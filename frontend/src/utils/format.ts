export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount ?? 0);
  } catch {
    return `$${(amount ?? 0).toFixed(2)}`;
  }
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '';
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return formatDate(iso);
}

export function formatDuration(minutes: number): string {
  const hrs = Math.floor((minutes || 0) / 60);
  const mins = (minutes || 0) % 60;
  return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function toInputDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function getStatusTone(status: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'Active':
    case 'Paid':
    case 'Completed':
    case 'Won':
    case 'Available':
    case 'Accepted':
      return 'success';
    case 'InProgress':
    case 'InReview':
    case 'Sent':
    case 'Qualified':
    case 'Proposal':
    case 'Negotiation':
    case 'Contacted':
      return 'info';
    case 'PartiallyPaid':
    case 'OnHold':
    case 'Planning':
    case 'Busy':
    case 'Away':
    case 'Medium':
    case 'High':
      return 'warning';
    case 'Overdue':
    case 'Cancelled':
    case 'Lost':
    case 'Critical':
    case 'Revoked':
    case 'Expired':
      return 'danger';
    default:
      return 'neutral';
  }
}
