import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/ui/Primitives';

const PILLARS = [
  {
    icon: Users,
    title: 'CRM & Lead Pipeline',
    description: 'Track prospects from initial outreach through proposal, negotiation, and seamless conversion into active clients.',
  },
  {
    icon: FolderKanban,
    title: 'Projects & Tasks',
    description: 'Coordinate delivery across list, grid, board, and timeline views with multi-assignee tasks and comments.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Invoicing & Payments',
    description: 'Generate server-verified invoices, apply partial or full payments, and monitor overdue balances in real time.',
  },
  {
    icon: Clock,
    title: 'Time & Expense Control',
    description: 'Prevent overlapping timers, separate billable vs non-billable hours, and categorize operational expenses.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Inspect profit margins, team workload, and customer revenue backed directly by SQL Server records.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-Tenant Isolation',
    description: 'Role-based permissions across Owner, Admin, Manager, and Member roles with strict workspace boundaries.',
  },
];

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white dark:bg-blue-600">
              {BRAND.name.slice(0, 1).toUpperCase()}
            </div>
            <span className="font-display text-lg font-bold tracking-tight">{BRAND.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
            </button>
            {isAuthenticated ? (
              <Link to="/overview">
                <Button>Open Workspace</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                  Sign in
                </Link>
                <Link to="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            All-in-One Business Operations Platform
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Run clients, projects, billing, and team operations from one calm workspace.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:text-lg">
            {BRAND.name} replaces fragmented spreadsheets, disconnected project trackers, and manual invoicing with an
            organized, multi-tenant operations hub built for agencies, startups, and modern service teams.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={isAuthenticated ? '/overview' : '/register'}>
              <Button size="lg">
                {isAuthenticated ? 'Go to Dashboard' : 'Create Workspace'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="secondary">
                Sign in with Demo Account
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <div className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-slate-200/90 bg-white p-6 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] dark:bg-blue-500/15 dark:text-blue-400">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
