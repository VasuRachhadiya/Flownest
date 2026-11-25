using Flownest.Application.Common;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.DTOs.Finance;
using Flownest.Domain.Enums;

namespace Flownest.Application.DTOs.Workspace;

public sealed record TeamMemberDto(
    Guid MemberId,
    Guid UserId,
    string FullName,
    string Email,
    string? JobTitle,
    OrganizationRole Role,
    MemberAvailability Availability,
    decimal? HourlyRate,
    bool IsActive,
    int ActiveProjectsCount,
    int PendingTasksCount,
    int CompletedTasksCount,
    DateTime JoinedAtUtc);

public sealed record InvitationDto(
    Guid Id,
    string Email,
    OrganizationRole Role,
    InvitationStatus Status,
    string Token,
    DateTime ExpiresAtUtc,
    DateTime CreatedAtUtc);

public sealed record CreateInvitationRequest(
    string Email,
    OrganizationRole Role);

public sealed record CreateInvitationResponse(
    InvitationDto Invitation,
    string JoinInstruction,
    bool EmailDeliveryConfigured);

public sealed record AcceptInvitationRequest(string Token);

public sealed record UpdateTeamMemberRequest(
    OrganizationRole Role,
    string? JobTitle,
    MemberAvailability Availability,
    decimal? HourlyRate,
    bool IsActive);

public sealed class DocumentQuery : PagedQuery
{
    public DocumentCategory? Category { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? ProjectId { get; set; }
}

public sealed record DocumentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    DocumentCategory Category,
    Guid? CustomerId,
    string? CustomerName,
    Guid? ProjectId,
    string? ProjectName,
    string UploadedByName,
    string? Description,
    DateTime CreatedAtUtc);

public sealed record RenameDocumentRequest(
    string FileName,
    DocumentCategory Category,
    string? Description);

public sealed record NotificationDto(
    Guid Id,
    NotificationType Type,
    string Title,
    string Message,
    string? EntityType,
    Guid? EntityId,
    string? ActionUrl,
    bool IsRead,
    DateTime CreatedAtUtc);

public sealed record GlobalSearchItemDto(
    Guid Id,
    string Title,
    string? Subtitle,
    string Category,
    string Route);

public sealed record GlobalSearchResultDto(
    IReadOnlyList<GlobalSearchItemDto> Customers,
    IReadOnlyList<GlobalSearchItemDto> Leads,
    IReadOnlyList<GlobalSearchItemDto> Projects,
    IReadOnlyList<GlobalSearchItemDto> Tasks,
    IReadOnlyList<GlobalSearchItemDto> Invoices);

public sealed record DashboardQuery(
    string Period = "year", // month, quarter, year, custom
    DateTime? FromUtc = null,
    DateTime? ToUtc = null);

public sealed record DashboardOverviewDto(
    decimal TotalRevenue,
    decimal OutstandingInvoices,
    decimal TotalExpenses,
    decimal NetProfit,
    int ActiveProjects,
    int PendingTasks,
    int CompletedTasks,
    int TotalCustomers,
    int NewLeads,
    IReadOnlyList<MonthlySeriesPointDto> RevenueExpenseSeries,
    IReadOnlyList<StatusCountDto> ProjectStatusSeries,
    IReadOnlyList<TeamWorkloadDto> TeamWorkload,
    IReadOnlyList<ActivityItemDto> RecentActivities,
    IReadOnlyList<UpcomingDeadlineDto> UpcomingDeadlines,
    IReadOnlyList<DashboardInvoiceDto> RecentInvoices,
    IReadOnlyList<DashboardTaskDto> MyTasks,
    IReadOnlyList<DashboardAlertDto> Alerts,
    bool IsEmptyWorkspace);

public sealed record StatusCountDto(string Status, int Count);
public sealed record TeamWorkloadDto(Guid UserId, string Name, int PendingTasks, int CompletedTasks, int ActiveProjects);
public sealed record UpcomingDeadlineDto(Guid Id, string Title, string Kind, DateTime DueDateUtc, string Status);
public sealed record DashboardInvoiceDto(Guid Id, string InvoiceNumber, string CustomerName, decimal TotalAmount, decimal BalanceDue, InvoiceStatus Status, DateTime DueDateUtc);
public sealed record DashboardTaskDto(Guid Id, string Title, string? ProjectName, PriorityLevel Priority, WorkTaskStatus Status, DateTime? DueDateUtc);
public sealed record DashboardAlertDto(string Severity, string Title, string Description, string Route);

public sealed record ReportsOverviewDto(
    decimal TotalRevenue,
    decimal TotalExpenses,
    decimal NetProfit,
    decimal CollectionRatePercent,
    int TotalCustomers,
    int ActiveProjects,
    int CompletedTasks,
    decimal BillableHours,
    IReadOnlyList<MonthlySeriesPointDto> MonthlyFinancials,
    IReadOnlyList<CategoryBreakdownDto> ExpensesByCategory,
    IReadOnlyList<StatusCountDto> ProjectsByStatus,
    IReadOnlyList<StatusCountDto> TasksByStatus,
    IReadOnlyList<StatusCountDto> InvoicesByStatus,
    IReadOnlyList<TeamWorkloadDto> TeamPerformance,
    IReadOnlyList<CustomerRevenueRowDto> TopCustomers);

public sealed record CustomerRevenueRowDto(Guid CustomerId, string Name, string? Company, int ProjectCount, int InvoiceCount, decimal TotalBilled, decimal TotalPaid);
