import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Printer, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Invoice, PaymentMethod } from '@/types/api';
import { formatCurrency, formatDate, toInputDate } from '@/utils/format';
import { Badge, Button, Card, Input, LoadingState, Modal, Select, Textarea } from '@/components/ui/Primitives';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toInputDate(new Date().toISOString()));
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BankTransfer');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const inv = await apiClient.get<Invoice>(`/invoices/${id}`);
      setInvoice(inv);
      setPayAmount(String(inv.balanceDue));
    } catch (err: any) {
      toast.error('Invoice not found', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const markSent = async () => {
    if (!invoice) return;
    await apiClient.patch(`/invoices/${invoice.id}/status`, { status: 'Sent' });
    toast.success('Invoice marked as Sent');
    load();
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    try {
      await apiClient.post('/payments', {
        invoiceId: invoice.id,
        amount: Number(payAmount),
        paymentDateUtc: new Date(payDate).toISOString(),
        paymentMethod: payMethod,
        referenceNumber: payRef || null,
        notes: payNotes || null,
      });
      toast.success('Payment recorded');
      setPayOpen(false);
      load();
    } catch (err: any) {
      toast.error('Payment failed', err.message);
    }
  };

  if (loading) return <LoadingState rows={5} />;
  if (!invoice) return null;

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/invoices">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === 'Draft' && (
            <Button size="sm" variant="secondary" onClick={markSent}>
              <Send className="h-3.5 w-3.5" /> Mark as Sent
            </Button>
          )}
          {invoice.balanceDue > 0 && invoice.status !== 'Cancelled' && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print / Save PDF
          </Button>
        </div>
      </div>

      {/* Print-friendly Invoice Sheet */}
      <Card className="mx-auto max-w-4xl p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="font-display text-2xl font-bold text-slate-900 dark:text-white">{activeOrg?.organizationName}</p>
            <p className="mt-1 text-xs text-slate-500">Tax / Commercial Statement</p>
          </div>
          <div className="text-right">
            <p className="font-mono-num text-xl font-bold text-[#1E3A5F] dark:text-blue-400">{invoice.invoiceNumber}</p>
            <div className="mt-1"><Badge status={invoice.status}>{invoice.status}</Badge></div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bill To</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{invoice.customerName}</p>
            {invoice.customerCompany && <p className="text-xs text-slate-600 dark:text-slate-300">{invoice.customerCompany}</p>}
            {invoice.customerEmail && <p className="text-xs text-slate-500">{invoice.customerEmail}</p>}
            {invoice.customerAddress && <p className="mt-1 text-xs text-slate-500">{invoice.customerAddress}</p>}
          </div>
          <div className="space-y-1.5 text-xs sm:text-right">
            <p><span className="text-slate-400">Issue Date:</span> <strong>{formatDate(invoice.issueDateUtc)}</strong></p>
            <p><span className="text-slate-400">Due Date:</span> <strong>{formatDate(invoice.dueDateUtc)}</strong></p>
            {invoice.projectName && <p><span className="text-slate-400">Project:</span> <strong>{invoice.projectName}</strong></p>}
          </div>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="py-2.5 font-medium">Description</th>
                <th className="py-2.5 text-right font-medium">Qty</th>
                <th className="py-2.5 text-right font-medium">Unit Price</th>
                <th className="py-2.5 text-right font-medium">Tax %</th>
                <th className="py-2.5 text-right font-medium">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoice.items.map((it) => (
                <tr key={it.id}>
                  <td className="py-3 font-medium text-slate-900 dark:text-white">{it.description}</td>
                  <td className="py-3 text-right font-mono-num">{it.quantity}</td>
                  <td className="py-3 text-right font-mono-num">{formatCurrency(it.unitPrice, currency)}</td>
                  <td className="py-3 text-right font-mono-num">{it.taxPercent}%</td>
                  <td className="py-3 text-right font-mono-num font-semibold">{formatCurrency(it.lineTotal, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono-num">{formatCurrency(invoice.subtotal, currency)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-mono-num">{formatCurrency(invoice.taxAmount, currency)}</span></div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between"><span className="text-slate-500">Discount</span><span className="font-mono-num text-emerald-600">-{formatCurrency(invoice.discountAmount, currency)}</span></div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold dark:border-slate-800">
              <span>Total</span><span className="font-mono-num">{formatCurrency(invoice.totalAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="font-mono-num">{formatCurrency(invoice.paidAmount, currency)}</span></div>
            <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
              <span>Balance Due</span><span className="font-mono-num">{formatCurrency(invoice.balanceDue, currency)}</span>
            </div>
          </div>
        </div>

        {(invoice.notes || invoice.terms) && (
          <div className="mt-8 grid gap-4 border-t border-slate-100 pt-5 text-xs text-slate-500 sm:grid-cols-2 dark:border-slate-800">
            {invoice.notes && <div><p className="font-semibold text-slate-700 dark:text-slate-300">Notes</p><p className="mt-1">{invoice.notes}</p></div>}
            {invoice.terms && <div><p className="font-semibold text-slate-700 dark:text-slate-300">Terms</p><p className="mt-1">{invoice.terms}</p></div>}
          </div>
        )}

        {invoice.payments.length > 0 && (
          <div className="mt-8 border-t border-slate-100 pt-5 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Payment History</p>
            <div className="space-y-1.5 text-xs">
              {invoice.payments.map((p) => (
                <div key={p.id} className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{formatDate(p.paymentDateUtc)} · {p.paymentMethod} {p.referenceNumber ? `(${p.referenceNumber})` : ''}</span>
                  <span className="font-mono-num font-semibold text-emerald-600">{formatCurrency(p.amount, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Record Payment for ${invoice.invoiceNumber}`}>
        <form onSubmit={recordPayment} className="space-y-4">
          <Input label="Amount *" type="number" step="0.01" min="0.01" max={invoice.balanceDue} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Payment Date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
            <Select label="Method" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}>
              <option value="BankTransfer">Bank Transfer</option>
              <option value="Card">Card</option>
              <option value="Upi">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <Input label="Reference Number" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="ACH / Transaction ID" />
          <Textarea label="Notes" rows={2} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button type="submit">Apply Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
