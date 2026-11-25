using Flownest.Application.Common;
using Flownest.Application.DTOs.Finance;
using Flownest.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flownest.Api.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public sealed class InvoicesController : ControllerBase
{
    private readonly IInvoiceService _invoices;
    public InvoicesController(IInvoiceService invoices) => _invoices = invoices;

    [HttpGet]
    public async Task<ActionResult<PagedResult<InvoiceDto>>> GetAll([FromQuery] InvoiceQuery query, CancellationToken ct) =>
        Ok(await _invoices.GetAllAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<InvoiceDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await _invoices.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<InvoiceDto>> Create([FromBody] UpsertInvoiceRequest request, CancellationToken ct) =>
        Ok(await _invoices.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<InvoiceDto>> Update(Guid id, [FromBody] UpsertInvoiceRequest request, CancellationToken ct) =>
        Ok(await _invoices.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<InvoiceDto>> UpdateStatus(Guid id, [FromBody] UpdateInvoiceStatusRequest request, CancellationToken ct) =>
        Ok(await _invoices.UpdateStatusAsync(id, request.Status, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteDraft(Guid id, CancellationToken ct)
    {
        await _invoices.DeleteDraftAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/payments")]
[Authorize]
public sealed class PaymentsController : ControllerBase
{
    private readonly IPaymentService _payments;
    public PaymentsController(IPaymentService payments) => _payments = payments;

    [HttpGet]
    public async Task<ActionResult<PagedResult<PaymentDto>>> GetAll([FromQuery] PaymentQuery query, CancellationToken ct) =>
        Ok(await _payments.GetAllAsync(query, ct));

    [HttpGet("summary")]
    public async Task<ActionResult<PaymentSummaryDto>> GetSummary(CancellationToken ct) =>
        Ok(await _payments.GetSummaryAsync(ct));

    [HttpPost]
    public async Task<ActionResult<PaymentDto>> Record([FromBody] RecordPaymentRequest request, CancellationToken ct) =>
        Ok(await _payments.RecordPaymentAsync(request, ct));
}

[ApiController]
[Route("api/expenses")]
[Authorize]
public sealed class ExpensesController : ControllerBase
{
    private readonly IExpenseService _expenses;
    public ExpensesController(IExpenseService expenses) => _expenses = expenses;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ExpenseDto>>> GetAll([FromQuery] ExpenseQuery query, CancellationToken ct) =>
        Ok(await _expenses.GetAllAsync(query, ct));

    [HttpGet("analytics")]
    public async Task<ActionResult<ExpenseAnalyticsDto>> GetAnalytics([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken ct) =>
        Ok(await _expenses.GetAnalyticsAsync(fromUtc, toUtc, ct));

    [HttpPost]
    public async Task<ActionResult<ExpenseDto>> Create([FromBody] UpsertExpenseRequest request, CancellationToken ct) =>
        Ok(await _expenses.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ExpenseDto>> Update(Guid id, [FromBody] UpsertExpenseRequest request, CancellationToken ct) =>
        Ok(await _expenses.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _expenses.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/time-entries")]
[Authorize]
public sealed class TimeEntriesController : ControllerBase
{
    private readonly ITimeTrackingService _time;
    public TimeEntriesController(ITimeTrackingService time) => _time = time;

    [HttpGet]
    public async Task<ActionResult<PagedResult<TimeEntryDto>>> GetAll([FromQuery] TimeEntryQuery query, CancellationToken ct) =>
        Ok(await _time.GetAllAsync(query, ct));

    [HttpGet("summary")]
    public async Task<ActionResult<TimeSummaryDto>> GetSummary([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken ct) =>
        Ok(await _time.GetSummaryAsync(fromUtc, toUtc, ct));

    [HttpPost("start")]
    public async Task<ActionResult<TimeEntryDto>> Start([FromBody] StartTimerRequest request, CancellationToken ct) =>
        Ok(await _time.StartTimerAsync(request, ct));

    [HttpPost("{id:guid}/stop")]
    public async Task<ActionResult<TimeEntryDto>> Stop(Guid id, CancellationToken ct) =>
        Ok(await _time.StopTimerAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<TimeEntryDto>> CreateManual([FromBody] UpsertTimeEntryRequest request, CancellationToken ct) =>
        Ok(await _time.CreateManualEntryAsync(request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _time.DeleteAsync(id, ct);
        return NoContent();
    }
}
