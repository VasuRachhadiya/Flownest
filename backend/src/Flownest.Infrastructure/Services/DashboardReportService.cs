using System.Text;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.DTOs.Finance;
using Flownest.Application.DTOs.Workspace;
using Flownest.Application.Interfaces;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

public sealed class DashboardReportService : IDashboardReportService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;

    public DashboardReportService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
    }

    public async Task<DashboardOverviewDto> GetDashboardAsync(DashboardQuery query, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        var (fromUtc, toUtc) = ResolveDateRange(query.Period, query.FromUtc, query.ToUtc);

        var payments = await _db.Payments.AsNoTracking()
            .Where(p => p.PaymentDateUtc >= fromUtc && p.PaymentDateUtc <= toUtc)
            .Select(p => new { p.Amount, p.PaymentDateUtc })
            .ToListAsync(ct);

        var expenses = await _db.Expenses.AsNoTracking()
            .Where(e => e.ExpenseDateUtc >= fromUtc && e.ExpenseDateUtc <= toUtc)
            .Select(e => new { e.Amount, e.ExpenseDateUtc })
            .ToListAsync(ct);

        var invoices = await _db.Invoices.AsNoTracking()
            .Include(i => i.Customer)
            .ToListAsync(ct);

        var projects = await _db.Projects.AsNoTracking().ToListAsync(ct);
        var tasks = await _db.WorkTasks.AsNoTracking().Include(t => t.Project).Include(t => t.Assignees).ToListAsync(ct);
        var totalCustomers = await _db.Customers.AsNoTracking().CountAsync(ct);
        var newLeads = await _db.Leads.AsNoTracking().CountAsync(l => l.Stage == LeadStage.New || l.Stage == LeadStage.Contacted, ct);

        var totalRevenue = payments.Sum(p => p.Amount);
        var totalExpenses = expenses.Sum(e => e.Amount);
        var outstandingInvoices = invoices
            .Where(i => i.Status != InvoiceStatus.Cancelled && i.Status != InvoiceStatus.Draft && i.TotalAmount > i.PaidAmount)
            .Sum(i => i.TotalAmount - i.PaidAmount);

        var series = BuildMonthlyFinancialSeries(fromUtc, toUtc,
            payments.Select(p => (p.PaymentDateUtc, p.Amount)),
            expenses.Select(e => (e.ExpenseDateUtc, e.Amount)));

        var projectStatusSeries = Enum.GetValues<ProjectStatus>()
            .Select(s => new StatusCountDto(s.ToString(), projects.Count(p => p.Status == s)))
            .Where(x => x.Count > 0)
            .ToList();

        var members = await _db.OrganizationMembers.AsNoTracking().Where(m => m.OrganizationId == orgId && m.IsActive).ToListAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(members.Select(m => m.UserId), ct);
        var projMembers = await _db.ProjectMembers.AsNoTracking().Include(pm => pm.Project).ToListAsync(ct);

        var teamWorkload = members.Select(m =>
        {
            var name = users.TryGetValue(m.UserId, out var u) ? u.FullName : "Member";
            var userTasks = tasks.Where(t => t.Assignees.Any(a => a.UserId == m.UserId)).ToList();
            var activeProjs = projMembers.Count(pm => pm.UserId == m.UserId && pm.Project.Status == ProjectStatus.Active);
            return new TeamWorkloadDto(
                m.UserId,
                name,
                userTasks.Count(t => t.Status != WorkTaskStatus.Completed),
                userTasks.Count(t => t.Status == WorkTaskStatus.Completed),
                activeProjs);
        }).ToList();

        var recentActivities = await _db.ActivityLogs.AsNoTracking()
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(10)
            .Select(a => new ActivityItemDto(a.Id, a.ActorName, a.EntityType, a.EntityId, a.Action, a.Summary, a.CreatedAtUtc))
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var deadlines = tasks
            .Where(t => t.Status != WorkTaskStatus.Completed && t.DueDateUtc.HasValue)
            .OrderBy(t => t.DueDateUtc)
            .Take(6)
            .Select(t => new UpcomingDeadlineDto(t.Id, t.Title, "Task", t.DueDateUtc!.Value, t.Status.ToString()))
            .Concat(projects.Where(p => p.Status == ProjectStatus.Active && p.DueDateUtc.HasValue)
                .OrderBy(p => p.DueDateUtc).Take(4)
                .Select(p => new UpcomingDeadlineDto(p.Id, p.Name, "Project", p.DueDateUtc!.Value, p.Status.ToString())))
            .OrderBy(d => d.DueDateUtc)
            .Take(8)
            .ToList();

        var recentInvoices = invoices
            .OrderByDescending(i => i.IssueDateUtc)
            .Take(6)
            .Select(i => new DashboardInvoiceDto(i.Id, i.InvoiceNumber, i.Customer.Name, i.TotalAmount, Math.Max(0, i.TotalAmount - i.PaidAmount), i.Status, i.DueDateUtc))
            .ToList();

        var myTasks = tasks
            .Where(t => t.Assignees.Any(a => a.UserId == userId) && t.Status != WorkTaskStatus.Completed)
            .OrderBy(t => t.DueDateUtc ?? DateTime.MaxValue)
            .Take(8)
            .Select(t => new DashboardTaskDto(t.Id, t.Title, t.Project?.Name, t.Priority, t.Status, t.DueDateUtc))
            .ToList();

        var alerts = new List<DashboardAlertDto>();
        var overdueInvoiceCount = invoices.Count(i => i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Cancelled && i.Status != InvoiceStatus.Draft && i.DueDateUtc < now);
        if (overdueInvoiceCount > 0)
        {
            alerts.Add(new DashboardAlertDto("critical", $"{overdueInvoiceCount} overdue invoice(s)", "Follow up on past-due customer balances.", "/invoices"));
        }
        var overdueTaskCount = tasks.Count(t => t.Status != WorkTaskStatus.Completed && t.DueDateUtc < now);
        if (overdueTaskCount > 0)
        {
            alerts.Add(new DashboardAlertDto("warning", $"{overdueTaskCount} overdue task(s)", "Review tasks past their target due date.", "/tasks"));
        }

        var isEmpty = totalCustomers == 0 && projects.Count == 0 && invoices.Count == 0 && tasks.Count == 0;

        return new DashboardOverviewDto(
            totalRevenue,
            outstandingInvoices,
            totalExpenses,
            totalRevenue - totalExpenses,
            projects.Count(p => p.Status == ProjectStatus.Active),
            tasks.Count(t => t.Status != WorkTaskStatus.Completed),
            tasks.Count(t => t.Status == WorkTaskStatus.Completed),
            totalCustomers,
            newLeads,
            series,
            projectStatusSeries,
            teamWorkload,
            recentActivities,
            deadlines,
            recentInvoices,
            myTasks,
            alerts,
            isEmpty);
    }

    public async Task<ReportsOverviewDto> GetReportsAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var start = fromUtc ?? new DateTime(DateTime.UtcNow.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = toUtc ?? DateTime.UtcNow;

        var payments = await _db.Payments.AsNoTracking().Where(p => p.PaymentDateUtc >= start && p.PaymentDateUtc <= end).ToListAsync(ct);
        var expenses = await _db.Expenses.AsNoTracking().Where(e => e.ExpenseDateUtc >= start && e.ExpenseDateUtc <= end).ToListAsync(ct);
        var invoices = await _db.Invoices.AsNoTracking().Include(i => i.Customer).ToListAsync(ct);
        var customers = await _db.Customers.AsNoTracking().Include(c => c.Projects).Include(c => c.Invoices).ToListAsync(ct);
        var projects = await _db.Projects.AsNoTracking().ToListAsync(ct);
        var tasks = await _db.WorkTasks.AsNoTracking().Include(t => t.Assignees).ToListAsync(ct);
        var billableMinutes = await _db.TimeEntries.AsNoTracking().Where(t => t.IsBillable && t.StartTimeUtc >= start && t.StartTimeUtc <= end).SumAsync(t => (int?)t.DurationMinutes, ct) ?? 0;

        var totalRev = payments.Sum(p => p.Amount);
        var totalExp = expenses.Sum(e => e.Amount);
        var totalBilled = invoices.Where(i => i.Status != InvoiceStatus.Cancelled).Sum(i => i.TotalAmount);
        var totalPaid = invoices.Where(i => i.Status != InvoiceStatus.Cancelled).Sum(i => i.PaidAmount);
        var collectionRate = totalBilled > 0 ? Math.Round(totalPaid * 100m / totalBilled, 1) : 0m;

        var members = await _db.OrganizationMembers.AsNoTracking().Where(m => m.OrganizationId == orgId && m.IsActive).ToListAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(members.Select(m => m.UserId), ct);
        var projMembers = await _db.ProjectMembers.AsNoTracking().Include(pm => pm.Project).ToListAsync(ct);

        var teamPerf = members.Select(m =>
        {
            var userTasks = tasks.Where(t => t.Assignees.Any(a => a.UserId == m.UserId)).ToList();
            return new TeamWorkloadDto(
                m.UserId,
                users.TryGetValue(m.UserId, out var u) ? u.FullName : "Member",
                userTasks.Count(t => t.Status != WorkTaskStatus.Completed),
                userTasks.Count(t => t.Status == WorkTaskStatus.Completed),
                projMembers.Count(pm => pm.UserId == m.UserId && pm.Project.Status == ProjectStatus.Active));
        }).ToList();

        var topCustomers = customers.Select(c => new CustomerRevenueRowDto(
            c.Id,
            c.Name,
            c.Company,
            c.Projects.Count(p => !p.IsDeleted),
            c.Invoices.Count(i => !i.IsDeleted && i.Status != InvoiceStatus.Cancelled),
            c.Invoices.Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Cancelled).Sum(i => i.TotalAmount),
            c.Invoices.Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Cancelled).Sum(i => i.PaidAmount)))
            .OrderByDescending(x => x.TotalBilled)
            .Take(15)
            .ToList();

        return new ReportsOverviewDto(
            totalRev,
            totalExp,
            totalRev - totalExp,
            collectionRate,
            customers.Count,
            projects.Count(p => p.Status == ProjectStatus.Active),
            tasks.Count(t => t.Status == WorkTaskStatus.Completed),
            Math.Round(billableMinutes / 60m, 1),
            BuildMonthlyFinancialSeries(start, end, payments.Select(p => (p.PaymentDateUtc, p.Amount)), expenses.Select(e => (e.ExpenseDateUtc, e.Amount))),
            expenses.GroupBy(e => e.Category.ToString()).Select(g => new CategoryBreakdownDto(g.Key, g.Sum(x => x.Amount))).OrderByDescending(x => x.Amount).ToList(),
            Enum.GetValues<ProjectStatus>().Select(s => new StatusCountDto(s.ToString(), projects.Count(p => p.Status == s))).Where(x => x.Count > 0).ToList(),
            Enum.GetValues<WorkTaskStatus>().Select(s => new StatusCountDto(s.ToString(), tasks.Count(t => t.Status == s))).Where(x => x.Count > 0).ToList(),
            Enum.GetValues<InvoiceStatus>().Select(s => new StatusCountDto(s.ToString(), invoices.Count(i => i.Status == s))).Where(x => x.Count > 0).ToList(),
            teamPerf,
            topCustomers);
    }

    public async Task<byte[]> ExportReportCsvAsync(string reportType, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default)
    {
        var reports = await GetReportsAsync(fromUtc, toUtc, ct);
        var sb = new StringBuilder();

        switch (reportType.ToLowerInvariant())
        {
            case "customers":
                sb.AppendLine("Customer,Company,Projects,Invoices,TotalBilled,TotalPaid");
                foreach (var c in reports.TopCustomers)
                    sb.AppendLine($"\"{Escape(c.Name)}\",\"{Escape(c.Company)}\",{c.ProjectCount},{c.InvoiceCount},{c.TotalBilled:F2},{c.TotalPaid:F2}");
                break;
            case "expenses":
                sb.AppendLine("Category,Amount");
                foreach (var e in reports.ExpensesByCategory)
                    sb.AppendLine($"\"{Escape(e.Category)}\",{e.Amount:F2}");
                break;
            case "team":
                sb.AppendLine("Member,ActiveProjects,PendingTasks,CompletedTasks");
                foreach (var m in reports.TeamPerformance)
                    sb.AppendLine($"\"{Escape(m.Name)}\",{m.ActiveProjects},{m.PendingTasks},{m.CompletedTasks}");
                break;
            default:
                sb.AppendLine("Month,Revenue,Expenses,NetProfit");
                foreach (var row in reports.MonthlyFinancials)
                    sb.AppendLine($"{row.Month},{row.Revenue:F2},{row.Expenses:F2},{row.Profit:F2}");
                break;
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<GlobalSearchResultDto> SearchAsync(string query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var term = (query ?? string.Empty).Trim().ToLower();
        if (term.Length < 2)
        {
            return new GlobalSearchResultDto(
                Array.Empty<GlobalSearchItemDto>(),
                Array.Empty<GlobalSearchItemDto>(),
                Array.Empty<GlobalSearchItemDto>(),
                Array.Empty<GlobalSearchItemDto>(),
                Array.Empty<GlobalSearchItemDto>());
        }

        var customers = await _db.Customers.AsNoTracking()
            .Where(c => c.Name.ToLower().Contains(term) || (c.Company != null && c.Company.ToLower().Contains(term)))
            .Take(5)
            .Select(c => new GlobalSearchItemDto(c.Id, c.Name, c.Company ?? c.Email, "Customer", $"/customers/{c.Id}"))
            .ToListAsync(ct);

        var leads = await _db.Leads.AsNoTracking()
            .Where(l => l.Name.ToLower().Contains(term) || (l.Company != null && l.Company.ToLower().Contains(term)))
            .Take(5)
            .Select(l => new GlobalSearchItemDto(l.Id, l.Name, l.Stage.ToString(), "Lead", "/leads"))
            .ToListAsync(ct);

        var projects = await _db.Projects.AsNoTracking()
            .Where(p => p.Name.ToLower().Contains(term) || (p.Code != null && p.Code.ToLower().Contains(term)))
            .Take(5)
            .Select(p => new GlobalSearchItemDto(p.Id, p.Name, p.Status.ToString(), "Project", $"/projects/{p.Id}"))
            .ToListAsync(ct);

        var tasks = await _db.WorkTasks.AsNoTracking()
            .Where(t => t.Title.ToLower().Contains(term))
            .Take(5)
            .Select(t => new GlobalSearchItemDto(t.Id, t.Title, t.Status.ToString(), "Task", "/tasks"))
            .ToListAsync(ct);

        var invoices = await _db.Invoices.AsNoTracking()
            .Include(i => i.Customer)
            .Where(i => i.InvoiceNumber.ToLower().Contains(term) || i.Customer.Name.ToLower().Contains(term))
            .Take(5)
            .Select(i => new GlobalSearchItemDto(i.Id, i.InvoiceNumber, $"{i.Customer.Name} · {i.Status}", "Invoice", $"/invoices/{i.Id}"))
            .ToListAsync(ct);

        return new GlobalSearchResultDto(customers, leads, projects, tasks, invoices);
    }

    private static (DateTime From, DateTime To) ResolveDateRange(string period, DateTime? customFrom, DateTime? customTo)
    {
        var now = DateTime.UtcNow;
        return period.ToLowerInvariant() switch
        {
            "month" => (new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc), now),
            "quarter" => (new DateTime(now.Year, ((now.Month - 1) / 3) * 3 + 1, 1, 0, 0, 0, DateTimeKind.Utc), now),
            "custom" when customFrom.HasValue && customTo.HasValue => (customFrom.Value, customTo.Value),
            _ => (now.AddMonths(-11).Date.AddDays(1 - now.Day), now)
        };
    }

    private static IReadOnlyList<MonthlySeriesPointDto> BuildMonthlyFinancialSeries(
        DateTime fromUtc,
        DateTime toUtc,
        IEnumerable<(DateTime Date, decimal Amount)> revenues,
        IEnumerable<(DateTime Date, decimal Amount)> expenses)
    {
        var revMap = revenues.GroupBy(r => $"{r.Date:yyyy-MM}").ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));
        var expMap = expenses.GroupBy(e => $"{e.Date:yyyy-MM}").ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var result = new List<MonthlySeriesPointDto>();
        var cursor = new DateTime(fromUtc.Year, fromUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var limit = new DateTime(toUtc.Year, toUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        while (cursor <= limit)
        {
            var key = $"{cursor:yyyy-MM}";
            var rev = revMap.GetValueOrDefault(key);
            var exp = expMap.GetValueOrDefault(key);
            result.Add(new MonthlySeriesPointDto(cursor.ToString("MMM yy"), rev, exp, rev - exp));
            cursor = cursor.AddMonths(1);
        }

        return result;
    }

    private static string Escape(string? val) => (val ?? string.Empty).Replace("\"", "\"\"");
}
