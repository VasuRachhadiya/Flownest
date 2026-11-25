import React, { useEffect, useState } from 'react';
import { Copy, Edit2, MailPlus, Shield, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiClient } from '@/services/api';
import type { Invitation, MemberAvailability, OrganizationRole, TeamMember } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  Badge,
  Button,
  Card,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui/Primitives';

export function TeamPage() {
  const { activeOrg } = useAuth();
  const toast = useToast();
  const currency = activeOrg?.currencyCode || 'USD';
  const canManage = activeOrg?.role === 'Owner' || activeOrg?.role === 'Admin';
  const canViewInvites = canManage || activeOrg?.role === 'Manager';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('Member');
  const [inviteNotice, setInviteNotice] = useState<{ token: string; instruction: string } | null>(null);

  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({
    role: 'Member' as OrganizationRole,
    jobTitle: '',
    availability: 'Available' as MemberAvailability,
    hourlyRate: '',
    isActive: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const m = await apiClient.get<TeamMember[]>('/team/members');
      setMembers(m);
      if (canViewInvites) {
        const inv = await apiClient.get<Invitation[]>('/team/invitations');
        setInvitations(inv);
      }
    } catch (err: any) {
      toast.error('Failed to load team', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeOrg?.organizationId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.post<{ invitation: Invitation; joinInstruction: string }>('/team/invitations', {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteNotice({ token: res.invitation.token, instruction: res.joinInstruction });
      setInviteEmail('');
      toast.success('Invitation created');
      load();
    } catch (err: any) {
      toast.error('Invitation failed', err.message);
    }
  };

  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setEditForm({
      role: m.role,
      jobTitle: m.jobTitle || '',
      availability: m.availability,
      hourlyRate: m.hourlyRate != null ? String(m.hourlyRate) : '',
      isActive: m.isActive,
    });
  };

  const saveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await apiClient.put(`/team/members/${editing.memberId}`, {
        role: editForm.role,
        jobTitle: editForm.jobTitle || null,
        availability: editForm.availability,
        hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : null,
        isActive: editForm.isActive,
      });
      toast.success('Team member updated');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error('Update failed', err.message);
    }
  };

  const revokeInvite = async (id: string) => {
    await apiClient.delete(`/team/invitations/${id}`);
    toast.success('Invitation revoked');
    load();
  };

  const removeMember = async (m: TeamMember) => {
    if (!window.confirm(`Remove ${m.fullName} from this organization?`)) return;
    try {
      await apiClient.delete(`/team/members/${m.memberId}`);
      toast.success('Member removed');
      load();
    } catch (err: any) {
      toast.error('Remove failed', err.message);
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/register?invite=${token}`);
    toast.success('Invite link copied to clipboard');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team & Workload"
        subtitle="Manage workspace members, roles, availability, and pending invitations."
        actions={
          canManage && (
            <Button onClick={() => { setInviteNotice(null); setInviteOpen(true); }}>
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          )
        }
      />

      {loading ? (
        <LoadingState rows={4} />
      ) : (
        <>
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/60">
                  <tr>
                    <th className="px-4 py-3 font-medium">Member</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Availability</th>
                    <th className="px-4 py-3 font-medium">Workload</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Rate</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((m) => (
                    <tr key={m.memberId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{m.fullName}</p>
                        <p className="text-xs text-slate-500">{m.jobTitle ? `${m.jobTitle} · ` : ''}{m.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={m.role === 'Owner' ? 'info' : 'neutral'}>
                          <Shield className="mr-1 h-3 w-3" /> {m.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={m.availability}>{m.availability}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {m.activeProjectsCount} projects · {m.pendingTasksCount} pending · {m.completedTasksCount} done
                      </td>
                      <td className="hidden px-4 py-3 font-mono-num text-xs md:table-cell">
                        {m.hourlyRate != null ? `${formatCurrency(m.hourlyRate, currency)}/hr` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <div className="inline-flex gap-1">
                            <button onClick={() => openEdit(m)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => removeMember(m)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {canViewInvites && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Workspace Invitations</h2>
                  <p className="text-xs text-slate-500">Invitations use secure workspace tokens stored in SQL Server (see docs for optional SMTP integration).</p>
                </div>
              </div>
              {invitations.length === 0 ? (
                <p className="py-4 text-xs text-slate-400">No invitations issued yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{inv.email}</p>
                        <p className="text-[11px] text-slate-500">Role: {inv.role} · Expires {formatDate(inv.expiresAtUtc)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge status={inv.status}>{inv.status}</Badge>
                        {inv.status === 'Pending' && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => copyToken(inv.token)}>
                              <Copy className="h-3 w-3" /> Copy Link
                            </Button>
                            {canManage && (
                              <Button size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)}>
                                Revoke
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Team Member">
        <form onSubmit={handleInvite} className="space-y-4">
          <Input label="Teammate Email *" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          <Select label="Role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Member">Member</option>
          </Select>
          {inviteNotice && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
              <p className="font-medium">{inviteNotice.instruction}</p>
              <div className="mt-2 flex items-center justify-between rounded bg-white px-2.5 py-1.5 font-mono-num text-[11px] dark:bg-slate-900">
                <span className="truncate">{inviteNotice.token}</span>
                <button type="button" onClick={() => copyToken(inviteNotice.token)} className="ml-2 font-sans font-semibold text-[#1E3A5F] dark:text-blue-400">
                  Copy Link
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>Close</Button>
            <Button type="submit"><MailPlus className="h-3.5 w-3.5" /> Generate Invite</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.fullName}`}>
        <form onSubmit={saveMember} className="space-y-4">
          <Select label="Organization Role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as OrganizationRole })}>
            <option value="Owner">Owner</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Member">Member</option>
          </Select>
          <Input label="Job Title" value={editForm.jobTitle} onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} />
          <Select label="Availability" value={editForm.availability} onChange={(e) => setEditForm({ ...editForm, availability: e.target.value as MemberAvailability })}>
            <option value="Available">Available</option>
            <option value="Busy">Busy</option>
            <option value="Away">Away</option>
            <option value="Offline">Offline</option>
          </Select>
          <Input label="Hourly Rate" type="number" step="0.01" min="0" value={editForm.hourlyRate} onChange={(e) => setEditForm({ ...editForm, hourlyRate: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
