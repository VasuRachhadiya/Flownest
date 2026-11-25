import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { OrganizationDetails, UserSummary } from '@/types/api';
import { Badge, Button, Card, Input, PageHeader, Select } from '@/components/ui/Primitives';

export function SettingsPage() {
  const { user, activeOrg, refreshSession, updateUserLocal } = useAuth();
  const { mode, setMode } = useTheme();
  const toast = useToast();

  const [tab, setTab] = useState<'organization' | 'personal' | 'appearance' | 'permissions'>('organization');
  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);

  const [orgForm, setOrgForm] = useState({
    name: '',
    logoUrl: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    address: '',
    timeZone: 'UTC',
    currencyCode: 'USD',
    brandAccentColor: '#1E3A5F',
  });

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phoneNumber: user?.phoneNumber || '',
    avatarUrl: user?.avatarUrl || '',
  });

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    if (!activeOrg) return;
    apiClient.get<OrganizationDetails>('/organizations/current').then((res) => {
      setOrg(res);
      setOrgForm({
        name: res.name,
        logoUrl: res.logoUrl || '',
        contactEmail: res.contactEmail || '',
        contactPhone: res.contactPhone || '',
        website: res.website || '',
        address: res.address || '',
        timeZone: res.timeZone,
        currencyCode: res.currencyCode,
        brandAccentColor: res.brandAccentColor,
      });
    });
  }, [activeOrg?.organizationId]);

  const canEditOrg = activeOrg?.role === 'Owner' || activeOrg?.role === 'Admin';

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    try {
      await apiClient.put('/organizations/current', orgForm);
      await refreshSession();
      toast.success('Organization settings saved');
    } catch (err: any) {
      toast.error('Failed to update organization', err.message);
    } finally {
      setSavingOrg(false);
    }
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await apiClient.put<UserSummary>('/auth/profile', profileForm);
      updateUserLocal(updated);
      toast.success('Personal profile updated');
    } catch (err: any) {
      toast.error('Profile update failed', err.message);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/auth/change-password', pwForm);
      setPwForm({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    } catch (err: any) {
      toast.error('Password change failed', err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure your organization workspace, personal profile, appearance, and access policies." />

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {(['organization', 'personal', 'appearance', 'permissions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold capitalize ${
              tab === t
                ? 'border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-500 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'organization' && (
        <Card className="max-w-2xl">
          <form onSubmit={saveOrg} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Organization Profile</h2>
              {org && <Badge>{org.currentUserRole}</Badge>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Organization Name *" value={orgForm.name} onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })} disabled={!canEditOrg} required />
              <Input label="Contact Email" type="email" value={orgForm.contactEmail} onChange={(e) => setOrgForm({ ...orgForm, contactEmail: e.target.value })} disabled={!canEditOrg} />
              <Input label="Contact Phone" value={orgForm.contactPhone} onChange={(e) => setOrgForm({ ...orgForm, contactPhone: e.target.value })} disabled={!canEditOrg} />
              <Input label="Website" value={orgForm.website} onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })} disabled={!canEditOrg} />
              <Select label="Currency" value={orgForm.currencyCode} onChange={(e) => setOrgForm({ ...orgForm, currencyCode: e.target.value })} disabled={!canEditOrg}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
              </Select>
              <Input label="Time Zone" value={orgForm.timeZone} onChange={(e) => setOrgForm({ ...orgForm, timeZone: e.target.value })} disabled={!canEditOrg} />
            </div>
            <Input label="Address" value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} disabled={!canEditOrg} />
            <Input label="Logo URL (optional)" value={orgForm.logoUrl} onChange={(e) => setOrgForm({ ...orgForm, logoUrl: e.target.value })} disabled={!canEditOrg} />
            {canEditOrg ? (
              <Button type="submit" loading={savingOrg}>Save Organization Settings</Button>
            ) : (
              <p className="text-xs text-slate-500">Only Owners and Admins can modify organization settings.</p>
            )}
          </form>
        </Card>
      )}

      {tab === 'personal' && (
        <div className="grid max-w-4xl gap-5 md:grid-cols-2">
          <Card>
            <h2 className="mb-4 text-sm font-semibold">Personal Profile</h2>
            <form onSubmit={saveProfile} className="space-y-4">
              <Input label="Full Name *" value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} required />
              <Input label="Phone Number" value={profileForm.phoneNumber} onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })} />
              <Input label="Avatar URL" value={profileForm.avatarUrl} onChange={(e) => setProfileForm({ ...profileForm, avatarUrl: e.target.value })} />
              <Button type="submit">Update Profile</Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold">Security & Password</h2>
            <form onSubmit={changePassword} className="space-y-4">
              <Input label="Current Password" type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
              <Input label="New Password" type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} required />
              <Button type="submit">Change Password</Button>
            </form>
          </Card>
        </div>
      )}

      {tab === 'appearance' && (
        <Card className="max-w-xl space-y-4">
          <h2 className="text-sm font-semibold">Color Mode & Theme</h2>
          <p className="text-xs text-slate-500">Choose how the workspace appears on this device.</p>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setMode(opt)}
                className={`rounded-xl border p-4 text-left text-xs font-semibold capitalize transition-colors ${
                  mode === opt
                    ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F] dark:border-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
                }`}
              >
                {opt} Mode
              </button>
            ))}
          </div>
        </Card>
      )}

      {tab === 'permissions' && (
        <Card className="max-w-3xl">
          <h2 className="mb-3 text-sm font-semibold">Workspace Role Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2 font-medium">Capability</th>
                  <th className="py-2 text-center font-medium">Owner</th>
                  <th className="py-2 text-center font-medium">Admin</th>
                  <th className="py-2 text-center font-medium">Manager</th>
                  <th className="py-2 text-center font-medium">Member</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  ['Manage CRM, Projects, Tasks, Time & Docs', 'Yes', 'Yes', 'Yes', 'Yes'],
                  ['Create/Edit Invoices & Record Payments', 'Yes', 'Yes', 'Yes', '—'],
                  ['Delete Customers, Leads, Projects, Expenses', 'Yes', 'Yes', 'Yes', '—'],
                  ['Invite & Manage Team Members & Org Settings', 'Yes', 'Yes', '—', '—'],
                  ['Assign or Modify Owner Role', 'Yes', '—', '—', '—'],
                ].map(([cap, o, a, m, mb]) => (
                  <tr key={cap}>
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{cap}</td>
                    <td className="py-2.5 text-center">{o}</td>
                    <td className="py-2.5 text-center">{a}</td>
                    <td className="py-2.5 text-center">{m}</td>
                    <td className="py-2.5 text-center">{mb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
