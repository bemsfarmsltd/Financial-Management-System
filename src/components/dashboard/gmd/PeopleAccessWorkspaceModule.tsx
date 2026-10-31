'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldCheck, UserPlus, UserRound, X, Mail, Clock, Send, Trash2, Building2, Copy, CheckCheck, UserX, Play, Pause, AlertCircle } from 'lucide-react';

type LeaderAccount = {
  id: string;
  legalName: string;
  employeeNumber: string;
  workEmail: string;
  phone: string | null;
  role: string;
  status: string;
  subsidiaryName: string;
  departmentName: string;
  positionName: string;
  isCurrentUser: boolean;
  createdAt: string;
};

type PendingSignup = {
  id: string;
  employeeNumber: string;
  legalName: string;
  workEmail: string;
  phone: string | null;
  role: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  residentialAddress?: string | null;
  cityState?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  nextOfKinName?: string | null;
  nextOfKinPhone?: string | null;
  nextOfKinRelationship?: string | null;
  assignments?: { subsidiaryId: string; departmentId?: string | null; positionName: string }[];
  createdAt: string;
};

type AdminInvitationItem = {
  id: string;
  workEmail: string;
  role: string;
  subsidiaryId: string;
  subsidiary?: { id: string; legalName: string };
  departmentId?: string | null;
  positionName?: string | null;
  token: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
};

type Org = { id: string; legalName: string; code: string; type: string };
type Dept = { id: string; name: string; code: string; organizationId: string };

const EXECUTIVE_INVITE_ROLES = [
  { value: 'SYSTEM_ADMIN', label: 'Super admin' },
  { value: 'GMD', label: 'The Group Managing Director' },
];

const STAFF_APPROVAL_ROLES = [
  { value: 'STAFF', label: 'Staff' },
  { value: 'GMD', label: 'The Group Managing Director' },
  { value: 'SYSTEM_ADMIN', label: 'Super admin' },
];

const getRoleDisplayName = (r: string) => {
  if (r === 'SYSTEM_ADMIN' || r === 'SUPER_ADMIN') return 'Super admin';
  if (r === 'GMD') return 'The Group Managing Director';
  if (r === 'STAFF') return 'Staff';
  return r;
};

export function PeopleAccessWorkspaceModule({
  setNotice,
  onNavigate,
}: {
  setNotice: (message: string) => void;
  onNavigate?: (tab: string) => void;
}) {
  const [employees, setEmployees] = useState<PendingSignup[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitationItem[]>([]);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [activeGmd, setActiveGmd] = useState<{ id: string; legalName: string; workEmail: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [resendingId, setResendingId] = useState('');
  const [leadershipAccounts, setLeadershipAccounts] = useState<LeaderAccount[]>([]);
  const [showCompleted, setShowCompleted] = useState(true);

  // Row approval configuration state
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
  const [approvalOrgs, setApprovalOrgs] = useState<Record<string, string>>({});
  const [approvalDepts, setApprovalDepts] = useState<Record<string, string>>({});

  // Executive Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    workEmail: '',
    role: 'GMD',
    subsidiaryId: '',
    departmentId: '',
    positionName: 'The Group Managing Director',
  });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [approvalRes, inviteRes, orgsRes, leaderRes] = await Promise.all([
        fetch('/api/auth/approvals', { credentials: 'include' }).catch(() => null),
        fetch('/api/staff/invite', { credentials: 'include' }).catch(() => null),
        fetch('/api/organizations', { credentials: 'include' }).catch(() => null),
        fetch('/api/admin/leadership', { credentials: 'include' }).catch(() => null),
      ]);

      let orgList: Org[] = [];
      let deptList: Dept[] = [];

      if (approvalRes && approvalRes.ok) {
        const approvalData = await approvalRes.json();
        setEmployees(approvalData.employees || []);
        if (Array.isArray(approvalData.organizations) && approvalData.organizations.length > 0) {
          orgList = approvalData.organizations;
        }
        if (Array.isArray(approvalData.departments) && approvalData.departments.length > 0) {
          deptList = approvalData.departments;
        }
        if (approvalData.activeGmd) setActiveGmd(approvalData.activeGmd);
      }

      // Resilient fallback: If approval didn't supply organizations, read from /api/organizations
      if (orgList.length === 0 && orgsRes && orgsRes.ok) {
        const orgData = await orgsRes.json();
        const rawOrgs = orgData?.organizations || [];
        orgList = rawOrgs.map((o: any) => ({
          id: o.id,
          legalName: o.name || o.legalName || 'BEMS Subsidiary',
          code: o.code || '',
          type: o.type || 'SUBSIDIARY',
        }));
      }

      setOrganizations(orgList);
      setDepartments(deptList);

      if (inviteRes && inviteRes.ok) {
        const inviteData = await inviteRes.json();
        setInvitations(inviteData.invitations || []);
      }

      if (leaderRes && leaderRes.ok) {
        const leaderData = await leaderRes.json();
        setLeadershipAccounts(leaderData.leaders || []);
      }

      if (orgList.length > 0) {
        setInviteForm((prev) => ({
          ...prev,
          subsidiaryId: prev.subsidiaryId || orgList[0].id,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load administration records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (employeeId: string, decision: 'APPROVE' | 'REJECT') => {
    setBusyId(employeeId);
    setError('');
    try {
      const role = approvalRoles[employeeId] || 'STAFF';
      const subsidiaryId = approvalOrgs[employeeId] || (organizations[0]?.id || null);
      const departmentId = approvalDepts[employeeId] || null;

      const response = await fetch('/api/auth/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employeeId, decision, role, subsidiaryId, departmentId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update this signup.');
      setNotice(data.message || (decision === 'APPROVE' ? 'Account approved.' : 'Signup declined.'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this signup.');
    } finally {
      setBusyId('');
    }
  };

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setInviteBusy(true);
    setInviteError('');
    try {
      const response = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(inviteForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to dispatch executive invitation.');

      setNotice(data.message || `Official invitation dispatched to ${inviteForm.workEmail}.`);
      setShowInviteModal(false);
      setInviteForm({
        workEmail: '',
        role: 'GMD',
        subsidiaryId: organizations[0]?.id || '',
        departmentId: '',
        positionName: 'The Group Managing Director',
      });
      await load();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation.');
    } finally {
      setInviteBusy(false);
    }
  };

  const copyInviteLink = async (token: string, id: string) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : 'https://bemserp.work'}/onboard?token=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setNotice('Onboarding link copied to clipboard!');
      setTimeout(() => setCopiedId(''), 3000);
    } catch {
      setNotice(`Invite Link: ${url}`);
    }
  };

  const revokeInvitation = async (id: string) => {
    try {
      const res = await fetch(`/api/staff/invite?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke invitation.');
      setNotice('Invitation revoked.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not revoke invitation.');
    }
  };

  const resendInvitation = async (id: string) => {
    setResendingId(id);
    try {
      const res = await fetch('/api/staff/invite/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend email.');
      setNotice(data.message || 'Invitation email dispatched successfully.');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not resend email.');
    } finally {
      setResendingId('');
    }
  };

  const handleToggleLeadershipStatus = async (leaderId: string, currentStatus: string, name: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const msg = nextStatus === 'SUSPENDED'
      ? `Are you sure you want to SUSPEND ${name}? Their active sessions will be terminated immediately.`
      : `Reactivate administrative account for ${name}?`;
    if (!window.confirm(msg)) return;
    setBusyId(leaderId);
    try {
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(leaderId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update account status.');
      setNotice(data.message);
      await load();
    } catch (err: any) {
      setError(err.message || 'Status update failed.');
    } finally {
      setBusyId('');
    }
  };

  const handleDeleteLeadershipAccount = async (leaderId: string, name: string, role: string) => {
    if (!window.confirm(`⚠️ PERMANENT ACCOUNT DELETION:\nAre you sure you want to permanently delete the ${role} account for "${name}"?\n\nThis cannot be undone.`)) {
      return;
    }
    setBusyId(leaderId);
    try {
      const res = await fetch(`/api/admin/employees/${encodeURIComponent(leaderId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account.');
      setNotice(data.message);
      await load();
    } catch (err: any) {
      setError(err.message || 'Deletion failed.');
    } finally {
      setBusyId('');
    }
  };

  const filteredDepts = inviteForm.subsidiaryId
    ? departments.filter((d) => d.organizationId === inviteForm.subsidiaryId)
    : departments;

  const pendingInvitations = invitations.filter((inv) => inv.status === 'PENDING');
  const completedInvitations = invitations.filter((inv) => inv.status === 'COMPLETED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ea580c', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            <ShieldCheck size={16} /> SYSTEM ADMINISTRATION &amp; ACCESS
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>People, Leadership &amp; Access Center</h1>
          <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0 0' }}>
            Invite executive and governance leadership roles via secure email links, and review manual staff self-registrations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setInviteError('');
              setInviteForm((prev) => ({
                ...prev,
                subsidiaryId: prev.subsidiaryId || (organizations[0]?.id ?? ''),
              }));
              setShowInviteModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
            }}
          >
            <Mail size={16} color="#ffffff" /> Invite Executive / Admin Role
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* 1. Pending Executive Invitations Section */}
      <section style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: 12, padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #ffedd5', paddingBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={16} color="#ea580c" />
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Active Executive &amp; Governance Invitations ({pendingInvitations.length})
              </h2>
            </div>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0 0' }}>
              Invited leaders who have received a secure 7-day onboarding email link to enter their own information and password.
            </p>
          </div>
        </div>

        {pendingInvitations.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #fde047',
                  background: '#fefce8',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef08a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#854d0e', fontWeight: 800, fontSize: 13 }}>
                    @
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                      {inv.workEmail}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <span style={{ background: '#ea580c', color: '#ffffff', padding: '1px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {getRoleDisplayName(inv.role)}
                      </span>
                      <span>·</span>
                      <span>🏢 {inv.subsidiary?.legalName || 'Subsidiary'}</span>
                      {inv.positionName && <span>({inv.positionName})</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 11.5, color: '#854d0e', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} />
                    <span>Expires {new Date(inv.expiresAt).toLocaleDateString('en-GB')}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void copyInviteLink(inv.token, inv.id)}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    {copiedId === inv.id ? <CheckCheck size={13} color="#16a34a" /> : <Copy size={13} />}
                    {copiedId === inv.id ? 'Copied Link!' : 'Copy Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void resendInvitation(inv.id)}
                    disabled={resendingId === inv.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fed7aa',
                      color: '#c2410c',
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <Send size={12} className={resendingId === inv.id ? 'animate-spin' : ''} />
                    {resendingId === inv.id ? 'Sending...' : 'Resend Email'}
                  </button>

                  <button
                    type="button"
                    onClick={() => void revokeInvitation(inv.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      padding: '5px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Revoke Invite
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: '#64748b' }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              No outstanding executive invitations. Click <strong>&quot;Invite Executive / Admin Role&quot;</strong> above to dispatch a link.
            </div>
          </div>
        )}

        {/* Completed Onboardings & Active Leadership Accounts */}
        {(leadershipAccounts.length > 0 || completedInvitations.length > 0) && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #fed7aa' }}>
            <button
              type="button"
              onClick={() => setShowCompleted((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{showCompleted ? '▼' : '►'}</span>
              <span>Active Leadership Accounts &amp; Completed Onboardings ({leadershipAccounts.length || completedInvitations.length})</span>
            </button>

            {showCompleted && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {leadershipAccounts.length > 0 ? (
                  leadershipAccounts.map((leader) => (
                    <div
                      key={leader.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: leader.status === 'ACTIVE' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                        background: leader.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                        fontSize: 13,
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: leader.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: leader.status === 'ACTIVE' ? '#166534' : '#dc2626',
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {leader.role.slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: leader.status === 'ACTIVE' ? '#0f172a' : '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>{leader.legalName}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#e2e8f0', color: '#334155' }}>
                              {getRoleDisplayName(leader.role)}
                            </span>
                            {leader.isCurrentUser && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#dbeafe', color: '#1d4ed8' }}>
                                Current User
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            {leader.workEmail} · 🏢 {leader.subsidiaryName} ({leader.positionName})
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: leader.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            color: leader.status === 'ACTIVE' ? '#15803d' : '#dc2626',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontWeight: 800,
                            fontSize: 11,
                          }}
                        >
                          {leader.status === 'ACTIVE' ? 'Active & Verified' : 'Suspended'}
                        </span>

                        {leader.isCurrentUser ? (
                          <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '0 4px' }}>
                            Protected Session
                          </span>
                        ) : (
                          <>
                            {leader.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                disabled={busyId === leader.id}
                                onClick={() => handleToggleLeadershipStatus(leader.id, 'ACTIVE', leader.legalName)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: '#fff7ed',
                                  border: '1px solid #fed7aa',
                                  color: '#ea580c',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                <Pause size={12} /> Suspend
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === leader.id}
                                onClick={() => handleToggleLeadershipStatus(leader.id, 'SUSPENDED', leader.legalName)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: '#ecfdf5',
                                  border: '1px solid #86efac',
                                  color: '#16a34a',
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  fontWeight: 700,
                                  fontSize: 11,
                                  cursor: 'pointer',
                                }}
                              >
                                <Play size={12} /> Reactivate
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={busyId === leader.id}
                              onClick={() => handleDeleteLeadershipAccount(leader.id, leader.legalName, leader.role)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '5px 10px',
                                borderRadius: 6,
                                fontWeight: 700,
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  completedInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0',
                        background: '#f0fdf4',
                        fontSize: 12.5,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#166534', fontWeight: 800, fontSize: 12 }}>
                          ✓
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#166534' }}>{inv.workEmail}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {getRoleDisplayName(inv.role)} · 🏢 {inv.subsidiary?.legalName || 'Subsidiary'}
                            {inv.positionName && ` (${inv.positionName})`}
                          </div>
                        </div>
                      </div>
                      <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>
                        Account Active &amp; Verified
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 2. Manual Staff Self-Registrations Queue */}
      <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Staff Self-Registrations Waiting for Verification ({employees.length})
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
              General staff members who registered themselves online. Choose their corporate division before confirming.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <div
                key={employee.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 320, flex: '1 1 320px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c', flexShrink: 0, marginTop: 2 }}>
                    <UserRound size={22} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 15.5 }}>{employee.legalName}</span>
                      <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800, fontFamily: 'monospace', color: '#334155' }}>
                        {employee.employeeNumber}
                      </span>
                    </div>
                    <div style={{ color: '#475569', fontSize: 13 }}>
                      <strong>{employee.jobTitle || 'Staff Member'}</strong> · <span style={{ color: '#0284c7', fontWeight: 600 }}>{employee.employmentType || 'FULL_TIME'}</span> · {employee.workEmail}
                    </div>
                    {employee.bankName && employee.accountNumber && (
                      <div style={{ color: '#166534', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', padding: '2px 8px', borderRadius: 4, width: 'fit-content', border: '1px solid #bbf7d0' }}>
                        🏦 {employee.bankName} · {employee.accountNumber} ({employee.accountName || employee.legalName})
                      </div>
                    )}
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 1 }}>
                      {employee.phone || 'No phone'} · {employee.cityState || 'Location not specified'} · Registered {new Date(employee.createdAt).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                </div>

                {/* Role & Org Selector for Approval */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff', color: '#1e293b' }}
                    value={approvalRoles[employee.id] || 'STAFF'}
                    onChange={(e) => setApprovalRoles((prev) => ({ ...prev, [employee.id]: e.target.value }))}
                  >
                    {STAFF_APPROVAL_ROLES.map((r) => {
                      const isGmdOccupied = r.value === 'GMD' && activeGmd;
                      return (
                        <option key={r.value} value={r.value} disabled={Boolean(isGmdOccupied)}>
                          {isGmdOccupied ? `GMD — Group Managing Director (Occupied by ${activeGmd.legalName})` : r.label}
                        </option>
                      );
                    })}
                  </select>

                  <select
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff', color: '#1e293b' }}
                    value={approvalOrgs[employee.id] || (organizations[0]?.id || '')}
                    onChange={(e) => setApprovalOrgs((prev) => ({ ...prev, [employee.id]: e.target.value }))}
                  >
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.legalName}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    disabled={busyId === employee.id}
                    onClick={() => void decide(employee.id, 'REJECT')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: '#ffffff',
                      color: '#b91c1c',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} /> Decline
                  </button>
                  <button
                    type="button"
                    disabled={busyId === employee.id}
                    onClick={() => void decide(employee.id, 'APPROVE')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Check size={14} /> Approve &amp; Grant Access
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: '#64748b' }}>
              <div style={{ fontSize: 32, marginBottom: 8, color: '#10b981' }}>✓</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>No staff accounts currently pending approval</div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                When staff members register using the self-signup portal, their accounts appear here for review.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Invite Executive / Admin Role Modal */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 14,
              width: '100%',
              maxWidth: 520,
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
              <div>
                <div style={{ color: '#ea580c', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  ADMINISTRATIVE EMAIL INVITATION
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
                  Invite Executive / Admin Role
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, color: '#9a3412', marginBottom: 16, fontSize: 12.5, lineHeight: 1.45 }}>
              Enter the executive&apos;s corporate email address and role. An official email invitation will be dispatched containing a secure 7-day link for them to complete their profile and set their private password.
            </div>

            {inviteError && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 16, fontSize: 13 }}>
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Work Email Address *
                </label>
                <input
                  required
                  type="email"
                  placeholder="e.g. finance.director@bemsgroup.com"
                  value={inviteForm.workEmail}
                  onChange={(e) => setInviteForm({ ...inviteForm, workEmail: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Executive / Admin Role *
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13.5, background: '#fff', boxSizing: 'border-box' }}
                  >
                    {EXECUTIVE_INVITE_ROLES.map((r) => {
                      const isGmdOccupied = r.value === 'GMD' && activeGmd;
                      return (
                        <option key={r.value} value={r.value} disabled={Boolean(isGmdOccupied)}>
                          {isGmdOccupied ? `GMD (Occupied by ${activeGmd.legalName})` : r.label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Subsidiary Entity *
                  </label>
                  <select
                    required
                    value={inviteForm.subsidiaryId}
                    onChange={(e) => setInviteForm({ ...inviteForm, subsidiaryId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13.5, background: '#fff', boxSizing: 'border-box' }}
                  >
                    {organizations.length === 0 ? (
                      <option value="" disabled>Loading subsidiaries...</option>
                    ) : (
                      <>
                        <option value="" disabled>Select Subsidiary Entity</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>{org.legalName}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {filteredDepts.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Department (Optional)
                  </label>
                  <select
                    value={inviteForm.departmentId}
                    onChange={(e) => setInviteForm({ ...inviteForm, departmentId: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13.5, background: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="">Select Department (Optional)</option>
                    {filteredDepts.map((d) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Official Job Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Financial Officer"
                  value={inviteForm.positionName}
                  onChange={(e) => setInviteForm({ ...inviteForm, positionName: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#475569' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteBusy}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: inviteBusy ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Send size={14} />
                  <span>{inviteBusy ? 'Sending Invitation...' : 'Send Invitation Email →'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
