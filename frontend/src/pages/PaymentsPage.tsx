import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Invoice, PagedResult, Payment, PaymentMethod, PaymentSummary } from '@/types/api';
import { formatCurrency, formatDate, toInputDate } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatCard,
  Textarea,
} from '@/components/ui/Primitives';

export function PaymentsPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [data, setData] = useState<PagedResult<Payment> | null>(null);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [method, setMethod] = useState<PaymentMethod>('BankTransfer');
  const [refNum, setRefNum] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [payRes, sumRes, invRes] = await Promise.all([
        apiClient.get<PagedResult<Payment>>('/payments', { page, pageSize: 15, search, paymentMethod: methodFilter || undefined }),
        apiClient.get<PaymentSummary>('/payments/summary'),
        apiClient.get<PagedResult<Invoice>>('/invoices', { page: 1, pageSize: 100 }),
      ]);
      setData(payRes);
      setSummary(sumRes);
      setUnpaidInvoices(invRes.items.filter((i) => i.balanceDue > 0 && i.status !== 'Cancelled'));
    } catch (err: any) {
      toast.error('Failed to load payments', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, methodFilter, activeOrg?.organizationId]);

  const openModal = () => {
    const first = unpaidInvoices[0];
    setInvoiceId(first?.id || '');
    setAmount(first ? String(first.balanceDue) : '');
    setDate(toInputDate(new Date().toISOString()));
    setMethod('BankTransfer');
    setRefNum('');
    setNotes('');
    setModalOpen(true);
  };

  const handleInvoicePick = (id: string) => {
    setInvoiceId(id);
    const inv = unpaidInvoices.find((i) => i.id === id);
    if (inv) setAmount(String(inv.balanceDue));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.post('/payments', {
        invoiceId,
        amount: Number(amount),
        paymentDateUtc: new Date(date).toISOString(),
        paymentMethod: method,
        referenceNumber: refNum || null,
        notes: notes || null,
      });
      toast.success('Payment recorded and invoice balance updated');
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast.error('Payment failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Record incoming customer payments and reconcile invoice balances."
        actions={
          <Button onClick={openModal} disabled={unpaidInvoices.length === 0}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        }
      />

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Received" value={formatCurrency(summary.totalReceived, currency)} mono />
          <StatCard label="Pending Receivables" value={formatCurrency(summary.pendingPayments, currency)} mono />
          <StatCard label="Recorded Transactions" value={summary.paymentCount} mono />
        </div>
      )}

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search invoice #, customer, reference..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Select value={methodFilter} onChange={(e) => { setPage(1); setMethodFilter(e.target.value); }} className="w-44">
            <option value="">All Methods</option>
            <option value="BankTransfer">Bank Transfer</option>
            <option value="Card">Card</option>
            <option value="Upi">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Other">Other</option>
          </Select>
        </div>

        {loading ? (
          <div className="p-4"><LoadingState rows={4} /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title="No payments recorded yet"
              description="Record a payment against an issued invoice to update revenue and balances."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Method</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Reference</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{formatDate(p.paymentDateUtc)}</td>
                      <td className="px-4 py-3 font-mono-num text-xs font-semibold">{p.invoiceNumber}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-900 dark:text-white">{p.customerName}</td>
                      <td className="px-4 py-3"><Badge>{p.paymentMethod}</Badge></td>
                      <td className="hidden px-4 py-3 font-mono-num text-xs text-slate-500 md:table-cell">{p.referenceNumber || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold text-emerald-600">{formatCurrency(p.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Payment">
        <form onSubmit={handleSave} className="space-y-4">
          <Select label="Invoice *" value={invoiceId} onChange={(e) => handleInvoicePick(e.target.value)} required>
            {unpaidInvoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.invoiceNumber} — {i.customerName} (Balance: {formatCurrency(i.balanceDue, currency)})
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount *" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Input label="Payment Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Select label="Payment Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="BankTransfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Upi">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Other">Other</option>
            </Select>
            <Input label="Reference #" value={refNum} onChange={(e) => setRefNum(e.target.value)} />
          </div>
          <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
