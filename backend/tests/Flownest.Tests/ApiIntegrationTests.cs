using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Flownest.Application.Common;
using Flownest.Application.DTOs.Auth;
using Flownest.Application.DTOs.Crm;
using Flownest.Application.DTOs.Finance;
using Flownest.Application.DTOs.Projects;
using Flownest.Application.DTOs.Workspace;
using Flownest.Domain.Enums;

namespace Flownest.Tests;

public sealed class ApiIntegrationTests : IClassFixture<FlownestWebFactory>
{
    private readonly FlownestWebFactory _factory;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public ApiIntegrationTests(FlownestWebFactory factory) => _factory = factory;

    private async Task<(HttpClient Client, AuthResponseDto Auth)> RegisterAndAuthClientAsync(string name, string email, string orgName)
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(name, email, "StrongPass123", orgName, null), JsonOpts);
        res.EnsureSuccessStatusCode();
        var auth = (await res.Content.ReadFromJsonAsync<AuthResponseDto>(JsonOpts))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);
        if (auth.ActiveOrganizationId.HasValue)
        {
            client.DefaultRequestHeaders.Add("X-Organization-Id", auth.ActiveOrganizationId.Value.ToString());
        }
        return (client, auth);
    }

    [Fact]
    public async Task TenantIsolation_PreventsCrossOrganizationAccessAndSpoofing()
    {
        var (clientA, authA) = await RegisterAndAuthClientAsync("Alice Owner", $"alice-{Guid.NewGuid():N}@test.com", "Alpha Corp");
        var (clientB, _) = await RegisterAndAuthClientAsync("Bob Owner", $"bob-{Guid.NewGuid():N}@test.com", "Beta Corp");

        var createCustomerRes = await clientA.PostAsJsonAsync("/api/customers",
            new UpsertCustomerRequest("Secret Client A", "Alpha Client", "secret@alpha.com", null, null, null, CustomerType.Business, CustomerStatus.Active, null, null, null),
            JsonOpts);
        createCustomerRes.EnsureSuccessStatusCode();
        var customerA = (await createCustomerRes.Content.ReadFromJsonAsync<CustomerDto>(JsonOpts))!;

        // Bob tries to read Alpha's customer using his own org context -> 404 NotFound
        var readAsBob = await clientB.GetAsync($"/api/customers/{customerA.Id}");
        Assert.Equal(HttpStatusCode.NotFound, readAsBob.StatusCode);

        // Bob tries to spoof Alpha's X-Organization-Id header -> 403 Forbidden
        clientB.DefaultRequestHeaders.Remove("X-Organization-Id");
        clientB.DefaultRequestHeaders.Add("X-Organization-Id", authA.ActiveOrganizationId!.Value.ToString());
        var spoofRes = await clientB.GetAsync("/api/customers");
        Assert.Equal(HttpStatusCode.Forbidden, spoofRes.StatusCode);
    }

    [Fact]
    public async Task InvoicingAndPayments_CalculateBackendTotalsAndTransitionStatuses()
    {
        var (client, _) = await RegisterAndAuthClientAsync("Finance Lead", $"fin-{Guid.NewGuid():N}@test.com", "Finance Studio");

        var custRes = await client.PostAsJsonAsync("/api/customers",
            new UpsertCustomerRequest("Acme Client", "Acme Inc", "ap@acme.com", null, null, null, CustomerType.Business, CustomerStatus.Active, null, null, null),
            JsonOpts);
        custRes.EnsureSuccessStatusCode();
        var customer = (await custRes.Content.ReadFromJsonAsync<CustomerDto>(JsonOpts))!;

        var invReq = new UpsertInvoiceRequest(
            customer.Id,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow.AddDays(14),
            10m, // 10% invoice tax
            50m, // $50 discount
            "Milestone 1",
            "Net 14",
            new[]
            {
                new UpsertInvoiceItemRequest("Consulting", 10m, 100m, 0m) // 1000 subtotal + 100 tax - 50 discount = 1050
            });

        var invRes = await client.PostAsJsonAsync("/api/invoices", invReq, JsonOpts);
        invRes.EnsureSuccessStatusCode();
        var invoice = (await invRes.Content.ReadFromJsonAsync<InvoiceDto>(JsonOpts))!;

        Assert.Equal(1000m, invoice.Subtotal);
        Assert.Equal(100m, invoice.TaxAmount);
        Assert.Equal(1050m, invoice.TotalAmount);
        Assert.Equal(InvoiceStatus.Draft, invoice.Status);

        // Mark as Sent
        var sentRes = await client.PatchAsJsonAsync($"/api/invoices/{invoice.Id}/status", new UpdateInvoiceStatusRequest(InvoiceStatus.Sent), JsonOpts);
        sentRes.EnsureSuccessStatusCode();

        // Overpayment rejected
        var overPay = await client.PostAsJsonAsync("/api/payments", new RecordPaymentRequest(invoice.Id, 2000m, DateTime.UtcNow, PaymentMethod.Card, "REF-OVER", null), JsonOpts);
        Assert.Equal(HttpStatusCode.BadRequest, overPay.StatusCode);

        // Partial payment -> PartiallyPaid
        var pay1 = await client.PostAsJsonAsync("/api/payments", new RecordPaymentRequest(invoice.Id, 400m, DateTime.UtcNow, PaymentMethod.BankTransfer, "REF-1", null), JsonOpts);
        pay1.EnsureSuccessStatusCode();
        var afterPartial = (await client.GetFromJsonAsync<InvoiceDto>($"/api/invoices/{invoice.Id}", JsonOpts))!;
        Assert.Equal(InvoiceStatus.PartiallyPaid, afterPartial.Status);
        Assert.Equal(650m, afterPartial.BalanceDue);

        // Remaining payment -> Paid
        var pay2 = await client.PostAsJsonAsync("/api/payments", new RecordPaymentRequest(invoice.Id, 650m, DateTime.UtcNow, PaymentMethod.Upi, "REF-2", null), JsonOpts);
        pay2.EnsureSuccessStatusCode();
        var afterFull = (await client.GetFromJsonAsync<InvoiceDto>($"/api/invoices/{invoice.Id}", JsonOpts))!;
        Assert.Equal(InvoiceStatus.Paid, afterFull.Status);
        Assert.Equal(0m, afterFull.BalanceDue);
    }

    [Fact]
    public async Task LeadsProjectsTasksTimeAndReports_WorkEndToEnd()
    {
        var (client, _) = await RegisterAndAuthClientAsync("Ops Owner", $"ops-{Guid.NewGuid():N}@test.com", "Ops Agency");

        // Lead -> Convert to Customer
        var leadRes = await client.PostAsJsonAsync("/api/leads",
            new UpsertLeadRequest("Sam Prospect", "Prospect LLC", "sam@prospect.com", null, "Website", LeadStage.Qualified, 15000m, DateTime.UtcNow.AddDays(2), "Hot lead", null),
            JsonOpts);
        leadRes.EnsureSuccessStatusCode();
        var lead = (await leadRes.Content.ReadFromJsonAsync<LeadDto>(JsonOpts))!;

        var convRes = await client.PostAsync($"/api/leads/{lead.Id}/convert", null);
        convRes.EnsureSuccessStatusCode();
        var convertedCustomer = (await convRes.Content.ReadFromJsonAsync<CustomerDto>(JsonOpts))!;
        Assert.Equal("Sam Prospect", convertedCustomer.Name);

        // Project & Task
        var projRes = await client.PostAsJsonAsync("/api/projects",
            new UpsertProjectRequest("Portal Rollout", "PR-1", "Desc", convertedCustomer.Id, ProjectStatus.Active, PriorityLevel.High, DateTime.UtcNow, DateTime.UtcNow.AddDays(30), 20000m, 0, null),
            JsonOpts);
        projRes.EnsureSuccessStatusCode();
        var project = (await projRes.Content.ReadFromJsonAsync<ProjectDto>(JsonOpts))!;

        var taskRes = await client.PostAsJsonAsync("/api/tasks",
            new UpsertWorkTaskRequest("Setup CI/CD", "Configure pipeline", project.Id, WorkTaskStatus.ToDo, PriorityLevel.High, DateTime.UtcNow.AddDays(3), new[] { "DevOps" }, 4m, null),
            JsonOpts);
        taskRes.EnsureSuccessStatusCode();
        var task = (await taskRes.Content.ReadFromJsonAsync<WorkTaskDto>(JsonOpts))!;

        var moveRes = await client.PatchAsJsonAsync($"/api/tasks/{task.Id}/move", new MoveTaskRequest(WorkTaskStatus.Completed, 0), JsonOpts);
        moveRes.EnsureSuccessStatusCode();

        // Time tracking overlapping guard
        var start1 = await client.PostAsJsonAsync("/api/time-entries/start", new StartTimerRequest(project.Id, task.Id, "Working on CI", true, 100m), JsonOpts);
        start1.EnsureSuccessStatusCode();
        var activeTimer = (await start1.Content.ReadFromJsonAsync<TimeEntryDto>(JsonOpts))!;

        var start2 = await client.PostAsJsonAsync("/api/time-entries/start", new StartTimerRequest(project.Id, null, "Second concurrent timer", true, 100m), JsonOpts);
        Assert.Equal(HttpStatusCode.Conflict, start2.StatusCode);

        var stopRes = await client.PostAsync($"/api/time-entries/{activeTimer.Id}/stop", null);
        stopRes.EnsureSuccessStatusCode();

        // Expense & Dashboard & CSV Report
        var expRes = await client.PostAsJsonAsync("/api/expenses",
            new UpsertExpenseRequest(ExpenseCategory.Software, 199m, DateTime.UtcNow, "CloudHost", "Hosting", PaymentMethod.Card, project.Id, null),
            JsonOpts);
        expRes.EnsureSuccessStatusCode();

        var dash = await client.GetFromJsonAsync<DashboardOverviewDto>("/api/analytics/dashboard?period=year", JsonOpts);
        Assert.NotNull(dash);
        Assert.Equal(199m, dash!.TotalExpenses);
        Assert.Equal(1, dash.CompletedTasks);

        var csvRes = await client.GetAsync("/api/analytics/reports/export?reportType=financial");
        csvRes.EnsureSuccessStatusCode();
        var csv = await csvRes.Content.ReadAsStringAsync();
        Assert.Contains("Month,Revenue,Expenses,NetProfit", csv);
    }

    [Fact]
    public async Task RoleBasedAuthorization_BlocksMemberFromAdminActions()
    {
        var (ownerClient, authOwner) = await RegisterAndAuthClientAsync("Org Owner", $"own-{Guid.NewGuid():N}@test.com", "RBAC Co");
        var memberEmail = $"member-{Guid.NewGuid():N}@test.com";

        var inviteRes = await ownerClient.PostAsJsonAsync("/api/team/invitations", new CreateInvitationRequest(memberEmail, OrganizationRole.Member), JsonOpts);
        inviteRes.EnsureSuccessStatusCode();
        var inv = (await inviteRes.Content.ReadFromJsonAsync<CreateInvitationResponse>(JsonOpts))!;

        var memberClient = _factory.CreateClient();
        var regMemberRes = await memberClient.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest("Team Member", memberEmail, "MemberPass123", null, inv.Invitation.Token),
            JsonOpts);
        regMemberRes.EnsureSuccessStatusCode();
        var memberAuth = (await regMemberRes.Content.ReadFromJsonAsync<AuthResponseDto>(JsonOpts))!;

        memberClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberAuth.AccessToken);
        memberClient.DefaultRequestHeaders.Add("X-Organization-Id", authOwner.ActiveOrganizationId!.Value.ToString());

        // Member cannot update organization settings -> 403 Forbidden
        var orgUpdateRes = await memberClient.PutAsJsonAsync("/api/organizations/current",
            new UpdateOrganizationRequest("Hacked Name", null, null, null, null, null, "UTC", "USD", "#000000"),
            JsonOpts);
        Assert.Equal(HttpStatusCode.Forbidden, orgUpdateRes.StatusCode);

        // Member CAN read customers -> 200 OK
        var custListRes = await memberClient.GetAsync("/api/customers");
        Assert.Equal(HttpStatusCode.OK, custListRes.StatusCode);
    }
}
