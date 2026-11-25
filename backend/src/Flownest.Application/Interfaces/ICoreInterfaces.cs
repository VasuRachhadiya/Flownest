using Flownest.Application.DTOs.Auth;
using Flownest.Domain.Entities;
using Flownest.Domain.Enums;

namespace Flownest.Application.Interfaces;

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    string? FullName { get; }
    Guid? OrganizationId { get; }
    OrganizationRole? OrganizationRole { get; }
    bool IsAuthenticated { get; }

    void SetOrganizationContext(Guid organizationId, OrganizationRole role);
    Guid RequireUserId();
    Guid RequireOrganizationId();
    OrganizationRole RequireRole();
    void EnsureMinimumRole(OrganizationRole minimumRole);
}

public interface IIdentityService
{
    Task<AuthResponseDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResponseDto> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<AuthResponseDto> RefreshSessionAsync(Guid userId, Guid? preferredOrgId, CancellationToken ct = default);
    Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
    Task<UserSummaryDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct = default);
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest request, CancellationToken ct = default);
    Task<Dictionary<Guid, UserSummaryDto>> GetUsersByIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct = default);
    Task<UserSummaryDto?> FindByEmailAsync(string email, CancellationToken ct = default);
}

public interface IFileStorageService
{
    Task<(string StoredFileName, long SizeBytes)> SaveAsync(Stream stream, string originalFileName, string contentType, Guid organizationId, CancellationToken ct = default);
    Task<Stream> OpenReadAsync(string storedFileName, Guid organizationId, CancellationToken ct = default);
    Task DeleteAsync(string storedFileName, Guid organizationId, CancellationToken ct = default);
}

public interface IActivityRecorder
{
    Task LogAsync(string entityType, Guid entityId, string action, string summary, Guid? customerId = null, Guid? projectId = null, CancellationToken ct = default);
    Task NotifyAsync(Guid recipientUserId, NotificationType type, string title, string message, string? entityType = null, Guid? entityId = null, string? actionUrl = null, CancellationToken ct = default);
}
