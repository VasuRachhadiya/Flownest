using Flownest.Application.Common;
using Flownest.Application.DTOs.Auth;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.DTOs.Projects;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

public sealed class ProjectService : IProjectService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IActivityRecorder _activity;

    public ProjectService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _activity = activity;
    }

    public async Task<PagedResult<ProjectDto>> GetAllAsync(ProjectQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Projects.AsNoTracking()
            .Include(p => p.Customer)
            .Include(p => p.Members)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(p => p.Name.ToLower().Contains(term) || (p.Code != null && p.Code.ToLower().Contains(term)));
        }
        if (query.Status.HasValue) q = q.Where(p => p.Status == query.Status.Value);
        if (query.Priority.HasValue) q = q.Where(p => p.Priority == query.Priority.Value);
        if (query.CustomerId.HasValue) q = q.Where(p => p.CustomerId == query.CustomerId.Value);

        q = q.OrderByDescending(p => p.CreatedAtUtc);
        var total = await q.CountAsync(ct);
        var projects = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);

        var projectIds = projects.Select(p => p.Id).ToList();
        var taskStats = await _db.WorkTasks.AsNoTracking()
            .Where(t => t.ProjectId != null && projectIds.Contains(t.ProjectId.Value))
            .GroupBy(t => t.ProjectId!.Value)
            .Select(g => new
            {
                ProjectId = g.Key,
                Total = g.Count(),
                Completed = g.Count(t => t.Status == WorkTaskStatus.Completed)
            })
            .ToDictionaryAsync(x => x.ProjectId, ct);

        var timeStats = await _db.TimeEntries.AsNoTracking()
            .Where(te => te.ProjectId != null && projectIds.Contains(te.ProjectId.Value))
            .GroupBy(te => te.ProjectId!.Value)
            .Select(g => new { ProjectId = g.Key, Minutes = g.Sum(x => x.DurationMinutes) })
            .ToDictionaryAsync(x => x.ProjectId, ct);

        var memberIds = projects.SelectMany(p => p.Members).Select(m => m.UserId).Distinct();
        var users = await _identity.GetUsersByIdsAsync(memberIds, ct);

        var items = projects.Select(p =>
        {
            taskStats.TryGetValue(p.Id, out var ts);
            timeStats.TryGetValue(p.Id, out var tm);
            var loggedHours = tm is null ? 0m : Math.Round(tm.Minutes / 60m, 2);
            return ToDto(p, ts?.Total ?? 0, ts?.Completed ?? 0, loggedHours, users);
        }).ToList();

        return new PagedResult<ProjectDto>
        {
            Items = items,
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<ProjectDetailDto> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var p = await _db.Projects.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Members)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new NotFoundException("Project not found.");

        var tasks = await _db.WorkTasks.AsNoTracking()
            .Include(t => t.Assignees)
            .Include(t => t.Comments)
            .Where(t => t.ProjectId == id)
            .OrderBy(t => t.Status).ThenBy(t => t.SortOrder)
            .ToListAsync(ct);

        var minutes = await _db.TimeEntries.AsNoTracking()
            .Where(te => te.ProjectId == id)
            .SumAsync(te => (int?)te.DurationMinutes, ct) ?? 0;

        var totalExpenses = await _db.Expenses.AsNoTracking()
            .Where(e => e.ProjectId == id)
            .SumAsync(e => (decimal?)e.Amount, ct) ?? 0m;

        var totalInvoiced = await _db.Invoices.AsNoTracking()
            .Where(i => i.ProjectId == id && i.Status != InvoiceStatus.Cancelled)
            .SumAsync(i => (decimal?)i.TotalAmount, ct) ?? 0m;

        var activities = await _db.ActivityLogs.AsNoTracking()
            .Where(a => a.ProjectId == id || (a.EntityType == "Project" && a.EntityId == id))
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(30)
            .Select(a => new ActivityItemDto(a.Id, a.ActorName, a.EntityType, a.EntityId, a.Action, a.Summary, a.CreatedAtUtc))
            .ToListAsync(ct);

        var allUserIds = p.Members.Select(m => m.UserId)
            .Concat(tasks.SelectMany(t => t.Assignees).Select(a => a.UserId))
            .Distinct();
        var users = await _identity.GetUsersByIdsAsync(allUserIds, ct);

        var projectDto = ToDto(p, tasks.Count, tasks.Count(t => t.Status == WorkTaskStatus.Completed), Math.Round(minutes / 60m, 2), users);
        var taskDtos = tasks.Select(t => WorkTaskService.ToDto(t, p.Name, users)).ToList();

        return new ProjectDetailDto(projectDto, totalExpenses, totalInvoiced, taskDtos, activities);
    }

    public async Task<ProjectDto> CreateAsync(UpsertProjectRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Name)) throw new DomainException("Project name is required.");

        if (request.CustomerId.HasValue)
        {
            var customerExists = await _db.Customers.AnyAsync(c => c.Id == request.CustomerId.Value, ct);
            if (!customerExists) throw new NotFoundException("Selected customer not found.");
        }

        var project = new Project
        {
            OrganizationId = orgId,
            Name = request.Name.Trim(),
            Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim().ToUpperInvariant(),
            Description = request.Description?.Trim(),
            CustomerId = request.CustomerId,
            Status = request.Status,
            Priority = request.Priority,
            StartDateUtc = request.StartDateUtc,
            DueDateUtc = request.DueDateUtc,
            Budget = Math.Max(0, request.Budget),
            ProgressPercent = Math.Clamp(request.ProgressPercent ?? 0, 0, 100)
        };

        var memberIds = (request.MemberUserIds ?? Array.Empty<Guid>()).Distinct().ToList();
        if (memberIds.Count == 0 && _currentUser.UserId.HasValue)
        {
            memberIds.Add(_currentUser.UserId.Value);
        }

        foreach (var uid in memberIds)
        {
            project.Members.Add(new ProjectMember { OrganizationId = orgId, ProjectId = project.Id, UserId = uid, ProjectRole = "Contributor" });
        }

        _db.Projects.Add(project);
        await _activity.LogAsync("Project", project.Id, "Created", $"Created project {project.Name}", customerId: project.CustomerId, projectId: project.Id, ct: ct);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(project.Id, ct)).Project;
    }

    public async Task<ProjectDto> UpdateAsync(Guid id, UpsertProjectRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.Name)) throw new DomainException("Project name is required.");

        var project = await _db.Projects.Include(p => p.Members).FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Project not found.");

        project.Name = request.Name.Trim();
        project.Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim().ToUpperInvariant();
        project.Description = request.Description?.Trim();
        project.CustomerId = request.CustomerId;
        project.Status = request.Status;
        project.Priority = request.Priority;
        project.StartDateUtc = request.StartDateUtc;
        project.DueDateUtc = request.DueDateUtc;
        project.Budget = Math.Max(0, request.Budget);
        if (request.ProgressPercent.HasValue)
        {
            project.ProgressPercent = Math.Clamp(request.ProgressPercent.Value, 0, 100);
        }

        if (request.MemberUserIds is not null)
        {
            var desired = request.MemberUserIds.Distinct().ToHashSet();
            var existing = project.Members.Select(m => m.UserId).ToHashSet();

            foreach (var remove in project.Members.Where(m => !desired.Contains(m.UserId)).ToList())
            {
                _db.ProjectMembers.Remove(remove);
            }
            foreach (var addUid in desired.Where(u => !existing.Contains(u)))
            {
                _db.ProjectMembers.Add(new ProjectMember { OrganizationId = orgId, ProjectId = project.Id, UserId = addUid, ProjectRole = "Contributor" });
            }
        }

        await _activity.LogAsync("Project", project.Id, "Updated", $"Updated project {project.Name}", customerId: project.CustomerId, projectId: project.Id, ct: ct);
        await _db.SaveChangesAsync(ct);

        return (await GetByIdAsync(project.Id, ct)).Project;
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Project not found.");

        project.IsDeleted = true;
        project.DeletedAtUtc = DateTime.UtcNow;
        await _activity.LogAsync("Project", project.Id, "Deleted", $"Deleted project {project.Name}", projectId: project.Id, ct: ct);
        await _db.SaveChangesAsync(ct);
    }

    private static ProjectDto ToDto(Project p, int totalTasks, int completedTasks, decimal loggedHours, Dictionary<Guid, UserSummaryDto> users)
    {
        var members = p.Members
            .Select(m => users.TryGetValue(m.UserId, out var u)
                ? new ProjectMemberDto(m.UserId, u.FullName, u.Email, m.ProjectRole)
                : new ProjectMemberDto(m.UserId, "Team Member", string.Empty, m.ProjectRole))
            .ToList();

        return new ProjectDto(
            p.Id, p.Name, p.Code, p.Description, p.CustomerId, p.Customer?.Name,
            p.Status, p.Priority, p.StartDateUtc, p.DueDateUtc, p.Budget,
            p.ProgressPercent, totalTasks, completedTasks, loggedHours, members,
            p.CreatedAtUtc, p.UpdatedAtUtc);
    }
}

public sealed class WorkTaskService : IWorkTaskService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IActivityRecorder _activity;

    public WorkTaskService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _activity = activity;
    }

    public async Task<PagedResult<WorkTaskDto>> GetAllAsync(WorkTaskQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        var now = DateTime.UtcNow;

        var q = _db.WorkTasks.AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.Assignees)
            .Include(t => t.Comments)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(t => t.Title.ToLower().Contains(term) || (t.Labels != null && t.Labels.ToLower().Contains(term)));
        }

        if (query.Status.HasValue) q = q.Where(t => t.Status == query.Status.Value);
        if (query.Priority.HasValue) q = q.Where(t => t.Priority == query.Priority.Value);
        if (query.ProjectId.HasValue) q = q.Where(t => t.ProjectId == query.ProjectId.Value);
        if (query.AssigneeUserId.HasValue) q = q.Where(t => t.Assignees.Any(a => a.UserId == query.AssigneeUserId.Value));

        switch (query.ViewScope?.ToLowerInvariant())
        {
            case "my":
                q = q.Where(t => t.Assignees.Any(a => a.UserId == userId));
                break;
            case "assigned":
                q = q.Where(t => t.Assignees.Any());
                break;
            case "upcoming":
                q = q.Where(t => t.Status != WorkTaskStatus.Completed && t.DueDateUtc != null && t.DueDateUtc >= now && t.DueDateUtc <= now.AddDays(14));
                break;
            case "overdue":
                q = q.Where(t => t.Status != WorkTaskStatus.Completed && t.DueDateUtc != null && t.DueDateUtc < now);
                break;
        }

        q = q.OrderBy(t => t.Status).ThenBy(t => t.SortOrder).ThenByDescending(t => t.CreatedAtUtc);
        var total = await q.CountAsync(ct);
        var tasks = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);

        var userIds = tasks.SelectMany(t => t.Assignees).Select(a => a.UserId).Distinct();
        var users = await _identity.GetUsersByIdsAsync(userIds, ct);

        return new PagedResult<WorkTaskDto>
        {
            Items = tasks.Select(t => ToDto(t, t.Project?.Name, users)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<IReadOnlyList<TaskCommentDto>> GetCommentsAsync(Guid taskId, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var exists = await _db.WorkTasks.AnyAsync(t => t.Id == taskId, ct);
        if (!exists) throw new NotFoundException("Task not found.");

        var comments = await _db.TaskComments.AsNoTracking()
            .Where(c => c.WorkTaskId == taskId)
            .OrderBy(c => c.CreatedAtUtc)
            .ToListAsync(ct);

        var users = await _identity.GetUsersByIdsAsync(comments.Select(c => c.AuthorUserId), ct);
        return comments.Select(c => new TaskCommentDto(
            c.Id,
            c.AuthorUserId,
            users.TryGetValue(c.AuthorUserId, out var u) ? u.FullName : "Team Member",
            c.Content,
            c.CreatedAtUtc)).ToList();
    }

    public async Task<WorkTaskDto> CreateAsync(UpsertWorkTaskRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var actorId = _currentUser.RequireUserId();
        if (string.IsNullOrWhiteSpace(request.Title)) throw new DomainException("Task title is required.");

        string? projectName = null;
        if (request.ProjectId.HasValue)
        {
            var proj = await _db.Projects.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.ProjectId.Value, ct)
                ?? throw new NotFoundException("Project not found.");
            projectName = proj.Name;
        }

        var task = new WorkTask
        {
            OrganizationId = orgId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            ProjectId = request.ProjectId,
            Status = request.Status,
            Priority = request.Priority,
            DueDateUtc = request.DueDateUtc,
            Labels = QueryHelper.JoinTags(request.Labels),
            EstimatedHours = Math.Max(0, request.EstimatedHours),
            CreatedByUserId = actorId
        };

        var assignees = (request.AssigneeUserIds ?? Array.Empty<Guid>()).Distinct().ToList();
        foreach (var uid in assignees)
        {
            task.Assignees.Add(new TaskAssignee { OrganizationId = orgId, WorkTaskId = task.Id, UserId = uid });
            if (uid != actorId)
            {
                await _activity.NotifyAsync(uid, NotificationType.TaskAssigned, "New task assigned", $"You were assigned to \"{task.Title}\".", "WorkTask", task.Id, "/tasks", ct);
            }
        }

        _db.WorkTasks.Add(task);
        await _activity.LogAsync("WorkTask", task.Id, "Created", $"Created task \"{task.Title}\"", projectId: task.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        if (task.ProjectId.HasValue) await RecalculateProjectProgressAsync(task.ProjectId.Value, ct);

        var users = await _identity.GetUsersByIdsAsync(assignees, ct);
        return ToDto(task, projectName, users);
    }

    public async Task<WorkTaskDto> UpdateAsync(Guid id, UpsertWorkTaskRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var actorId = _currentUser.RequireUserId();
        if (string.IsNullOrWhiteSpace(request.Title)) throw new DomainException("Task title is required.");

        var task = await _db.WorkTasks.Include(t => t.Assignees).Include(t => t.Comments).Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundException("Task not found.");

        task.Title = request.Title.Trim();
        task.Description = request.Description?.Trim();
        task.ProjectId = request.ProjectId;
        task.Status = request.Status;
        task.Priority = request.Priority;
        task.DueDateUtc = request.DueDateUtc;
        task.Labels = QueryHelper.JoinTags(request.Labels);
        task.EstimatedHours = Math.Max(0, request.EstimatedHours);

        if (request.AssigneeUserIds is not null)
        {
            var desired = request.AssigneeUserIds.Distinct().ToHashSet();
            var existing = task.Assignees.Select(a => a.UserId).ToHashSet();

            foreach (var remove in task.Assignees.Where(a => !desired.Contains(a.UserId)).ToList())
            {
                _db.TaskAssignees.Remove(remove);
            }
            foreach (var addUid in desired.Where(u => !existing.Contains(u)))
            {
                _db.TaskAssignees.Add(new TaskAssignee { OrganizationId = orgId, WorkTaskId = task.Id, UserId = addUid });
                if (addUid != actorId)
                {
                    await _activity.NotifyAsync(addUid, NotificationType.TaskAssigned, "Task assigned", $"You were assigned to \"{task.Title}\".", "WorkTask", task.Id, "/tasks", ct);
                }
            }
        }

        await _activity.LogAsync("WorkTask", task.Id, "Updated", $"Updated task \"{task.Title}\"", projectId: task.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        if (task.ProjectId.HasValue) await RecalculateProjectProgressAsync(task.ProjectId.Value, ct);

        var users = await _identity.GetUsersByIdsAsync(task.Assignees.Select(a => a.UserId), ct);
        return ToDto(task, task.Project?.Name, users);
    }

    public async Task<WorkTaskDto> MoveAsync(Guid id, MoveTaskRequest request, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var task = await _db.WorkTasks.Include(t => t.Assignees).Include(t => t.Comments).Include(t => t.Project)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundException("Task not found.");

        task.Status = request.Status;
        if (request.SortOrder.HasValue) task.SortOrder = request.SortOrder.Value;

        await _activity.LogAsync("WorkTask", task.Id, "Moved", $"Moved task \"{task.Title}\" to {request.Status}", projectId: task.ProjectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        if (task.ProjectId.HasValue) await RecalculateProjectProgressAsync(task.ProjectId.Value, ct);

        var users = await _identity.GetUsersByIdsAsync(task.Assignees.Select(a => a.UserId), ct);
        return ToDto(task, task.Project?.Name, users);
    }

    public async Task<TaskCommentDto> AddCommentAsync(Guid taskId, AddTaskCommentRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var actorId = _currentUser.RequireUserId();
        if (string.IsNullOrWhiteSpace(request.Content)) throw new DomainException("Comment content cannot be empty.");

        var task = await _db.WorkTasks.Include(t => t.Assignees).FirstOrDefaultAsync(t => t.Id == taskId, ct)
            ?? throw new NotFoundException("Task not found.");

        var comment = new TaskComment
        {
            OrganizationId = orgId,
            WorkTaskId = taskId,
            AuthorUserId = actorId,
            Content = request.Content.Trim()
        };

        _db.TaskComments.Add(comment);
        foreach (var assignee in task.Assignees.Where(a => a.UserId != actorId))
        {
            await _activity.NotifyAsync(assignee.UserId, NotificationType.Mention, "New task comment", $"New comment on \"{task.Title}\".", "WorkTask", task.Id, "/tasks", ct);
        }

        await _db.SaveChangesAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { actorId }, ct);
        return new TaskCommentDto(comment.Id, actorId, users.TryGetValue(actorId, out var u) ? u.FullName : "Team Member", comment.Content, comment.CreatedAtUtc);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var task = await _db.WorkTasks.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundException("Task not found.");

        task.IsDeleted = true;
        task.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (task.ProjectId.HasValue) await RecalculateProjectProgressAsync(task.ProjectId.Value, ct);
    }

    private async Task RecalculateProjectProgressAsync(Guid projectId, CancellationToken ct)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId, ct);
        if (project is null) return;

        var counts = await _db.WorkTasks.AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .GroupBy(_ => 1)
            .Select(g => new { Total = g.Count(), Done = g.Count(t => t.Status == WorkTaskStatus.Completed) })
            .FirstOrDefaultAsync(ct);

        if (counts is not null && counts.Total > 0)
        {
            project.ProgressPercent = (int)Math.Round(counts.Done * 100.0 / counts.Total);
            await _db.SaveChangesAsync(ct);
        }
    }

    internal static WorkTaskDto ToDto(WorkTask t, string? projectName, Dictionary<Guid, UserSummaryDto> users)
    {
        var assignees = t.Assignees.Select(a =>
            users.TryGetValue(a.UserId, out var u)
                ? new TaskAssigneeDto(a.UserId, u.FullName, u.Email)
                : new TaskAssigneeDto(a.UserId, "Team Member", string.Empty)).ToList();

        return new WorkTaskDto(
            t.Id, t.Title, t.Description, t.ProjectId, projectName,
            t.Status, t.Priority, t.DueDateUtc, QueryHelper.SplitTags(t.Labels),
            t.EstimatedHours, t.SortOrder, t.Comments.Count, assignees,
            t.CreatedAtUtc, t.UpdatedAtUtc);
    }
}
