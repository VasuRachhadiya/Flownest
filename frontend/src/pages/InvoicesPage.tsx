import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Edit2, Eye, FileSpreadsheet, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Customer, Invoice, InvoiceStatus, PagedResult, Project } from '@/types/api';
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
  Textarea,
} from '@/components/ui/Primitives';

interface LineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
}

const EMPTY_LINE: LineDraft = { description: '', quantity: '1', unitPrice: '0', taxPercent: '0' };

export function InvoicesPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currency = activeOrg?.currencyCode || 'USD';

  const [data, setData] = useState<PagedResult<Invoice> | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [issueDate, setIssueDate] = useState(toInputDate(new Date().toISOString()));
  const [dueDate, setDueDate] = useState(toInputDate(new Date(Date.now() + 14 * 86400000).toISOString()));
  const [taxRatePercent, setTaxRatePercent] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Net 14 days');
  const [items, setItems] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, custRes, projRes] = await Promise.all([
        apiClient.get<PagedResult<Invoice>>('/invoices', { page, pageSize: 15, search, status: statusFilter || undefined }),
        apiClient.get<PagedResult<Customer>>('/customers', { page: 1, pageSize: 100 }),
        apiClient.get<PagedResult<Project>>('/projects', { page: 1, pageSize: 100 }),
      ]);
      setData(invRes);
      setCustomers(custRes.items);
      setProjects(projRes.items);
    } catch (err: any) {
      toast.error('Failed to load invoices', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, statusFilter, activeOrg?.organizationId]);

  const openCreate = () => {
    setEditing(null);
    setCustomerId(customers[0]?.id || '');
    setProjectId('');
    setIssueDate(toInputDate(new Date().toISOString()));
    setDueDate(toInputDate(new Date(Date.now() + 14 * 86400000).toISOString()));
    setTaxRatePercent('0');
    setDiscountAmount('0');
    setNotes('');
    setTerms('Net 14 days');
    setItems([{ ...EMPTY_LINE }]);
    setModalOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setCustomerId(inv.customerId);
    setProjectId(inv.projectId || '');
    setIssueDate(toInputDate(inv.issueDateUtc));
    setDueDate(toInputDate(inv.dueDateUtc));
    setTaxRatePercent(String(inv.taxRatePercent));
    setDiscountAmount(String(inv.discountAmount));
    setNotes(inv.notes || '');
    setTerms(inv.terms || '');
    setItems(
      inv.items.map((it) => ({
        description: it.description,
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
        taxPercent: String(it.taxPercent),
      }))
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    if (searchParams.get('new')) setSearchParams({});
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        customerId,
        projectId: projectId || null,
        issueDateUtc: new Date(issueDate).toISOString(),
        dueDateUtc: new Date(dueDate).toISOString(),
        taxRatePercent: Number(taxRatePercent) || 0,
        discountAmount: Number(discountAmount) || 0,
        notes: notes || null,
        terms: terms || null,
        items: items.map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          taxPercent: Number(it.taxPercent) || 0,
        })),
      };

      if (editing) {
        await apiClient.put(`/invoices/${editing.id}`, payload);
        toast.success('Invoice updated (totals verified by server)');
      } else {
        await apiClient.post('/invoices', payload);
        toast.success('Invoice created');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error('Invoice save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: InvoiceStatus) => {
    try {
      await apiClient.patch(`/invoices/${id}/status`, { status });
      toast.success(`Invoice marked as ${status}`);
      load();
    } catch (err: any) {
      toast.error('Status update failed', err.message);
    }
  };

  const handleDeleteDraft = async (inv: Invoice) => {
    if (!window.confirm(`Delete draft invoice ${inv.invoiceNumber}?`)) return;
    try {
      await apiClient.delete(`/invoices/${inv.id}`);
      toast.success('Draft deleted');
      load();
    } catch (err: any) {
      toast.error('Delete failed', err.message);
    }
  };

  // Preview-only UI estimate (authoritative calculation runs on backend)
  const previewSub = items.reduce((s, x) => s + (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0), 0);
  const previewLineTax = items.reduce(
    (s, x) => s + (Number(x.quantity) || 0) * (Number(x.unitPrice) || 0) * ((Number(x.taxPercent) || 0) / 100),
    0
  );
  const previewTotal = Math.max(0, previewSub + previewLineTax + previewSub * ((Number(taxRatePercent) || 0) / 100) - (Number(discountAmount) || 0));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Create client invoices, manage billing statuses, and export print-ready statements."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        }
      />

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search invoice # or customer..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} className="w-44">
            <option value="">All Statuses</option>
            {['Draft', 'Sent', 'PartiallyPaid', 'Paid', 'Overdue', 'Cancelled'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="p-4"><LoadingState rows={5} /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title="No invoices found"
              description="Create your first invoice with line items, taxes, and customer billing details."
              action={<Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Create Invoice</Button>}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice #</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Due Date</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Balance</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <Link to={`/invoices/${inv.id}`} className="font-mono-num font-semibold text-[#1E3A5F] hover:underline dark:text-blue-400">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{inv.customerName}</p>
                        {inv.projectName && <p className="text-xs text-slate-500">{inv.projectName}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge status={inv.status}>{inv.status}</Badge>
                          {inv.status === 'Draft' && (
                            <button onClick={() => handleStatusChange(inv.id, 'Sent')} className="text-[11px] font-medium text-blue-600 hover:underline">
                              Send
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">{formatDate(inv.dueDateUtc)}</td>
                      <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold">{formatCurrency(inv.totalAmount, currency)}</td>
                      <td className="hidden px-4 py-3 text-right font-mono-num text-xs text-slate-600 dark:text-slate-300 sm:table-cell">
                        {formatCurrency(inv.balanceDue, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link to={`/invoices/${inv.id}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Preview / Print">
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                            <button onClick={() => openEdit(inv)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {inv.status === 'Draft' && (
                            <button onClick={() => handleDeleteDraft(inv)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete draft">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.invoiceNumber}` : 'Create Invoice'} maxWidth="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Customer *" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer...</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
            </Select>
            <Select label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No linked project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input label="Issue Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Line Items</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setItems([...items, { ...EMPTY_LINE }])}>
                <Plus className="h-3.5 w-3.5" /> Add Item
              </Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-slate-200 p-2.5 sm:grid-cols-12 dark:border-slate-800">
                <div className="sm:col-span-5">
                  <Input
                    placeholder="Description *"
                    value={item.description}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].description = e.target.value;
                      setItems(next);
                    }}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].quantity = e.target.value;
                      setItems(next);
                    }}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Unit $"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].unitPrice = e.target.value;
                      setItems(next);
                    }}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Tax %"
                    value={item.taxPercent}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx].taxPercent = e.target.value;
                      setItems(next);
                    }}
                  />
                </div>
                <div className="flex items-center justify-end sm:col-span-1">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Invoice Tax (%)" type="number" step="0.01" min="0" value={taxRatePercent} onChange={(e) => setTaxRatePercent(e.target.value)} />
            <Input label="Discount Amount" type="number" step="0.01" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} />
            <div className="flex flex-col justify-end rounded-lg bg-slate-50 px-3 py-2 text-right dark:bg-slate-950">
              <span className="text-[11px] text-slate-500">Estimated Total (Server Verified)</span>
              <span className="font-mono-num text-base font-bold text-slate-900 dark:text-white">{formatCurrency(previewTotal, currency)}</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Textarea label="Payment Terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Invoice' : 'Create Draft Invoice'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
