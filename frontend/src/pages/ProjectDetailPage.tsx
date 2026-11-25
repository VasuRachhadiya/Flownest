import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { DocumentRecord, PagedResult, ProjectDetail, WorkTaskStatus } from '@/types/api';
import { formatBytes, formatCurrency, formatDate, formatRelativeTime } from '@/utils/format';
import { Badge, Button, Card, Input, LoadingState, Modal, PageHeader, StatCard } from '@/components/ui/Primitives';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [files, setFiles] = useState<DocumentRecord[]>([]);
  const [tab, setTab] = useState<'overview' | 'tasks' | 'team' | 'activity' | 'files' | 'budget'>('overview');
  const [loading, setLoading] = useState(true);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [projRes, docsRes] = await Promise.all([
        apiClient.get<ProjectDetail>(`/projects/${id}`),
        apiClient.get<PagedResult<DocumentRecord>>('/documents', { projectId: id, pageSize: 50 }),
      ]);
      setDetail(projRes);
      setFiles(docsRes.items);
    } catch (err: any) {
      toast.error('Failed to load project', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newTaskTitle.trim()) return;
    try {
      await apiClient.post('/tasks', {
        title: newTaskTitle.trim(),
        projectId: id,
        status: 'ToDo',
        priority: 'Medium',
        estimatedHours: 0,
      });
      setNewTaskTitle('');
      setTaskModalOpen(false);
      toast.success('Task added to project');
      load();
    } catch (err: any) {
      toast.error('Could not add task', err.message);
    }
  };

  const moveTask = async (taskId: string, status: WorkTaskStatus) => {
    await apiClient.patch(`/tasks/${taskId}/move`, { status });
    load();
  };

  if (loading) return <LoadingState rows={5} />;
  if (!detail) return null;

  const { project, totalExpenses, totalInvoiced, tasks, activities } = detail;

  return (
    <div className="space-y-6">
      <Link to="/projects">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </Link>

      <PageHeader
        title={project.name}
        subtitle={`${project.code ? `${project.code} · ` : ''}${project.customerName || 'Internal Workspace Project'}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge status={project.status}>{project.status}</Badge>
            <Badge status={project.priority}>{project.priority}</Badge>
            <Button size="sm" onClick={() => setTaskModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {(['overview', 'tasks', 'team', 'budget', 'files', 'activity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold capitalize transition-colors ${
              tab === t
                ? 'border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-500 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Progress" value={`${project.progressPercent}%`} hint={`${project.completedTasks} / ${project.totalTasks} tasks done`} mono />
            <StatCard label="Budget" value={formatCurrency(project.budget, currency)} mono />
            <StatCard label="Logged Hours" value={`${project.loggedHours}h`} mono />
            <StatCard label="Due Date" value={formatDate(project.dueDateUtc)} />
          </div>
          <Card>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Project Scope & Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
              {project.description || 'No project description provided yet.'}
            </p>
          </Card>
        </div>
      )}

      {tab === 'tasks' && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Project Tasks ({tasks.length})</h3>
            <Button size="sm" onClick={() => setTaskModalOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Task</Button>
          </div>
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No tasks in this project yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {tasks.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>
                    <p className="text-[11px] text-slate-500">Due {formatDate(t.dueDateUtc)} · {t.assignees.map((a) => a.fullName).join(', ') || 'Unassigned'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={t.priority}>{t.priority}</Badge>
                    <select
                      value={t.status}
                      onChange={(e) => moveTask(t.id, e.target.value as WorkTaskStatus)}
                      className="h-7 rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="ToDo">To Do</option>
                      <option value="InProgress">In Progress</option>
                      <option value="InReview">In Review</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'team' && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Assigned Team Members ({project.members.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {project.members.map((m) => (
              <div key={m.userId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.fullName}</p>
                <p className="text-xs text-slate-500">{m.email}</p>
                <Badge className="mt-2">{m.projectRole || 'Contributor'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'budget' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Allocated Budget" value={formatCurrency(project.budget, currency)} mono />
          <StatCard label="Total Invoiced" value={formatCurrency(totalInvoiced, currency)} mono />
          <StatCard label="Project Expenses" value={formatCurrency(totalExpenses, currency)} mono />
        </div>
      )}

      {tab === 'files' && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Linked Documents ({files.length})</h3>
            <Link to="/documents" className="text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">Open Document Center</Link>
          </div>
          {files.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">No files linked to this project.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{f.fileName}</p>
                    <p className="text-[11px] text-slate-500">{f.category} · {formatBytes(f.fileSizeBytes)}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => apiClient.downloadBlob(`/documents/${f.id}/download`, f.fileName)}>
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'activity' && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Project Activity</h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 text-xs">
                <p><span className="font-semibold">{a.actorName}</span> · {a.summary}</p>
                <span className="text-[11px] text-slate-400">{formatRelativeTime(a.createdAtUtc)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Quick Add Project Task">
        <form onSubmit={handleQuickTask} className="space-y-4">
          <Input label="Task Title" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} required autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setTaskModalOpen(false)}>Cancel</Button>
            <Button type="submit">Add Task</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
