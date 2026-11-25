using Flownest.Application.Common;
using Flownest.Domain.Enums;

namespace Flownest.Application.DTOs.Crm;

public sealed class CustomerQuery : PagedQuery
{
    public CustomerStatus? Status { get; set; }
    public CustomerType? CustomerType { get; set; }
}

public sealed record CustomerDto(
    Guid Id,
    string Name,
    string? Company,
    string? Email,
    string? Phone,
    string? Address,
    string? Website,
    CustomerType CustomerType,
    CustomerStatus Status,
    string? Source,
    string? Notes,
    IReadOnlyList<string> Tags,
    int ProjectCount,
    int InvoiceCount,
    decimal TotalBilled,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record CustomerDetailDto(
    CustomerDto Customer,
    IReadOnlyList<CustomerProjectSummaryDto> Projects,
    IReadOnlyList<CustomerInvoiceSummaryDto> Invoices,
    IReadOnlyList<ActivityItemDto> Activities);

public sealed record CustomerProjectSummaryDto(
    Guid Id,
    string Name,
    ProjectStatus Status,
    PriorityLevel Priority,
    DateTime? DueDateUtc,
    int ProgressPercent,
    decimal Budget);

public sealed record CustomerInvoiceSummaryDto(
    Guid Id,
    string InvoiceNumber,
    InvoiceStatus Status,
    DateTime IssueDateUtc,
    DateTime DueDateUtc,
    decimal TotalAmount,
    decimal PaidAmount);

public sealed record ActivityItemDto(
    Guid Id,
    string ActorName,
    string EntityType,
    Guid EntityId,
    string Action,
    string Summary,
    DateTime CreatedAtUtc);

public sealed record UpsertCustomerRequest(
    string Name,
    string? Company,
    string? Email,
    string? Phone,
    string? Address,
    string? Website,
    CustomerType CustomerType,
    CustomerStatus Status,
    string? Source,
    string? Notes,
    IReadOnlyList<string>? Tags);

public sealed class LeadQuery : PagedQuery
{
    public LeadStage? Stage { get; set; }
    public Guid? AssignedToUserId { get; set; }
}

public sealed record LeadDto(
    Guid Id,
    string Name,
    string? Company,
    string? Email,
    string? Phone,
    string? Source,
    LeadStage Stage,
    decimal ExpectedValue,
    DateTime? FollowUpDateUtc,
    string? Notes,
    Guid? AssignedToUserId,
    string? AssignedToName,
    Guid? ConvertedCustomerId,
    DateTime? ConvertedAtUtc,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record LeadPipelineStatsDto(
    int TotalLeads,
    decimal TotalPipelineValue,
    decimal WeightedValue,
    int WonCount,
    decimal WonValue,
    IReadOnlyDictionary<string, int> CountByStage,
    IReadOnlyDictionary<string, decimal> ValueByStage);

public sealed record UpsertLeadRequest(
    string Name,
    string? Company,
    string? Email,
    string? Phone,
    string? Source,
    LeadStage Stage,
    decimal ExpectedValue,
    DateTime? FollowUpDateUtc,
    string? Notes,
    Guid? AssignedToUserId);

public sealed record ChangeLeadStageRequest(LeadStage Stage);
