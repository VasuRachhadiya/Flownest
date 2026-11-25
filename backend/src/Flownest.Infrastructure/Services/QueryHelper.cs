using Flownest.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Services;

internal static class QueryHelper
{
    public static async Task<PagedResult<TDto>> ToPagedResultAsync<TEntity, TDto>(
        IQueryable<TEntity> query,
        PagedQuery paging,
        Func<TEntity, TDto> mapper,
        CancellationToken ct = default)
    {
        var total = await query.CountAsync(ct);
        var items = await query
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .ToListAsync(ct);

        return new PagedResult<TDto>
        {
            Items = items.Select(mapper).ToList(),
            TotalCount = total,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public static IReadOnlyList<string> SplitTags(string? raw) =>
        string.IsNullOrWhiteSpace(raw)
            ? Array.Empty<string>()
            : raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                 .Distinct(StringComparer.OrdinalIgnoreCase)
                 .ToList();

    public static string? JoinTags(IReadOnlyList<string>? tags) =>
        tags is null || tags.Count == 0
            ? null
            : string.Join(", ", tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim()).Distinct(StringComparer.OrdinalIgnoreCase));
}
