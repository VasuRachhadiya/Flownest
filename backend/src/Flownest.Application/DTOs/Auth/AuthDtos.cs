using Flownest.Domain.Enums;

namespace Flownest.Application.DTOs.Auth;

public sealed record UserSummaryDto(
    Guid Id,
    string FullName,
    string Email,
    string? AvatarUrl,
    string? PhoneNumber);

public sealed record OrganizationMembershipDto(
    Guid OrganizationId,
    string OrganizationName,
    string Slug,
    string? LogoUrl,
    string CurrencyCode,
    string TimeZone,
    OrganizationRole Role);

public sealed record AuthResponseDto(
    string AccessToken,
    DateTime ExpiresAtUtc,
    UserSummaryDto User,
    Guid? ActiveOrganizationId,
    IReadOnlyList<OrganizationMembershipDto> Organizations);

public sealed record RegisterRequest(
    string FullName,
    string Email,
    string Password,
    string? OrganizationName,
    string? InvitationToken);

public sealed record LoginRequest(string Email, string Password);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ForgotPasswordResponse(
    string Message,
    string? DevelopmentResetToken,
    bool EmailDeliveryConfigured);

public sealed record ResetPasswordRequest(
    string Email,
    string Token,
    string NewPassword);

public sealed record UpdateProfileRequest(
    string FullName,
    string? PhoneNumber,
    string? AvatarUrl);

public sealed record ChangePasswordRequest(
    string CurrentPassword,
    string NewPassword);

public sealed record CreateOrganizationRequest(
    string Name,
    string? ContactEmail,
    string? TimeZone,
    string? CurrencyCode);

public sealed record UpdateOrganizationRequest(
    string Name,
    string? LogoUrl,
    string? ContactEmail,
    string? ContactPhone,
    string? Website,
    string? Address,
    string TimeZone,
    string CurrencyCode,
    string BrandAccentColor);

public sealed record OrganizationDetailsDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string? ContactEmail,
    string? ContactPhone,
    string? Website,
    string? Address,
    string TimeZone,
    string CurrencyCode,
    string BrandAccentColor,
    OrganizationRole CurrentUserRole);
