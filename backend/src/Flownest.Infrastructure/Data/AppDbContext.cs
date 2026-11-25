using Flownest.Application.Interfaces;
using Flownest.Domain.Common;
using Flownest.Domain.Entities;
using Flownest.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Flownest.Infrastructure.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    private readonly ICurrentUserService? _currentUserService;

    public AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUserService? currentUserService = null)
        : base(options)
    {
        _currentUserService = currentUserService;
    }

    // Expose property so EF Core translates query filters dynamically per DbContext instance
    private Guid? CurrentOrgId => _currentUserService?.OrganizationId;

    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
    public DbSet<OrganizationInvitation> OrganizationInvitations => Set<OrganizationInvitation>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<WorkTask> WorkTasks => Set<WorkTask>();
    public DbSet<TaskAssignee> TaskAssignees => Set<TaskAssignee>();
    public DbSet<TaskComment> TaskComments => Set<TaskComment>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Expense> Expenses => Set<Expense>();
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
    public DbSet<DocumentRecord> Documents => Set<DocumentRecord>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Soft-delete filters for organization root entities
        builder.Entity<Organization>().HasQueryFilter(e => !e.IsDeleted);
        builder.Entity<OrganizationMember>().HasQueryFilter(e => !e.IsDeleted);
        builder.Entity<OrganizationInvitation>().HasQueryFilter(e => !e.IsDeleted);

        // Tenant-isolated + soft-delete global query filters
        builder.Entity<Customer>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<Lead>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<Project>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<ProjectMember>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<WorkTask>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<TaskAssignee>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<TaskComment>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<Invoice>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<InvoiceItem>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<Payment>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<Expense>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<TimeEntry>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<DocumentRecord>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<Notification>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
        builder.Entity<ActivityLog>().HasQueryFilter(e => !e.IsDeleted && CurrentOrgId.HasValue && e.OrganizationId == CurrentOrgId.Value);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var utcNow = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedAtUtc == default)
                    entry.Entity.CreatedAtUtc = utcNow;
                entry.Entity.UpdatedAtUtc = utcNow;

                if (entry.Entity is TenantEntity tenantEntity &&
                    tenantEntity.OrganizationId == Guid.Empty &&
                    _currentUserService?.OrganizationId is Guid activeOrgId)
                {
                    tenantEntity.OrganizationId = activeOrgId;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = utcNow;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
