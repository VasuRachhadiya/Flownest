using Flownest.Domain.Common;
using Flownest.Domain.Enums;

namespace Flownest.Domain.Entities;

public class Invoice : TenantEntity
{
    public string InvoiceNumber { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Guid? ProjectId { get; set; }
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Draft;
    public DateTime IssueDateUtc { get; set; } = DateTime.UtcNow;
    public DateTime DueDateUtc { get; set; }
    public decimal Subtotal { get; set; }
    public decimal TaxRatePercent { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public string? Notes { get; set; }
    public string? Terms { get; set; }

    public Customer Customer { get; set; } = null!;
    public Project? Project { get; set; }
    public ICollection<InvoiceItem> Items { get; set; } = new List<InvoiceItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}

public class InvoiceItem : TenantEntity
{
    public Guid InvoiceId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal TaxPercent { get; set; }
    public decimal LineTotal { get; set; }
    public int SortOrder { get; set; }

    public Invoice Invoice { get; set; } = null!;
}

public class Payment : TenantEntity
{
    public Guid InvoiceId { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaymentDateUtc { get; set; } = DateTime.UtcNow;
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.BankTransfer;
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public Guid RecordedByUserId { get; set; }

    public Invoice Invoice { get; set; } = null!;
}

public class Expense : TenantEntity
{
    public ExpenseCategory Category { get; set; } = ExpenseCategory.Other;
    public decimal Amount { get; set; }
    public DateTime ExpenseDateUtc { get; set; } = DateTime.UtcNow;
    public string Vendor { get; set; } = string.Empty;
    public string? Description { get; set; }
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.Card;
    public Guid? ProjectId { get; set; }
    public Guid? ReceiptDocumentId { get; set; }
    public Guid RecordedByUserId { get; set; }

    public Project? Project { get; set; }
    public DocumentRecord? ReceiptDocument { get; set; }
}

public class TimeEntry : TenantEntity
{
    public Guid UserId { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? WorkTaskId { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime StartTimeUtc { get; set; }
    public DateTime? EndTimeUtc { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsRunning { get; set; }
    public bool IsBillable { get; set; } = true;
    public decimal HourlyRate { get; set; }

    public Project? Project { get; set; }
    public WorkTask? WorkTask { get; set; }
}
