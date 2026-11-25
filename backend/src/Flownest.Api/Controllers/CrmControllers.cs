using Flownest.Application.Common;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flownest.Api.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public sealed class CustomersController : ControllerBase
{
    private readonly ICustomerService _customers;
    public CustomersController(ICustomerService customers) => _customers = customers;

    [HttpGet]
    public async Task<ActionResult<PagedResult<CustomerDto>>> GetAll([FromQuery] CustomerQuery query, CancellationToken ct) =>
        Ok(await _customers.GetAllAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDetailDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await _customers.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create([FromBody] UpsertCustomerRequest request, CancellationToken ct) =>
        Ok(await _customers.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Update(Guid id, [FromBody] UpsertCustomerRequest request, CancellationToken ct) =>
        Ok(await _customers.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _customers.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/leads")]
[Authorize]
public sealed class LeadsController : ControllerBase
{
    private readonly ILeadService _leads;
    public LeadsController(ILeadService leads) => _leads = leads;

    [HttpGet]
    public async Task<ActionResult<PagedResult<LeadDto>>> GetAll([FromQuery] LeadQuery query, CancellationToken ct) =>
        Ok(await _leads.GetAllAsync(query, ct));

    [HttpGet("stats")]
    public async Task<ActionResult<LeadPipelineStatsDto>> GetStats(CancellationToken ct) =>
        Ok(await _leads.GetPipelineStatsAsync(ct));

    [HttpPost]
    public async Task<ActionResult<LeadDto>> Create([FromBody] UpsertLeadRequest request, CancellationToken ct) =>
        Ok(await _leads.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<LeadDto>> Update(Guid id, [FromBody] UpsertLeadRequest request, CancellationToken ct) =>
        Ok(await _leads.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/stage")]
    public async Task<ActionResult<LeadDto>> ChangeStage(Guid id, [FromBody] ChangeLeadStageRequest request, CancellationToken ct) =>
        Ok(await _leads.ChangeStageAsync(id, request.Stage, ct));

    [HttpPost("{id:guid}/convert")]
    public async Task<ActionResult<CustomerDto>> Convert(Guid id, CancellationToken ct) =>
        Ok(await _leads.ConvertToCustomerAsync(id, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _leads.DeleteAsync(id, ct);
        return NoContent();
    }
}
