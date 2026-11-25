using Flownest.Application.DTOs.Auth;
using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

public sealed class OrganizationService : IOrganizationService
{
    private readonly AppDbContext _db;
    private readonly ICurrentUserService _currentUser;

    public OrganizationService(AppDbContext db, ICurrentUserService currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<OrganizationMembershipDto>> GetUserOrganizationsAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();
        return await _db.OrganizationMembers
            .Include(m => m.Organization)
            .Where(m => m.UserId == userId && m.IsActive && !m.Organization.IsDeleted)
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
    }

    public async Task<OrganizationDetailsDto> CreateAsync(CreateOrganizationRequest request, CancellationToken ct = default)
    {
        var userId = _currentUser.RequireUserId();
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new DomainException("Organization name is required.");
        }

        var baseSlug = new string(request.Name.Trim().ToLowerInvariant().Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray()).Trim('-');
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "workspace";
        var slug = baseSlug;
        var suffix = 1;
        while (await _db.Organizations.IgnoreQueryFilters().AnyAsync(o => o.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{++suffix}";
        }

        var org = new Organization
        {
            Name = request.Name.Trim(),
            Slug = slug,
            ContactEmail = string.IsNullOrWhiteSpace(request.ContactEmail) ? _currentUser.Email : request.ContactEmail.Trim(),
            TimeZone = string.IsNullOrWhiteSpace(request.TimeZone) ? "UTC" : request.TimeZone.Trim(),
            CurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? "USD" : request.CurrencyCode.Trim().ToUpperInvariant()
        };

        _db.Organizations.Add(org);
        _db.OrganizationMembers.Add(new OrganizationMember
        {
            OrganizationId = org.Id,
            UserId = userId,
            Role = OrganizationRole.Owner,
            JobTitle = "Owner",
            Availability = MemberAvailability.Available,
            IsActive = true,
            JoinedAtUtc = DateTime.UtcNow
        });

        await _db.SaveChangesAsync(ct);

        return new OrganizationDetailsDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.ContactEmail, org.ContactPhone,
            org.Website, org.Address, org.TimeZone, org.CurrencyCode, org.BrandAccentColor, OrganizationRole.Owner);
    }

    public async Task<OrganizationDetailsDto> GetCurrentAsync(CancellationToken ct = default)
    {
        var orgId = _currentUser.RequireOrganizationId();
        var role = _currentUser.RequireRole();
        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct)
            ?? throw new NotFoundException("Organization not found.");

        return new OrganizationDetailsDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.ContactEmail, org.ContactPhone,
            org.Website, org.Address, org.TimeZone, org.CurrencyCode, org.BrandAccentColor, role);
    }

    public async Task<OrganizationDetailsDto> UpdateCurrentAsync(UpdateOrganizationRequest request, CancellationToken ct = default)
    {
        _currentUser.EnsureMinimumRole(OrganizationRole.Admin);
        var orgId = _currentUser.RequireOrganizationId();
        var role = _currentUser.RequireRole();

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new DomainException("Organization name is required.");
        }

        var org = await _db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct)
            ?? throw new NotFoundException("Organization not found.");

        org.Name = request.Name.Trim();
        org.LogoUrl = string.IsNullOrWhiteSpace(request.LogoUrl) ? null : request.LogoUrl.Trim();
        org.ContactEmail = string.IsNullOrWhiteSpace(request.ContactEmail) ? null : request.ContactEmail.Trim();
        org.ContactPhone = string.IsNullOrWhiteSpace(request.ContactPhone) ? null : request.ContactPhone.Trim();
        org.Website = string.IsNullOrWhiteSpace(request.Website) ? null : request.Website.Trim();
        org.Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();
        org.TimeZone = string.IsNullOrWhiteSpace(request.TimeZone) ? "UTC" : request.TimeZone.Trim();
        org.CurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? "USD" : request.CurrencyCode.Trim().ToUpperInvariant();
        org.BrandAccentColor = string.IsNullOrWhiteSpace(request.BrandAccentColor) ? "#1E3A5F" : request.BrandAccentColor.Trim();

        await _db.SaveChangesAsync(ct);

        return new OrganizationDetailsDto(
            org.Id, org.Name, org.Slug, org.LogoUrl, org.ContactEmail, org.ContactPhone,
            org.Website, org.Address, org.TimeZone, org.CurrencyCode, org.BrandAccentColor, role);
    }
}
