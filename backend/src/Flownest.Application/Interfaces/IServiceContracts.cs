using Flownest.Application.Common;
using Flownest.Application.DTOs.Auth;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.DTOs.Finance;
using Flownest.Application.DTOs.Projects;
using Flownest.Application.DTOs.Workspace;
using Flownest.Domain.Enums;

namespace Flownest.Application.Interfaces;

public interface IOrganizationService
{
    Task<IReadOnlyList<OrganizationMembershipDto>> GetUserOrganizationsAsync(CancellationToken ct = default);
    Task<OrganizationDetailsDto> CreateAsync(CreateOrganizationRequest request, CancellationToken ct = default);
    Task<OrganizationDetailsDto> GetCurrentAsync(CancellationToken ct = default);
    Task<OrganizationDetailsDto> UpdateCurrentAsync(UpdateOrganizationRequest request, CancellationToken ct = default);
}

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> GetAllAsync(CustomerQuery query, CancellationToken ct = default);
    Task<CustomerDetailDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<CustomerDto> CreateAsync(UpsertCustomerRequest request, CancellationToken ct = default);
    Task<CustomerDto> UpdateAsync(Guid id, UpsertCustomerRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ILeadService
{
    Task<PagedResult<LeadDto>> GetAllAsync(LeadQuery query, CancellationToken ct = default);
    Task<LeadPipelineStatsDto> GetPipelineStatsAsync(CancellationToken ct = default);
    Task<LeadDto> CreateAsync(UpsertLeadRequest request, CancellationToken ct = default);
    Task<LeadDto> UpdateAsync(Guid id, UpsertLeadRequest request, CancellationToken ct = default);
    Task<LeadDto> ChangeStageAsync(Guid id, LeadStage stage, CancellationToken ct = default);
    Task<CustomerDto> ConvertToCustomerAsync(Guid id, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IProjectService
{
    Task<PagedResult<ProjectDto>> GetAllAsync(ProjectQuery query, CancellationToken ct = default);
    Task<ProjectDetailDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ProjectDto> CreateAsync(UpsertProjectRequest request, CancellationToken ct = default);
    Task<ProjectDto> UpdateAsync(Guid id, UpsertProjectRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IWorkTaskService
{
    Task<PagedResult<WorkTaskDto>> GetAllAsync(WorkTaskQuery query, CancellationToken ct = default);
    Task<IReadOnlyList<TaskCommentDto>> GetCommentsAsync(Guid taskId, CancellationToken ct = default);
    Task<WorkTaskDto> CreateAsync(UpsertWorkTaskRequest request, CancellationToken ct = default);
    Task<WorkTaskDto> UpdateAsync(Guid id, UpsertWorkTaskRequest request, CancellationToken ct = default);
    Task<WorkTaskDto> MoveAsync(Guid id, MoveTaskRequest request, CancellationToken ct = default);
    Task<TaskCommentDto> AddCommentAsync(Guid taskId, AddTaskCommentRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ITeamService
{
    Task<IReadOnlyList<TeamMemberDto>> GetMembersAsync(CancellationToken ct = default);
    Task<TeamMemberDto> UpdateMemberAsync(Guid memberId, UpdateTeamMemberRequest request, CancellationToken ct = default);
    Task RemoveMemberAsync(Guid memberId, CancellationToken ct = default);
    Task<IReadOnlyList<InvitationDto>> GetInvitationsAsync(CancellationToken ct = default);
    Task<CreateInvitationResponse> InviteAsync(CreateInvitationRequest request, CancellationToken ct = default);
    Task RevokeInvitationAsync(Guid invitationId, CancellationToken ct = default);
    Task<OrganizationMembershipDto> AcceptInvitationAsync(AcceptInvitationRequest request, CancellationToken ct = default);
}

public interface IInvoiceService
{
    Task<PagedResult<InvoiceDto>> GetAllAsync(InvoiceQuery query, CancellationToken ct = default);
    Task<InvoiceDto> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<InvoiceDto> CreateAsync(UpsertInvoiceRequest request, CancellationToken ct = default);
    Task<InvoiceDto> UpdateAsync(Guid id, UpsertInvoiceRequest request, CancellationToken ct = default);
    Task<InvoiceDto> UpdateStatusAsync(Guid id, InvoiceStatus status, CancellationToken ct = default);
    Task DeleteDraftAsync(Guid id, CancellationToken ct = default);
}

public interface IPaymentService
{
    Task<PagedResult<PaymentDto>> GetAllAsync(PaymentQuery query, CancellationToken ct = default);
    Task<PaymentSummaryDto> GetSummaryAsync(CancellationToken ct = default);
    Task<PaymentDto> RecordPaymentAsync(RecordPaymentRequest request, CancellationToken ct = default);
}

public interface IExpenseService
{
    Task<PagedResult<ExpenseDto>> GetAllAsync(ExpenseQuery query, CancellationToken ct = default);
    Task<ExpenseAnalyticsDto> GetAnalyticsAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default);
    Task<ExpenseDto> CreateAsync(UpsertExpenseRequest request, CancellationToken ct = default);
    Task<ExpenseDto> UpdateAsync(Guid id, UpsertExpenseRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface ITimeTrackingService
{
    Task<PagedResult<TimeEntryDto>> GetAllAsync(TimeEntryQuery query, CancellationToken ct = default);
    Task<TimeSummaryDto> GetSummaryAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default);
    Task<TimeEntryDto> StartTimerAsync(StartTimerRequest request, CancellationToken ct = default);
    Task<TimeEntryDto> StopTimerAsync(Guid id, CancellationToken ct = default);
    Task<TimeEntryDto> CreateManualEntryAsync(UpsertTimeEntryRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IDocumentService
{
    Task<PagedResult<DocumentDto>> GetAllAsync(DocumentQuery query, CancellationToken ct = default);
    Task<DocumentDto> UploadAsync(Stream fileStream, string fileName, string contentType, long fileSizeBytes, DocumentCategory category, Guid? customerId, Guid? projectId, string? description, CancellationToken ct = default);
    Task<(Stream Content, string ContentType, string FileName)> DownloadAsync(Guid id, CancellationToken ct = default);
    Task<DocumentDto> UpdateMetadataAsync(Guid id, RenameDocumentRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetMyNotificationsAsync(bool unreadOnly = false, CancellationToken ct = default);
    Task<int> GetUnreadCountAsync(CancellationToken ct = default);
    Task MarkAsReadAsync(Guid id, CancellationToken ct = default);
    Task MarkAllAsReadAsync(CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public interface IDashboardReportService
{
    Task<DashboardOverviewDto> GetDashboardAsync(DashboardQuery query, CancellationToken ct = default);
    Task<ReportsOverviewDto> GetReportsAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default);
    Task<byte[]> ExportReportCsvAsync(string reportType, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default);
    Task<GlobalSearchResultDto> SearchAsync(string query, CancellationToken ct = default);
}
