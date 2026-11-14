'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  RefreshCw,
  Clock,
  AlertTriangle,
  Inbox,
  X,
} from 'lucide-react';

interface HrRequestsPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor?: string;
}

const CATEGORIES = [
  'ALL',
  'LEAVE',
  'ATTENDANCE_CORRECTION',
  'SALARY_ADVANCE',
  'REIMBURSEMENT',
  'EQUIPMENT',
  'WFH',
  'SCHEDULE',
  'TRAINING',
  'INFO_CORRECTION',
  'TRANSFER',
  'SALARY_REVIEW',
  'TRAVEL',
  'EMPLOYMENT_LETTER',
];

export default function HrRequestsPanel({
  selectedSubsidiaryId,
  activeBrandColor = '#ea580c',
}: HrRequestsPanelProps) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [inspectTicket, setInspectTicket] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    category: 'EMPLOYMENT_LETTER',
    priority: 'NORMAL',
    subject: '',
    description: '',
  });
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/requests${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets || []);
        setStaffOptions(data.staffOptions || []);
      }
    } catch {
      setBanner({ type: 'err', text: 'Failed to load HR requests.' });
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
    const res = await fetch(`/api/hr/requests${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Action failed.' });
    } else {
      setBanner({ type: 'ok', text: 'HR request updated successfully.' });
      setShowNewModal(false);
      setInspectTicket(null);
      setResolutionNote('');
      setForm({ employeeId: '', category: 'EMPLOYMENT_LETTER', priority: 'NORMAL', subject: '', description: '' });
      await loadData();
    }
  };

  const pendingCount = tickets.filter((t) => t.status === 'PENDING' || t.status === 'IN_REVIEW').length;
  const approvedCount = tickets.filter((t) => t.status === 'APPROVED').length;
  const urgentCount = tickets.filter((t) => (t.priority === 'URGENT' || t.priority === 'HIGH') && (t.status === 'PENDING' || t.status === 'IN_REVIEW')).length;

  const filtered = tickets.filter((t) => {
    if (subTab === 'PENDING' && t.status !== 'PENDING' && t.status !== 'IN_REVIEW') return false;
    if (subTab === 'APPROVED' && t.status !== 'APPROVED') return false;
    if (subTab === 'REJECTED' && t.status !== 'REJECTED' && t.status !== 'CANCELLED') return false;
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      t.referenceCode.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.employee?.legalName || '').toLowerCase().includes(q)
    );
  });

  const exportCsv = () => {
    const headers = ['RefCode', 'Employee', 'Category', 'Priority', 'Subject', 'Status', 'CreatedAt'];
    const rows = filtered.map((t) => [
      t.referenceCode,
      `"${(t.employee?.legalName || '').replace(/"/g, '""')}"`,
      t.category,
      t.priority,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      t.status,
      t.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bems-hr-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {banner && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, background: banner.type === 'ok' ? '#ecfdf5' : '#fef2f2', color: banner.type === 'ok' ? '#047857' : '#b91c1c', border: `1px solid ${banner.type === 'ok' ? '#a7f3d0' : '#fecaca'}` }}>
          {banner.text}
        </div>
      )}

      {/* 4 KPI Strip (matching AttendanceDeskPage) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '12px' }}>
        {[
          { label: 'TOTAL TICKETS', value: tickets.length, sub: '13-category intake desk', color: '#0f172a', icon: <Inbox size={15} color={activeBrandColor} /> },
          { label: 'PENDING REVIEW', value: pendingCount, sub: 'Awaiting HR / GMD sign-off', color: activeBrandColor, icon: <Clock size={15} color={activeBrandColor} /> },
          { label: 'APPROVED', value: approvedCount, sub: 'Authorized & logged', color: '#059669', icon: <CheckCircle2 size={15} color="#059669" /> },
          { label: 'HIGH / URGENT', value: urgentCount, sub: 'Priority SLA escalations', color: '#dc2626', icon: <AlertTriangle size={15} color="#dc2626" /> },
        ].map((k) => (
          <div key={k.label} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>
              {k.icon}
              <span>{k.label}</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: k.color, margin: '6px 0 2px' }}>{k.value}</div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Underline Sub-Tab Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All Requests (${tickets.length})` },
            { id: 'PENDING', label: `Pending Queue (${pendingCount})` },
            { id: 'APPROVED', label: `Approved (${approvedCount})` },
            { id: 'REJECTED', label: 'Rejected & Cancelled' },
          ].map((t) => {
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id as any)}
                style={{
                  padding: '10px 4px',
                  border: 'none',
                  borderBottom: active ? `2.5px solid ${activeBrandColor}` : '2.5px solid transparent',
                  background: 'transparent',
                  color: active ? activeBrandColor : '#64748b',
                  fontSize: '13px',
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          style={{ marginBottom: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '9px', border: 'none', background: activeBrandColor, color: '#ffffff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={14} /> Log HR Request
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px', flex: '1 1 320px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: '300px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref code, subject, or staff..."
              style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c === 'ALL' ? 'All 13 Categories' : c.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            <option value="ALL">All Priorities</option>
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            <Download size={13} /> Export CSV
          </button>
          <button type="button" onClick={loadData} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer' }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Register Table */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading central requests desk...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Ref Code</th>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Subject &amp; Details</th>
                  <th style={{ padding: '12px 16px' }}>Priority</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No HR request tickets matching your filters.</td></tr>
                ) : (
                  filtered.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: activeBrandColor, whiteSpace: 'nowrap' }}>{t.referenceCode}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.employee?.legalName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{t.employee?.employeeNumber}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', fontSize: '12px', fontWeight: 600 }}>{t.category.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{t.subject}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: t.priority === 'URGENT' ? '#fee2e2' : t.priority === 'HIGH' ? '#fff7ed' : '#f1f5f9', color: t.priority === 'URGENT' ? '#b91c1c' : t.priority === 'HIGH' ? '#ea580c' : '#475569' }}>
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: t.status === 'APPROVED' ? '#ecfdf5' : t.status === 'REJECTED' ? '#fef2f2' : '#fff7ed', color: t.status === 'APPROVED' ? '#059669' : t.status === 'REJECTED' ? '#dc2626' : '#ea580c' }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" onClick={() => { setInspectTicket(t); setResolutionNote(t.resolutionNote || ''); }} style={{ padding: '5px 9px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                            Inspect
                          </button>
                          {(t.status === 'PENDING' || t.status === 'IN_REVIEW') && (
                            <>
                              <button type="button" onClick={() => submit({ action: 'RESOLVE', id: t.id, decision: 'APPROVED' })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                Approve
                              </button>
                              <button type="button" onClick={() => submit({ action: 'RESOLVE', id: t.id, decision: 'REJECTED' })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log HR Request Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '520px', padding: '22px', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Log New HR Request Ticket</h3>
              <button type="button" onClick={() => setShowNewModal(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                <option value="">Select Employee...</option>
                {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName} ({s.employeeNumber})</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  {CATEGORIES.filter((c) => c !== 'ALL').map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              <textarea rows={3} placeholder="Details & justification..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              <button type="button" onClick={() => submit({ action: 'CREATE', ...form })} style={{ padding: '11px', borderRadius: '10px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginTop: '4px' }}>
                Submit HR Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Request Modal */}
      {inspectTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '520px', padding: '22px', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: activeBrandColor }}>{inspectTicket.referenceCode} · {inspectTicket.category.replace(/_/g, ' ')}</div>
                <h3 style={{ margin: '2px 0 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{inspectTicket.subject}</h3>
              </div>
              <button type="button" onClick={() => setInspectTicket(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', marginBottom: '12px' }}>
              <div><strong>Employee:</strong> {inspectTicket.employee?.legalName} ({inspectTicket.employee?.employeeNumber})</div>
              <div style={{ marginTop: '6px' }}>{inspectTicket.description}</div>
            </div>
            <textarea rows={2} placeholder="Resolution / approval note (optional)" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '12.5px', marginBottom: '12px' }} />
            {(inspectTicket.status === 'PENDING' || inspectTicket.status === 'IN_REVIEW') && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => submit({ action: 'RESOLVE', id: inspectTicket.id, decision: 'REJECTED', resolutionNote })} style={{ padding: '9px 14px', borderRadius: '9px', border: 'none', background: '#dc2626', color: '#ffffff', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                  <XCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Reject
                </button>
                <button type="button" onClick={() => submit({ action: 'RESOLVE', id: inspectTicket.id, decision: 'APPROVED', resolutionNote })} style={{ padding: '9px 14px', borderRadius: '9px', border: 'none', background: '#059669', color: '#ffffff', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>
                  <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
