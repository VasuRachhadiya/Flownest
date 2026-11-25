using Flownest.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Flownest.Infrastructure.Data.Configurations;

public sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.Property(x => x.Name).HasMaxLength(160).IsRequired();
        builder.Property(x => x.Slug).HasMaxLength(180).IsRequired();
        builder.Property(x => x.LogoUrl).HasMaxLength(500);
        builder.Property(x => x.ContactEmail).HasMaxLength(200);
        builder.Property(x => x.ContactPhone).HasMaxLength(50);
        builder.Property(x => x.Website).HasMaxLength(300);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.TimeZone).HasMaxLength(100).IsRequired();
        builder.Property(x => x.CurrencyCode).HasMaxLength(10).IsRequired();
        builder.Property(x => x.BrandAccentColor).HasMaxLength(20).IsRequired();

        builder.HasIndex(x => x.Slug).IsUnique();
    }
}

public sealed class OrganizationMemberConfiguration : IEntityTypeConfiguration<OrganizationMember>
{
    public void Configure(EntityTypeBuilder<OrganizationMember> builder)
    {
        builder.Property(x => x.JobTitle).HasMaxLength(120);
        builder.Property(x => x.HourlyRate).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.OrganizationId, x.UserId }).IsUnique().HasFilter("[IsDeleted] = 0");
        builder.HasOne(x => x.Organization)
            .WithMany(o => o.Members)
            .HasForeignKey(x => x.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class OrganizationInvitationConfiguration : IEntityTypeConfiguration<OrganizationInvitation>
{
    public void Configure(EntityTypeBuilder<OrganizationInvitation> builder)
    {
        builder.Property(x => x.Email).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Token).HasMaxLength(128).IsRequired();

        builder.HasIndex(x => x.Token).IsUnique();
        builder.HasIndex(x => new { x.OrganizationId, x.Email });
        builder.HasOne(x => x.Organization)
            .WithMany(o => o.Invitations)
            .HasForeignKey(x => x.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.Property(x => x.Name).HasMaxLength(160).IsRequired();
        builder.Property(x => x.Company).HasMaxLength(160);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Address).HasMaxLength(500);
        builder.Property(x => x.Website).HasMaxLength(300);
        builder.Property(x => x.Source).HasMaxLength(100);
        builder.Property(x => x.Tags).HasMaxLength(500);

        builder.HasIndex(x => new { x.OrganizationId, x.Status, x.IsDeleted });
        builder.HasIndex(x => new { x.OrganizationId, x.Name });
    }
}

public sealed class LeadConfiguration : IEntityTypeConfiguration<Lead>
{
    public void Configure(EntityTypeBuilder<Lead> builder)
    {
        builder.Property(x => x.Name).HasMaxLength(160).IsRequired();
        builder.Property(x => x.Company).HasMaxLength(160);
        builder.Property(x => x.Email).HasMaxLength(200);
        builder.Property(x => x.Phone).HasMaxLength(50);
        builder.Property(x => x.Source).HasMaxLength(100);
        builder.Property(x => x.ExpectedValue).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.OrganizationId, x.Stage, x.IsDeleted });
        builder.HasOne(x => x.ConvertedCustomer)
            .WithMany()
            .HasForeignKey(x => x.ConvertedCustomerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Code).HasMaxLength(40);
        builder.Property(x => x.Budget).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.OrganizationId, x.Status, x.IsDeleted });
        builder.HasOne(x => x.Customer)
            .WithMany(c => c.Projects)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        builder.Property(x => x.ProjectRole).HasMaxLength(80);
        builder.HasIndex(x => new { x.ProjectId, x.UserId }).IsUnique().HasFilter("[IsDeleted] = 0");
        builder.HasOne(x => x.Project)
            .WithMany(p => p.Members)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class WorkTaskConfiguration : IEntityTypeConfiguration<WorkTask>
{
    public void Configure(EntityTypeBuilder<WorkTask> builder)
    {
        builder.Property(x => x.Title).HasMaxLength(240).IsRequired();
        builder.Property(x => x.Labels).HasMaxLength(400);
        builder.Property(x => x.EstimatedHours).HasPrecision(9, 2);

        builder.HasIndex(x => new { x.OrganizationId, x.Status, x.IsDeleted });
        builder.HasIndex(x => new { x.OrganizationId, x.DueDateUtc });
        builder.HasOne(x => x.Project)
            .WithMany(p => p.Tasks)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class TaskAssigneeConfiguration : IEntityTypeConfiguration<TaskAssignee>
{
    public void Configure(EntityTypeBuilder<TaskAssignee> builder)
    {
        builder.HasIndex(x => new { x.WorkTaskId, x.UserId }).IsUnique().HasFilter("[IsDeleted] = 0");
        builder.HasOne(x => x.WorkTask)
            .WithMany(t => t.Assignees)
            .HasForeignKey(x => x.WorkTaskId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TaskCommentConfiguration : IEntityTypeConfiguration<TaskComment>
{
    public void Configure(EntityTypeBuilder<TaskComment> builder)
    {
        builder.Property(x => x.Content).HasMaxLength(4000).IsRequired();
        builder.HasOne(x => x.WorkTask)
            .WithMany(t => t.Comments)
            .HasForeignKey(x => x.WorkTaskId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.Property(x => x.InvoiceNumber).HasMaxLength(40).IsRequired();
        builder.Property(x => x.Subtotal).HasPrecision(18, 2);
        builder.Property(x => x.TaxRatePercent).HasPrecision(9, 2);
        builder.Property(x => x.TaxAmount).HasPrecision(18, 2);
        builder.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        builder.Property(x => x.TotalAmount).HasPrecision(18, 2);
        builder.Property(x => x.PaidAmount).HasPrecision(18, 2);

        builder.HasIndex(x => new { x.OrganizationId, x.InvoiceNumber }).IsUnique().HasFilter("[IsDeleted] = 0");
        builder.HasIndex(x => new { x.OrganizationId, x.Status, x.IsDeleted });

        builder.HasOne(x => x.Customer)
            .WithMany(c => c.Invoices)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Project)
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class InvoiceItemConfiguration : IEntityTypeConfiguration<InvoiceItem>
{
    public void Configure(EntityTypeBuilder<InvoiceItem> builder)
    {
        builder.Property(x => x.Description).HasMaxLength(300).IsRequired();
        builder.Property(x => x.Quantity).HasPrecision(12, 2);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.TaxPercent).HasPrecision(9, 2);
        builder.Property(x => x.LineTotal).HasPrecision(18, 2);

        builder.HasOne(x => x.Invoice)
            .WithMany(i => i.Items)
            .HasForeignKey(x => x.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.ReferenceNumber).HasMaxLength(120);
        builder.HasIndex(x => new { x.OrganizationId, x.PaymentDateUtc });

        builder.HasOne(x => x.Invoice)
            .WithMany(i => i.Payments)
            .HasForeignKey(x => x.InvoiceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ExpenseConfiguration : IEntityTypeConfiguration<Expense>
{
    public void Configure(EntityTypeBuilder<Expense> builder)
    {
        builder.Property(x => x.Amount).HasPrecision(18, 2);
        builder.Property(x => x.Vendor).HasMaxLength(160).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(1000);
        builder.HasIndex(x => new { x.OrganizationId, x.ExpenseDateUtc, x.Category });

        builder.HasOne(x => x.Project)
            .WithMany()
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.ReceiptDocument)
            .WithMany()
            .HasForeignKey(x => x.ReceiptDocumentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class TimeEntryConfiguration : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        builder.Property(x => x.Description).HasMaxLength(500).IsRequired();
        builder.Property(x => x.HourlyRate).HasPrecision(18, 2);
        builder.HasIndex(x => new { x.OrganizationId, x.UserId, x.IsRunning });
        builder.HasIndex(x => new { x.OrganizationId, x.StartTimeUtc });

        builder.HasOne(x => x.Project)
            .WithMany(p => p.TimeEntries)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.WorkTask)
            .WithMany(t => t.TimeEntries)
            .HasForeignKey(x => x.WorkTaskId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class DocumentRecordConfiguration : IEntityTypeConfiguration<DocumentRecord>
{
    public void Configure(EntityTypeBuilder<DocumentRecord> builder)
    {
        builder.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.StoredFileName).HasMaxLength(260).IsRequired();
        builder.Property(x => x.ContentType).HasMaxLength(150).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.HasIndex(x => new { x.OrganizationId, x.Category, x.IsDeleted });

        builder.HasOne(x => x.Customer)
            .WithMany(c => c.Documents)
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.Project)
            .WithMany(p => p.Documents)
            .HasForeignKey(x => x.ProjectId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Message).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.EntityType).HasMaxLength(80);
        builder.Property(x => x.ActionUrl).HasMaxLength(300);
        builder.HasIndex(x => new { x.OrganizationId, x.RecipientUserId, x.IsRead });
    }
}

public sealed class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> builder)
    {
        builder.Property(x => x.ActorName).HasMaxLength(160).IsRequired();
        builder.Property(x => x.EntityType).HasMaxLength(80).IsRequired();
        builder.Property(x => x.Action).HasMaxLength(80).IsRequired();
        builder.Property(x => x.Summary).HasMaxLength(500).IsRequired();
        builder.HasIndex(x => new { x.OrganizationId, x.CreatedAtUtc });
    }
}
