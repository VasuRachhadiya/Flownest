using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Flownest.Application.DTOs.Auth;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Flownest.Infrastructure.Identity;
using Flownest.Infrastructure.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Flownest.Infrastructure.Services;

public sealed class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _db;
    private readonly JwtOptions _jwtOptions;
    private readonly EmailOptions _emailOptions;
    private readonly IHostEnvironment _env;
    private readonly ILogger<IdentityService> _logger;

    public IdentityService(
        UserManager<ApplicationUser> userManager,
        AppDbContext db,
        IOptions<JwtOptions> jwtOptions,
        IOptions<EmailOptions> emailOptions,
        IHostEnvironment env,
        ILogger<IdentityService> logger)
    {
        _userManager = userManager;
        _db = db;
        _jwtOptions = jwtOptions.Value;
        _emailOptions = emailOptions.Value;
        _env = env;
        _logger = logger;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            throw new DomainException("Full name, email, and password are required.");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existing = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existing is not null)
        {
            throw new ConflictException("An account with this email already exists.");
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = normalizedEmail,
            Email = normalizedEmail,
            FullName = request.FullName.Trim(),
            EmailConfirmed = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            var errors = string.Join(" ", createResult.Errors.Select(e => e.Description));
            throw new DomainException(errors);
        }

        Guid? activeOrgId = null;

        if (!string.IsNullOrWhiteSpace(request.InvitationToken))
        {
            var invitation = await _db.OrganizationInvitations
                .FirstOrDefaultAsync(i => i.Token == request.InvitationToken.Trim() && i.Status == InvitationStatus.Pending, ct);

            if (invitation is null || invitation.ExpiresAtUtc < DateTime.UtcNow)
            {
                throw new DomainException("The invitation token is invalid or has expired.");
            }

            if (!string.Equals(invitation.Email, normalizedEmail, StringComparison.OrdinalIgnoreCase))
            {
                throw new ForbiddenException("This invitation was issued for a different email address.");
            }

            _db.OrganizationMembers.Add(new OrganizationMember
            {
                OrganizationId = invitation.OrganizationId,
                UserId = user.Id,
                Role = invitation.Role,
                Availability = MemberAvailability.Available,
                IsActive = true,
                JoinedAtUtc = DateTime.UtcNow
            });

            invitation.Status = InvitationStatus.Accepted;
            invitation.AcceptedAtUtc = DateTime.UtcNow;
            activeOrgId = invitation.OrganizationId;
            await _db.SaveChangesAsync(ct);
        }
        else if (!string.IsNullOrWhiteSpace(request.OrganizationName))
        {
            var org = new Organization
            {
                Name = request.OrganizationName.Trim(),
                Slug = await GenerateUniqueSlugAsync(request.OrganizationName.Trim(), ct),
                ContactEmail = normalizedEmail,
                TimeZone = "UTC",
                CurrencyCode = "USD"
            };
            _db.Organizations.Add(org);
            _db.OrganizationMembers.Add(new OrganizationMember
            {
                OrganizationId = org.Id,
                UserId = user.Id,
                Role = OrganizationRole.Owner,
                JobTitle = "Founder / Owner",
                Availability = MemberAvailability.Available,
                IsActive = true,
                JoinedAtUtc = DateTime.UtcNow
            });
            activeOrgId = org.Id;
            await _db.SaveChangesAsync(ct);
        }

        return await BuildAuthResponseAsync(user, activeOrgId, ct);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new DomainException("Email and password are required.");
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (user is null || !await _userManager.CheckPasswordAsync(user, request.Password))
        {
            throw new UnauthorizedException("Invalid email or password.");
        }

        return await BuildAuthResponseAsync(user, null, ct);
    }

    public async Task<AuthResponseDto> RefreshSessionAsync(Guid userId, Guid? preferredOrgId, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new UnauthorizedException("User session is no longer valid.");

        return await BuildAuthResponseAsync(user, preferredOrgId, ct);
    }

    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            throw new DomainException("Email is required.");
        }

        var user = await _userManager.FindByEmailAsync(request.Email.Trim());
        string? devToken = null;
        if (user is not null)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            if (_env.IsDevelopment() && !_emailOptions.SmtpConfigured)
            {
                devToken = token;
            }
            _logger.LogInformation("Password reset requested for {Email}. SMTP configured: {SmtpConfigured}", user.Email, _emailOptions.SmtpConfigured);
        }

        var message = _emailOptions.SmtpConfigured
            ? "If an account exists for that email, password reset instructions have been sent."
            : "Password reset token generated. Configure SMTP in Email settings to send reset links automatically.";

        return new ForgotPasswordResponse(message, devToken, _emailOptions.SmtpConfigured);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        var user = await _userManager.FindByEmailAsync(request.Email.Trim())
            ?? throw new DomainException("Invalid password reset request.");

        var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
        if (!result.Succeeded)
        {
            throw new DomainException(string.Join(" ", result.Errors.Select(e => e.Description)));
        }
    }

    public async Task<UserSummaryDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new DomainException("Full name is required.");
        }

        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User account not found.");

        user.FullName = request.FullName.Trim();
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
        user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        user.UpdatedAtUtc = DateTime.UtcNow;

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            throw new DomainException(string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        return ToSummary(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User account not found.");

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            throw new DomainException(string.Join(" ", result.Errors.Select(e => e.Description)));
        }
    }

    public async Task<Dictionary<Guid, UserSummaryDto>> GetUsersByIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct = default)
    {
        var ids = userIds.Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<Guid, UserSummaryDto>();

        return await _userManager.Users
            .Where(u => ids.Contains(u.Id))
            .Select(u => ToSummary(u))
            .ToDictionaryAsync(u => u.Id, ct);
    }

    public async Task<UserSummaryDto?> FindByEmailAsync(string email, CancellationToken ct = default)
    {
        var user = await _userManager.FindByEmailAsync(email.Trim());
        return user is null ? null : ToSummary(user);
    }

    private async Task<AuthResponseDto> BuildAuthResponseAsync(ApplicationUser user, Guid? preferredOrgId, CancellationToken ct)
    {
        var memberships = await _db.OrganizationMembers
            .Include(m => m.Organization)
            .Where(m => m.UserId == user.Id && m.IsActive && !m.Organization.IsDeleted)
            .OrderBy(m => m.JoinedAtUtc)
            .Select(m => new OrganizationMembershipDto(
                m.OrganizationId,
                m.Organization.Name,
                m.Organization.Slug,
                m.Organization.LogoUrl,
                m.Organization.CurrencyCode,
                m.Organization.TimeZone,
                m.Role))
            .ToListAsync(ct);

        Guid? activeOrgId = preferredOrgId.HasValue && memberships.Any(m => m.OrganizationId == preferredOrgId.Value)
            ? preferredOrgId
            : memberships.FirstOrDefault()?.OrganizationId;

        var expiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.FullName),
            new("name", user.FullName)
        };

        if (activeOrgId.HasValue)
        {
            claims.Add(new Claim("default_org_id", activeOrgId.Value.ToString()));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);

        return new AuthResponseDto(
            accessToken,
            expiresAtUtc,
            ToSummary(user),
            activeOrgId,
            memberships);
    }

    private async Task<string> GenerateUniqueSlugAsync(string name, CancellationToken ct)
    {
        var baseSlug = new string(name.ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray()).Trim('-');
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "workspace";
        var slug = baseSlug;
        var suffix = 1;
        while (await _db.Organizations.IgnoreQueryFilters().AnyAsync(o => o.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{++suffix}";
        }
        return slug;
    }

    private static UserSummaryDto ToSummary(ApplicationUser u) =>
        new(u.Id, u.FullName, u.Email ?? string.Empty, u.AvatarUrl, u.PhoneNumber);
}
