using Flownest.Application.Common;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

public sealed class CustomerService : ICustomerService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IActivityRecorder _activity;

    public CustomerService(AppDbContext db, ICurrentUserService currentUser, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _activity = activity;
    }

    public async Task<PagedResult<CustomerDto>> GetAllAsync(CustomerQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Customers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(c =>
                c.Name.ToLower().Contains(term) ||
                (c.Company != null && c.Company.ToLower().Contains(term)) ||
                (c.Email != null && c.Email.ToLower().Contains(term)) ||
                (c.Tags != null && c.Tags.ToLower().Contains(term)));
        }

        if (query.Status.HasValue) q = q.Where(c => c.Status == query.Status.Value);
        if (query.CustomerType.HasValue) q = q.Where(c => c.CustomerType == query.CustomerType.Value);

        q = query.SortBy?.ToLowerInvariant() switch
        {
            "name" => query.SortDesc ? q.OrderByDescending(c => c.Name) : q.OrderBy(c => c.Name),
            "company" => query.SortDesc ? q.OrderByDescending(c => c.Company) : q.OrderBy(c => c.Company),
            _ => query.SortDesc ? q.OrderByDescending(c => c.CreatedAtUtc) : q.OrderBy(c => c.CreatedAtUtc)
        };

        var total = await q.CountAsync(ct);
        var rows = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize)
            .Select(c => new
            {
                Customer = c,
                ProjectCount = c.Projects.Count(p => !p.IsDeleted),
                InvoiceCount = c.Invoices.Count(i => !i.IsDeleted),
                TotalBilled = c.Invoices.Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Cancelled).Sum(i => (decimal?)i.TotalAmount) ?? 0m
            })
            .ToListAsync(ct);

        return new PagedResult<CustomerDto>
        {
            Items = rows.Select(r => ToDto(r.Customer, r.ProjectCount, r.InvoiceCount, r.TotalBilled)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<CustomerDetailDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var c = await _db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("Customer not found.");

        var projects = await _db.Projects.AsNoTracking()
            .Where(p => p.CustomerId == id)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Select(p => new CustomerProjectSummaryDto(p.Id, p.Name, p.Status, p.Priority, p.DueDateUtc, p.ProgressPercent, p.Budget))
            .ToListAsync(ct);

        var invoices = await _db.Invoices.AsNoTracking()
            .Where(i => i.CustomerId == id)
            .OrderByDescending(i => i.IssueDateUtc)
            .Select(i => new CustomerInvoiceSummaryDto(i.Id, i.InvoiceNumber, i.Status, i.IssueDateUtc, i.DueDateUtc, i.TotalAmount, i.PaidAmount))
            .ToListAsync(ct);

        var activities = await _db.ActivityLogs.AsNoTracking()
            .Where(a => a.CustomerId == id || (a.EntityType == "Customer" && a.EntityId == id))
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(30)
            .Select(a => new ActivityItemDto(a.Id, a.ActorName, a.EntityType, a.EntityId, a.Action, a.Summary, a.CreatedAtUtc))
            .ToListAsync(ct);

        var totalBilled = invoices.Where(i => i.Status != InvoiceStatus.Cancelled).Sum(i => i.TotalAmount);
        return new CustomerDetailDto(ToDto(c, projects.Count, invoices.Count, totalBilled), projects, invoices, activities);
    }

    public async Task<CustomerDto> CreateAsync(UpsertCustomerRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Name)) throw new DomainException("Customer name is required.");

        var entity = new Customer
        {
            OrganizationId = orgId,
            Name = request.Name.Trim(),
            Company = request.Company?.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            Address = request.Address?.Trim(),
            Website = request.Website?.Trim(),
            CustomerType = request.CustomerType,
            Status = request.Status,
            Source = request.Source?.Trim(),
            Notes = request.Notes?.Trim(),
            Tags = QueryHelper.JoinTags(request.Tags)
        };

        _db.Customers.Add(entity);
        await _activity.LogAsync("Customer", entity.Id, "Created", $"Added customer {entity.Name}", customerId: entity.Id, ct: ct);
        await _db.SaveChangesAsync(ct);

        return ToDto(entity, 0, 0, 0m);
    }

    public async Task<CustomerDto> UpdateAsync(Guid id, UpsertCustomerRequest request, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Name)) throw new DomainException("Customer name is required.");

        var entity = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Customer not found.");

        entity.Name = request.Name.Trim();
        entity.Company = request.Company?.Trim();
        entity.Email = request.Email?.Trim();
        entity.Phone = request.Phone?.Trim();
        entity.Address = request.Address?.Trim();
        entity.Website = request.Website?.Trim();
        entity.CustomerType = request.CustomerType;
        entity.Status = request.Status;
        entity.Source = request.Source?.Trim();
        entity.Notes = request.Notes?.Trim();
        entity.Tags = QueryHelper.JoinTags(request.Tags);

        await _activity.LogAsync("Customer", entity.Id, "Updated", $"Updated customer {entity.Name}", customerId: entity.Id, ct: ct);
        await _db.SaveChangesAsync(ct);

        var stats = await _db.Customers.AsNoTracking().Where(c => c.Id == id)
            .Select(c => new
            {
                ProjectCount = c.Projects.Count(p => !p.IsDeleted),
                InvoiceCount = c.Invoices.Count(i => !i.IsDeleted),
                TotalBilled = c.Invoices.Where(i => !i.IsDeleted && i.Status != InvoiceStatus.Cancelled).Sum(i => (decimal?)i.TotalAmount) ?? 0m
            })
            .FirstAsync(ct);

        return ToDto(entity, stats.ProjectCount, stats.InvoiceCount, stats.TotalBilled);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var entity = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Customer not found.");

        entity.IsDeleted = true;
        entity.DeletedAtUtc = DateTime.UtcNow;
        await _activity.LogAsync("Customer", entity.Id, "Deleted", $"Archived/deleted customer {entity.Name}", customerId: entity.Id, ct: ct);
        await _db.SaveChangesAsync(ct);
    }

    private static CustomerDto ToDto(Customer c, int projectCount, int invoiceCount, decimal totalBilled) =>
        new(c.Id, c.Name, c.Company, c.Email, c.Phone, c.Address, c.Website,
            c.CustomerType, c.Status, c.Source, c.Notes, QueryHelper.SplitTags(c.Tags),
            projectCount, invoiceCount, totalBilled, c.CreatedAtUtc, c.UpdatedAtUtc);
}

public sealed class LeadService : ILeadService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IActivityRecorder _activity;

    public LeadService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _activity = activity;
    }

    public async Task<PagedResult<LeadDto>> GetAllAsync(LeadQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Leads.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(l =>
                l.Name.ToLower().Contains(term) ||
                (l.Company != null && l.Company.ToLower().Contains(term)) ||
                (l.Email != null && l.Email.ToLower().Contains(term)));
        }

        if (query.Stage.HasValue) q = q.Where(l => l.Stage == query.Stage.Value);
        if (query.AssignedToUserId.HasValue) q = q.Where(l => l.AssignedToUserId == query.AssignedToUserId.Value);

        q = q.OrderByDescending(l => l.UpdatedAtUtc);
        var total = await q.CountAsync(ct);
        var items = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);

        var userIds = items.Where(l => l.AssignedToUserId.HasValue).Select(l => l.AssignedToUserId!.Value).Distinct();
        var users = await _identity.GetUsersByIdsAsync(userIds, ct);

        return new PagedResult<LeadDto>
        {
            Items = items.Select(l => ToDto(l, users)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<LeadPipelineStatsDto> GetPipelineStatsAsync(CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var leads = await _db.Leads.AsNoTracking().Select(l => new { l.Stage, l.ExpectedValue }).ToListAsync(ct);

        var countByStage = Enum.GetValues<LeadStage>().ToDictionary(s => s.ToString(), _ => 0);
        var valueByStage = Enum.GetValues<LeadStage>().ToDictionary(s => s.ToString(), _ => 0m);

        decimal totalPipeline = 0m;
        decimal weighted = 0m;
        int wonCount = 0;
        decimal wonValue = 0m;

        foreach (var l in leads)
        {
            var key = l.Stage.ToString();
            countByStage[key]++;
            valueByStage[key] += l.ExpectedValue;

            if (l.Stage != LeadStage.Lost) totalPipeline += l.ExpectedValue;
            if (l.Stage == LeadStage.Won)
            {
                wonCount++;
                wonValue += l.ExpectedValue;
            }

            var weight = l.Stage switch
            {
                LeadStage.New => 0.10m,
                LeadStage.Contacted => 0.20m,
                LeadStage.Qualified => 0.40m,
                LeadStage.Proposal => 0.65m,
                LeadStage.Negotiation => 0.85m,
                LeadStage.Won => 1.00m,
                _ => 0m
            };
            weighted += Math.Round(l.ExpectedValue * weight, 2);
        }

        return new LeadPipelineStatsDto(leads.Count, totalPipeline, weighted, wonCount, wonValue, countByStage, valueByStage);
    }

    public async Task<LeadDto> CreateAsync(UpsertLeadRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Name)) throw new DomainException("Lead name is required.");

        var entity = new Lead
        {
            OrganizationId = orgId,
            Name = request.Name.Trim(),
            Company = request.Company?.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            Source = request.Source?.Trim(),
            Stage = request.Stage,
            ExpectedValue = Math.Max(0, request.ExpectedValue),
            FollowUpDateUtc = request.FollowUpDateUtc,
            Notes = request.Notes?.Trim(),
            AssignedToUserId = request.AssignedToUserId
        };

        _db.Leads.Add(entity);
        await _activity.LogAsync("Lead", entity.Id, "Created", $"Created lead {entity.Name} ({entity.Stage})", ct: ct);
        await _db.SaveChangesAsync(ct);

        var users = entity.AssignedToUserId.HasValue
            ? await _identity.GetUsersByIdsAsync(new[] { entity.AssignedToUserId.Value }, ct)
            : new();
        return ToDto(entity, users);
    }

    public async Task<LeadDto> UpdateAsync(Guid id, UpsertLeadRequest request, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Name)) throw new DomainException("Lead name is required.");

        var entity = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundException("Lead not found.");

        entity.Name = request.Name.Trim();
        entity.Company = request.Company?.Trim();
        entity.Email = request.Email?.Trim();
        entity.Phone = request.Phone?.Trim();
        entity.Source = request.Source?.Trim();
        entity.Stage = request.Stage;
        entity.ExpectedValue = Math.Max(0, request.ExpectedValue);
        entity.FollowUpDateUtc = request.FollowUpDateUtc;
        entity.Notes = request.Notes?.Trim();
        entity.AssignedToUserId = request.AssignedToUserId;

        await _activity.LogAsync("Lead", entity.Id, "Updated", $"Updated lead {entity.Name}", ct: ct);
        await _db.SaveChangesAsync(ct);

        var users = entity.AssignedToUserId.HasValue
            ? await _identity.GetUsersByIdsAsync(new[] { entity.AssignedToUserId.Value }, ct)
            : new();
        return ToDto(entity, users);
    }

    public async Task<LeadDto> ChangeStageAsync(Guid id, LeadStage stage, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var entity = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundException("Lead not found.");

        entity.Stage = stage;
        await _activity.LogAsync("Lead", entity.Id, "StageChanged", $"Moved lead {entity.Name} to {stage}", ct: ct);
        await _db.SaveChangesAsync(ct);

        var users = entity.AssignedToUserId.HasValue
            ? await _identity.GetUsersByIdsAsync(new[] { entity.AssignedToUserId.Value }, ct)
            : new();
        return ToDto(entity, users);
    }

    public async Task<CustomerDto> ConvertToCustomerAsync(Guid id, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var lead = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundException("Lead not found.");

        if (lead.ConvertedCustomerId.HasValue)
        {
            throw new ConflictException("This lead has already been converted to a customer.");
        }

        var customer = new Customer
        {
            OrganizationId = orgId,
            Name = lead.Name,
            Company = lead.Company,
            Email = lead.Email,
            Phone = lead.Phone,
            CustomerType = string.IsNullOrWhiteSpace(lead.Company) ? CustomerType.Individual : CustomerType.Business,
            Status = CustomerStatus.Active,
            Source = lead.Source,
            Notes = lead.Notes,
            Tags = "Converted Lead"
        };

        _db.Customers.Add(customer);
        lead.Stage = LeadStage.Won;
        lead.ConvertedCustomerId = customer.Id;
        lead.ConvertedAtUtc = DateTime.UtcNow;

        await _activity.LogAsync("Lead", lead.Id, "Converted", $"Converted lead {lead.Name} to customer", customerId: customer.Id, ct: ct);
        await _db.SaveChangesAsync(ct);

        return new CustomerDto(
            customer.Id, customer.Name, customer.Company, customer.Email, customer.Phone,
            customer.Address, customer.Website, customer.CustomerType, customer.Status,
            customer.Source, customer.Notes, QueryHelper.SplitTags(customer.Tags),
            0, 0, 0m, customer.CreatedAtUtc, customer.UpdatedAtUtc);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var entity = await _db.Leads.FirstOrDefaultAsync(l => l.Id == id, ct)
            ?? throw new NotFoundException("Lead not found.");

        entity.IsDeleted = true;
        entity.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private static LeadDto ToDto(Lead l, Dictionary<Guid, Application.DTOs.Auth.UserSummaryDto> users)
    {
        string? assigneeName = null;
        if (l.AssignedToUserId.HasValue && users.TryGetValue(l.AssignedToUserId.Value, out var u))
        {
            assigneeName = u.FullName;
        }
        return new LeadDto(
            l.Id, l.Name, l.Company, l.Email, l.Phone, l.Source, l.Stage,
            l.ExpectedValue, l.FollowUpDateUtc, l.Notes, l.AssignedToUserId,
            assigneeName, l.ConvertedCustomerId, l.ConvertedAtUtc, l.CreatedAtUtc, l.UpdatedAtUtc);
    }
}
