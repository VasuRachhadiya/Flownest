import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Calendar, Edit2, Plus, Search, Target, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Lead, LeadPipelineStats, LeadStage, PagedResult, TeamMember } from '@/types/api';
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
  StatCard,
  Textarea,
} from '@/components/ui/Primitives';

const STAGES: LeadStage[] = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const EMPTY_LEAD = {
  name: '',
  company: '',
  email: '',
  phone: '',
  source: '',
  stage: 'New' as LeadStage,
  expectedValue: '0',
  followUpDateUtc: '',
  notes: '',
  assignedToUserId: '',
};

export function LeadsPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currency = activeOrg?.currencyCode || 'USD';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadPipelineStats | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(EMPTY_LEAD);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [leadRes, statsRes, teamRes] = await Promise.all([
        apiClient.get<PagedResult<Lead>>('/leads', { page: 1, pageSize: 100, search, stage: stageFilter || undefined }),
        apiClient.get<LeadPipelineStats>('/leads/stats'),
        apiClient.get<TeamMember[]>('/team/members'),
      ]);
      setLeads(leadRes.items);
      setStats(statsRes);
      setMembers(teamRes);
    } catch (err: any) {
      toast.error('Failed to load leads', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, stageFilter, activeOrg?.organizationId]);

  const openCreate = (stage: LeadStage = 'New') => {
    setEditing(null);
    setForm({ ...EMPTY_LEAD, stage });
    setModalOpen(true);
  };

  const openEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      name: l.name,
      company: l.company || '',
      email: l.email || '',
      phone: l.phone || '',
      source: l.source || '',
      stage: l.stage,
      expectedValue: String(l.expectedValue),
      followUpDateUtc: toInputDate(l.followUpDateUtc),
      notes: l.notes || '',
      assignedToUserId: l.assignedToUserId || '',
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
        source: form.source || null,
        stage: form.stage,
        expectedValue: Number(form.expectedValue) || 0,
        followUpDateUtc: form.followUpDateUtc ? new Date(form.followUpDateUtc).toISOString() : null,
        notes: form.notes || null,
        assignedToUserId: form.assignedToUserId || null,
      };
      if (editing) {
        await apiClient.put(`/leads/${editing.id}`, payload);
        toast.success('Lead updated');
      } else {
        await apiClient.post('/leads', payload);
        toast.success('Lead added');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error('Could not save lead', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (leadId: string, nextStage: LeadStage) => {
    try {
      await apiClient.patch(`/leads/${leadId}/stage`, { stage: nextStage });
      load();
    } catch (err: any) {
      toast.error('Stage update failed', err.message);
    }
  };

  const handleConvert = async (l: Lead) => {
    try {
      await apiClient.post(`/leads/${l.id}/convert`);
      toast.success('Lead converted to customer', `${l.name} is now in your Customers CRM.`);
      load();
    } catch (err: any) {
      toast.error('Conversion failed', err.message);
    }
  };

  const handleDelete = async (l: Lead) => {
    if (!window.confirm(`Delete lead "${l.name}"?`)) return;
    try {
      await apiClient.delete(`/leads/${l.id}`);
      toast.success('Lead deleted');
      load();
    } catch (err: any) {
      toast.error('Delete failed', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads Pipeline"
        subtitle="Track opportunities, schedule follow-ups, and convert won deals into customers."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        }
      />

      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Leads" value={stats.totalLeads} hint="Across all pipeline stages" />
          <StatCard label="Pipeline Value" value={formatCurrency(stats.totalPipelineValue, currency)} mono hint="Excluding lost deals" />
          <StatCard label="Weighted Forecast" value={formatCurrency(stats.weightedValue, currency)} mono hint="Stage probability adjusted" />
          <StatCard label="Won Revenue" value={formatCurrency(stats.wonValue, currency)} mono hint={`${stats.wonCount} deals won`} />
        </div>
      )}

      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lead name or company..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-[#1E3A5F] focus:outline-none dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="sm:w-44">
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState rows={4} />
      ) : leads.length === 0 ? (
        <EmptyState
          icon={<Target className="h-5 w-5" />}
          title="No leads in pipeline"
          description="Add prospective clients to track deal value, follow-up dates, and conversions."
          action={<Button size="sm" onClick={() => openCreate()}><Plus className="h-3.5 w-3.5" /> Add Lead</Button>}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.filter((s) => !stageFilter || stageFilter === s).map((stage) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            const stageVal = stageLeads.reduce((acc, x) => acc + x.expectedValue, 0);
            return (
              <div
                key={stage}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('leadId');
                  if (id) handleStageChange(id, stage);
                }}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200/90 bg-slate-100/60 p-3 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {stage} <span className="ml-1 text-slate-400">({stageLeads.length})</span>
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-500">{formatCurrency(stageVal, currency)}</p>
                  </div>
                  <button
                    onClick={() => openCreate(stage)}
                    className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800"
                    title={`Add lead to ${stage}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {stageLeads.map((l) => (
                    <div
                      key={l.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('leadId', l.id)}
                      className="cursor-grab rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-colors hover:border-slate-300 active:cursor-grabbing dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{l.name}</p>
                          {l.company && <p className="truncate text-[11px] text-slate-500">{l.company}</p>}
                        </div>
                        <span className="font-mono-num shrink-0 text-xs font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(l.expectedValue, currency)}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        {l.followUpDateUtc && (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                            <Calendar className="h-3 w-3" /> {formatDate(l.followUpDateUtc)}
                          </span>
                        )}
                        {l.assignedToName && <span>· {l.assignedToName}</span>}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-1 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <select
                          value={l.stage}
                          onChange={(e) => handleStageChange(l.id, e.target.value as LeadStage)}
                          className="h-7 rounded border border-slate-200 bg-white px-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950"
                        >
                          {STAGES.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1">
                          {!l.convertedCustomerId ? (
                            <button
                              onClick={() => handleConvert(l)}
                              className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300"
                              title="Convert to Customer"
                            >
                              <UserPlus className="h-3 w-3" /> Convert
                            </button>
                          ) : (
                            <Badge tone="success">Converted</Badge>
                          )}
                          <button onClick={() => openEdit(l)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(l)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Lead' : 'New Lead'} maxWidth="max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Contact Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label="Stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as LeadStage })}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input label="Expected Value" type="number" step="0.01" min="0" value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} />
            <Input label="Follow-Up Date" type="date" value={form.followUpDateUtc} onChange={(e) => setForm({ ...form, followUpDateUtc: e.target.value })} />
            <Select label="Assigned To" value={form.assignedToUserId} onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}>
              <option value="">Unassigned</option>
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
            </Select>
          </div>
          <Input label="Lead Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="LinkedIn, Referral, Website..." />
          <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Lead'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
