import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Edit2, Plus, Receipt, Search, Trash2 } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type {
  DocumentRecord,
  Expense,
  ExpenseAnalytics,
  ExpenseCategory,
  PagedResult,
  PaymentMethod,
  Project,
} from '@/types/api';
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

const CATEGORIES: ExpenseCategory[] = ['Office', 'Travel', 'Software', 'Marketing', 'Equipment', 'Utilities', 'Salaries', 'Other'];
const COLORS = ['#1E3A5F', '#3B6EA5', '#0F9D58', '#D97706', '#DC2626', '#64748B', '#0891B2', '#4F46E5'];

export function ExpensesPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currency = activeOrg?.currencyCode || 'USD';

  const [data, setData] = useState<PagedResult<Expense> | null>(null);
  const [analytics, setAnalytics] = useState<ExpenseAnalytics | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<ExpenseCategory>('Software');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(toInputDate(new Date().toISOString()));
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Card');
  const [projectId, setProjectId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [expRes, anaRes, projRes] = await Promise.all([
        apiClient.get<PagedResult<Expense>>('/expenses', { page, pageSize: 15, search, category: categoryFilter || undefined }),
        apiClient.get<ExpenseAnalytics>('/expenses/analytics'),
        apiClient.get<PagedResult<Project>>('/projects', { page: 1, pageSize: 100 }),
      ]);
      setData(expRes);
      setAnalytics(anaRes);
      setProjects(projRes.items);
    } catch (err: any) {
      toast.error('Failed to load expenses', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, categoryFilter, activeOrg?.organizationId]);

  const openCreate = () => {
    setEditing(null);
    setCategory('Software');
    setAmount('');
    setDate(toInputDate(new Date().toISOString()));
    setVendor('');
    setDescription('');
    setPaymentMethod('Card');
    setProjectId('');
    setReceiptFile(null);
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setCategory(e.category);
    setAmount(String(e.amount));
    setDate(toInputDate(e.expenseDateUtc));
    setVendor(e.vendor);
    setDescription(e.description || '');
    setPaymentMethod(e.paymentMethod);
    setProjectId(e.projectId || '');
    setReceiptFile(null);
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
      let receiptDocumentId = editing?.receiptDocumentId || null;
      if (receiptFile) {
        const fd = new FormData();
        fd.append('file', receiptFile);
        fd.append('category', 'Receipt');
        if (projectId) fd.append('projectId', projectId);
        const uploaded = await apiClient.upload<DocumentRecord>('/documents', fd);
        receiptDocumentId = uploaded.id;
      }

      const payload = {
        category,
        amount: Number(amount),
        expenseDateUtc: new Date(date).toISOString(),
        vendor,
        description: description || null,
        paymentMethod,
        projectId: projectId || null,
        receiptDocumentId,
      };

      if (editing) {
        await apiClient.put(`/expenses/${editing.id}`, payload);
        toast.success('Expense updated');
      } else {
        await apiClient.post('/expenses', payload);
        toast.success('Expense recorded');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error('Failed to save expense', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex: Expense) => {
    if (!window.confirm(`Delete expense for ${ex.vendor}?`)) return;
    await apiClient.delete(`/expenses/${ex.id}`);
    toast.success('Expense deleted');
    load();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        subtitle="Track operational spend, attach receipts, and monitor category distribution."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Record Expense
          </Button>
        }
      />

      {analytics && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <StatCard label="Total Expenses" value={formatCurrency(analytics.totalExpenses, currency)} mono />
            <StatCard label="Current Month Spend" value={formatCurrency(analytics.currentMonthExpenses, currency)} mono />
          </div>
          <Card>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">By Category</h3>
            {analytics.byCategory.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-400">No expense data yet.</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={analytics.byCategory} dataKey="amount" nameKey="category" innerRadius={40} outerRadius={68}>
                      {analytics.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Spend</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.monthlyTrend}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} />
                  <Bar dataKey="expenses" fill="#D97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      <Card padding={false}>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search vendor or description..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Select value={categoryFilter} onChange={(e) => { setPage(1); setCategoryFilter(e.target.value); }} className="w-44">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="p-4"><LoadingState rows={4} /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No expenses recorded"
              description="Log software, travel, office, or payroll expenses to track profitability."
              action={<Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Record Expense</Button>}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Project / Receipt</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((ex) => (
                    <tr key={ex.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(ex.expenseDateUtc)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{ex.vendor}</p>
                        {ex.description && <p className="text-xs text-slate-500">{ex.description}</p>}
                      </td>
                      <td className="px-4 py-3"><Badge>{ex.category}</Badge></td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                        <p>{ex.projectName || 'General'}</p>
                        {ex.receiptDocumentId && ex.receiptFileName && (
                          <button
                            onClick={() => apiClient.downloadBlob(`/documents/${ex.receiptDocumentId}/download`, ex.receiptFileName!)}
                            className="text-[11px] font-medium text-[#1E3A5F] hover:underline dark:text-blue-400"
                          >
                            {ex.receiptFileName}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(ex.amount, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(ex)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDelete(ex)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Expense' : 'Record Expense'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Vendor *" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
            <Input label="Amount *" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Select label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              <option value="Card">Card</option>
              <option value="BankTransfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Upi">UPI</option>
              <option value="Other">Other</option>
            </Select>
            <Select label="Project (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">General Overhead</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <Textarea label="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Receipt Attachment (optional)</label>
            <input type="file" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-xs text-slate-500" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Expense' : 'Record Expense'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
