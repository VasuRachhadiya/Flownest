import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, Edit2, FolderKanban, LayoutGrid, List, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Customer, PagedResult, PriorityLevel, Project, ProjectStatus, TeamMember } from '@/types/api';
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
  Select,
  Textarea,
} from '@/components/ui/Primitives';

const STATUSES: ProjectStatus[] = ['Planning', 'Active', 'OnHold', 'Completed', 'Cancelled'];
const PRIORITIES: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

const EMPTY_PROJECT = {
  name: '',
  code: '',
  description: '',
  customerId: '',
  status: 'Planning' as ProjectStatus,
  priority: 'Medium' as PriorityLevel,
  startDateUtc: '',
  dueDateUtc: '',
  budget: '0',
  memberUserIds: [] as string[],
};

export function ProjectsPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currency = activeOrg?.currencyCode || 'USD';

  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'grid' | 'board' | 'timeline'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(EMPTY_PROJECT);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [projRes, custRes, teamRes] = await Promise.all([
        apiClient.get<PagedResult<Project>>('/projects', { page: 1, pageSize: 100, search, status: statusFilter || undefined }),
        apiClient.get<PagedResult<Customer>>('/customers', { page: 1, pageSize: 100 }),
        apiClient.get<TeamMember[]>('/team/members'),
      ]);
      setProjects(projRes.items);
      setCustomers(custRes.items);
      setMembers(teamRes);
    } catch (err: any) {
      toast.error('Failed to load projects', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, statusFilter, activeOrg?.organizationId]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_PROJECT);
    setModalOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      code: p.code || '',
      description: p.description || '',
      customerId: p.customerId || '',
      status: p.status,
      priority: p.priority,
      startDateUtc: toInputDate(p.startDateUtc),
      dueDateUtc: toInputDate(p.dueDateUtc),
      budget: String(p.budget),
      memberUserIds: p.members.map((m) => m.userId),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    if (searchParams.get('new')) setSearchParams({});
  };

  const toggleMember = (userId: string) => {
    setForm((prev) => ({
      ...prev,
      memberUserIds: prev.memberUserIds.includes(userId)
        ? prev.memberUserIds.filter((id) => id !== userId)
        : [...prev.memberUserIds, userId],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        description: form.description || null,
        customerId: form.customerId || null,
        status: form.status,
        priority: form.priority,
        startDateUtc: form.startDateUtc ? new Date(form.startDateUtc).toISOString() : null,
        dueDateUtc: form.dueDateUtc ? new Date(form.dueDateUtc).toISOString() : null,
        budget: Number(form.budget) || 0,
        memberUserIds: form.memberUserIds,
      };
      if (editing) {
        await apiClient.put(`/projects/${editing.id}`, payload);
        toast.success('Project updated');
      } else {
        await apiClient.post('/projects', payload);
        toast.success('Project created');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Project) => {
    if (!window.confirm(`Delete project "${p.name}"?`)) return;
    try {
      await apiClient.delete(`/projects/${p.id}`);
      toast.success('Project deleted');
      load();
    } catch (err: any) {
      toast.error('Delete failed', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Projects"
        subtitle="Manage client engagements, milestones, budgets, and team allocation."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        }
      />

      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search project name or code..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-[#1E3A5F] focus:outline-none dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-950">
            {[
              { id: 'grid', label: 'Grid', icon: LayoutGrid },
              { id: 'list', label: 'List', icon: List },
              { id: 'board', label: 'Board', icon: FolderKanban },
              { id: 'timeline', label: 'Timeline', icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as any)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium ${
                  view === tab.id ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white' : 'text-slate-500'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingState rows={4} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="No projects yet"
          description="Create your first project to organize tasks, team members, documents, and budgets."
          action={<Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> New Project</Button>}
        />
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col justify-between transition-colors hover:border-slate-300 dark:hover:border-slate-700">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {p.code && <span className="font-mono-num text-[11px] font-medium text-slate-400">{p.code}</span>}
                    <Link to={`/projects/${p.id}`} className="block text-base font-semibold text-slate-900 hover:text-[#1E3A5F] hover:underline dark:text-white dark:hover:text-blue-400">
                      {p.name}
                    </Link>
                    <p className="text-xs text-slate-500">{p.customerName || 'Internal Project'}</p>
                  </div>
                  <Badge status={p.status}>{p.status}</Badge>
                </div>

                {p.description && <p className="mt-2.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{p.description}</p>}

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                    <span>Progress ({p.completedTasks}/{p.totalTasks} tasks)</span>
                    <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-200">{p.progressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-[#1E3A5F] dark:bg-blue-500" style={{ width: `${p.progressPercent}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Badge status={p.priority}>{p.priority}</Badge>
                  <span className="font-mono-num text-slate-500">{formatCurrency(p.budget, currency)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(p)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(p)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : view === 'list' ? (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Status & Priority</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Deadline</th>
                  <th className="px-4 py-3 text-right font-medium">Budget</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Link to={`/projects/${p.id}`} className="font-semibold text-slate-900 hover:underline dark:text-white">{p.name}</Link>
                      <p className="text-xs text-slate-500">{p.customerName || 'Internal'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge status={p.status}>{p.status}</Badge>
                        <Badge status={p.priority}>{p.priority}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono-num">{p.progressPercent}% ({p.completedTasks}/{p.totalTasks})</td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">{formatDate(p.dueDateUtc)}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold">{formatCurrency(p.budget, currency)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(p)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : view === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((st) => {
            const list = projects.filter((p) => p.status === st);
            return (
              <div key={st} className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-100/60 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="mb-3 text-xs font-semibold text-slate-900 dark:text-white">{st} ({list.length})</p>
                <div className="space-y-2.5">
                  {list.map((p) => (
                    <Link key={p.id} to={`/projects/${p.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{p.customerName || 'Internal'} · {p.progressPercent}%</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Project Delivery Timeline</h3>
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Link to={`/projects/${p.id}`} className="font-semibold text-slate-900 hover:underline dark:text-white">{p.name}</Link>
                  <div className="flex items-center gap-2 text-slate-500">
                    <span>{formatDate(p.startDateUtc)} → {formatDate(p.dueDateUtc)}</span>
                    <Badge status={p.status}>{p.status}</Badge>
                  </div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-[#1E3A5F] dark:bg-blue-500" style={{ width: `${Math.max(5, p.progressPercent)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Project' : 'New Project'} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Project Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Project Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g., PRJ-101" />
            <Select label="Customer" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Internal / No Customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>)}
            </Select>
            <Input label="Budget" type="number" step="0.01" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}>
              {PRIORITIES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </Select>
            <Input label="Start Date" type="date" value={form.startDateUtc} onChange={(e) => setForm({ ...form, startDateUtc: e.target.value })} />
            <Input label="Due Date" type="date" value={form.dueDateUtc} onChange={(e) => setForm({ ...form, dueDateUtc: e.target.value })} />
          </div>
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Project Team Members</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = form.memberUserIds.includes(m.userId);
                return (
                  <button
                    type="button"
                    key={m.userId}
                    onClick={() => toggleMember(m.userId)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white dark:border-blue-500 dark:bg-blue-600'
                        : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {m.fullName}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Project' : 'Create Project'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
