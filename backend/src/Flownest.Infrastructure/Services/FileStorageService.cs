using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Infrastructure.Options;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Flownest.Infrastructure.Services;

public sealed class LocalFileStorageService : IFileStorageService
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".md",
        ".png", ".jpg", ".jpeg", ".webp", ".svg", ".zip"
    };

    private readonly string _rootDirectory;
    private readonly long _maxFileSizeBytes;

    public LocalFileStorageService(IOptions<StorageOptions> options, IHostEnvironment env)
    {
        var configured = options.Value.RootPath;
        _rootDirectory = Path.IsPathRooted(configured)
            ? configured
            : Path.GetFullPath(Path.Combine(env.ContentRootPath, configured));
        _maxFileSizeBytes = options.Value.MaxFileSizeBytes;
        Directory.CreateDirectory(_rootDirectory);
    }

    public async Task<(string StoredFileName, long SizeBytes)> SaveAsync(
        Stream stream,
        string originalFileName,
        string contentType,
        Guid organizationId,
        CancellationToken ct = default)
    {
        var ext = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExtensions.Contains(ext))
        {
            throw new DomainException($"File extension '{ext}' is not permitted.");
        }

        if (stream.CanSeek && stream.Length > _maxFileSizeBytes)
        {
            throw new DomainException($"File size exceeds the maximum allowed limit of {_maxFileSizeBytes / (1024 * 1024)} MB.");
        }

        var orgFolder = Path.Combine(_rootDirectory, organizationId.ToString("N"));
        Directory.CreateDirectory(orgFolder);

        var storedFileName = $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var fullPath = GetSafeOrgFilePath(organizationId, storedFileName);

        long totalBytes = 0;
        await using var target = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        var buffer = new byte[81920];
        int read;
        while ((read = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            totalBytes += read;
            if (totalBytes > _maxFileSizeBytes)
            {
                target.Close();
                File.Delete(fullPath);
                throw new DomainException($"File size exceeds the maximum allowed limit of {_maxFileSizeBytes / (1024 * 1024)} MB.");
            }
            await target.WriteAsync(buffer.AsMemory(0, read), ct);
        }

        if (totalBytes == 0)
        {
            target.Close();
            File.Delete(fullPath);
            throw new DomainException("Empty files cannot be uploaded.");
        }

        return (storedFileName, totalBytes);
    }

    public Task<Stream> OpenReadAsync(string storedFileName, Guid organizationId, CancellationToken ct = default)
    {
        var fullPath = GetSafeOrgFilePath(organizationId, storedFileName);
        if (!File.Exists(fullPath))
        {
            throw new NotFoundException("Stored document file could not be found.");
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string storedFileName, Guid organizationId, CancellationToken ct = default)
    {
        var fullPath = GetSafeOrgFilePath(organizationId, storedFileName);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
        return Task.CompletedTask;
    }

    private string GetSafeOrgFilePath(Guid organizationId, string storedFileName)
    {
        var cleanName = Path.GetFileName(storedFileName);
        var orgFolder = Path.GetFullPath(Path.Combine(_rootDirectory, organizationId.ToString("N")));
        var fullPath = Path.GetFullPath(Path.Combine(orgFolder, cleanName));
        if (!fullPath.StartsWith(orgFolder, StringComparison.OrdinalIgnoreCase))
        {
            throw new ForbiddenException("Invalid document path.");
        }
        return fullPath;
    }
}
