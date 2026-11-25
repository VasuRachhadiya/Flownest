import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Globe, Mail, MapPin, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { CustomerDetail } from '@/types/api';
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/format';
import { Badge, Button, Card, LoadingState, PageHeader } from '@/components/ui/Primitives';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .get<CustomerDetail>(`/customers/${id}`)
      .then(setDetail)
      .catch((err) => toast.error('Customer not found', err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState rows={5} />;
  if (!detail) return null;

  const { customer, projects, invoices, activities } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/customers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Customers
          </Button>
        </Link>
      </div>

      <PageHeader
        title={customer.name}
        subtitle={customer.company ? `${customer.company} · ${customer.customerType}` : customer.customerType}
        actions={<Badge status={customer.status}>{customer.status}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Contact & Account Details</h2>
          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400" /> {customer.email || '—'}</div>
            <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400" /> {customer.phone || '—'}</div>
            <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-slate-400" /> {customer.website || '—'}</div>
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {customer.address || '—'}</div>
          </div>
          {customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {customer.tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          )}
          {customer.notes && (
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{customer.notes}</p>
            </div>
          )}
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Related Projects ({projects.length})</h2>
              <Link to="/projects?new=1" className="text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                New Project
              </Link>
            </div>
            {projects.length === 0 ? (
              <p className="py-4 text-xs text-slate-400">No projects linked to this customer.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((p) => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="flex items-center justify-between py-2.5 text-xs hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-[11px] text-slate-500">Due {formatDate(p.dueDateUtc)} · {p.progressPercent}% complete</p>
                    </div>
                    <Badge status={p.status}>{p.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Invoices ({invoices.length})</h2>
              <Link to="/invoices?new=1" className="text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                Create Invoice
              </Link>
            </div>
            {invoices.length === 0 ? (
              <p className="py-4 text-xs text-slate-400">No invoices issued for this customer.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <Link key={inv.id} to={`/invoices/${inv.id}`} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <p className="font-mono-num font-semibold text-slate-900 dark:text-white">{inv.invoiceNumber}</p>
                      <p className="text-[11px] text-slate-500">Due {formatDate(inv.dueDateUtc)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono-num font-semibold">{formatCurrency(inv.totalAmount, currency)}</p>
                      <Badge status={inv.status}>{inv.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Activity Timeline</h2>
            {activities.length === 0 ? (
              <p className="py-4 text-xs text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {activities.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-2 text-xs">
                    <p className="text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">{a.actorName}</span> · {a.summary}
                    </p>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(a.createdAtUtc)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
