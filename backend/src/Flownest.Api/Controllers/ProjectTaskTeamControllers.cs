using Flownest.Application.Common;
using Flownest.Application.DTOs.Projects;
using Flownest.Application.DTOs.Workspace;
using Flownest.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Flownest.Api.Controllers;

[ApiController]
[Route("api/projects")]
[Authorize]
public sealed class ProjectsController : ControllerBase
{
    private readonly IProjectService _projects;
    public ProjectsController(IProjectService projects) => _projects = projects;

    [HttpGet]
    public async Task<ActionResult<PagedResult<ProjectDto>>> GetAll([FromQuery] ProjectQuery query, CancellationToken ct) =>
        Ok(await _projects.GetAllAsync(query, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProjectDetailDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await _projects.GetByIdAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<ProjectDto>> Create([FromBody] UpsertProjectRequest request, CancellationToken ct) =>
        Ok(await _projects.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjectDto>> Update(Guid id, [FromBody] UpsertProjectRequest request, CancellationToken ct) =>
        Ok(await _projects.UpdateAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _projects.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/tasks")]
[Authorize]
public sealed class TasksController : ControllerBase
{
    private readonly IWorkTaskService _tasks;
    public TasksController(IWorkTaskService tasks) => _tasks = tasks;

    [HttpGet]
    public async Task<ActionResult<PagedResult<WorkTaskDto>>> GetAll([FromQuery] WorkTaskQuery query, CancellationToken ct) =>
        Ok(await _tasks.GetAllAsync(query, ct));

    [HttpGet("{id:guid}/comments")]
    public async Task<ActionResult<IReadOnlyList<TaskCommentDto>>> GetComments(Guid id, CancellationToken ct) =>
        Ok(await _tasks.GetCommentsAsync(id, ct));

    [HttpPost]
    public async Task<ActionResult<WorkTaskDto>> Create([FromBody] UpsertWorkTaskRequest request, CancellationToken ct) =>
        Ok(await _tasks.CreateAsync(request, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<WorkTaskDto>> Update(Guid id, [FromBody] UpsertWorkTaskRequest request, CancellationToken ct) =>
        Ok(await _tasks.UpdateAsync(id, request, ct));

    [HttpPatch("{id:guid}/move")]
    public async Task<ActionResult<WorkTaskDto>> Move(Guid id, [FromBody] MoveTaskRequest request, CancellationToken ct) =>
        Ok(await _tasks.MoveAsync(id, request, ct));

    [HttpPost("{id:guid}/comments")]
    public async Task<ActionResult<TaskCommentDto>> AddComment(Guid id, [FromBody] AddTaskCommentRequest request, CancellationToken ct) =>
        Ok(await _tasks.AddCommentAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _tasks.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/team")]
[Authorize]
public sealed class TeamController : ControllerBase
{
    private readonly ITeamService _team;
    public TeamController(ITeamService team) => _team = team;

    [HttpGet("members")]
    public async Task<ActionResult<IReadOnlyList<TeamMemberDto>>> GetMembers(CancellationToken ct) =>
        Ok(await _team.GetMembersAsync(ct));

    [HttpPut("members/{memberId:guid}")]
    public async Task<ActionResult<TeamMemberDto>> UpdateMember(Guid memberId, [FromBody] UpdateTeamMemberRequest request, CancellationToken ct) =>
        Ok(await _team.UpdateMemberAsync(memberId, request, ct));

    [HttpDelete("members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid memberId, CancellationToken ct)
    {
        await _team.RemoveMemberAsync(memberId, ct);
        return NoContent();
    }

    [HttpGet("invitations")]
    public async Task<ActionResult<IReadOnlyList<InvitationDto>>> GetInvitations(CancellationToken ct) =>
        Ok(await _team.GetInvitationsAsync(ct));

    [HttpPost("invitations")]
    public async Task<ActionResult<CreateInvitationResponse>> Invite([FromBody] CreateInvitationRequest request, CancellationToken ct) =>
        Ok(await _team.InviteAsync(request, ct));

    [HttpDelete("invitations/{invitationId:guid}")]
    public async Task<IActionResult> Revoke(Guid invitationId, CancellationToken ct)
    {
        await _team.RevokeInvitationAsync(invitationId, ct);
        return NoContent();
    }

    [HttpPost("invitations/accept")]
    public async Task<IActionResult> Accept([FromBody] AcceptInvitationRequest request, CancellationToken ct) =>
        Ok(await _team.AcceptInvitationAsync(request, ct));
}
