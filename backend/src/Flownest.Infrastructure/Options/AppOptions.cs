namespace Flownest.Infrastructure.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = "Flownest";
    public string Audience { get; set; } = "Flownest.Clients";
    public string SecretKey { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 480;
}

public sealed class StorageOptions
{
    public const string SectionName = "Storage";
    public string RootPath { get; set; } = "App_Data/Documents";
    public long MaxFileSizeBytes { get; set; } = 15 * 1024 * 1024; // 15 MB
}

public sealed class EmailOptions
{
    public const string SectionName = "Email";
    public bool SmtpConfigured { get; set; }
    public string? FromAddress { get; set; }
}
