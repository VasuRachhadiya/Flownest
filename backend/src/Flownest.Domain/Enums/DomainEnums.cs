namespace Flownest.Domain.Enums;

public enum OrganizationRole
{
    Owner = 1,
    Admin = 2,
    Manager = 3,
    Member = 4
}

public enum MemberAvailability
{
    Available = 1,
    Busy = 2,
    Away = 3,
    Offline = 4
}

public enum InvitationStatus
{
    Pending = 1,
    Accepted = 2,
    Revoked = 3,
    Expired = 4
}

public enum CustomerType
{
    Individual = 1,
    Business = 2
}

public enum CustomerStatus
{
    Active = 1,
    Inactive = 2,
    Archived = 3
}

public enum LeadStage
{
    New = 1,
    Contacted = 2,
    Qualified = 3,
    Proposal = 4,
    Negotiation = 5,
    Won = 6,
    Lost = 7
}

public enum ProjectStatus
{
    Planning = 1,
    Active = 2,
    OnHold = 3,
    Completed = 4,
    Cancelled = 5
}

public enum PriorityLevel
{
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

public enum WorkTaskStatus
{
    ToDo = 1,
    InProgress = 2,
    InReview = 3,
    Completed = 4
}

public enum InvoiceStatus
{
    Draft = 1,
    Sent = 2,
    PartiallyPaid = 3,
    Paid = 4,
    Overdue = 5,
    Cancelled = 6
}

public enum PaymentMethod
{
    Cash = 1,
    BankTransfer = 2,
    Card = 3,
    Upi = 4,
    Other = 5
}

public enum ExpenseCategory
{
    Office = 1,
    Travel = 2,
    Software = 3,
    Marketing = 4,
    Equipment = 5,
    Utilities = 6,
    Salaries = 7,
    Other = 8
}

public enum DocumentCategory
{
    Contract = 1,
    Proposal = 2,
    Invoice = 3,
    Receipt = 4,
    Report = 5,
    Deliverable = 6,
    Other = 7
}

public enum NotificationType
{
    TaskAssigned = 1,
    TaskDeadline = 2,
    ProjectUpdate = 3,
    CustomerActivity = 4,
    InvoiceUpdate = 5,
    PaymentRecorded = 6,
    TeamInvitation = 7,
    Mention = 8
}
