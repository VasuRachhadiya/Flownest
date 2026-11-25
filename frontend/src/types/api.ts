export type OrganizationRole = 'Owner' | 'Admin' | 'Manager' | 'Member';
export type MemberAvailability = 'Available' | 'Busy' | 'Away' | 'Offline';
export type CustomerType = 'Individual' | 'Business';
export type CustomerStatus = 'Active' | 'Inactive' | 'Archived';
export type LeadStage = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';
export type ProjectStatus = 'Planning' | 'Active' | 'OnHold' | 'Completed' | 'Cancelled';
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type WorkTaskStatus = 'ToDo' | 'InProgress' | 'InReview' | 'Completed';
export type InvoiceStatus = 'Draft' | 'Sent' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Cancelled';
export type PaymentMethod = 'Cash' | 'BankTransfer' | 'Card' | 'Upi' | 'Other';
export type ExpenseCategory = 'Office' | 'Travel' | 'Software' | 'Marketing' | 'Equipment' | 'Utilities' | 'Salaries' | 'Other';
export type DocumentCategory = 'Contract' | 'Proposal' | 'Invoice' | 'Receipt' | 'Report' | 'Deliverable' | 'Other';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  phoneNumber?: string;
}

export interface OrganizationMembership {
  organizationId: string;
  organizationName: string;
  slug: string;
  logoUrl?: string;
  currencyCode: string;
  timeZone: string;
  role: OrganizationRole;
}

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: UserSummary;
  activeOrganizationId?: string;
  organizations: OrganizationMembership[];
}

export interface OrganizationDetails {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  timeZone: string;
  currencyCode: string;
  brandAccentColor: string;
  currentUserRole: OrganizationRole;
}

export interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  customerType: CustomerType;
  status: CustomerStatus;
  source?: string;
  notes?: string;
  tags: string[];
  projectCount: number;
  invoiceCount: number;
  totalBilled: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ActivityItem {
  id: string;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  createdAtUtc: string;
}

export interface CustomerDetail {
  customer: Customer;
  projects: Array<{
    id: string;
    name: string;
    status: ProjectStatus;
    priority: PriorityLevel;
    dueDateUtc?: string;
    progressPercent: number;
    budget: number;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: InvoiceStatus;
    issueDateUtc: string;
    dueDateUtc: string;
    totalAmount: number;
    paidAmount: number;
  }>;
  activities: ActivityItem[];
}

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage: LeadStage;
  expectedValue: number;
  followUpDateUtc?: string;
  notes?: string;
  assignedToUserId?: string;
  assignedToName?: string;
  convertedCustomerId?: string;
  convertedAtUtc?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface LeadPipelineStats {
  totalLeads: number;
  totalPipelineValue: number;
  weightedValue: number;
  wonCount: number;
  wonValue: number;
  countByStage: Record<string, number>;
  valueByStage: Record<string, number>;
}

export interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  startDateUtc?: string;
  dueDateUtc?: string;
  budget: number;
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  loggedHours: number;
  members: Array<{ userId: string; fullName: string; email: string; projectRole?: string }>;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface WorkTask {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  status: WorkTaskStatus;
  priority: PriorityLevel;
  dueDateUtc?: string;
  labels: string[];
  estimatedHours: number;
  sortOrder: number;
  commentCount: number;
  assignees: Array<{ userId: string; fullName: string; email: string }>;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ProjectDetail {
  project: Project;
  totalExpenses: number;
  totalInvoiced: number;
  tasks: WorkTask[];
  activities: ActivityItem[];
}

export interface TaskComment {
  id: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAtUtc: string;
}

export interface TeamMember {
  memberId: string;
  userId: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  role: OrganizationRole;
  availability: MemberAvailability;
  hourlyRate?: number;
  isActive: boolean;
  activeProjectsCount: number;
  pendingTasksCount: number;
  completedTasksCount: number;
  joinedAtUtc: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: OrganizationRole;
  status: string;
  token: string;
  expiresAtUtc: string;
  createdAtUtc: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerCompany?: string;
  customerEmail?: string;
  customerAddress?: string;
  projectId?: string;
  projectName?: string;
  status: InvoiceStatus;
  issueDateUtc: string;
  dueDateUtc: string;
  subtotal: number;
  taxRatePercent: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string;
  terms?: string;
  items: InvoiceItem[];
  payments: Array<{
    id: string;
    amount: number;
    paymentDateUtc: string;
    paymentMethod: PaymentMethod;
    referenceNumber?: string;
    notes?: string;
  }>;
  createdAtUtc: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paymentDateUtc: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  recordedByName: string;
  createdAtUtc: string;
}

export interface PaymentSummary {
  totalReceived: number;
  pendingPayments: number;
  paymentCount: number;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDateUtc: string;
  vendor: string;
  description?: string;
  paymentMethod: PaymentMethod;
  projectId?: string;
  projectName?: string;
  receiptDocumentId?: string;
  receiptFileName?: string;
  recordedByName: string;
  createdAtUtc: string;
}

export interface ExpenseAnalytics {
  totalExpenses: number;
  currentMonthExpenses: number;
  byCategory: Array<{ category: string; amount: number }>;
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
}

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  projectId?: string;
  projectName?: string;
  workTaskId?: string;
  taskTitle?: string;
  description: string;
  startTimeUtc: string;
  endTimeUtc?: string;
  durationMinutes: number;
  isRunning: boolean;
  isBillable: boolean;
  hourlyRate: number;
  billableAmount: number;
}

export interface TimeSummary {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  totalBillableAmount: number;
  activeTimer?: TimeEntry;
}

export interface DocumentRecord {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  category: DocumentCategory;
  customerId?: string;
  customerName?: string;
  projectId?: string;
  projectName?: string;
  uploadedByName: string;
  description?: string;
  createdAtUtc: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAtUtc: string;
}

export interface GlobalSearchResult {
  customers: Array<{ id: string; title: string; subtitle?: string; category: string; route: string }>;
  leads: Array<{ id: string; title: string; subtitle?: string; category: string; route: string }>;
  projects: Array<{ id: string; title: string; subtitle?: string; category: string; route: string }>;
  tasks: Array<{ id: string; title: string; subtitle?: string; category: string; route: string }>;
  invoices: Array<{ id: string; title: string; subtitle?: string; category: string; route: string }>;
}

export interface DashboardOverview {
  totalRevenue: number;
  outstandingInvoices: number;
  totalExpenses: number;
  netProfit: number;
  activeProjects: number;
  pendingTasks: number;
  completedTasks: number;
  totalCustomers: number;
  newLeads: number;
  revenueExpenseSeries: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  projectStatusSeries: Array<{ status: string; count: number }>;
  teamWorkload: Array<{ userId: string; name: string; pendingTasks: number; completedTasks: number; activeProjects: number }>;
  recentActivities: ActivityItem[];
  upcomingDeadlines: Array<{ id: string; title: string; kind: string; dueDateUtc: string; status: string }>;
  recentInvoices: Array<{ id: string; invoiceNumber: string; customerName: string; totalAmount: number; balanceDue: number; status: InvoiceStatus; dueDateUtc: string }>;
  myTasks: Array<{ id: string; title: string; projectName?: string; priority: PriorityLevel; status: WorkTaskStatus; dueDateUtc?: string }>;
  alerts: Array<{ severity: string; title: string; description: string; route: string }>;
  isEmptyWorkspace: boolean;
}

export interface ReportsOverview {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  collectionRatePercent: number;
  totalCustomers: number;
  activeProjects: number;
  completedTasks: number;
  billableHours: number;
  monthlyFinancials: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  expensesByCategory: Array<{ category: string; amount: number }>;
  projectsByStatus: Array<{ status: string; count: number }>;
  tasksByStatus: Array<{ status: string; count: number }>;
  invoicesByStatus: Array<{ status: string; count: number }>;
  teamPerformance: Array<{ userId: string; name: string; pendingTasks: number; completedTasks: number; activeProjects: number }>;
  topCustomers: Array<{ customerId: string; name: string; company?: string; projectCount: number; invoiceCount: number; totalBilled: number; totalPaid: number }>;
}
