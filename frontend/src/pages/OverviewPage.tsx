import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  DollarSign,
  FolderKanban,
  Plus,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { DashboardOverview } from '@/types/api';
import { formatCurrency, formatDate, formatRelativeTime } from '@/utils/format';
import { Badge, Button, Card, EmptyState, Input, LoadingState, PageHeader, StatCard } from '@/components/ui/Primitives';

const CHART_COLORS = ['#1E3A5F', '#0F9D58', '#D97706', '#3B6EA5', '#64748B'];

export function OverviewPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [period, setPeriod] = useState<'month' | 'quarter' | 'year' | 'custom'>('year');
  const [fromUtc, setFromUtc] = useState('');
  const [toUtc, setToUtc] = useState('');
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<DashboardOverview>('/analytics/dashboard', {
        period,
        fromUtc: period === 'custom' && fromUtc ? new Date(fromUtc).toISOString() : undefined,
        toUtc: period === 'custom' && toUtc ? new Date(toUtc).toISOString() : undefined,
      });
      setData(res);
    } catch (err: any) {
      toast.error('Failed to load overview', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom' || (fromUtc && toUtc)) {
      load();
    }
  }, [period, fromUtc, toUtc, activeOrg?.organizationId]);

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Workspace Overview" subtitle="Real-time operational & financial pulse" />
        <LoadingState rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Overview"
        subtitle={`Live operational performance for ${activeOrg?.organizationName || 'your organization'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              {(['month', 'quarter', 'year', 'custom'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-2.5 py-1.5 font-medium capitalize transition-colors ${
                    period === p
                      ? 'bg-[#1E3A5F] text-white dark:bg-blue-600'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <Input type="date" value={fromUtc} onChange={(e) => setFromUtc(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={toUtc} onChange={(e) => setToUtc(e.target.value)} className="h-8 text-xs" />
              </div>
            )}
          </div>
        }
      />

      {data?.isEmptyWorkspace && (
        <EmptyState
          title="Your workspace is clean and ready"
          description="Start by adding your first customer, launching a project, or issuing an invoice. Every metric below updates automatically from your database."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/customers?new=1">
                <Button size="sm">
                  <Plus className="h-3.5 w-3.5" /> Add First Customer
                </Button>
              </Link>
              <Link to="/projects?new=1">
                <Button size="sm" variant="secondary">Create Project</Button>
              </Link>
              <Link to="/invoices?new=1">
                <Button size="sm" variant="secondary">Create Invoice</Button>
              </Link>
            </div>
          }
        />
      )}

      {data && data.alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.alerts.map((alert, idx) => (
            <Link
              key={idx}
              to={alert.route}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs transition-colors ${
                alert.severity === 'critical'
                  ? 'border-red-200 bg-red-50/70 text-red-900 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="opacity-80">{alert.description}</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* KPI Grid */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={formatCurrency(data.totalRevenue, currency)}
              hint="Payments collected in period"
              mono
              icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            />
            <StatCard
              label="Outstanding Invoices"
              value={formatCurrency(data.outstandingInvoices, currency)}
              hint="Awaiting client settlement"
              mono
              icon={<DollarSign className="h-4 w-4 text-amber-600" />}
            />
            <StatCard
              label="Total Expenses"
              value={formatCurrency(data.totalExpenses, currency)}
              hint="Operational spend in period"
              mono
              icon={<TrendingDown className="h-4 w-4 text-red-600" />}
            />
            <StatCard
              label="Net Profit"
              value={formatCurrency(data.netProfit, currency)}
              hint="Collected revenue minus expenses"
              mono
              icon={<Wallet className="h-4 w-4 text-[#1E3A5F] dark:text-blue-400" />}
            />
          </div>

          {/* Secondary Operational Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Active Projects"
              value={data.activeProjects}
              hint="Currently in delivery"
              icon={<FolderKanban className="h-4 w-4" />}
            />
            <StatCard
              label="Pending Tasks"
              value={data.pendingTasks}
              hint={`${data.completedTasks} tasks completed`}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Total Customers"
              value={data.totalCustomers}
              hint="Active & inactive accounts"
              icon={<UserCheck className="h-4 w-4" />}
            />
            <StatCard
              label="Open New Leads"
              value={data.newLeads}
              hint="New & contacted pipeline"
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Revenue vs Expenses</h2>
                  <p className="text-xs text-slate-500">Monthly cash flow trend</p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueExpenseSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1E3A5F" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#1E3A5F" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D97706" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.45} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" />
                    <Tooltip formatter={(val: number) => formatCurrency(val, currency)} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#1E3A5F" strokeWidth={2} fill="url(#revGrad)" />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#D97706" strokeWidth={2} fill="url(#expGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Project Status</h2>
              <p className="mb-4 text-xs text-slate-500">Distribution across workspace</p>
              {data.projectStatusSeries.length === 0 ? (
                <p className="py-16 text-center text-xs text-slate-400">No projects recorded yet.</p>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.projectStatusSeries}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={52}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {data.projectStatusSeries.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {data.projectStatusSeries.map((s, idx) => (
                  <span key={s.status} className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                    {s.status} ({s.count})
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* Operational Grid */}
          <div className="grid gap-5 lg:grid-cols-3">
            {/* My Tasks */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Tasks Assigned to Me</h2>
                <Link to="/tasks" className="text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {data.myTasks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No pending tasks assigned to you.</p>
                ) : (
                  data.myTasks.map((t) => (
                    <div key={t.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-900 dark:text-white">{t.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {t.projectName || 'General'} · Due {formatDate(t.dueDateUtc)}
                        </p>
                      </div>
                      <Badge status={t.priority}>{t.priority}</Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Recent Invoices */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Invoices</h2>
                <Link to="/invoices" className="text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                  Manage
                </Link>
              </div>
              <div className="space-y-2">
                {data.recentInvoices.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No invoices created yet.</p>
                ) : (
                  data.recentInvoices.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/invoices/${inv.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                    >
                      <div className="min-w-0">
                        <p className="font-mono-num text-xs font-semibold text-slate-900 dark:text-white">{inv.invoiceNumber}</p>
                        <p className="truncate text-[11px] text-slate-500">{inv.customerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono-num text-xs font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(inv.totalAmount, currency)}
                        </p>
                        <Badge status={inv.status}>{inv.status}</Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            {/* Team Workload */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Team Workload</h2>
                <Link to="/team" className="text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                  Team
                </Link>
              </div>
              {data.teamWorkload.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">No team members yet.</p>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.teamWorkload} layout="vertical" margin={{ left: 10, right: 12 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={95} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="pendingTasks" name="Pending Tasks" fill="#1E3A5F" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="completedTasks" name="Completed" fill="#0F9D58" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Deadlines & Activity */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Upcoming Deadlines</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.upcomingDeadlines.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No upcoming deadlines scheduled.</p>
                ) : (
                  data.upcomingDeadlines.map((d) => (
                    <div key={`${d.kind}-${d.id}`} className="flex items-center justify-between py-2.5 text-xs">
                      <div className="min-w-0 pr-3">
                        <p className="truncate font-medium text-slate-900 dark:text-white">{d.title}</p>
                        <p className="text-[11px] text-slate-500">{d.kind}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num text-slate-600 dark:text-slate-300">{formatDate(d.dueDateUtc)}</span>
                        <Badge status={d.status}>{d.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Recent Business Activity</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.recentActivities.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No recorded activities yet.</p>
                ) : (
                  data.recentActivities.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="text-slate-800 dark:text-slate-200">
                          <span className="font-semibold">{a.actorName}</span> · {a.summary}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(a.createdAtUtc)}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
