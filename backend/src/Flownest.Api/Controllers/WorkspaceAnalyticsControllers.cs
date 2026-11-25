using Flownest.Application.Common;
using Flownest.Application.DTOs.Workspace;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Api.Controllers;

[ApiController]
[Route("api/documents")]
[Authorize]
public sealed class DocumentsController : ControllerBase
{
    private readonly IDocumentService _documents;
    public DocumentsController(IDocumentService documents) => _documents = documents;

    [HttpGet]
    public async Task<ActionResult<PagedResult<DocumentDto>>> GetAll([FromQuery] DocumentQuery query, CancellationToken ct) =>
        Ok(await _documents.GetAllAsync(query, ct));

    [HttpPost]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<DocumentDto>> Upload(
        IFormFile file,
        [FromForm] DocumentCategory category = DocumentCategory.Other,
        [FromForm] Guid? customerId = null,
        [FromForm] Guid? projectId = null,
        [FromForm] string? description = null,
        CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
        {
            throw new DomainException("Please select a non-empty file to upload.");
        }

        await using var stream = file.OpenReadStream();
        var dto = await _documents.UploadAsync(stream, file.FileName, file.ContentType, file.Length, category, customerId, projectId, description, ct);
        return Ok(dto);
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var (content, contentType, fileName) = await _documents.DownloadAsync(id, ct);
        return File(content, contentType, fileName);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DocumentDto>> UpdateMetadata(Guid id, [FromBody] RenameDocumentRequest request, CancellationToken ct) =>
        Ok(await _documents.UpdateMetadataAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _documents.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ControllerBase
{
    private readonly INotificationService _notifications;
    public NotificationsController(INotificationService notifications) => _notifications = notifications;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationDto>>> GetMine([FromQuery] bool unreadOnly = false, CancellationToken ct = default) =>
        Ok(await _notifications.GetMyNotificationsAsync(unreadOnly, ct));

    [HttpGet("unread-count")]
    public async Task<ActionResult<object>> UnreadCount(CancellationToken ct) =>
        Ok(new { count = await _notifications.GetUnreadCountAsync(ct) });

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await _notifications.MarkAsReadAsync(id, ct);
        return NoContent();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        await _notifications.MarkAllAsReadAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _notifications.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/analytics")]
[Authorize]
public sealed class AnalyticsController : ControllerBase
{
    private readonly IDashboardReportService _analytics;
    public AnalyticsController(IDashboardReportService analytics) => _analytics = analytics;

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardOverviewDto>> GetDashboard([FromQuery] DashboardQuery query, CancellationToken ct) =>
        Ok(await _analytics.GetDashboardAsync(query, ct));

    [HttpGet("reports")]
    public async Task<ActionResult<ReportsOverviewDto>> GetReports([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken ct) =>
        Ok(await _analytics.GetReportsAsync(fromUtc, toUtc, ct));

    [HttpGet("reports/export")]
    public async Task<IActionResult> ExportCsv([FromQuery] string reportType = "financial", [FromQuery] DateTime? fromUtc = null, [FromQuery] DateTime? toUtc = null, CancellationToken ct = default)
    {
        var bytes = await _analytics.ExportReportCsvAsync(reportType, fromUtc, toUtc, ct);
        return File(bytes, "text/csv", $"flownest-{reportType}-report-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("search")]
    public async Task<ActionResult<GlobalSearchResultDto>> Search([FromQuery] string q, CancellationToken ct) =>
        Ok(await _analytics.SearchAsync(q, ct));
}

[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    public HealthController(AppDbContext db) => _db = db;

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var canConnect = await _db.Database.CanConnectAsync(ct);
        return canConnect
            ? Ok(new { status = "healthy", database = "connected", timestampUtc = DateTime.UtcNow })
            : StatusCode(503, new { status = "unhealthy", database = "disconnected" });
    }
}
