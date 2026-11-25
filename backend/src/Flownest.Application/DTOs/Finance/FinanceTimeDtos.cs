using Flownest.Application.Common;
using Flownest.Domain.Enums;

namespace Flownest.Application.DTOs.Finance;

public sealed class InvoiceQuery : PagedQuery
{
    public InvoiceStatus? Status { get; set; }
    public Guid? CustomerId { get; set; }
}

public sealed record InvoiceItemDto(
    Guid Id,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxPercent,
    decimal LineTotal);

public sealed record InvoicePaymentSummaryDto(
    Guid Id,
    decimal Amount,
    DateTime PaymentDateUtc,
    PaymentMethod PaymentMethod,
    string? ReferenceNumber,
    string? Notes);

public sealed record InvoiceDto(
    Guid Id,
    string InvoiceNumber,
    Guid CustomerId,
    string CustomerName,
    string? CustomerCompany,
    string? CustomerEmail,
    string? CustomerAddress,
    Guid? ProjectId,
    string? ProjectName,
    InvoiceStatus Status,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal Subtotal,
    decimal TaxRatePercent,
    decimal TaxAmount,
    decimal DiscountAmount,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal BalanceDue,
    string? Notes,
    string? Terms,
    IReadOnlyList<InvoiceItemDto> Items,
    IReadOnlyList<InvoicePaymentSummaryDto> Payments,
    DateTime CreatedAtUtc);

public sealed record UpsertInvoiceItemRequest(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxPercent);

public sealed record UpsertInvoiceRequest(
    Guid CustomerId,
    Guid? ProjectId,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal TaxRatePercent,
    decimal DiscountAmount,
    string? Notes,
    string? Terms,
    IReadOnlyList<UpsertInvoiceItemRequest> Items);

public sealed record UpdateInvoiceStatusRequest(InvoiceStatus Status);

public sealed class PaymentQuery : PagedQuery
{
    public PaymentMethod? PaymentMethod { get; set; }
    public Guid? InvoiceId { get; set; }
}

public sealed record PaymentDto(
    Guid Id,
    Guid InvoiceId,
    string InvoiceNumber,
    string CustomerName,
    decimal Amount,
    DateTime PaymentDateUtc,
    PaymentMethod PaymentMethod,
    string? ReferenceNumber,
    string? Notes,
    string RecordedByName,
    DateTime CreatedAtUtc);

public sealed record PaymentSummaryDto(
    decimal TotalReceived,
    decimal PendingPayments,
    int PaymentCount);

public sealed record RecordPaymentRequest(
    Guid InvoiceId,
    decimal Amount,
    DateTime PaymentDateUtc,
    PaymentMethod PaymentMethod,
    string? ReferenceNumber,
    string? Notes);

public sealed class ExpenseQuery : PagedQuery
{
    public ExpenseCategory? Category { get; set; }
    public Guid? ProjectId { get; set; }
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
}

public sealed record ExpenseDto(
    Guid Id,
    ExpenseCategory Category,
    decimal Amount,
    DateTime ExpenseDateUtc,
    string Vendor,
    string? Description,
    PaymentMethod PaymentMethod,
    Guid? ProjectId,
    string? ProjectName,
    Guid? ReceiptDocumentId,
    string? ReceiptFileName,
    string RecordedByName,
    DateTime CreatedAtUtc);

public sealed record ExpenseAnalyticsDto(
    decimal TotalExpenses,
    decimal CurrentMonthExpenses,
    IReadOnlyList<CategoryBreakdownDto> ByCategory,
    IReadOnlyList<MonthlySeriesPointDto> MonthlyTrend);

public sealed record CategoryBreakdownDto(string Category, decimal Amount);
public sealed record MonthlySeriesPointDto(string Month, decimal Revenue, decimal Expenses, decimal Profit);

public sealed record UpsertExpenseRequest(
    ExpenseCategory Category,
    decimal Amount,
    DateTime ExpenseDateUtc,
    string Vendor,
    string? Description,
    PaymentMethod PaymentMethod,
    Guid? ProjectId,
    Guid? ReceiptDocumentId);

public sealed class TimeEntryQuery : PagedQuery
{
    public Guid? ProjectId { get; set; }
    public Guid? UserId { get; set; }
    public bool? IsBillable { get; set; }
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
}

public sealed record TimeEntryDto(
    Guid Id,
    Guid UserId,
    string UserName,
    Guid? ProjectId,
    string? ProjectName,
    Guid? WorkTaskId,
    string? TaskTitle,
    string Description,
    DateTime StartTimeUtc,
    DateTime? EndTimeUtc,
    int DurationMinutes,
    bool IsRunning,
    bool IsBillable,
    decimal HourlyRate,
    decimal BillableAmount);

public sealed record TimeSummaryDto(
    int TotalMinutes,
    int BillableMinutes,
    int NonBillableMinutes,
    decimal TotalBillableAmount,
    TimeEntryDto? ActiveTimer);

public sealed record StartTimerRequest(
    Guid? ProjectId,
    Guid? WorkTaskId,
    string Description,
    bool IsBillable,
    decimal? HourlyRate);

public sealed record UpsertTimeEntryRequest(
    Guid? ProjectId,
    Guid? WorkTaskId,
    string Description,
    DateTime StartTimeUtc,
    DateTime EndTimeUtc,
    bool IsBillable,
    decimal? HourlyRate);
