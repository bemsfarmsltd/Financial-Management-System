'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, PlusCircle, RefreshCw, ShieldCheck, UserPlus, UserRound, X } from 'lucide-react';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';

type PendingSignup = {
  id: string;
  employeeNumber: string;
  legalName: string;
  workEmail: string;
  phone: string | null;
  role: string;
  createdAt: string;
};

type Org = { id: string; legalName: string; code: string; type: string };
type Dept = { id: string; name: string; code: string; organizationId: string };

const ADMIN_ROLES = [
  { value: 'GMD', label: 'GMD — Group Managing Director' },
  { value: 'COO', label: 'COO — Chief Operating Officer' },
  { value: 'HEAD_OF_ADMIN', label: 'Head of Administration' },
  { value: 'FINANCE', label: 'Finance & Treasury Officer' },
  { value: 'VERIFIER', label: 'Internal Audit & Verifier' },
  { value: 'HR', label: 'Human Resources Lead' },
  { value: 'STAFF', label: 'General Staff' },
];

export default function StaffApprovalsPage() {
  const [employees, setEmployees] = useState<PendingSignup[]>([]);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Row approval configuration state
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
  const [approvalOrgs, setApprovalOrgs] = useState<Record<string, string>>({});
  const [approvalDepts, setApprovalDepts] = useState<Record<string, string>>({});

  // Direct Onboarding Modal State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    legalName: '',
    workEmail: '',
    phone: '',
    role: 'GMD',
    subsidiaryId: '',
    departmentId: '',
    password: '',
  });
  const [onboardBusy, setOnboardBusy] = useState(false);
  const [onboardError, setOnboardError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/approvals', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load pending signups.');
      setEmployees(data.employees || []);
      setOrganizations(data.organizations || []);
      setDepartments(data.departments || []);
      if (data.organizations?.length && !onboardForm.subsidiaryId) {
        setOnboardForm((prev) => ({ ...prev, subsidiaryId: data.organizations[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pending signups.');
    } finally {
      setLoading(false);
    }
  }, [onboardForm.subsidiaryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (employeeId: string, decision: 'APPROVE' | 'REJECT') => {
    setBusyId(employeeId);
    setError('');
    setNotice('');
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

  const handleOnboardSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setOnboardBusy(true);
    setOnboardError('');
    try {
      const response = await fetch('/api/staff/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(onboardForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to onboard role.');

      setNotice(data.message || 'Role successfully onboarded.');
      setShowOnboardModal(false);
      setOnboardForm({
        legalName: '',
        workEmail: '',
        phone: '',
        role: 'GMD',
        subsidiaryId: organizations[0]?.id || '',
        departmentId: '',
        password: '',
      });
      await load();
    } catch (err: any) {
      setOnboardError(err.message || 'Failed to onboard account.');
    } finally {
      setOnboardBusy(false);
    }
  };

  const filteredDepts = onboardForm.subsidiaryId
    ? departments.filter((d) => d.organizationId === onboardForm.subsidiaryId)
    : departments;

  return (
    <ConnectAppShell>
      <main className="staff-approval-page" style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
        <div
          className="staff-approval-heading"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              <ShieldCheck size={16} /> SYSTEM ADMINISTRATION & ACCESS
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 }}>People, Leadership & Access Center</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: '6px 0 0 0' }}>
              Onboard corporate leadership roles directly, or review and approve manual staff registrations.
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
                padding: '9px 14px',
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
              onClick={() => setShowOnboardModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#f8fafc',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
              }}
            >
              <UserPlus size={16} color="#f59e0b" /> Onboard Admin / Leadership Role
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        {notice && (
          <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, color: '#065f46', marginBottom: 20, fontSize: 14 }}>
            {notice}
          </div>
        )}

        {/* Pending Staff Signups Section */}
        <section style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                Manual Staff Registrations Waiting for Approval ({employees.length})
              </h2>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
                Staff members who registered online. Choose their role and corporate division before confirming.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0' }}>Loading registration queue…</p>
            ) : employees.length ? (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 260 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 21, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                      <UserRound size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{employee.legalName}</div>
                      <div style={{ color: '#475569', fontSize: 13 }}>{employee.workEmail}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                        {employee.phone || 'No phone'} · Registered {new Date(employee.createdAt).toLocaleDateString('en-GB')}
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
                      {ADMIN_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
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
                      <Check size={14} /> Approve & Grant Access
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: '#64748b' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>No staff accounts currently pending approval</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                  When staff members register using the self-signup portal, their accounts appear here for review.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Onboard Leadership / Admin Modal */}
        {showOnboardModal && (
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
                maxWidth: 560,
                padding: '28px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
                <div>
                  <div style={{ color: '#d97706', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    ADMINISTRATOR PROVISIONING
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '4px 0 0 0' }}>
                    Onboard Executive / Admin Role
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={20} />
                </button>
              </div>

              {onboardError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 16, fontSize: 13 }}>
                  {onboardError}
                </div>
              )}

              <form onSubmit={handleOnboardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Full Legal Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Henry Nwosu"
                    value={onboardForm.legalName}
                    onChange={(e) => setOnboardForm({ ...onboardForm, legalName: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Work Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="henry@bemsgroup.com"
                      value={onboardForm.workEmail}
                      onChange={(e) => setOnboardForm({ ...onboardForm, workEmail: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+234 803 000 0000"
                      value={onboardForm.phone}
                      onChange={(e) => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Corporate Role *
                    </label>
                    <select
                      value={onboardForm.role}
                      onChange={(e) => setOnboardForm({ ...onboardForm, role: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                    >
                      {ADMIN_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Subsidiary / Division
                    </label>
                    <select
                      value={onboardForm.subsidiaryId}
                      onChange={(e) => setOnboardForm({ ...onboardForm, subsidiaryId: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>{org.legalName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {filteredDepts.length > 0 && (
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Department
                    </label>
                    <select
                      value={onboardForm.departmentId}
                      onChange={(e) => setOnboardForm({ ...onboardForm, departmentId: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, background: '#fff' }}
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
                    Initial Password *
                  </label>
                  <input
                    required
                    type="password"
                    minLength={10}
                    placeholder="At least 10 characters"
                    value={onboardForm.password}
                    onChange={(e) => setOnboardForm({ ...onboardForm, password: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
                  />
                  <small style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: 'block' }}>
                    Share this initial password with the user. They can sign in immediately on the live portal.
                  </small>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 14, cursor: 'pointer', color: '#475569' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={onboardBusy}
                    style={{
                      padding: '9px 20px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {onboardBusy ? 'Provisioning…' : 'Complete Onboarding →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </ConnectAppShell>
  );
}
