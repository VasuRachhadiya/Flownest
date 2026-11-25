using Flownest.Domain.Common;
using Flownest.Domain.Enums;

namespace Flownest.Domain.Entities;

public class DocumentRecord : TenantEntity
{
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public DocumentCategory Category { get; set; } = DocumentCategory.Other;
    public Guid? CustomerId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid UploadedByUserId { get; set; }
    public string? Description { get; set; }

    public Customer? Customer { get; set; }
    public Project? Project { get; set; }
}

public class Notification : TenantEntity
{
    public Guid RecipientUserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string? ActionUrl { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAtUtc { get; set; }
}

public class ActivityLog : TenantEntity
{
    public Guid? ActorUserId { get; set; }
    public string ActorName { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public Guid? ProjectId { get; set; }
}
