import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Receipt,
  Search,
  Settings,
  Sun,
  Target,
  Trash2,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { GlobalSearchResult, NotificationItem } from '@/types/api';
import { formatRelativeTime } from '@/utils/format';
import { Button, Input, Modal } from '@/components/ui/Primitives';

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/customers', label: 'Customers', icon: UserCheck },
  { to: '/leads', label: 'Leads', icon: Target },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/team', label: 'Team', icon: Users },
  { to: '/invoices', label: 'Invoices', icon: FileSpreadsheet },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/time-tracking', label: 'Time Tracking', icon: Clock },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const { user, organizations, activeOrg, switchOrganization, logout, refreshSession } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const loadNotifications = async () => {
    if (!activeOrg) return;
    try {
      const [list, countRes] = await Promise.all([
        apiClient.get<NotificationItem[]>('/notifications'),
        apiClient.get<{ count: number }>('/notifications/unread-count'),
      ]);
      setNotifications(list);
      setUnreadCount(countRes.count);
    } catch {
      // silent background check
    }
  };

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [activeOrg?.organizationId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const term = searchQuery.trim();
    if (term.length < 2) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.get<GlobalSearchResult>('/analytics/search', { q: term });
        setSearchResults(res);
      } catch {
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const breadcrumbs = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((p, idx) => ({
      label: p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      path: '/' + parts.slice(0, idx + 1).join('/'),
    }));
  }, [location.pathname]);

  const handleMarkRead = async (id: string) => {
    await apiClient.post(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAllRead = async () => {
    await apiClient.post('/notifications/read-all');
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleDeleteNotif = async (id: string) => {
    await apiClient.delete(`/notifications/${id}`);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    loadNotifications();
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      const created = await apiClient.post<{ id: string }>('/organizations', { name: newOrgName.trim() });
      await switchOrganization(created.id);
      await refreshSession();
      toast.success('Workspace created', `${newOrgName.trim()} is now active.`);
      setNewOrgName('');
      setCreateOrgOpen(false);
    } catch (err: any) {
      toast.error('Could not create workspace', err.message);
    } finally {
      setCreatingOrg(false);
    }
  };

  const renderSidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      {/* Brand + Workspace Selector */}
      <div className="border-b border-slate-200/80 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between px-1.5 py-1">
          <Link to="/overview" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white dark:bg-blue-600">
              {BRAND.name.slice(0, 1).toUpperCase()}
            </div>
            {(!collapsed || isMobile) && (
              <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white">
                {BRAND.name}
              </span>
            )}
          </Link>
          {!isMobile && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 lg:block"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Workspace Switcher */}
        {(!collapsed || isMobile) && (
          <div className="relative mt-2.5">
            <button
              onClick={() => setOrgMenuOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-left text-xs transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:bg-slate-800"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {activeOrg?.organizationName || 'Select Workspace'}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{activeOrg?.role || 'Member'}</p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </button>

            {orgMenuOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workspaces</p>
                {organizations.map((org) => (
                  <button
                    key={org.organizationId}
                    onClick={async () => {
                      setOrgMenuOpen(false);
                      if (org.organizationId !== activeOrg?.organizationId) {
                        await switchOrganization(org.organizationId);
                        toast.info('Workspace switched', org.organizationName);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="truncate font-medium text-slate-700 dark:text-slate-200">{org.organizationName}</span>
                    {org.organizationId === activeOrg?.organizationId && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </button>
                ))}
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                <button
                  onClick={() => {
                    setOrgMenuOpen(false);
                    setCreateOrgOpen(true);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-[#1E3A5F] hover:bg-slate-100 dark:text-blue-400 dark:hover:bg-slate-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create workspace
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed && !isMobile ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-[#1E3A5F] text-white dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer User */}
      <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {(user?.fullName || 'U').slice(0, 2).toUpperCase()}
          </div>
          {(!collapsed || isMobile) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{user?.fullName}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const groupedSearchCount = searchResults
    ? searchResults.customers.length +
      searchResults.leads.length +
      searchResults.projects.length +
      searchResults.tasks.length +
      searchResults.invoices.length
    : 0;

  return (
    <div className="flex min-h-screen bg-[#F8F9FB] text-slate-900 dark:bg-[#0B1120] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={`no-print hidden shrink-0 border-r border-slate-200/80 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-900 lg:block ${
          collapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderSidebarContent(false)}</div>
      </aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="no-print fixed inset-0 z-50 flex lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-slate-950/50"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 h-full w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-2 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
              {renderSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navbar */}
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
              <span>{activeOrg?.organizationName || BRAND.name}</span>
              {breadcrumbs.map((b, i) => (
                <React.Fragment key={b.path}>
                  <span>/</span>
                  <Link
                    to={b.path}
                    className={
                      i === breadcrumbs.length - 1
                        ? 'font-medium text-slate-900 dark:text-white'
                        : 'hover:text-slate-800 dark:hover:text-slate-200'
                    }
                  >
                    {b.label}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search workspace...</span>
              <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-900 md:inline">
                Ctrl K
              </kbd>
            </button>

            {/* Quick Action */}
            <div className="relative">
              <Button size="sm" onClick={() => setQuickAddOpen((v) => !v)}>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Quick Add</span>
              </Button>
              {quickAddOpen && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  {[
                    { label: 'New Customer', to: '/customers?new=1' },
                    { label: 'New Lead', to: '/leads?new=1' },
                    { label: 'New Project', to: '/projects?new=1' },
                    { label: 'New Task', to: '/tasks?new=1' },
                    { label: 'New Invoice', to: '/invoices?new=1' },
                    { label: 'Record Expense', to: '/expenses?new=1' },
                  ].map((item) => (
                    <button
                      key={item.to}
                      onClick={() => {
                        setQuickAddOpen(false);
                        navigate(item.to);
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle color theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:w-96">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Notifications
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] hover:underline dark:text-blue-400"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-xs text-slate-500">You are all caught up.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-2.5 px-4 py-3 text-xs ${
                            !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => {
                              if (!n.isRead) handleMarkRead(n.id);
                              if (n.actionUrl) {
                                setNotifOpen(false);
                                navigate(n.actionUrl);
                              }
                            }}
                          >
                            <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                            <p className="mt-0.5 text-slate-600 dark:text-slate-400">{n.message}</p>
                            <p className="mt-1 text-[11px] text-slate-400">{formatRelativeTime(n.createdAtUtc)}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteNotif(n.id)}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white dark:bg-blue-600">
                  {(user?.fullName || 'U').slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden max-w-28 truncate md:inline">{user?.fullName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-40 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-2.5 py-2 dark:border-slate-800">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{user?.fullName}</p>
                    <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Profile & Settings
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                      navigate('/login');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Global Search Modal */}
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Global Search"
        subtitle="Search across customers, leads, projects, tasks, and invoices"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <Input
            autoFocus
            placeholder="Type at least 2 characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && <p className="text-xs text-slate-500">Searching workspace records...</p>}
          {!searching && searchQuery.trim().length >= 2 && searchResults && groupedSearchCount === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">No matching records found for "{searchQuery}".</p>
          )}
          {searchResults && groupedSearchCount > 0 && (
            <div className="max-h-80 space-y-4 overflow-y-auto">
              {[
                { title: 'Customers', items: searchResults.customers },
                { title: 'Leads', items: searchResults.leads },
                { title: 'Projects', items: searchResults.projects },
                { title: 'Tasks', items: searchResults.tasks },
                { title: 'Invoices', items: searchResults.invoices },
              ]
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <div key={group.title}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSearchOpen(false);
                            navigate(item.route);
                          }}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          <span className="font-medium text-slate-900 dark:text-white">{item.title}</span>
                          {item.subtitle && <span className="text-slate-500">{item.subtitle}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create Workspace Modal */}
      <Modal
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        title="Create New Organization Workspace"
        subtitle="Each organization has fully isolated customers, projects, invoices, and team members."
      >
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <Input
            label="Organization Name"
            placeholder="e.g., Horizon Digital Agency"
            value={newOrgName}
            onChange={(e) => setNewOrgName(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOrgOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creatingOrg}>
              Create Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
