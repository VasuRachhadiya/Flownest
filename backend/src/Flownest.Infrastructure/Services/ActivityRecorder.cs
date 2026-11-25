using Flownest.Application.Interfaces;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;

namespace Flownest.Infrastructure.Services;

public sealed class ActivityRecorder : IActivityRecorder
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public ActivityRecorder(AppDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public Task LogAsync(
        string entityType,
        Guid entityId,
        string action,
        string summary,
        Guid? customerId = null,
        Guid? projectId = null,
        CancellationToken ct = default)
    {
        if (_currentUser.OrganizationId is not Guid orgId) return Task.CompletedTask;

        _db.ActivityLogs.Add(new ActivityLog
        {
            OrganizationId = orgId,
            ActorUserId = _currentUser.UserId,
            ActorName = _currentUser.FullName ?? _currentUser.Email ?? "System",
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            Summary = summary,
            CustomerId = customerId,
            ProjectId = projectId
        });

        return Task.CompletedTask;
    }

    public Task NotifyAsync(
        Guid recipientUserId,
        NotificationType type,
        string title,
        string message,
        string? entityType = null,
        Guid? entityId = null,
        string? actionUrl = null,
        CancellationToken ct = default)
    {
        if (_currentUser.OrganizationId is not Guid orgId) return Task.CompletedTask;

        _db.Notifications.Add(new Notification
        {
            OrganizationId = orgId,
            RecipientUserId = recipientUserId,
            Type = type,
            Title = title,
            Message = message,
            EntityType = entityType,
            EntityId = entityId,
            ActionUrl = actionUrl,
            IsRead = false
        });

        return Task.CompletedTask;
    }
}
