using Flownest.Application.Common;
using Flownest.Application.DTOs.Crm;
using Flownest.Domain.Enums;

namespace Flownest.Application.DTOs.Projects;

public sealed class ProjectQuery : PagedQuery
{
    public ProjectStatus? Status { get; set; }
    public PriorityLevel? Priority { get; set; }
    public Guid? CustomerId { get; set; }
}

public sealed record ProjectMemberDto(
    Guid UserId,
    string FullName,
    string Email,
    string? ProjectRole);

public sealed record ProjectDto(
    Guid Id,
    string Name,
    string? Code,
    string? Description,
    Guid? CustomerId,
    string? CustomerName,
    ProjectStatus Status,
    PriorityLevel Priority,
    DateTime? StartDateUtc,
    DateTime? DueDateUtc,
    decimal Budget,
    int ProgressPercent,
    int TotalTasks,
    int CompletedTasks,
    decimal LoggedHours,
    IReadOnlyList<ProjectMemberDto> Members,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record ProjectDetailDto(
    ProjectDto Project,
    decimal TotalExpenses,
    decimal TotalInvoiced,
    IReadOnlyList<WorkTaskDto> Tasks,
    IReadOnlyList<ActivityItemDto> Activities);

public sealed record UpsertProjectRequest(
    string Name,
    string? Code,
    string? Description,
    Guid? CustomerId,
    ProjectStatus Status,
    PriorityLevel Priority,
    DateTime? StartDateUtc,
    DateTime? DueDateUtc,
    decimal Budget,
    int? ProgressPercent,
    IReadOnlyList<Guid>? MemberUserIds);

public sealed class WorkTaskQuery : PagedQuery
{
    public WorkTaskStatus? Status { get; set; }
    public PriorityLevel? Priority { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? AssigneeUserId { get; set; }
    public string? ViewScope { get; set; } // all, my, assigned, upcoming, overdue
}

public sealed record TaskAssigneeDto(
    Guid UserId,
    string FullName,
    string Email);

public sealed record TaskCommentDto(
    Guid Id,
    Guid AuthorUserId,
    string AuthorName,
    string Content,
    DateTime CreatedAtUtc);

public sealed record WorkTaskDto(
    Guid Id,
    string Title,
    string? Description,
    Guid? ProjectId,
    string? ProjectName,
    WorkTaskStatus Status,
    PriorityLevel Priority,
    DateTime? DueDateUtc,
    IReadOnlyList<string> Labels,
    decimal EstimatedHours,
    int SortOrder,
    int CommentCount,
    IReadOnlyList<TaskAssigneeDto> Assignees,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record UpsertWorkTaskRequest(
    string Title,
    string? Description,
    Guid? ProjectId,
    WorkTaskStatus Status,
    PriorityLevel Priority,
    DateTime? DueDateUtc,
    IReadOnlyList<string>? Labels,
    decimal EstimatedHours,
    IReadOnlyList<Guid>? AssigneeUserIds);

public sealed record MoveTaskRequest(WorkTaskStatus Status, int? SortOrder);
public sealed record AddTaskCommentRequest(string Content);
