import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CheckSquare, Edit2, Kanban, List, MessageSquare, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { PagedResult, PriorityLevel, Project, TaskComment, TeamMember, WorkTask, WorkTaskStatus } from '@/types/api';
import { formatDate, formatRelativeTime, toInputDate } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui/Primitives';

const STATUSES: Array<{ id: WorkTaskStatus; label: string }> = [
  { id: 'ToDo', label: 'To Do' },
  { id: 'InProgress', label: 'In Progress' },
  { id: 'InReview', label: 'In Review' },
  { id: 'Completed', label: 'Completed' },
];
const PRIORITIES: PriorityLevel[] = ['Low', 'Medium', 'High', 'Critical'];

const EMPTY_TASK = {
  title: '',
  description: '',
  projectId: '',
  status: 'ToDo' as WorkTaskStatus,
  priority: 'Medium' as PriorityLevel,
  dueDateUtc: '',
  labelsText: '',
  estimatedHours: '0',
  assigneeUserIds: [] as string[],
};

export function TasksPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [scope, setScope] = useState<'all' | 'my' | 'assigned' | 'upcoming' | 'overdue'>('all');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState<WorkTask | null>(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [saving, setSaving] = useState(false);

  const [drawerTask, setDrawerTask] = useState<WorkTask | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentText, setCommentText] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [taskRes, projRes, teamRes] = await Promise.all([
        apiClient.get<PagedResult<WorkTask>>('/tasks', {
          page: 1,
          pageSize: 100,
          search,
          viewScope: scope,
          projectId: projectFilter || undefined,
        }),
        apiClient.get<PagedResult<Project>>('/projects', { page: 1, pageSize: 100 }),
        apiClient.get<TeamMember[]>('/team/members'),
      ]);
      setTasks(taskRes.items);
      setProjects(projRes.items);
      setMembers(teamRes);
    } catch (err: any) {
      toast.error('Failed to load tasks', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [scope, search, projectFilter, activeOrg?.organizationId]);

  const openCreate = (status: WorkTaskStatus = 'ToDo') => {
    setEditing(null);
    setForm({ ...EMPTY_TASK, status });
    setModalOpen(true);
  };

  const openEdit = (t: WorkTask) => {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description || '',
      projectId: t.projectId || '',
      status: t.status,
      priority: t.priority,
      dueDateUtc: toInputDate(t.dueDateUtc),
      labelsText: t.labels.join(', '),
      estimatedHours: String(t.estimatedHours),
      assigneeUserIds: t.assignees.map((a) => a.userId),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    if (searchParams.get('new')) setSearchParams({});
  };

  const toggleAssignee = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      assigneeUserIds: prev.assigneeUserIds.includes(uid)
        ? prev.assigneeUserIds.filter((x) => x !== uid)
        : [...prev.assigneeUserIds, uid],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        projectId: form.projectId || null,
        status: form.status,
        priority: form.priority,
        dueDateUtc: form.dueDateUtc ? new Date(form.dueDateUtc).toISOString() : null,
        labels: form.labelsText.split(',').map((s) => s.trim()).filter(Boolean),
        estimatedHours: Number(form.estimatedHours) || 0,
        assigneeUserIds: form.assigneeUserIds,
      };
      if (editing) {
        await apiClient.put(`/tasks/${editing.id}`, payload);
        toast.success('Task updated');
      } else {
        await apiClient.post('/tasks', payload);
        toast.success('Task created');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error('Could not save task', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (taskId: string, status: WorkTaskStatus) => {
    try {
      await apiClient.patch(`/tasks/${taskId}/move`, { status });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    } catch (err: any) {
      toast.error('Move failed', err.message);
    }
  };

  const handleDelete = async (t: WorkTask) => {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    await apiClient.delete(`/tasks/${t.id}`);
    toast.success('Task deleted');
    if (drawerTask?.id === t.id) setDrawerTask(null);
    load();
  };

  const openDrawer = async (t: WorkTask) => {
    setDrawerTask(t);
    try {
      const res = await apiClient.get<TaskComment[]>(`/tasks/${t.id}/comments`);
      setComments(res);
    } catch {
      setComments([]);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerTask || !commentText.trim()) return;
    try {
      const added = await apiClient.post<TaskComment>(`/tasks/${drawerTask.id}/comments`, { content: commentText.trim() });
      setComments((prev) => [...prev, added]);
      setCommentText('');
      load();
    } catch (err: any) {
      toast.error('Comment failed', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        subtitle="Coordinate execution across Kanban boards, personal task queues, and project milestones."
        actions={
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        }
      />

      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium dark:bg-slate-950">
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'my', label: 'My Tasks' },
              { id: 'assigned', label: 'Assigned' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'overdue', label: 'Overdue' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setScope(tab.id as any)}
                className={`rounded-md px-2.5 py-1.5 ${
                  scope === tab.id ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-800 dark:bg-slate-950">
            <button
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium ${viewMode === 'board' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
            >
              <Kanban className="h-3.5 w-3.5" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 font-medium ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-800 dark:text-white' : 'text-slate-500'}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search task title or label..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="sm:w-56">
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingState rows={4} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-5 w-5" />}
          title="No tasks match this view"
          description="Create a task or switch your filter scope to see workspace deliverables."
          action={<Button size="sm" onClick={() => openCreate()}><Plus className="h-3.5 w-3.5" /> New Task</Button>}
        />
      ) : viewMode === 'board' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('taskId');
                  if (id) handleMove(id, col.id);
                }}
                className="flex flex-col rounded-xl border border-slate-200/90 bg-slate-100/60 p-3 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {col.label} <span className="ml-1 text-slate-400">({colTasks.length})</span>
                  </span>
                  <button onClick={() => openCreate(col.id)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('taskId', t.id)}
                      onClick={() => openDrawer(t)}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">{t.title}</p>
                        <Badge status={t.priority}>{t.priority}</Badge>
                      </div>
                      {t.projectName && <p className="mt-1 text-[11px] text-slate-500">{t.projectName}</p>}
                      {t.labels.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {t.labels.map((lb) => (
                            <span key={lb} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {lb}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-slate-800">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(t.dueDateUtc)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {t.commentCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <button onClick={() => openDrawer(t)} className="text-left font-semibold text-slate-900 hover:underline dark:text-white">
                        {t.title}
                      </button>
                      <p className="text-[11px] text-slate-500">{t.assignees.map((a) => a.fullName).join(', ') || 'Unassigned'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{t.projectName || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => handleMove(t.id, e.target.value as WorkTaskStatus)}
                        className="h-7 rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                      >
                        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3"><Badge status={t.priority}>{t.priority}</Badge></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.dueDateUtc)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(t)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => handleDelete(t)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Task Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Task' : 'New Task'} maxWidth="max-w-xl">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">No Project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as WorkTaskStatus })}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as PriorityLevel })}>
              {PRIORITIES.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
            </Select>
            <Input label="Due Date" type="date" value={form.dueDateUtc} onChange={(e) => setForm({ ...form, dueDateUtc: e.target.value })} />
            <Input label="Estimated Hours" type="number" step="0.5" min="0" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} />
            <Input label="Labels (comma-separated)" value={form.labelsText} onChange={(e) => setForm({ ...form, labelsText: e.target.value })} placeholder="Backend, Design" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">Assignees</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const active = form.assigneeUserIds.includes(m.userId);
                return (
                  <button
                    type="button"
                    key={m.userId}
                    onClick={() => toggleAssignee(m.userId)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                      active
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
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save Task' : 'Create Task'}</Button>
          </div>
        </form>
      </Modal>

      {/* Task Details & Comments Drawer */}
      <Drawer
        open={!!drawerTask}
        onClose={() => setDrawerTask(null)}
        title={drawerTask?.title || ''}
        subtitle={drawerTask?.projectName || 'Workspace Task'}
      >
        {drawerTask && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={drawerTask.status}>{drawerTask.status}</Badge>
              <Badge status={drawerTask.priority}>{drawerTask.priority}</Badge>
              <Button size="sm" variant="secondary" onClick={() => { setDrawerTask(null); openEdit(drawerTask); }}>
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
            {drawerTask.description && (
              <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{drawerTask.description}</p>
            )}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
              <p><strong>Due:</strong> {formatDate(drawerTask.dueDateUtc)}</p>
              <p className="mt-1"><strong>Assignees:</strong> {drawerTask.assignees.map((a) => a.fullName).join(', ') || 'Unassigned'}</p>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Comments ({comments.length})</h4>
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-100 p-3 text-xs dark:border-slate-800">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">{c.authorName}</span>
                      <span className="text-[11px] text-slate-400">{formatRelativeTime(c.createdAtUtc)}</span>
                    </div>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{c.content}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={submitComment} className="mt-4 flex gap-2">
                <Input
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
