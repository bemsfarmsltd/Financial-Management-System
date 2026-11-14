'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, Lock, Plus, Scale, CheckCircle2, X } from 'lucide-react';

interface HrRelationsPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor?: string;
}

const DISCIPLINARY_STEPS = [
  'INCIDENT',
  'HR_REVIEW',
  'QUERY_ISSUED',
  'EMPLOYEE_RESPONSE',
  'DECISION',
  'APPEAL',
  'CLOSED',
];

const OUTCOMES = [
  'EXONERATED',
  'VERBAL_WARNING',
  'WRITTEN_WARNING',
  'FINAL_WARNING',
  'SUSPENSION',
  'TERMINATION',
];

export default function HrRelationsPanel({
  selectedSubsidiaryId,
  activeBrandColor = '#ea580c',
}: HrRelationsPanelProps) {
  const [tab, setTab] = useState<'DISCIPLINE' | 'GRIEVANCE'>('DISCIPLINE');
  const [disciplinaryCases, setDisciplinaryCases] = useState<any[]>([]);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [discForm, setDiscForm] = useState({ employeeId: '', severity: 'MINOR', allegation: '', queryText: '' });
  const [grvForm, setGrvForm] = useState({ reporterId: '', againstEmployeeId: '', category: 'MANAGEMENT_CONDUCT', summary: '' });
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/relations${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setDisciplinaryCases(data.disciplinaryCases || []);
        setGrievances(data.grievances || []);
        setStaffOptions(data.staffOptions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submit = async (payload: Record<string, unknown>) => {
    setBanner(null);
    const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
    const res = await fetch(`/api/hr/relations${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Action failed.' });
    } else {
      setBanner({ type: 'ok', text: 'Employee relations record updated.' });
      setShowModal(false);
      await loadData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {banner && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, background: banner.type === 'ok' ? '#ecfdf5' : '#fef2f2', color: banner.type === 'ok' ? '#047857' : '#b91c1c' }}>
          {banner.text}
        </div>
      )}

      {/* 4 KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '12px' }}>
        {[
          { label: 'OPEN DISCIPLINARY', value: disciplinaryCases.filter((c) => c.step !== 'CLOSED').length, sub: '7-step due process', color: '#dc2626', icon: <ShieldAlert size={15} color="#dc2626" /> },
          { label: 'CLOSED CASES', value: disciplinaryCases.filter((c) => c.step === 'CLOSED').length, sub: 'Resolved with audit trail', color: '#059669', icon: <CheckCircle2 size={15} color="#059669" /> },
          { label: 'CONFIDENTIAL GRIEVANCES', value: grievances.length, sub: 'Anti-retaliation protected', color: activeBrandColor, icon: <Lock size={15} color={activeBrandColor} /> },
          { label: 'ZERO AI PENALTIES', value: '100%', sub: 'Human HR/GMD review only', color: '#0f172a', icon: <Scale size={15} color={activeBrandColor} /> },
        ].map((k) => (
          <div key={k.label} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#64748b' }}>{k.icon}<span>{k.label}</span></div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: k.color, margin: '6px 0 2px' }}>{k.value}</div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Underline Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { id: 'DISCIPLINE', label: `Conduct & Disciplinary (${disciplinaryCases.length})` },
            { id: 'GRIEVANCE', label: `Confidential Grievances (${grievances.length})` },
          ].map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id as any)} style={{ padding: '10px 4px', border: 'none', borderBottom: active ? `2.5px solid ${activeBrandColor}` : '2.5px solid transparent', background: 'transparent', color: active ? activeBrandColor : '#64748b', fontSize: '13px', fontWeight: active ? 800 : 600, cursor: 'pointer' }}>
                {t.label}
              </button>
            );
          })}
        </div>

        <button type="button" onClick={() => setShowModal(true)} style={{ marginBottom: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: activeBrandColor, color: '#ffffff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> {tab === 'DISCIPLINE' ? 'Open Disciplinary Case' : 'Log Confidential Grievance'}
        </button>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px' }}>
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading employee relations records...</div>
        ) : tab === 'DISCIPLINE' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {disciplinaryCases.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No disciplinary cases recorded.</p>
            ) : (
              disciplinaryCases.map((c) => {
                const stepIdx = DISCIPLINARY_STEPS.indexOf(c.step);
                return (
                  <div key={c.id} style={{ padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldAlert size={15} color={activeBrandColor} />
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{c.caseNumber} · {c.employee?.legalName}</strong>
                        <span style={{ padding: '2px 8px', borderRadius: '999px', background: '#fee2e2', color: '#b91c1c', fontSize: '10.5px', fontWeight: 700 }}>{c.severity}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select value={c.step} onChange={(e) => submit({ action: 'ADVANCE_DISCIPLINARY', id: c.id, step: e.target.value })} style={{ padding: '5px 9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 700 }}>
                          {DISCIPLINARY_STEPS.map((st) => <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>)}
                        </select>
                        <select value={c.decisionOutcome || ''} onChange={(e) => submit({ action: 'ADVANCE_DISCIPLINARY', id: c.id, decisionOutcome: e.target.value })} style={{ padding: '5px 9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 700 }}>
                          <option value="">Outcome (Pending)...</option>
                          {OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <p style={{ margin: '8px 0 10px', fontSize: '12.5px', color: '#334155' }}>{c.allegation}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                      {DISCIPLINARY_STEPS.map((st, idx) => (
                        <div key={st} style={{ padding: '4px 6px', borderRadius: '6px', textAlign: 'center', fontSize: '9.5px', fontWeight: 700, background: idx <= stepIdx ? activeBrandColor : '#e2e8f0', color: idx <= stepIdx ? '#ffffff' : '#64748b' }}>
                          {st.replace(/_/g, ' ')}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#047857', fontWeight: 700, background: '#ecfdf5', padding: '8px 12px', borderRadius: '10px' }}>
              <Lock size={14} /> Anti-retaliation RBAC active: employees/managers cannot view grievances filed against themselves.
            </div>
            {grievances.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px' }}>No confidential grievances visible in your scope.</p>
            ) : (
              grievances.map((g) => (
                <div key={g.id} style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{g.ticketCode} · {g.category.replace(/_/g, ' ')}</strong>
                    <select value={g.status} onChange={(e) => submit({ action: 'UPDATE_GRIEVANCE', id: g.id, status: e.target.value })} style={{ padding: '5px 9px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 700 }}>
                      {['OPEN', 'INVESTIGATING', 'RESOLVED', 'ESCALATED'].map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: '#334155' }}>{g.summary}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '500px', padding: '22px', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{tab === 'DISCIPLINE' ? 'Open Disciplinary Case' : 'File Confidential Grievance'}</h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {tab === 'DISCIPLINE' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={discForm.employeeId} onChange={(e) => setDiscForm({ ...discForm, employeeId: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="">Select Employee...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
                </select>
                <select value={discForm.severity} onChange={(e) => setDiscForm({ ...discForm, severity: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="MINOR">Minor Infraction</option>
                  <option value="MAJOR">Major Infraction</option>
                  <option value="GROSS_MISCONDUCT">Gross Misconduct</option>
                </select>
                <textarea rows={2} placeholder="Allegation / Incident Summary" value={discForm.allegation} onChange={(e) => setDiscForm({ ...discForm, allegation: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <textarea rows={2} placeholder="Official Query Text (optional)" value={discForm.queryText} onChange={(e) => setDiscForm({ ...discForm, queryText: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <button type="button" onClick={() => submit({ action: 'OPEN_DISCIPLINARY', ...discForm })} style={{ padding: '11px', borderRadius: '10px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>Open Case</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={grvForm.reporterId} onChange={(e) => setGrvForm({ ...grvForm, reporterId: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="">Reporter (Employee)...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
                </select>
                <select value={grvForm.againstEmployeeId} onChange={(e) => setGrvForm({ ...grvForm, againstEmployeeId: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="">Against (Optional - Protected)...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
                </select>
                <select value={grvForm.category} onChange={(e) => setGrvForm({ ...grvForm, category: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  {['HARASSMENT', 'DISCRIMINATION', 'PAY_DISPUTE', 'SAFETY', 'MANAGEMENT_CONDUCT', 'OTHER'].map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
                <textarea rows={3} placeholder="Confidential Grievance Summary" value={grvForm.summary} onChange={(e) => setGrvForm({ ...grvForm, summary: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <button type="button" onClick={() => submit({ action: 'FILE_GRIEVANCE', ...grvForm })} style={{ padding: '11px', borderRadius: '10px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, cursor: 'pointer' }}>File Confidential Case</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
