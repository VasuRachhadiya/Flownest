using System.Security.Claims;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace Flownest.Infrastructure.Services;

public sealed class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private Guid? _resolvedOrganizationId;
    private OrganizationRole? _resolvedRole;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated == true;

    public Guid? UserId
    {
        get
        {
            var raw = User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? User?.FindFirstValue("sub");
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }

    public string? Email => User?.FindFirstValue(ClaimTypes.Email) ?? User?.FindFirstValue("email");
    public string? FullName => User?.FindFirstValue(ClaimTypes.Name) ?? User?.FindFirstValue("name");

    public Guid? OrganizationId => _resolvedOrganizationId;
    public OrganizationRole? OrganizationRole => _resolvedRole;

    public void SetOrganizationContext(Guid organizationId, OrganizationRole role)
    {
        _resolvedOrganizationId = organizationId;
        _resolvedRole = role;
    }

    public Guid RequireUserId() =>
        UserId ?? throw new UnauthorizedException("User is not authenticated.");

    public Guid RequireOrganizationId() =>
        OrganizationId ?? throw new ForbiddenException("An active organization workspace is required.");

    public OrganizationRole RequireRole() =>
        OrganizationRole ?? throw new ForbiddenException("Organization membership role could not be resolved.");

    public void EnsureMinimumRole(OrganizationRole minimumRole)
    {
        var role = RequireRole();
        // Owner = 1, Admin = 2, Manager = 3, Member = 4 (lower numeric value = higher privilege)
        if ((int)role > (int)minimumRole)
        {
            throw new ForbiddenException($"Requires {minimumRole} role or higher.");
        }
    }
}
