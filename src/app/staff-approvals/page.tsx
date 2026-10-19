'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, UserRound, X } from 'lucide-react';
import { ConnectAppShell } from '@/components/layout/ConnectAppShell';

type PendingSignup = { id: string; employeeNumber: string; legalName: string; workEmail: string; phone: string | null; createdAt: string };

export default function StaffApprovalsPage() {
  const [employees, setEmployees] = useState<PendingSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/approvals', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load pending signups.');
      setEmployees(data.employees || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pending signups.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (employeeId: string, decision: 'APPROVE' | 'REJECT') => {
    setBusyId(employeeId); setError(''); setNotice('');
    try {
      const response = await fetch('/api/auth/approvals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ employeeId, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update this signup.');
      setNotice(data.message || (decision === 'APPROVE' ? 'Account approved.' : 'Signup declined.'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this signup.');
    } finally { setBusyId(''); }
  };

  return <ConnectAppShell><main className="staff-approval-page">
    <div className="staff-approval-heading"><div><p className="kicker">PEOPLE & ACCESS</p><h1>Staff signup approvals</h1><p>Review staff accounts before they can sign in to the system.</p></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
    {error && <div className="staff-approval-alert error" role="alert">{error}</div>}
    {notice && <div className="staff-approval-alert" role="status">{notice}</div>}
    <section className="staff-approval-list" aria-live="polite">
      {loading ? <p className="staff-approval-empty">Loading pending signups…</p> : employees.length ? employees.map((employee) => <article key={employee.id} className="staff-approval-row">
        <span className="staff-approval-avatar"><UserRound size={17}/></span><div className="staff-approval-person"><strong>{employee.legalName}</strong><span>{employee.workEmail}</span><small>{employee.phone || 'No phone provided'} · Requested {new Date(employee.createdAt).toLocaleDateString('en-GB')}</small></div>
        <div className="staff-approval-actions"><button type="button" disabled={busyId === employee.id} onClick={() => void decide(employee.id, 'REJECT')}><X size={14}/> Decline</button><button type="button" disabled={busyId === employee.id} onClick={() => void decide(employee.id, 'APPROVE')}><Check size={14}/> Approve</button></div>
      </article>) : <p className="staff-approval-empty">No staff accounts are waiting for approval.</p>}
    </section>
  </main></ConnectAppShell>;
}
