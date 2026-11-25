import React, { useEffect, useState } from 'react';
import { Clock, Play, Plus, Square, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { PagedResult, Project, TimeEntry, TimeSummary, WorkTask } from '@/types/api';
import { formatCurrency, formatDateTime, formatDuration } from '@/utils/format';
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
} from '@/components/ui/Primitives';

export function TimeTrackingPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [entries, setEntries] = useState<PagedResult<TimeEntry> | null>(null);
  const [summary, setSummary] = useState<TimeSummary | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [timerDesc, setTimerDesc] = useState('');
  const [timerProjectId, setTimerProjectId] = useState('');
  const [timerTaskId, setTimerTaskId] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDesc, setManualDesc] = useState('');
  const [manualProjectId, setManualProjectId] = useState('');
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualBillable, setManualBillable] = useState(true);
  const [manualRate, setManualRate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [listRes, sumRes, projRes, taskRes] = await Promise.all([
        apiClient.get<PagedResult<TimeEntry>>('/time-entries', { page, pageSize: 15 }),
        apiClient.get<TimeSummary>('/time-entries/summary'),
        apiClient.get<PagedResult<Project>>('/projects', { page: 1, pageSize: 100 }),
        apiClient.get<PagedResult<WorkTask>>('/tasks', { page: 1, pageSize: 100 }),
      ]);
      setEntries(listRes);
      setSummary(sumRes);
      setProjects(projRes.items);
      setTasks(taskRes.items);
    } catch (err: any) {
      toast.error('Failed to load time entries', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, activeOrg?.organizationId]);

  useEffect(() => {
    const active = summary?.activeTimer;
    if (!active) {
      setElapsedSec(0);
      return;
    }
    const update = () => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - new Date(active.startTimeUtc).getTime()) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [summary?.activeTimer?.id]);

  const formatClock = (sec: number) => {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/time-entries/start', {
        projectId: timerProjectId || null,
        workTaskId: timerTaskId || null,
        description: timerDesc || 'Work session',
        isBillable: timerBillable,
      });
      toast.success('Timer started');
      setTimerDesc('');
      load();
    } catch (err: any) {
      toast.error('Cannot start timer', err.message);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await apiClient.post(`/time-entries/${id}/stop`);
      toast.success('Timer stopped & saved');
      load();
    } catch (err: any) {
      toast.error('Failed to stop timer', err.message);
    }
  };

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/time-entries/manual', {
        projectId: manualProjectId || null,
        workTaskId: manualTaskId || null,
        description: manualDesc,
        startTimeUtc: new Date(manualStart).toISOString(),
        endTimeUtc: new Date(manualEnd).toISOString(),
        isBillable: manualBillable,
        hourlyRate: manualRate ? Number(manualRate) : null,
      });
      toast.success('Manual time logged');
      setManualOpen(false);
      load();
    } catch (err: any) {
      toast.error('Could not log time', err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this time entry?')) return;
    await apiClient.delete(`/time-entries/${id}`);
    toast.success('Time entry deleted');
    load();
  };

  const activeTimer = summary?.activeTimer;
  const filteredTasks = (projId: string) => (projId ? tasks.filter((t) => t.projectId === projId) : tasks);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Time Tracking"
        subtitle="Track billable and non-billable hours with live timers and manual timesheets."
        actions={
          <Button variant="secondary" onClick={() => setManualOpen(true)}>
            <Plus className="h-4 w-4" />
            Log Manual Time
          </Button>
        }
      />

      {/* Live Timer Bar */}
      <Card>
        {activeTimer ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Timer Running
              </span>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{activeTimer.description}</p>
              <p className="text-xs text-slate-500">
                {activeTimer.projectName || 'General'} {activeTimer.taskTitle ? `· ${activeTimer.taskTitle}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white">{formatClock(elapsedSec)}</span>
              <Button variant="danger" onClick={() => handleStop(activeTimer.id)}>
                <Square className="h-3.5 w-3.5 fill-current" /> Stop Timer
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleStart} className="grid gap-3 md:grid-cols-12 md:items-end">
            <div className="md:col-span-4">
              <Input label="What are you working on?" placeholder="Task or activity description..." value={timerDesc} onChange={(e) => setTimerDesc(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Select label="Project" value={timerProjectId} onChange={(e) => { setTimerProjectId(e.target.value); setTimerTaskId(''); }}>
                <option value="">No Project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select label="Task" value={timerTaskId} onChange={(e) => setTimerTaskId(e.target.value)}>
                <option value="">No Task</option>
                {filteredTasks(timerProjectId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2 md:col-span-3 md:justify-end">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={timerBillable} onChange={(e) => setTimerBillable(e.target.checked)} className="rounded" />
                Billable
              </label>
              <Button type="submit">
                <Play className="h-3.5 w-3.5 fill-current" /> Start
              </Button>
            </div>
          </form>
        )}
      </Card>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Logged" value={formatDuration(summary.totalMinutes)} mono />
          <StatCard label="Billable Time" value={formatDuration(summary.billableMinutes)} mono />
          <StatCard label="Non-Billable Time" value={formatDuration(summary.nonBillableMinutes)} mono />
          <StatCard label="Billable Value" value={formatCurrency(summary.totalBillableAmount, currency)} mono />
        </div>
      )}

      <Card padding={false}>
        {loading ? (
          <div className="p-4"><LoadingState rows={4} /></div>
        ) : !entries || entries.items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title="No time logged yet"
              description="Start the live timer above or log a completed work session."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Window</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Duration</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entries.items.map((te) => (
                    <tr key={te.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{te.description}</p>
                        <p className="text-xs text-slate-500">{te.projectName || 'General'}{te.taskTitle ? ` · ${te.taskTitle}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{te.userName}</td>
                      <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                        {formatDateTime(te.startTimeUtc)}
                      </td>
                      <td className="px-4 py-3">
                        {te.isRunning ? <Badge tone="success">Running</Badge> : <Badge tone={te.isBillable ? 'info' : 'neutral'}>{te.isBillable ? 'Billable' : 'Internal'}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold">{formatDuration(te.durationMinutes)}</td>
                      <td className="px-4 py-3 text-right font-mono-num text-xs">{formatCurrency(te.billableAmount, currency)}</td>
                      <td className="px-4 py-3 text-right">
                        {te.isRunning ? (
                          <Button size="sm" variant="danger" onClick={() => handleStop(te.id)}>Stop</Button>
                        ) : (
                          <button onClick={() => handleDelete(te.id)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={entries.page} totalPages={entries.totalPages} totalCount={entries.totalCount} onPageChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title="Log Manual Time Entry">
        <form onSubmit={handleManual} className="space-y-4">
          <Input label="Description *" value={manualDesc} onChange={(e) => setManualDesc(e.target.value)} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Project" value={manualProjectId} onChange={(e) => setManualProjectId(e.target.value)}>
              <option value="">No Project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select label="Task" value={manualTaskId} onChange={(e) => setManualTaskId(e.target.value)}>
              <option value="">No Task</option>
              {filteredTasks(manualProjectId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </Select>
            <Input label="Start Time *" type="datetime-local" value={manualStart} onChange={(e) => setManualStart(e.target.value)} required />
            <Input label="End Time *" type="datetime-local" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} required />
            <Input label="Hourly Rate (optional)" type="number" step="0.01" min="0" value={manualRate} onChange={(e) => setManualRate(e.target.value)} />
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={manualBillable} onChange={(e) => setManualBillable(e.target.checked)} /> Billable session
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setManualOpen(false)}>Cancel</Button>
            <Button type="submit">Log Time</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
