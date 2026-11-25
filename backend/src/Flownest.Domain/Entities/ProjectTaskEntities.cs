using Flownest.Domain.Common;
using Flownest.Domain.Enums;

namespace Flownest.Domain.Entities;

public class Project : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public Guid? CustomerId { get; set; }
    public ProjectStatus Status { get; set; } = ProjectStatus.Planning;
    public PriorityLevel Priority { get; set; } = PriorityLevel.Medium;
    public DateTime? StartDateUtc { get; set; }
    public DateTime? DueDateUtc { get; set; }
    public decimal Budget { get; set; }
    public int ProgressPercent { get; set; }

    public Customer? Customer { get; set; }
    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
    public ICollection<WorkTask> Tasks { get; set; } = new List<WorkTask>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
    public ICollection<DocumentRecord> Documents { get; set; } = new List<DocumentRecord>();
}

public class ProjectMember : TenantEntity
{
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    public string? ProjectRole { get; set; }

    public Project Project { get; set; } = null!;
}

public class WorkTask : TenantEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? ProjectId { get; set; }
    public WorkTaskStatus Status { get; set; } = WorkTaskStatus.ToDo;
    public PriorityLevel Priority { get; set; } = PriorityLevel.Medium;
    public DateTime? DueDateUtc { get; set; }
    public string? Labels { get; set; }
    public decimal EstimatedHours { get; set; }
    public int SortOrder { get; set; }
    public Guid CreatedByUserId { get; set; }

    public Project? Project { get; set; }
    public ICollection<TaskAssignee> Assignees { get; set; } = new List<TaskAssignee>();
    public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();
    public ICollection<TimeEntry> TimeEntries { get; set; } = new List<TimeEntry>();
}

public class TaskAssignee : TenantEntity
{
    public Guid WorkTaskId { get; set; }
    public Guid UserId { get; set; }

    public WorkTask WorkTask { get; set; } = null!;
}

public class TaskComment : TenantEntity
{
    public Guid WorkTaskId { get; set; }
    public Guid AuthorUserId { get; set; }
    public string Content { get; set; } = string.Empty;

    public WorkTask WorkTask { get; set; } = null!;
}
