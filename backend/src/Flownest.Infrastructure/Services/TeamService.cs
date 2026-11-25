using System.Security.Cryptography;
using Flownest.Application.DTOs.Auth;
using Flownest.Application.DTOs.Workspace;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Flownest.Infrastructure.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Flownest.Infrastructure.Services;

public sealed class TeamService : ITeamService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;
    private readonly IIdentityService _identity;
    private readonly IActivityRecorder _activity;
    private readonly EmailOptions _emailOptions;

    public TeamService(
        AppDbContext db,
        ICurrentUserService currentUser,
        IIdentityService identity,
        IActivityRecorder activity,
        IOptions<EmailOptions> emailOptions)
    {
        _db = db;
        _currentUser = currentUser;
        _identity = identity;
        _activity = activity;
        _emailOptions = emailOptions.Value;
    }

    public async Task<IReadOnlyList<TeamMemberDto>> GetMembersAsync(CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var members = await _db.OrganizationMembers.AsNoTracking()
            .Where(m => m.OrganizationId == orgId)
            .OrderBy(m => m.Role).ThenBy(m => m.JoinedAtUtc)
            .ToListAsync(ct);

        var userIds = members.Select(m => m.UserId).ToList();
        var users = await _identity.GetUsersByIdsAsync(userIds, ct);

        var activeProjectsByUser = await _db.ProjectMembers.AsNoTracking()
            .Include(pm => pm.Project)
            .Where(pm => pm.Project.Status == ProjectStatus.Active)
            .GroupBy(pm => pm.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

        var tasksByUser = await _db.TaskAssignees.AsNoTracking()
            .Include(ta => ta.WorkTask)
            .GroupBy(ta => ta.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                Pending = g.Count(x => x.WorkTask.Status != WorkTaskStatus.Completed),
                Completed = g.Count(x => x.WorkTask.Status == WorkTaskStatus.Completed)
            })
            .ToDictionaryAsync(x => x.UserId, ct);

        return members.Select(m =>
        {
            users.TryGetValue(m.UserId, out var user);
            activeProjectsByUser.TryGetValue(m.UserId, out var projCount);
            tasksByUser.TryGetValue(m.UserId, out var taskStats);

            return new TeamMemberDto(
                m.Id,
                m.UserId,
                user?.FullName ?? "Workspace Member",
                user?.Email ?? string.Empty,
                m.JobTitle,
                m.Role,
                m.Availability,
                m.HourlyRate,
                m.IsActive,
                projCount,
                taskStats?.Pending ?? 0,
                taskStats?.Completed ?? 0,
                m.JoinedAtUtc);
        }).ToList();
    }

    public async Task<TeamMemberDto> UpdateMemberAsync(Guid memberId, UpdateTeamMemberRequest request, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Admin);
        var orgId = _currentUser.RequireOrganizationId();
        var actorRole = _currentUser.RequireRole();

        var member = await _db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.Id == memberId && m.OrganizationId == orgId, ct)
            ?? throw new NotFoundException("Team member not found.");

        if (member.Role == OrganizationRole.Owner && actorRole != OrganizationRole.Owner)
        {
            throw new ForbiddenException("Only an Owner can modify another Owner.");
        }

        if (request.Role == OrganizationRole.Owner && actorRole != OrganizationRole.Owner)
        {
            throw new ForbiddenException("Only an Owner can grant the Owner role.");
        }

        if (member.Role == OrganizationRole.Owner && request.Role != OrganizationRole.Owner)
        {
            var ownerCount = await _db.OrganizationMembers.CountAsync(m => m.OrganizationId == orgId && m.Role == OrganizationRole.Owner && m.IsActive, ct);
            if (ownerCount <= 1)
            {
                throw new DomainException("Workspace must retain at least one active Owner.");
            }
        }

        member.Role = request.Role;
        member.JobTitle = request.JobTitle?.Trim();
        member.Availability = request.Availability;
        member.HourlyRate = request.HourlyRate;
        member.IsActive = request.IsActive;

        await _activity.LogAsync("TeamMember", member.Id, "Updated", $"Updated member role to {member.Role}", ct: ct);
        await _db.SaveChangesAsync(ct);

        var all = await GetMembersAsync(ct);
        return all.First(x => x.MemberId == memberId);
    }

    public async Task RemoveMemberAsync(Guid memberId, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Admin);
        var orgId = _currentUser.RequireOrganizationId();

        var member = await _db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.Id == memberId && m.OrganizationId == orgId, ct)
            ?? throw new NotFoundException("Team member not found.");

        if (member.Role == OrganizationRole.Owner)
        {
            var ownerCount = await _db.OrganizationMembers.CountAsync(m => m.OrganizationId == orgId && m.Role == OrganizationRole.Owner && m.IsActive, ct);
            if (ownerCount <= 1) throw new DomainException("Cannot remove the sole Owner of the workspace.");
        }

        member.IsDeleted = true;
        member.DeletedAtUtc = DateTime.UtcNow;
        member.IsActive = false;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<InvitationDto>> GetInvitationsAsync(CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Manager);
        var orgId = _currentUser.RequireOrganizationId();

        return await _db.OrganizationInvitations.AsNoTracking()
            .Where(i => i.OrganizationId == orgId)
            .OrderByDescending(i => i.CreatedAtUtc)
            .Select(i => new InvitationDto(i.Id, i.Email, i.Role, i.Status, i.Token, i.ExpiresAtUtc, i.CreatedAtUtc))
            .ToListAsync(ct);
    }

    public async Task<CreateInvitationResponse> InviteAsync(CreateInvitationRequest request, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Admin);
        var orgId = _currentUser.RequireOrganizationId();
        var actorId = _currentUser.RequireUserId();

        if (string.IsNullOrWhiteSpace(request.Email)) throw new DomainException("Email address is required.");
        if (request.Role == OrganizationRole.Owner) throw new ForbiddenException("Invitations cannot directly assign Owner role.");

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var existingUser = await _identity.FindByEmailAsync(normalizedEmail, ct);
        if (existingUser is not null)
        {
            var alreadyMember = await _db.OrganizationMembers.AnyAsync(m => m.OrganizationId == orgId && m.UserId == existingUser.Id, ct);
            if (alreadyMember) throw new ConflictException("This user is already a member of the workspace.");
        }

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var invitation = new OrganizationInvitation
        {
            OrganizationId = orgId,
            Email = normalizedEmail,
            Role = request.Role,
            Token = token,
            Status = InvitationStatus.Pending,
            InvitedByUserId = actorId,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7)
        };

        _db.OrganizationInvitations.Add(invitation);
        await _activity.LogAsync("Invitation", invitation.Id, "Created", $"Created invitation for {normalizedEmail} as {request.Role}", ct: ct);
        await _db.SaveChangesAsync(ct);

        var dto = new InvitationDto(invitation.Id, invitation.Email, invitation.Role, invitation.Status, invitation.Token, invitation.ExpiresAtUtc, invitation.CreatedAtUtc);
        var instruction = _emailOptions.SmtpConfigured
            ? "Invitation email dispatched via configured SMTP provider."
            : "SMTP email delivery is not configured. Share this secure invitation token or join link directly with your teammate.";

        return new CreateInvitationResponse(dto, instruction, _emailOptions.SmtpConfigured);
    }

    public async Task RevokeInvitationAsync(Guid invitationId, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Admin);
        var orgId = _currentUser.RequireOrganizationId();

        var inv = await _db.OrganizationInvitations
            .FirstOrDefaultAsync(i => i.Id == invitationId && i.OrganizationId == orgId, ct)
            ?? throw new NotFoundException("Invitation not found.");

        inv.Status = InvitationStatus.Revoked;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<OrganizationMembershipDto> AcceptInvitationAsync(AcceptInvitationRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();
        var userEmail = _currentUser.Email ?? string.Empty;

        var inv = await _db.OrganizationInvitations
            .Include(i => i.Organization)
            .FirstOrDefaultAsync(i => i.Token == request.Token.Trim() && i.Status == InvitationStatus.Pending, ct)
            ?? throw new NotFoundException("Invitation token is invalid or no longer active.");

        if (inv.ExpiresAtUtc < DateTime.UtcNow)
        {
            inv.Status = InvitationStatus.Expired;
            await _db.SaveChangesAsync(ct);
            throw new DomainException("This invitation has expired.");
        }

        if (!string.Equals(inv.Email, userEmail, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("This invitation was issued for a different email address.");
        }

        var existingMember = await _db.OrganizationMembers
            .FirstOrDefaultAsync(m => m.OrganizationId == inv.OrganizationId && m.UserId == userId, ct);

        if (existingMember is null)
        {
            existingMember = new OrganizationMember
            {
                OrganizationId = inv.OrganizationId,
                UserId = userId,
                Role = inv.Role,
                Availability = MemberAvailability.Available,
                IsActive = true,
                JoinedAtUtc = DateTime.UtcNow
            };
            _db.OrganizationMembers.Add(existingMember);
        }

        inv.Status = InvitationStatus.Accepted;
        inv.AcceptedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new OrganizationMembershipDto(
            inv.OrganizationId, inv.Organization.Name, inv.Organization.Slug,
            inv.Organization.LogoUrl, inv.Organization.CurrencyCode, inv.Organization.TimeZone, existingMember.Role);
    }
}
