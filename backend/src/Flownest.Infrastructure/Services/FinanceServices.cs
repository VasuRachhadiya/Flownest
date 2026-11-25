using Flownest.Application.Common;
using Flownest.Application.DTOs.Finance;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

public sealed class InvoiceService : IInvoiceService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IActivityRecorder _activity;

    public InvoiceService(AppDbContext db, ICurrentUserService currentUser, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _activity = activity;
    }

    public async Task<PagedResult<InvoiceDto>> GetAllAsync(InvoiceQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Invoices.AsNoTracking()
            .Include(i => i.Customer)
            .Include(i => i.Project)
            .Include(i => i.Items)
            .Include(i => i.Payments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(i => i.InvoiceNumber.ToLower().Contains(term) || i.Customer.Name.ToLower().Contains(term));
        }

        if (query.Status.HasValue) q = q.Where(i => i.Status == query.Status.Value);
        if (query.CustomerId.HasValue) q = q.Where(i => i.CustomerId == query.CustomerId.Value);

        q = q.OrderByDescending(i => i.IssueDateUtc).ThenByDescending(i => i.CreatedAtUtc);
        return await QueryHelper.ToPagedResultAsync(q, query, ToDto, ct);
    }

    public async Task<InvoiceDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var inv = await _db.Invoices.AsNoTracking()
            .Include(i => i.Customer)
            .Include(i => i.Project)
            .Include(i => i.Items)
            .Include(i => i.Payments)
            .FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException("Invoice not found.");

        return ToDto(inv);
    }

    public async Task<InvoiceDto> CreateAsync(UpsertInvoiceRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);

        var customerExists = await _db.Customers.AnyAsync(c => c.Id == request.CustomerId, ct);
        if (!customerExists) throw new NotFoundException("Customer not found.");

        if (request.Items is null || request.Items.Count == 0)
        {
            throw new DomainException("At least one line item is required.");
        }

        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct)
            ?? throw new NotFoundException("Organization not found.");

        var seq = org.NextInvoiceSequence++;
        var invoiceNumber = $"INV-{DateTime.UtcNow:yyyy}-{seq:D4}";

        var invoice = new Invoice
        {
            OrganizationId = orgId,
            InvoiceNumber = invoiceNumber,
            CustomerId = request.CustomerId,
            ProjectId = request.ProjectId,
            Status = InvoiceStatus.Draft,
            IssueDateUtc = request.IssueDateUtc,
            DueDateUtc = request.DueDateUtc,
            TaxRatePercent = Math.Max(0, request.TaxRatePercent),
            DiscountAmount = Math.Max(0, request.DiscountAmount),
            Notes = request.Notes?.Trim(),
            Terms = request.Terms?.Trim()
        };

        ApplyBackendCalculations(invoice, request.Items, orgId);

        _db.Invoices.Add(invoice);
        await _activity.LogAsync("Invoice", invoice.Id, "Created", $"Created invoice {invoice.InvoiceNumber} ({invoice.TotalAmount:C})", customerId: invoice.CustomerId, projectId: invoice.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(invoice.Id, ct);
    }

    public async Task<InvoiceDto> UpdateAsync(Guid id, UpsertInvoiceRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);

        var invoice = await _db.Invoices.Include(i => i.Items).FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException("Invoice not found.");

        if (invoice.Status is InvoiceStatus.Paid or InvoiceStatus.Cancelled)
        {
            throw new DomainException("Paid or cancelled invoices cannot be edited.");
        }

        if (request.Items is null || request.Items.Count == 0)
        {
            throw new DomainException("At least one line item is required.");
        }

        invoice.CustomerId = request.CustomerId;
        invoice.ProjectId = request.ProjectId;
        invoice.IssueDateUtc = request.IssueDateUtc;
        invoice.DueDateUtc = request.DueDateUtc;
        invoice.TaxRatePercent = Math.Max(0, request.TaxRatePercent);
        invoice.DiscountAmount = Math.Max(0, request.DiscountAmount);
        invoice.Notes = request.Notes?.Trim();
        invoice.Terms = request.Terms?.Trim();

        _db.InvoiceItems.RemoveRange(invoice.Items);
        invoice.Items.Clear();

        ApplyBackendCalculations(invoice, request.Items, orgId);
        RecalculatePaymentStatus(invoice);

        await _activity.LogAsync("Invoice", invoice.Id, "Updated", $"Updated invoice {invoice.InvoiceNumber}", customerId: invoice.CustomerId, projectId: invoice.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(invoice.Id, ct);
    }

    public async Task<InvoiceDto> UpdateStatusAsync(Guid id, InvoiceStatus status, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException("Invoice not found.");

        if (invoice.PaidAmount > 0 && status == InvoiceStatus.Draft)
        {
            throw new DomainException("Cannot revert an invoice with recorded payments back to Draft.");
        }

        invoice.Status = status;
        await _activity.LogAsync("Invoice", invoice.Id, "StatusChanged", $"Invoice {invoice.InvoiceNumber} marked as {status}", customerId: invoice.CustomerId, projectId: invoice.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(invoice.Id, ct);
    }

    public async Task DeleteDraftAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var invoice = await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id, ct)
            ?? throw new NotFoundException("Invoice not found.");

        if (invoice.Status != InvoiceStatus.Draft || invoice.PaidAmount > 0)
        {
            throw new DomainException("Only draft invoices without payments can be deleted.");
        }

        invoice.IsDeleted = true;
        invoice.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private static void ApplyBackendCalculations(Invoice invoice, IReadOnlyList<UpsertInvoiceItemRequest> items, Guid orgId)
    {
        decimal subtotal = 0m;
        decimal lineTaxTotal = 0m;
        int order = 0;

        foreach (var itemReq in items)
        {
            if (string.IsNullOrWhiteSpace(itemReq.Description))
                throw new DomainException("Invoice item description is required.");
            if (itemReq.Quantity <= 0 || itemReq.UnitPrice < 0)
                throw new DomainException("Invoice item quantity must be positive and unit price cannot be negative.");

            var baseLine = Math.Round(itemReq.Quantity * itemReq.UnitPrice, 2, MidpointRounding.AwayFromZero);
            var itemTax = Math.Round(baseLine * (Math.Max(0, itemReq.TaxPercent) / 100m), 2, MidpointRounding.AwayFromZero);
            var lineTotal = baseLine + itemTax;

            subtotal += baseLine;
            lineTaxTotal += itemTax;

            invoice.Items.Add(new InvoiceItem
            {
                OrganizationId = orgId,
                InvoiceId = invoice.Id,
                Description = itemReq.Description.Trim(),
                Quantity = itemReq.Quantity,
                UnitPrice = itemReq.UnitPrice,
                TaxPercent = Math.Max(0, itemReq.TaxPercent),
                LineTotal = lineTotal,
                SortOrder = order++
            });
        }

        var invoiceLevelTax = Math.Round(subtotal * (invoice.TaxRatePercent / 100m), 2, MidpointRounding.AwayFromZero);
        invoice.Subtotal = subtotal;
        invoice.TaxAmount = lineTaxTotal + invoiceLevelTax;
        invoice.TotalAmount = Math.Max(0m, subtotal + invoice.TaxAmount - invoice.DiscountAmount);
    }

    internal static void RecalculatePaymentStatus(Invoice invoice)
    {
        if (invoice.Status == InvoiceStatus.Cancelled) return;

        if (invoice.PaidAmount >= invoice.TotalAmount && invoice.TotalAmount > 0)
        {
            invoice.Status = InvoiceStatus.Paid;
        }
        else if (invoice.PaidAmount > 0)
        {
            invoice.Status = InvoiceStatus.PartiallyPaid;
        }
        else if (invoice.Status != InvoiceStatus.Draft && invoice.DueDateUtc < DateTime.UtcNow)
        {
            invoice.Status = InvoiceStatus.Overdue;
        }
    }

    private static InvoiceDto ToDto(Invoice i) =>
        new(
            i.Id, i.InvoiceNumber, i.CustomerId, i.Customer.Name, i.Customer.Company, i.Customer.Email, i.Customer.Address,
            i.ProjectId, i.Project?.Name, i.Status, i.IssueDateUtc, i.DueDateUtc,
            i.Subtotal, i.TaxRatePercent, i.TaxAmount, i.DiscountAmount, i.TotalAmount, i.PaidAmount,
            Math.Max(0m, i.TotalAmount - i.PaidAmount), i.Notes, i.Terms,
            i.Items.OrderBy(x => x.SortOrder).Select(x => new InvoiceItemDto(x.Id, x.Description, x.Quantity, x.UnitPrice, x.TaxPercent, x.LineTotal)).ToList(),
            i.Payments.Where(p => !p.IsDeleted).OrderByDescending(p => p.PaymentDateUtc).Select(p => new InvoicePaymentSummaryDto(p.Id, p.Amount, p.PaymentDateUtc, p.PaymentMethod, p.ReferenceNumber, p.Notes)).ToList(),
            i.CreatedAtUtc);
}

public sealed class PaymentService : IPaymentService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IActivityRecorder _activity;

    public PaymentService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _activity = activity;
    }

    public async Task<PagedResult<PaymentDto>> GetAllAsync(PaymentQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Payments.AsNoTracking()
            .Include(p => p.Invoice).ThenInclude(i => i.Customer)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(p =>
                p.Invoice.InvoiceNumber.ToLower().Contains(term) ||
                p.Invoice.Customer.Name.ToLower().Contains(term) ||
                (p.ReferenceNumber != null && p.ReferenceNumber.ToLower().Contains(term)));
        }

        if (query.PaymentMethod.HasValue) q = q.Where(p => p.PaymentMethod == query.PaymentMethod.Value);
        if (query.InvoiceId.HasValue) q = q.Where(p => p.InvoiceId == query.InvoiceId.Value);

        q = q.OrderByDescending(p => p.PaymentDateUtc);
        var total = await q.CountAsync(ct);
        var rows = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);

        var users = await _identity.GetUsersByIdsAsync(rows.Select(r => r.RecordedByUserId), ct);

        return new PagedResult<PaymentDto>
        {
            Items = rows.Select(p => new PaymentDto(
                p.Id, p.InvoiceId, p.Invoice.InvoiceNumber, p.Invoice.Customer.Name,
                p.Amount, p.PaymentDateUtc, p.PaymentMethod, p.ReferenceNumber, p.Notes,
                users.TryGetValue(p.RecordedByUserId, out var u) ? u.FullName : "Team Member",
                p.CreatedAtUtc)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<PaymentSummaryDto> GetSummaryAsync(CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var totalReceived = await _db.Payments.AsNoTracking().SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var paymentCount = await _db.Payments.AsNoTracking().CountAsync(ct);
        var pending = await _db.Invoices.AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Cancelled && i.Status != InvoiceStatus.Draft && i.TotalAmount > i.PaidAmount)
            .SumAsync(i => (decimal?)(i.TotalAmount - i.PaidAmount), ct) ?? 0m;

        return new PaymentSummaryDto(totalReceived, pending, paymentCount);
    }

    public async Task<PaymentDto> RecordPaymentAsync(RecordPaymentRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var actorId = _currentUser.RequireUserId();
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);

        if (request.Amount <= 0) throw new DomainException("Payment amount must be greater than zero.");

        var invoice = await _db.Invoices.Include(i => i.Customer)
            .FirstOrDefaultAsync(i => i.Id == request.InvoiceId, ct)
            ?? throw new NotFoundException("Invoice not found.");

        if (invoice.Status == InvoiceStatus.Cancelled)
        {
            throw new DomainException("Cannot record payment for a cancelled invoice.");
        }

        var remaining = invoice.TotalAmount - invoice.PaidAmount;
        if (request.Amount > remaining)
        {
            throw new DomainException($"Payment amount exceeds remaining invoice balance ({remaining:C}).");
        }

        var payment = new Payment
        {
            OrganizationId = orgId,
            InvoiceId = invoice.Id,
            Amount = request.Amount,
            PaymentDateUtc = request.PaymentDateUtc,
            PaymentMethod = request.PaymentMethod,
            ReferenceNumber = request.ReferenceNumber?.Trim(),
            Notes = request.Notes?.Trim(),
            RecordedByUserId = actorId
        };

        _db.Payments.Add(payment);
        invoice.PaidAmount += request.Amount;
        InvoiceService.RecalculatePaymentStatus(invoice);

        await _activity.LogAsync("Payment", payment.Id, "Recorded", $"Recorded {payment.Amount:C} payment for {invoice.InvoiceNumber}", customerId: invoice.CustomerId, projectId: invoice.ProjectId, ct: ct);
        await _activity.NotifyAsync(actorId, NotificationType.PaymentRecorded, "Payment recorded", $"Payment of {payment.Amount:C} applied to {invoice.InvoiceNumber}.", "Invoice", invoice.Id, "/payments", ct);
        await _db.SaveChangesAsync(ct);

        var users = await _identity.GetUsersByIdsAsync(new[] { actorId }, ct);
        return new PaymentDto(
            payment.Id, payment.InvoiceId, invoice.InvoiceNumber, invoice.Customer.Name,
            payment.Amount, payment.PaymentDateUtc, payment.PaymentMethod, payment.ReferenceNumber,
            payment.Notes, users.TryGetValue(actorId, out var u) ? u.FullName : "Team Member", payment.CreatedAtUtc);
    }
}

public sealed class ExpenseService : IExpenseService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IActivityRecorder _activity;

    public ExpenseService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _activity = activity;
    }

    public async Task<PagedResult<ExpenseDto>> GetAllAsync(ExpenseQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Expenses.AsNoTracking()
            .Include(e => e.Project)
            .Include(e => e.ReceiptDocument)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(e => e.Vendor.ToLower().Contains(term) || (e.Description != null && e.Description.ToLower().Contains(term)));
        }

        if (query.Category.HasValue) q = q.Where(e => e.Category == query.Category.Value);
        if (query.ProjectId.HasValue) q = q.Where(e => e.ProjectId == query.ProjectId.Value);
        if (query.FromUtc.HasValue) q = q.Where(e => e.ExpenseDateUtc >= query.FromUtc.Value);
        if (query.ToUtc.HasValue) q = q.Where(e => e.ExpenseDateUtc <= query.ToUtc.Value);

        q = q.OrderByDescending(e => e.ExpenseDateUtc);
        var total = await q.CountAsync(ct);
        var rows = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(rows.Select(r => r.RecordedByUserId), ct);

        return new PagedResult<ExpenseDto>
        {
            Items = rows.Select(e => ToDto(e, users)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<ExpenseAnalyticsDto> GetAnalyticsAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Expenses.AsNoTracking().AsQueryable();
        if (fromUtc.HasValue) q = q.Where(e => e.ExpenseDateUtc >= fromUtc.Value);
        if (toUtc.HasValue) q = q.Where(e => e.ExpenseDateUtc <= toUtc.Value);

        var list = await q.Select(e => new { e.Category, e.Amount, e.ExpenseDateUtc }).ToListAsync(ct);
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var total = list.Sum(x => x.Amount);
        var currentMonth = list.Where(x => x.ExpenseDateUtc >= monthStart).Sum(x => x.Amount);

        var byCategory = list.GroupBy(x => x.Category.ToString())
            .Select(g => new CategoryBreakdownDto(g.Key, g.Sum(x => x.Amount)))
            .OrderByDescending(x => x.Amount)
            .ToList();

        var trend = list
            .GroupBy(x => new { x.ExpenseDateUtc.Year, x.ExpenseDateUtc.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new MonthlySeriesPointDto(
                $"{g.Key.Year}-{g.Key.Month:D2}",
                0m,
                g.Sum(x => x.Amount),
                0m))
            .ToList();

        return new ExpenseAnalyticsDto(total, currentMonth, byCategory, trend);
    }

    public async Task<ExpenseDto> CreateAsync(UpsertExpenseRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var actorId = _currentUser.RequireUserId();
        if (string.IsNullOrWhiteSpace(request.Vendor)) throw new DomainException("Vendor is required.");
        if (request.Amount <= 0) throw new DomainException("Expense amount must be greater than zero.");

        var entity = new Expense
        {
            OrganizationId = orgId,
            Category = request.Category,
            Amount = request.Amount,
            ExpenseDateUtc = request.ExpenseDateUtc,
            Vendor = request.Vendor.Trim(),
            Description = request.Description?.Trim(),
            PaymentMethod = request.PaymentMethod,
            ProjectId = request.ProjectId,
            ReceiptDocumentId = request.ReceiptDocumentId,
            RecordedByUserId = actorId
        };

        _db.Expenses.Add(entity);
        await _activity.LogAsync("Expense", entity.Id, "Created", $"Recorded {entity.Amount:C} expense to {entity.Vendor}", projectId: entity.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        var loaded = await _db.Expenses.AsNoTracking().Include(e => e.Project).Include(e => e.ReceiptDocument).FirstAsync(e => e.Id == entity.Id, ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { actorId }, ct);
        return ToDto(loaded, users);
    }

    public async Task<ExpenseDto> UpdateAsync(Guid id, UpsertExpenseRequest request, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Vendor)) throw new DomainException("Vendor is required.");
        if (request.Amount <= 0) throw new DomainException("Expense amount must be greater than zero.");

        var entity = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new NotFoundException("Expense not found.");

        entity.Category = request.Category;
        entity.Amount = request.Amount;
        entity.ExpenseDateUtc = request.ExpenseDateUtc;
        entity.Vendor = request.Vendor.Trim();
        entity.Description = request.Description?.Trim();
        entity.PaymentMethod = request.PaymentMethod;
        entity.ProjectId = request.ProjectId;
        entity.ReceiptDocumentId = request.ReceiptDocumentId;

        await _db.SaveChangesAsync(ct);

        var loaded = await _db.Expenses.AsNoTracking().Include(e => e.Project).Include(e => e.ReceiptDocument).FirstAsync(e => e.Id == id, ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { loaded.RecordedByUserId }, ct);
        return ToDto(loaded, users);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var entity = await _db.Expenses.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new NotFoundException("Expense not found.");

        entity.IsDeleted = true;
        entity.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private static ExpenseDto ToDto(Expense e, Dictionary<Guid, Application.DTOs.Auth.UserSummaryDto> users) =>
        new(
            e.Id, e.Category, e.Amount, e.ExpenseDateUtc, e.Vendor, e.Description,
            e.PaymentMethod, e.ProjectId, e.Project?.Name, e.ReceiptDocumentId,
            e.ReceiptDocument?.FileName,
            users.TryGetValue(e.RecordedByUserId, out var u) ? u.FullName : "Team Member",
            e.CreatedAtUtc);
}
