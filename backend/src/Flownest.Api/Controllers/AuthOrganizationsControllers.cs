using Flownest.Application.DTOs.Auth;
using Flownest.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Flownest.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IIdentityService _identity;
    private readonly ICurrentUserService _currentUser;

    public AuthController(IIdentityService identity, ICurrentUserService currentUser)
    {
        _identity = identity;
        _currentUser = currentUser;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> Register([FromBody] RegisterRequest request, CancellationToken ct) =>
        Ok(await _identity.RegisterAsync(request, ct));

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponseDto>> Login([FromBody] LoginRequest request, CancellationToken ct) =>
        Ok(await _identity.LoginAsync(request, ct));

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<ForgotPasswordResponse>> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct) =>
        Ok(await _identity.ForgotPasswordAsync(request, ct));

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        await _identity.ResetPasswordAsync(request, ct);
        return NoContent();
    }

    [HttpGet("session")]
    [Authorize]
    public async Task<ActionResult<AuthResponseDto>> GetSession(CancellationToken ct) =>
        Ok(await _identity.RefreshSessionAsync(_currentUser.RequireUserId(), _currentUser.OrganizationId, ct));

    [HttpPut("profile")]
    [Authorize]
    public async Task<ActionResult<UserSummaryDto>> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct) =>
        Ok(await _identity.UpdateProfileAsync(_currentUser.RequireUserId(), request, ct));

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        await _identity.ChangePasswordAsync(_currentUser.RequireUserId(), request, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/organizations")]
[Authorize]
public sealed class OrganizationsController : ControllerBase
{
    private readonly IOrganizationService _organizations;

    public OrganizationsController(IOrganizationService organizations) => _organizations = organizations;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrganizationMembershipDto>>> GetMine(CancellationToken ct) =>
        Ok(await _organizations.GetUserOrganizationsAsync(ct));

    [HttpPost]
    public async Task<ActionResult<OrganizationDetailsDto>> Create([FromBody] CreateOrganizationRequest request, CancellationToken ct) =>
        Ok(await _organizations.CreateAsync(request, ct));

    [HttpGet("current")]
    public async Task<ActionResult<OrganizationDetailsDto>> GetCurrent(CancellationToken ct) =>
        Ok(await _organizations.GetCurrentAsync(ct));

    [HttpPut("current")]
    public async Task<ActionResult<OrganizationDetailsDto>> UpdateCurrent([FromBody] UpdateOrganizationRequest request, CancellationToken ct) =>
        Ok(await _organizations.UpdateCurrentAsync(request, ct));
}
