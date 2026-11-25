import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Edit2, ExternalLink, Plus, Search, Trash2, UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Customer, CustomerStatus, CustomerType, PagedResult } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';
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

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  website: '',
  customerType: 'Business' as CustomerType,
  status: 'Active' as CustomerStatus,
  source: '',
  notes: '',
  tagsText: '',
};

export function CustomersPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currency = activeOrg?.currencyCode || 'USD';

  const [data, setData] = useState<PagedResult<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<PagedResult<Customer>>('/customers', {
        page,
        pageSize: 15,
        search,
        status: statusFilter || undefined,
        customerType: typeFilter || undefined,
      });
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load customers', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, search, statusFilter, typeFilter, activeOrg?.organizationId]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      website: c.website || '',
      customerType: c.customerType,
      status: c.status,
      source: c.source || '',
      notes: c.notes || '',
      tagsText: c.tags.join(', '),
    });
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
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        website: form.website || null,
        customerType: form.customerType,
        status: form.status,
        source: form.source || null,
        notes: form.notes || null,
        tags: form.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editing) {
        await apiClient.put(`/customers/${editing.id}`, payload);
        toast.success('Customer updated');
      } else {
        await apiClient.post('/customers', payload);
        toast.success('Customer created');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!window.confirm(`Delete customer "${c.name}"?`)) return;
    try {
      await apiClient.delete(`/customers/${c.id}`);
      toast.success('Customer removed');
      load();
    } catch (err: any) {
      toast.error('Delete failed', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle="Manage client contacts, companies, tags, and linked revenue."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      <Card padding={false}>
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search name, company, email, tag..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-[#1E3A5F] focus:outline-none dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} className="w-36">
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }} className="w-36">
              <option value="">All Types</option>
              <option value="Business">Business</option>
              <option value="Individual">Individual</option>
            </Select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-4"><LoadingState rows={5} /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<UserCheck className="h-5 w-5" />}
              title="No customers found"
              description="Add your first customer or adjust your search and status filters."
              action={<Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Customer</Button>}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Type & Status</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Contact</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">Projects / Invoices</th>
                    <th className="px-4 py-3 text-right font-medium">Total Billed</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <Link to={`/customers/${c.id}`} className="font-semibold text-slate-900 hover:text-[#1E3A5F] hover:underline dark:text-white dark:hover:text-blue-400">
                          {c.name}
                        </Link>
                        {c.company && <p className="text-xs text-slate-500">{c.company}</p>}
                        {c.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.tags.map((t) => (
                              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge status={c.status}>{c.status}</Badge>
                          <span className="text-[11px] text-slate-500">{c.customerType}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-600 dark:text-slate-300 md:table-cell">
                        <p>{c.email || '—'}</p>
                        <p className="text-slate-400">{c.phone || ''}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-slate-600 dark:text-slate-300 lg:table-cell">
                        {c.projectCount} projects · {c.invoiceCount} invoices
                        <p className="text-[11px] text-slate-400">Added {formatDate(c.createdAtUtc)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(c.totalBilled, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link to={`/customers/${c.id}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="View profile">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <button onClick={() => openEdit(c)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(c)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Customer' : 'New Customer'} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label="Customer Type" value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value as CustomerType })}>
              <option value="Business">Business</option>
              <option value="Individual">Individual</option>
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </Select>
            <Input label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            <Input label="Lead Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Referral, Inbound..." />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Tags (comma-separated)" value={form.tagsText} onChange={(e) => setForm({ ...form, tagsText: e.target.value })} placeholder="Enterprise, Retainer" />
          <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Customer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
