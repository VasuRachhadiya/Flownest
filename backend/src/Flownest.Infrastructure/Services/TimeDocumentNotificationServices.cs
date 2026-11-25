using Flownest.Application.Common;
using Flownest.Application.DTOs.Finance;
using Flownest.Application.DTOs.Workspace;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

public sealed class TimeTrackingService : ITimeTrackingService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;

    public TimeTrackingService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
    }

    public async Task<PagedResult<TimeEntryDto>> GetAllAsync(TimeEntryQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.TimeEntries.AsNoTracking()
            .Include(t => t.Project)
            .Include(t => t.WorkTask)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(t => t.Description.ToLower().Contains(term));
        }
        if (query.ProjectId.HasValue) q = q.Where(t => t.ProjectId == query.ProjectId.Value);
        if (query.UserId.HasValue) q = q.Where(t => t.UserId == query.UserId.Value);
        if (query.IsBillable.HasValue) q = q.Where(t => t.IsBillable == query.IsBillable.Value);
        if (query.FromUtc.HasValue) q = q.Where(t => t.StartTimeUtc >= query.FromUtc.Value);
        if (query.ToUtc.HasValue) q = q.Where(t => t.StartTimeUtc <= query.ToUtc.Value);

        q = q.OrderByDescending(t => t.IsRunning).ThenByDescending(t => t.StartTimeUtc);
        var total = await q.CountAsync(ct);
        var rows = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(rows.Select(r => r.UserId), ct);

        return new PagedResult<TimeEntryDto>
        {
            Items = rows.Select(t => ToDto(t, users)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<TimeSummaryDto> GetSummaryAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();

        var q = _db.TimeEntries.AsNoTracking().Include(t => t.Project).Include(t => t.WorkTask).AsQueryable();
        if (fromUtc.HasValue) q = q.Where(t => t.StartTimeUtc >= fromUtc.Value);
        if (toUtc.HasValue) q = q.Where(t => t.StartTimeUtc <= toUtc.Value);

        var list = await q.ToListAsync(ct);
        var totalMin = list.Sum(x => x.DurationMinutes);
        var billableMin = list.Where(x => x.IsBillable).Sum(x => x.DurationMinutes);
        var nonBillableMin = totalMin - billableMin;
        var billableAmount = list.Where(x => x.IsBillable).Sum(x => Math.Round((x.DurationMinutes / 60m) * x.HourlyRate, 2));

        var active = await _db.TimeEntries.AsNoTracking()
            .Include(t => t.Project).Include(t => t.WorkTask)
            .FirstOrDefaultAsync(t => t.UserId == userId && t.IsRunning, ct);

        TimeEntryDto? activeDto = null;
        if (active is not null)
        {
            var users = await _identity.GetUsersByIdsAsync(new[] { active.UserId }, ct);
            activeDto = ToDto(active, users);
        }

        return new TimeSummaryDto(totalMin, billableMin, nonBillableMin, billableAmount, activeDto);
    }

    public async Task<TimeEntryDto> StartTimerAsync(StartTimerRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();

        var hasActive = await _db.TimeEntries.AnyAsync(t => t.UserId == userId && t.IsRunning, ct);
        if (hasActive)
        {
            throw new ConflictException("You already have an active running timer. Stop the current timer before starting a new one.");
        }

        var rate = request.HourlyRate ?? await ResolveMemberRateAsync(orgId, userId, ct);
        var entry = new TimeEntry
        {
            OrganizationId = orgId,
            UserId = userId,
            ProjectId = request.ProjectId,
            WorkTaskId = request.WorkTaskId,
            Description = string.IsNullOrWhiteSpace(request.Description) ? "Work session" : request.Description.Trim(),
            StartTimeUtc = DateTime.UtcNow,
            IsRunning = true,
            IsBillable = request.IsBillable,
            HourlyRate = Math.Max(0, rate),
            DurationMinutes = 0
        };

        _db.TimeEntries.Add(entry);
        await _db.SaveChangesAsync(ct);

        var loaded = await _db.TimeEntries.AsNoTracking().Include(t => t.Project).Include(t => t.WorkTask).FirstAsync(t => t.Id == entry.Id, ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { userId }, ct);
        return ToDto(loaded, users);
    }

    public async Task<TimeEntryDto> StopTimerAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();

        var entry = await _db.TimeEntries.Include(t => t.Project).Include(t => t.WorkTask)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct)
            ?? throw new NotFoundException("Time entry not found.");

        if (!entry.IsRunning) throw new DomainException("This timer is already stopped.");

        var end = DateTime.UtcNow;
        entry.EndTimeUtc = end;
        entry.IsRunning = false;
        entry.DurationMinutes = Math.Max(1, (int)Math.Round((end - entry.StartTimeUtc).TotalMinutes));

        await _db.SaveChangesAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { userId }, ct);
        return ToDto(entry, users);
    }

    public async Task<TimeEntryDto> CreateManualEntryAsync(UpsertTimeEntryRequest request, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();

        if (request.EndTimeUtc <= request.StartTimeUtc)
        {
            throw new DomainException("End time must be after start time.");
        }

        var overlap = await _db.TimeEntries.AnyAsync(t =>
            t.UserId == userId &&
            !t.IsRunning &&
            t.EndTimeUtc != null &&
            t.StartTimeUtc < request.EndTimeUtc &&
            t.EndTimeUtc > request.StartTimeUtc, ct);

        if (overlap)
        {
            throw new ConflictException("This time range overlaps with an existing logged session.");
        }

        var rate = request.HourlyRate ?? await ResolveMemberRateAsync(orgId, userId, ct);
        var duration = Math.Max(1, (int)Math.Round((request.EndTimeUtc - request.StartTimeUtc).TotalMinutes));

        var entry = new TimeEntry
        {
            OrganizationId = orgId,
            UserId = userId,
            ProjectId = request.ProjectId,
            WorkTaskId = request.WorkTaskId,
            Description = string.IsNullOrWhiteSpace(request.Description) ? "Logged work" : request.Description.Trim(),
            StartTimeUtc = request.StartTimeUtc,
            EndTimeUtc = request.EndTimeUtc,
            DurationMinutes = duration,
            IsRunning = false,
            IsBillable = request.IsBillable,
            HourlyRate = Math.Max(0, rate)
        };

        _db.TimeEntries.Add(entry);
        await _db.SaveChangesAsync(ct);

        var loaded = await _db.TimeEntries.AsNoTracking().Include(t => t.Project).Include(t => t.WorkTask).FirstAsync(t => t.Id == entry.Id, ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { userId }, ct);
        return ToDto(loaded, users);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        var role = _currentUser.RequireRole();

        var entry = await _db.TimeEntries.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundException("Time entry not found.");

        if (entry.UserId != userId && (int)role > (int)OrganizationRole.Manager)
        {
            throw new ForbiddenException("You can only delete your own time entries.");
        }

        entry.IsDeleted = true;
        entry.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    private async Task<decimal> ResolveMemberRateAsync(Guid orgId, Guid userId, CancellationToken ct)
    {
        return await _db.OrganizationMembers.AsNoTracking()
            .Where(m => m.OrganizationId == orgId && m.UserId == userId)
            .Select(m => m.HourlyRate ?? 0m)
            .FirstOrDefaultAsync(ct);
    }

    private static TimeEntryDto ToDto(TimeEntry t, Dictionary<Guid, Application.DTOs.Auth.UserSummaryDto> users)
    {
        var mins = t.IsRunning ? Math.Max(0, (int)Math.Round((DateTime.UtcNow - t.StartTimeUtc).TotalMinutes)) : t.DurationMinutes;
        var amount = t.IsBillable ? Math.Round((mins / 60m) * t.HourlyRate, 2) : 0m;
        return new TimeEntryDto(
            t.Id, t.UserId, users.TryGetValue(t.UserId, out var u) ? u.FullName : "Team Member",
            t.ProjectId, t.Project?.Name, t.WorkTaskId, t.WorkTask?.Title,
            t.Description, t.StartTimeUtc, t.EndTimeUtc, mins, t.IsRunning, t.IsBillable, t.HourlyRate, amount);
    }
}

public sealed class DocumentService : IDocumentService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IFileStorageService _storage;
    private readonly IActivityRecorder _activity;

    public DocumentService(AppDbContext db, ICurrentUserService currentUser, IIdentityService identity, IFileStorageService storage, IActivityRecorder activity)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _storage = storage;
        _activity = activity;
    }

    public async Task<PagedResult<DocumentDto>> GetAllAsync(DocumentQuery query, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var q = _db.Documents.AsNoTracking()
            .Include(d => d.Customer)
            .Include(d => d.Project)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            q = q.Where(d => d.FileName.ToLower().Contains(term) || (d.Description != null && d.Description.ToLower().Contains(term)));
        }

        if (query.Category.HasValue) q = q.Where(d => d.Category == query.Category.Value);
        if (query.CustomerId.HasValue) q = q.Where(d => d.CustomerId == query.CustomerId.Value);
        if (query.ProjectId.HasValue) q = q.Where(d => d.ProjectId == query.ProjectId.Value);

        q = q.OrderByDescending(d => d.CreatedAtUtc);
        var total = await q.CountAsync(ct);
        var rows = await q.Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        var users = await _identity.GetUsersByIdsAsync(rows.Select(r => r.UploadedByUserId), ct);

        return new PagedResult<DocumentDto>
        {
            Items = rows.Select(d => ToDto(d, users)).ToList(),
            TotalCount = total,
            Page = query.Page,
            PageSize = query.PageSize
        };
    }

    public async Task<DocumentDto> UploadAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        long fileSizeBytes,
        DocumentCategory category,
        Guid? customerId,
        Guid? projectId,
        string? description,
        CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();

        var safeFileName = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safeFileName)) throw new DomainException("Invalid file name.");

        var (storedName, savedBytes) = await _storage.SaveAsync(fileStream, safeFileName, contentType, orgId, ct);

        var record = new DocumentRecord
        {
            OrganizationId = orgId,
            FileName = safeFileName,
            StoredFileName = storedName,
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            FileSizeBytes = savedBytes,
            Category = category,
            CustomerId = customerId,
            ProjectId = projectId,
            UploadedByUserId = userId,
            Description = description?.Trim()
        };

        _db.Documents.Add(record);
        await _activity.LogAsync("Document", record.Id, "Uploaded", $"Uploaded document {record.FileName}", customerId: customerId, projectId: projectId, ct: ct);
        await _db.SaveChangesAsync(ct);

        var loaded = await _db.Documents.AsNoTracking().Include(d => d.Customer).Include(d => d.Project).FirstAsync(d => d.Id == record.Id, ct);
        var users = await _identity.GetUsersByIdsAsync(new[] { userId }, ct);
        return ToDto(loaded, users);
    }

    public async Task<(Stream Content, string ContentType, string FileName)> DownloadAsync(Guid id, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var doc = await _db.Documents.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new NotFoundException("Document not found.");

        var stream = await _storage.OpenReadAsync(doc.StoredFileName, orgId, ct);
        return (stream, doc.ContentType, doc.FileName);
    }

    public async Task<DocumentDto> UpdateMetadataAsync(Guid id, RenameDocumentRequest request, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        if (string.IsNullOrWhiteSpace(request.FileName)) throw new DomainException("Document name is required.");

        var doc = await _db.Documents.Include(d => d.Customer).Include(d => d.Project).FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new NotFoundException("Document not found.");

        doc.FileName = Path.GetFileName(request.FileName.Trim());
        doc.Category = request.Category;
        doc.Description = request.Description?.Trim();
        await _db.SaveChangesAsync(ct);

        var users = await _identity.GetUsersByIdsAsync(new[] { doc.UploadedByUserId }, ct);
        return ToDto(doc, users);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw new NotFoundException("Document not found.");

        doc.IsDeleted = true;
        doc.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        await _storage.DeleteAsync(doc.StoredFileName, orgId, ct);
    }

    private static DocumentDto ToDto(DocumentRecord d, Dictionary<Guid, Application.DTOs.Auth.UserSummaryDto> users) =>
        new(
            d.Id, d.FileName, d.ContentType, d.FileSizeBytes, d.Category,
            d.CustomerId, d.Customer?.Name, d.ProjectId, d.Project?.Name,
            users.TryGetValue(d.UploadedByUserId, out var u) ? u.FullName : "Team Member",
            d.Description, d.CreatedAtUtc);
}

public sealed class NotificationService : INotificationService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public NotificationService(AppDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<NotificationDto>> GetMyNotificationsAsync(bool unreadOnly = false, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();

        var q = _db.Notifications.AsNoTracking().Where(n => n.RecipientUserId == userId);
        if (unreadOnly) q = q.Where(n => !n.IsRead);

        return await q.OrderByDescending(n => n.CreatedAtUtc)
            .Take(50)
            .Select(n => new NotificationDto(n.Id, n.Type, n.Title, n.Message, n.EntityType, n.EntityId, n.ActionUrl, n.IsRead, n.CreatedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<int> GetUnreadCountAsync(CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        return await _db.Notifications.AsNoTracking().CountAsync(n => n.RecipientUserId == userId && !n.IsRead, ct);
    }

    public async Task MarkAsReadAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        var notif = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.RecipientUserId == userId, ct)
            ?? throw new NotFoundException("Notification not found.");

        notif.IsRead = true;
        notif.ReadAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task MarkAllAsReadAsync(CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        var unread = await _db.Notifications.Where(n => n.RecipientUserId == userId && !n.IsRead).ToListAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var n in unread)
        {
            n.IsRead = true;
            n.ReadAtUtc = now;
        }
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        _currentUser.RequireOrganizationId();
        var userId = _currentUser.RequireUserId();
        var notif = await _db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.RecipientUserId == userId, ct)
            ?? throw new NotFoundException("Notification not found.");

        notif.IsDeleted = true;
        notif.DeletedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
