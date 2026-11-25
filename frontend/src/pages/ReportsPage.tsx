import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient, toQueryString } from '@/services/api';
import type { ReportsOverview } from '@/types/api';
import { formatCurrency } from '@/utils/format';
import { Button, Card, Input, LoadingState, PageHeader, StatCard } from '@/components/ui/Primitives';

export function ReportsPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';

  const [fromDate, setFromDate] = useState(`${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<ReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ReportsOverview>('/analytics/reports', {
        fromUtc: new Date(fromDate).toISOString(),
        toUtc: new Date(`${toDate}T23:59:59Z`).toISOString(),
      });
      setReport(res);
    } catch (err: any) {
      toast.error('Failed to load reports', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [fromDate, toDate, activeOrg?.organizationId]);

  const exportCsv = (reportType: string) => {
    const qs = toQueryString({
      reportType,
      fromUtc: new Date(fromDate).toISOString(),
      toUtc: new Date(`${toDate}T23:59:59Z`).toISOString(),
    });
    apiClient.downloadBlob(`/analytics/reports/export${qs}`, `flownest-${reportType}-${toDate}.csv`);
  };

  if (loading && !report) return <LoadingState rows={5} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Real-time financial, customer, project, invoice, and team performance reporting."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
            <Button size="sm" variant="secondary" onClick={() => exportCsv('financial')}>
              <Download className="h-3.5 w-3.5" /> CSV Financial
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportCsv('customers')}>
              <Download className="h-3.5 w-3.5" /> CSV Customers
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        }
      />

      {report && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Revenue" value={formatCurrency(report.totalRevenue, currency)} mono />
            <StatCard label="Expenses" value={formatCurrency(report.totalExpenses, currency)} mono />
            <StatCard label="Net Profit" value={formatCurrency(report.netProfit, currency)} mono />
            <StatCard label="Collection Rate" value={`${report.collectionRatePercent}%`} hint={`${report.billableHours}h billable logged`} mono />
          </div>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Monthly Financial Comparison</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.monthlyFinancials}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.45} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => formatCurrency(val, currency)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#D97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Net Profit" fill="#0F9D58" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Top Customers by Billing</h3>
                <button onClick={() => exportCsv('customers')} className="no-print text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <tr>
                      <th className="py-2 font-medium">Customer</th>
                      <th className="py-2 text-right font-medium">Projects</th>
                      <th className="py-2 text-right font-medium">Billed</th>
                      <th className="py-2 text-right font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.topCustomers.map((c) => (
                      <tr key={c.customerId}>
                        <td className="py-2.5 font-medium text-slate-900 dark:text-white">{c.name}</td>
                        <td className="py-2.5 text-right font-mono-num">{c.projectCount}</td>
                        <td className="py-2.5 text-right font-mono-num">{formatCurrency(c.totalBilled, currency)}</td>
                        <td className="py-2.5 text-right font-mono-num text-emerald-600">{formatCurrency(c.totalPaid, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Team Performance</h3>
                <button onClick={() => exportCsv('team')} className="no-print text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400">
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                    <tr>
                      <th className="py-2 font-medium">Member</th>
                      <th className="py-2 text-right font-medium">Active Projects</th>
                      <th className="py-2 text-right font-medium">Pending Tasks</th>
                      <th className="py-2 text-right font-medium">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.teamPerformance.map((m) => (
                      <tr key={m.userId}>
                        <td className="py-2.5 font-medium text-slate-900 dark:text-white">{m.name}</td>
                        <td className="py-2.5 text-right font-mono-num">{m.activeProjects}</td>
                        <td className="py-2.5 text-right font-mono-num">{m.pendingTasks}</td>
                        <td className="py-2.5 text-right font-mono-num text-emerald-600">{m.completedTasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
