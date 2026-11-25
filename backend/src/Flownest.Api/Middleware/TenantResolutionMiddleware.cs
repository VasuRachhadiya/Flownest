using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Api.Middleware;

public sealed class TenantResolutionMiddleware
{
    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ICurrentUserService currentUser, AppDbContext db)
    {
        if (currentUser.IsAuthenticated && currentUser.UserId is Guid userId)
        {
            Guid? requestedOrgId = null;

            if (context.Request.Headers.TryGetValue("X-Organization-Id", out var headerVal) &&
                !string.IsNullOrWhiteSpace(headerVal))
            {
                if (!Guid.TryParse(headerVal.ToString(), out var parsed))
                {
                    throw new DomainException("Invalid X-Organization-Id header.");
                }
                requestedOrgId = parsed;
            }
            else
            {
                var claimOrg = context.User.FindFirst("default_org_id")?.Value;
                if (Guid.TryParse(claimOrg, out var parsedClaim))
                {
                    requestedOrgId = parsedClaim;
                }
            }

            if (requestedOrgId.HasValue)
            {
                var membership = await db.OrganizationMembers
                    .AsNoTracking()
                    .Include(m => m.Organization)
                    .FirstOrDefaultAsync(m =>
                        m.OrganizationId == requestedOrgId.Value &&
                        m.UserId == userId &&
                        m.IsActive &&
                        !m.Organization.IsDeleted);

                if (membership is null)
                {
                    throw new ForbiddenException("You do not have access to the requested organization workspace.");
                }

                currentUser.SetOrganizationContext(membership.OrganizationId, membership.Role);
            }
        }

        await _next(context);
    }
}
