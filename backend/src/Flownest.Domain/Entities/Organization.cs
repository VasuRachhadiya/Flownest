using Flownest.Domain.Common;
using Flownest.Domain.Enums;

namespace Flownest.Domain.Entities;

public class Organization : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Website { get; set; }
    public string? Address { get; set; }
    public string TimeZone { get; set; } = "UTC";
    public string CurrencyCode { get; set; } = "USD";
    public string BrandAccentColor { get; set; } = "#1E3A5F";
    public int NextInvoiceSequence { get; set; } = 1;

    public ICollection<OrganizationMember> Members { get; set; } = new List<OrganizationMember>();
    public ICollection<OrganizationInvitation> Invitations { get; set; } = new List<OrganizationInvitation>();
}

public class OrganizationMember : TenantEntity
{
    public Guid UserId { get; set; }
    public OrganizationRole Role { get; set; } = OrganizationRole.Member;
    public string? JobTitle { get; set; }
    public MemberAvailability Availability { get; set; } = MemberAvailability.Available;
    public decimal? HourlyRate { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime JoinedAtUtc { get; set; } = DateTime.UtcNow;

    public Organization Organization { get; set; } = null!;
}

public class OrganizationInvitation : TenantEntity
{
    public string Email { get; set; } = string.Empty;
    public OrganizationRole Role { get; set; } = OrganizationRole.Member;
    public string Token { get; set; } = string.Empty;
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public Guid InvitedByUserId { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? AcceptedAtUtc { get; set; }

    public Organization Organization { get; set; } = null!;
}
