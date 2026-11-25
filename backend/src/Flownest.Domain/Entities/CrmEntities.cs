using Flownest.Domain.Common;
using Flownest.Domain.Enums;

namespace Flownest.Domain.Entities;

public class Customer : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? Website { get; set; }
    public CustomerType CustomerType { get; set; } = CustomerType.Business;
    public CustomerStatus Status { get; set; } = CustomerStatus.Active;
    public string? Source { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; } // comma-separated normalized tags

    public ICollection<Project> Projects { get; set; } = new List<Project>();
    public ICollection<Invoice> Invoices { get; set; } = new List<Invoice>();
    public ICollection<DocumentRecord> Documents { get; set; } = new List<DocumentRecord>();
}

public class Lead : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Company { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Source { get; set; }
    public LeadStage Stage { get; set; } = LeadStage.New;
    public decimal ExpectedValue { get; set; }
    public DateTime? FollowUpDateUtc { get; set; }
    public string? Notes { get; set; }
    public Guid? AssignedToUserId { get; set; }
    public Guid? ConvertedCustomerId { get; set; }
    public DateTime? ConvertedAtUtc { get; set; }

    public Customer? ConvertedCustomer { get; set; }
}
