using Flownest.Domain.Entities;
using Flownest.Domain.Enums;
using Flownest.Infrastructure.Data;
using Flownest.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Flownest.Infrastructure.Seed;

public static class DatabaseSeeder
{
    public static async Task SeedDevelopmentDataAsync(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        await db.Database.MigrateAsync();

        if (await db.Organizations.IgnoreQueryFilters().AnyAsync())
        {
            return;
        }

        logger.LogInformation("Seeding Flownest development demo workspace in SQL Server...");

        var owner = await EnsureUserAsync(userManager, "Elena Vance", "owner@flownest.demo", "Demo@12345!");
        var manager = await EnsureUserAsync(userManager, "Marcus Chen", "manager@flownest.demo", "Demo@12345!");
        var member = await EnsureUserAsync(userManager, "Sophia Patel", "member@flownest.demo", "Demo@12345!");

        var org = new Organization
        {
            Name = "Northstar Studio (Demo)",
            Slug = "northstar-demo",
            ContactEmail = "hello@northstar-demo.example",
            ContactPhone = "+1 (415) 555-0192",
            Website = "https://northstar-demo.example",
            Address = "548 Market Street, Suite 41200, San Francisco, CA",
            TimeZone = "America/Los_Angeles",
            CurrencyCode = "USD",
            BrandAccentColor = "#1E3A5F",
            NextInvoiceSequence = 5
        };
        db.Organizations.Add(org);

        db.OrganizationMembers.AddRange(
            new OrganizationMember { OrganizationId = org.Id, UserId = owner.Id, Role = OrganizationRole.Owner, JobTitle = "Managing Partner", Availability = MemberAvailability.Available, HourlyRate = 165m },
            new OrganizationMember { OrganizationId = org.Id, UserId = manager.Id, Role = OrganizationRole.Manager, JobTitle = "Operations Lead", Availability = MemberAvailability.Busy, HourlyRate = 135m },
            new OrganizationMember { OrganizationId = org.Id, UserId = member.Id, Role = OrganizationRole.Member, JobTitle = "Senior Engineer", Availability = MemberAvailability.Available, HourlyRate = 120m }
        );

        var c1 = new Customer { OrganizationId = org.Id, Name = "Clara Lindqvist", Company = "Nordic Logistics Group", Email = "clara@nordiclogistics.example", Phone = "+1 415 555 0141", Address = "720 Harbor Blvd, Seattle, WA", CustomerType = CustomerType.Business, Status = CustomerStatus.Active, Source = "Referral", Tags = "Enterprise, Retainer", Notes = "[DEMO] Key logistics operations retainer client." };
        var c2 = new Customer { OrganizationId = org.Id, Name = "David Okafor", Company = "Vertex BioLabs", Email = "david@vertexbio.example", Phone = "+1 617 555 0188", Address = "12 Kendall Sq, Cambridge, MA", CustomerType = CustomerType.Business, Status = CustomerStatus.Active, Source = "Inbound", Tags = "Healthcare, Q4", Notes = "[DEMO] Cloud analytics platform modernization." };
        var c3 = new Customer { OrganizationId = org.Id, Name = "Hannah Brooks", Company = "Studio Alder", Email = "hannah@studioalder.example", Phone = "+1 212 555 0119", CustomerType = CustomerType.Individual, Status = CustomerStatus.Active, Source = "Website", Tags = "Design, Advisory" };
        db.Customers.AddRange(c1, c2, c3);

        db.Leads.AddRange(
            new Lead { OrganizationId = org.Id, Name = "Julian Meyer", Company = "Apex FinTech", Email = "jmeyer@apexfintech.example", Source = "LinkedIn", Stage = LeadStage.Proposal, ExpectedValue = 28500m, FollowUpDateUtc = DateTime.UtcNow.AddDays(3), AssignedToUserId = owner.Id, Notes = "[DEMO] Sent phased delivery proposal." },
            new Lead { OrganizationId = org.Id, Name = "Priya Nair", Company = "Kinetix Retail", Email = "priya@kinetix.example", Source = "Partner", Stage = LeadStage.Qualified, ExpectedValue = 16000m, FollowUpDateUtc = DateTime.UtcNow.AddDays(5), AssignedToUserId = manager.Id },
            new Lead { OrganizationId = org.Id, Name = "Tomás Rivera", Company = "Solstice Energy", Email = "tomas@solstice.example", Source = "Inbound", Stage = LeadStage.Negotiation, ExpectedValue = 42000m, FollowUpDateUtc = DateTime.UtcNow.AddDays(2), AssignedToUserId = owner.Id },
            new Lead { OrganizationId = org.Id, Name = "Liam Gallagher", Company = "Harbor Freight Co", Email = "liam@harborfreight.example", Source = "Conference", Stage = LeadStage.New, ExpectedValue = 12500m, FollowUpDateUtc = DateTime.UtcNow.AddDays(7), AssignedToUserId = manager.Id }
        );

        var p1 = new Project { OrganizationId = org.Id, Name = "Supply Chain Portal v2", Code = "NLG-204", Description = "[DEMO] Unified dispatch, customs tracking, and carrier billing portal.", CustomerId = c1.Id, Status = ProjectStatus.Active, Priority = PriorityLevel.High, StartDateUtc = DateTime.UtcNow.AddDays(-35), DueDateUtc = DateTime.UtcNow.AddDays(25), Budget = 48000m, ProgressPercent = 67 };
        var p2 = new Project { OrganizationId = org.Id, Name = "Lab Data Warehouse Migration", Code = "VBL-109", Description = "[DEMO] SQL Server & telemetry ingestion pipeline upgrade.", CustomerId = c2.Id, Status = ProjectStatus.Active, Priority = PriorityLevel.Critical, StartDateUtc = DateTime.UtcNow.AddDays(-18), DueDateUtc = DateTime.UtcNow.AddDays(14), Budget = 36000m, ProgressPercent = 50 };
        var p3 = new Project { OrganizationId = org.Id, Name = "Brand Operations Playbook", Code = "SAL-042", Description = "[DEMO] Process standardization and financial workflow rollout.", CustomerId = c3.Id, Status = ProjectStatus.Planning, Priority = PriorityLevel.Medium, StartDateUtc = DateTime.UtcNow.AddDays(2), DueDateUtc = DateTime.UtcNow.AddDays(40), Budget = 12000m, ProgressPercent = 0 };
        db.Projects.AddRange(p1, p2, p3);

        db.ProjectMembers.AddRange(
            new ProjectMember { OrganizationId = org.Id, ProjectId = p1.Id, UserId = owner.Id, ProjectRole = "Sponsor" },
            new ProjectMember { OrganizationId = org.Id, ProjectId = p1.Id, UserId = manager.Id, ProjectRole = "Lead" },
            new ProjectMember { OrganizationId = org.Id, ProjectId = p1.Id, UserId = member.Id, ProjectRole = "Engineer" },
            new ProjectMember { OrganizationId = org.Id, ProjectId = p2.Id, UserId = manager.Id, ProjectRole = "Lead" },
            new ProjectMember { OrganizationId = org.Id, ProjectId = p2.Id, UserId = member.Id, ProjectRole = "Engineer" }
        );

        var t1 = new WorkTask { OrganizationId = org.Id, ProjectId = p1.Id, Title = "Finalize carrier EDI webhook validation", Status = WorkTaskStatus.Completed, Priority = PriorityLevel.High, DueDateUtc = DateTime.UtcNow.AddDays(-3), EstimatedHours = 8m, Labels = "Backend, API", CreatedByUserId = manager.Id };
        var t2 = new WorkTask { OrganizationId = org.Id, ProjectId = p1.Id, Title = "Build customs clearance status timeline", Status = WorkTaskStatus.InProgress, Priority = PriorityLevel.High, DueDateUtc = DateTime.UtcNow.AddDays(4), EstimatedHours = 12m, Labels = "Frontend, UI", CreatedByUserId = manager.Id };
        var t3 = new WorkTask { OrganizationId = org.Id, ProjectId = p1.Id, Title = "Performance audit on dispatch SQL queries", Status = WorkTaskStatus.InReview, Priority = PriorityLevel.Medium, DueDateUtc = DateTime.UtcNow.AddDays(2), EstimatedHours = 6m, Labels = "Database", CreatedByUserId = owner.Id };
        var t4 = new WorkTask { OrganizationId = org.Id, ProjectId = p2.Id, Title = "Configure automated nightly backup policy", Status = WorkTaskStatus.ToDo, Priority = PriorityLevel.Critical, DueDateUtc = DateTime.UtcNow.AddDays(3), EstimatedHours = 5m, Labels = "Infrastructure", CreatedByUserId = manager.Id };
        var t5 = new WorkTask { OrganizationId = org.Id, ProjectId = p2.Id, Title = "Validate schema parity across lab tenants", Status = WorkTaskStatus.InProgress, Priority = PriorityLevel.High, DueDateUtc = DateTime.UtcNow.AddDays(-1), EstimatedHours = 10m, Labels = "QA, SQL", CreatedByUserId = owner.Id };
        db.WorkTasks.AddRange(t1, t2, t3, t4, t5);

        db.TaskAssignees.AddRange(
            new TaskAssignee { OrganizationId = org.Id, WorkTaskId = t1.Id, UserId = member.Id },
            new TaskAssignee { OrganizationId = org.Id, WorkTaskId = t2.Id, UserId = member.Id },
            new TaskAssignee { OrganizationId = org.Id, WorkTaskId = t3.Id, UserId = manager.Id },
            new TaskAssignee { OrganizationId = org.Id, WorkTaskId = t4.Id, UserId = owner.Id },
            new TaskAssignee { OrganizationId = org.Id, WorkTaskId = t5.Id, UserId = owner.Id }
        );

        var inv1 = new Invoice
        {
            OrganizationId = org.Id, InvoiceNumber = "INV-2026-0001", CustomerId = c1.Id, ProjectId = p1.Id,
            Status = InvoiceStatus.Paid, IssueDateUtc = DateTime.UtcNow.AddMonths(-2), DueDateUtc = DateTime.UtcNow.AddMonths(-1),
            Subtotal = 18000m, TaxRatePercent = 8m, TaxAmount = 1440m, DiscountAmount = 0m, TotalAmount = 19440m, PaidAmount = 19440m,
            Notes = "[DEMO] Phase 1 Discovery & Architecture Milestone"
        };
        inv1.Items.Add(new InvoiceItem { OrganizationId = org.Id, InvoiceId = inv1.Id, Description = "Architecture & API Foundation", Quantity = 1m, UnitPrice = 18000m, TaxPercent = 0m, LineTotal = 18000m, SortOrder = 0 });

        var inv2 = new Invoice
        {
            OrganizationId = org.Id, InvoiceNumber = "INV-2026-0002", CustomerId = c2.Id, ProjectId = p2.Id,
            Status = InvoiceStatus.PartiallyPaid, IssueDateUtc = DateTime.UtcNow.AddDays(-22), DueDateUtc = DateTime.UtcNow.AddDays(8),
            Subtotal = 15000m, TaxRatePercent = 8m, TaxAmount = 1200m, DiscountAmount = 500m, TotalAmount = 15700m, PaidAmount = 8000m,
            Notes = "[DEMO] Warehouse Migration Sprint 1"
        };
        inv2.Items.Add(new InvoiceItem { OrganizationId = org.Id, InvoiceId = inv2.Id, Description = "ETL Pipeline & Schema Modeling", Quantity = 100m, UnitPrice = 150m, TaxPercent = 0m, LineTotal = 15000m, SortOrder = 0 });

        var inv3 = new Invoice
        {
            OrganizationId = org.Id, InvoiceNumber = "INV-2026-0003", CustomerId = c1.Id, ProjectId = p1.Id,
            Status = InvoiceStatus.Sent, IssueDateUtc = DateTime.UtcNow.AddDays(-10), DueDateUtc = DateTime.UtcNow.AddDays(20),
            Subtotal = 12400m, TaxRatePercent = 8m, TaxAmount = 992m, DiscountAmount = 0m, TotalAmount = 13392m, PaidAmount = 0m,
            Notes = "[DEMO] Carrier Portal Milestone 2"
        };
        inv3.Items.Add(new InvoiceItem { OrganizationId = org.Id, InvoiceId = inv3.Id, Description = "Portal Frontend & Integration", Quantity = 80m, UnitPrice = 155m, TaxPercent = 0m, LineTotal = 12400m, SortOrder = 0 });

        var inv4 = new Invoice
        {
            OrganizationId = org.Id, InvoiceNumber = "INV-2026-0004", CustomerId = c3.Id, ProjectId = p3.Id,
            Status = InvoiceStatus.Overdue, IssueDateUtc = DateTime.UtcNow.AddDays(-40), DueDateUtc = DateTime.UtcNow.AddDays(-10),
            Subtotal = 4200m, TaxRatePercent = 0m, TaxAmount = 0m, DiscountAmount = 0m, TotalAmount = 4200m, PaidAmount = 0m,
            Notes = "[DEMO] Advisory Kickoff Retainer"
        };
        inv4.Items.Add(new InvoiceItem { OrganizationId = org.Id, InvoiceId = inv4.Id, Description = "Operations Advisory Workshop", Quantity = 1m, UnitPrice = 4200m, TaxPercent = 0m, LineTotal = 4200m, SortOrder = 0 });
        db.Invoices.AddRange(inv1, inv2, inv3, inv4);

        db.Payments.AddRange(
            new Payment { OrganizationId = org.Id, InvoiceId = inv1.Id, Amount = 19440m, PaymentDateUtc = DateTime.UtcNow.AddMonths(-1).AddDays(-4), PaymentMethod = PaymentMethod.BankTransfer, ReferenceNumber = "ACH-99241", RecordedByUserId = owner.Id, Notes = "[DEMO] Paid in full via ACH" },
            new Payment { OrganizationId = org.Id, InvoiceId = inv2.Id, Amount = 8000m, PaymentDateUtc = DateTime.UtcNow.AddDays(-12), PaymentMethod = PaymentMethod.BankTransfer, ReferenceNumber = "WIRE-4821", RecordedByUserId = owner.Id, Notes = "[DEMO] Initial 50% milestone deposit" }
        );

        db.Expenses.AddRange(
            new Expense { OrganizationId = org.Id, Category = ExpenseCategory.Software, Amount = 640m, ExpenseDateUtc = DateTime.UtcNow.AddDays(-25), Vendor = "Microsoft Azure", Description = "[DEMO] SQL & API Staging Infrastructure", PaymentMethod = PaymentMethod.Card, ProjectId = p1.Id, RecordedByUserId = owner.Id },
            new Expense { OrganizationId = org.Id, Category = ExpenseCategory.Software, Amount = 290m, ExpenseDateUtc = DateTime.UtcNow.AddDays(-18), Vendor = "Vercel & GitHub", Description = "[DEMO] Team Pro Hosting", PaymentMethod = PaymentMethod.Card, RecordedByUserId = manager.Id },
            new Expense { OrganizationId = org.Id, Category = ExpenseCategory.Travel, Amount = 1180m, ExpenseDateUtc = DateTime.UtcNow.AddDays(-14), Vendor = "Delta Air Lines", Description = "[DEMO] On-site client workshop travel", PaymentMethod = PaymentMethod.Card, ProjectId = p2.Id, RecordedByUserId = owner.Id },
            new Expense { OrganizationId = org.Id, Category = ExpenseCategory.Marketing, Amount = 950m, ExpenseDateUtc = DateTime.UtcNow.AddDays(-8), Vendor = "LinkedIn Ads", Description = "[DEMO] Q4 B2B Lead Campaign", PaymentMethod = PaymentMethod.Card, RecordedByUserId = manager.Id },
            new Expense { OrganizationId = org.Id, Category = ExpenseCategory.Office, Amount = 420m, ExpenseDateUtc = DateTime.UtcNow.AddMonths(-2), Vendor = "Regus Co-working", Description = "[DEMO] Conference room & supplies", PaymentMethod = PaymentMethod.BankTransfer, RecordedByUserId = owner.Id }
        );

        db.TimeEntries.AddRange(
            new TimeEntry { OrganizationId = org.Id, UserId = member.Id, ProjectId = p1.Id, WorkTaskId = t1.Id, Description = "[DEMO] EDI parser and signature verification", StartTimeUtc = DateTime.UtcNow.AddDays(-3).AddHours(-6), EndTimeUtc = DateTime.UtcNow.AddDays(-3).AddHours(-2), DurationMinutes = 240, IsRunning = false, IsBillable = true, HourlyRate = 120m },
            new TimeEntry { OrganizationId = org.Id, UserId = owner.Id, ProjectId = p2.Id, WorkTaskId = t5.Id, Description = "[DEMO] Tenant isolation & index tuning review", StartTimeUtc = DateTime.UtcNow.AddDays(-1).AddHours(-5), EndTimeUtc = DateTime.UtcNow.AddDays(-1).AddHours(-2), DurationMinutes = 180, IsRunning = false, IsBillable = true, HourlyRate = 165m },
            new TimeEntry { OrganizationId = org.Id, UserId = manager.Id, ProjectId = p1.Id, Description = "[DEMO] Weekly client sprint sync", StartTimeUtc = DateTime.UtcNow.AddDays(-2).AddHours(-2), EndTimeUtc = DateTime.UtcNow.AddDays(-2).AddHours(-1), DurationMinutes = 60, IsRunning = false, IsBillable = false, HourlyRate = 135m }
        );

        db.ActivityLogs.AddRange(
            new ActivityLog { OrganizationId = org.Id, ActorUserId = owner.Id, ActorName = owner.FullName, EntityType = "Invoice", EntityId = inv3.Id, Action = "Sent", Summary = "[DEMO] Issued invoice INV-2026-0003 to Clara Lindqvist", CustomerId = c1.Id, ProjectId = p1.Id },
            new ActivityLog { OrganizationId = org.Id, ActorUserId = member.Id, ActorName = member.FullName, EntityType = "WorkTask", EntityId = t1.Id, Action = "Completed", Summary = "[DEMO] Completed task \"Finalize carrier EDI webhook validation\"", ProjectId = p1.Id },
            new ActivityLog { OrganizationId = org.Id, ActorUserId = owner.Id, ActorName = owner.FullName, EntityType = "Payment", EntityId = inv2.Id, Action = "Recorded", Summary = "[DEMO] Recorded $8,000.00 partial payment on INV-2026-0002", CustomerId = c2.Id, ProjectId = p2.Id }
        );

        db.Notifications.AddRange(
            new Notification { OrganizationId = org.Id, RecipientUserId = owner.Id, Type = NotificationType.InvoiceUpdate, Title = "Invoice overdue", Message = "[DEMO] INV-2026-0004 for Studio Alder is past due.", EntityType = "Invoice", EntityId = inv4.Id, ActionUrl = $"/invoices/{inv4.Id}" },
            new Notification { OrganizationId = org.Id, RecipientUserId = owner.Id, Type = NotificationType.TaskAssigned, Title = "Task assigned", Message = "[DEMO] You are assigned to \"Configure automated nightly backup policy\".", EntityType = "WorkTask", EntityId = t4.Id, ActionUrl = "/tasks" }
        );

        await db.SaveChangesAsync();
        logger.LogInformation("Flownest demo workspace seeded successfully.");
    }

    private static async Task<ApplicationUser> EnsureUserAsync(UserManager<ApplicationUser> userManager, string fullName, string email, string password)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is not null) return user;

        user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            Email = email,
            FullName = fullName,
            EmailConfirmed = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Failed to seed user {email}: {string.Join(", ", result.Errors.Select(e => e.Description))}");
        }
        return user;
    }
}
