'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Eye,
  X,
  FileCheck2,
} from 'lucide-react';

interface HrDocumentsPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor?: string;
}

const DOC_TYPES = [
  'OFFER_LETTER',
  'EMPLOYMENT_CONTRACT',
  'CONFIRMATION_LETTER',
  'PROMOTION_LETTER',
  'SALARY_ADJUSTMENT',
  'TRANSFER_LETTER',
  'WARNING_LETTER',
  'LEAVE_APPROVAL',
  'NDA',
  'EXIT_CLEARANCE',
  'EXPERIENCE_LETTER',
  'POLICY',
  'CERTIFICATE',
  'OTHER',
];

export default function HrDocumentsPanel({
  selectedSubsidiaryId,
  activeBrandColor = '#ea580c',
}: HrDocumentsPanelProps) {
  const [tab, setTab] = useState<'DOCUMENTS' | 'PENDING_SIG' | 'EXPIRING' | 'TEMPLATES'>('DOCUMENTS');
  const [documents, setDocuments] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [issueForm, setIssueForm] = useState({
    employeeId: '',
    docType: 'OFFER_LETTER',
    title: '',
    expiryDate: '',
    renderedHtml: '',
    requiresSignature: true,
  });
  const [tplForm, setTplForm] = useState({ docType: 'OFFER_LETTER', title: '', bodyTemplate: '' });
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/documents${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
        setTemplates(data.templates || []);
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
    const res = await fetch(`/api/hr/documents${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setBanner({ type: 'err', text: data.error || 'Action failed.' });
    } else {
      setBanner({ type: 'ok', text: 'Document saved successfully.' });
      setShowModal(false);
      await loadData();
    }
  };

  const pendingSigDocs = documents.filter((d) => d.requiresSignature && !d.signedAt);
  const signedDocs = documents.filter((d) => Boolean(d.signedAt));
  const expiringDocs = documents.filter((d) => {
    if (!d.expiryDate) return false;
    const diffDays = (new Date(d.expiryDate).getTime() - Date.now()) / 86400000;
    return diffDays <= 30;
  });

  const displayedDocs = (tab === 'PENDING_SIG' ? pendingSigDocs : tab === 'EXPIRING' ? expiringDocs : documents).filter((d) => {
    if (docTypeFilter !== 'ALL' && d.docType !== docTypeFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      d.title.toLowerCase().includes(q) ||
      (d.employee?.legalName || '').toLowerCase().includes(q)
    );
  });

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
          { label: 'ISSUED DOCUMENTS', value: documents.length, sub: '14 enterprise doc types', color: '#0f172a', icon: <FileText size={15} color={activeBrandColor} /> },
          { label: 'AWAITING SIGNATURE', value: pendingSigDocs.length, sub: 'Digital acknowledgement pending', color: activeBrandColor, icon: <Clock size={15} color={activeBrandColor} /> },
          { label: 'SIGNED / EXECUTED', value: signedDocs.length, sub: 'Verified employee records', color: '#059669', icon: <FileCheck2 size={15} color="#059669" /> },
          { label: 'EXPIRING (30 DAYS)', value: expiringDocs.length, sub: 'Contracts & certifications', color: '#dc2626', icon: <AlertTriangle size={15} color="#dc2626" /> },
        ].map((k) => (
          <div key={k.label} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: '#64748b' }}>{k.icon}<span>{k.label}</span></div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: k.color, margin: '6px 0 2px' }}>{k.value}</div>
            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Underline Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { id: 'DOCUMENTS', label: `Issued Repository (${documents.length})` },
            { id: 'PENDING_SIG', label: `Pending Signatures (${pendingSigDocs.length})` },
            { id: 'EXPIRING', label: `Expiring Soon (${expiringDocs.length})` },
            { id: 'TEMPLATES', label: `Templates (${templates.length})` },
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
          <Plus size={14} /> {tab === 'TEMPLATES' ? 'Create Template' : 'Issue Employee Document'}
        </button>
      </div>

      {tab !== 'TEMPLATES' && (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '320px' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or employee..." style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
          </div>
          <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)} style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}>
            <option value="ALL">All 14 Document Types</option>
            {DOC_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading documents repository...</div>
        ) : tab !== 'TEMPLATES' ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b' }}>
                  <th style={{ padding: '12px 16px' }}>Document</th>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Expiry</th>
                  <th style={{ padding: '12px 16px' }}>Signature Status</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedDocs.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No documents found for this view.</td></tr>
                ) : (
                  displayedDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><FileText size={14} color={activeBrandColor} /> {doc.title} (v{doc.version})</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>{doc.employee?.legalName}</td>
                      <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>{doc.docType.replace(/_/g, ' ')}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{doc.expiryDate || 'Permanent'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {doc.signedAt ? (
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={13} /> Signed</span>
                        ) : doc.requiresSignature ? (
                          <span style={{ color: '#ea580c', fontWeight: 700, fontSize: '12px' }}>Awaiting Signature</span>
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '12px' }}>Issued</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button type="button" onClick={() => setPreviewDoc(doc)} style={{ padding: '5px 8px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '11px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Eye size={12} /> Preview
                          </button>
                          {doc.requiresSignature && !doc.signedAt && (
                            <button type="button" onClick={() => submit({ action: 'SIGN_DOCUMENT', id: doc.id })} style={{ padding: '5px 8px', borderRadius: '7px', border: 'none', background: '#059669', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                              Mark Signed
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {templates.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', margin: '8px' }}>No templates created yet.</p>
            ) : (
              templates.map((t) => (
                <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: '14px', padding: '16px', background: '#f8fafc' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 800, color: activeBrandColor }}>{t.docType.replace(/_/g, ' ')}</div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{t.title}</div>
                  <p style={{ fontSize: '12px', color: '#475569', marginTop: '6px', lineHeight: 1.45 }}>{t.bodyTemplate.slice(0, 120)}...</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Issue / Template Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '520px', padding: '22px', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>{tab === 'TEMPLATES' ? 'Create Document Template' : 'Issue Employee Document'}</h3>
              <button type="button" onClick={() => setShowModal(false)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            {tab === 'TEMPLATES' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={tplForm.docType} onChange={(e) => setTplForm({ ...tplForm, docType: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  {DOC_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                </select>
                <input placeholder="Template Title" value={tplForm.title} onChange={(e) => setTplForm({ ...tplForm, title: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <textarea rows={4} placeholder="Template body ({{employeeName}}, {{jobTitle}}, {{effectiveDate}})" value={tplForm.bodyTemplate} onChange={(e) => setTplForm({ ...tplForm, bodyTemplate: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <button type="button" onClick={() => submit({ action: 'CREATE_TEMPLATE', ...tplForm })} style={{ padding: '11px', borderRadius: '10px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Save Template</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={issueForm.employeeId} onChange={(e) => setIssueForm({ ...issueForm, employeeId: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                  <option value="">Select Employee...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName} ({s.employeeNumber})</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select value={issueForm.docType} onChange={(e) => setIssueForm({ ...issueForm, docType: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                    {DOC_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input type="date" value={issueForm.expiryDate} onChange={(e) => setIssueForm({ ...issueForm, expiryDate: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <input placeholder="Document Title" value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <textarea rows={3} placeholder="Document content / summary note (optional)" value={issueForm.renderedHtml} onChange={(e) => setIssueForm({ ...issueForm, renderedHtml: e.target.value })} style={{ padding: '10px', borderRadius: '9px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#334155' }}>
                  <input type="checkbox" checked={issueForm.requiresSignature} onChange={(e) => setIssueForm({ ...issueForm, requiresSignature: e.target.checked })} />
                  Require employee digital acknowledgement / e-Signature
                </label>
                <button type="button" onClick={() => submit({ action: 'ISSUE_DOCUMENT', ...issueForm })} style={{ padding: '11px', borderRadius: '10px', border: 'none', background: activeBrandColor, color: '#ffffff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Issue Document</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 90, display: 'grid', placeItems: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', width: '100%', maxWidth: '580px', padding: '24px', boxShadow: '0 24px 60px rgba(15,23,42,0.22)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: activeBrandColor }}>{previewDoc.docType.replace(/_/g, ' ')} · v{previewDoc.version}</div>
                <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{previewDoc.title}</h3>
              </div>
              <button type="button" onClick={() => setPreviewDoc(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '13px', lineHeight: 1.6, color: '#1e293b', minHeight: '140px' }}>
              <div style={{ marginBottom: '8px' }}><strong>Recipient:</strong> {previewDoc.employee?.legalName} ({previewDoc.employee?.employeeNumber})</div>
              <div>{previewDoc.renderedHtml || 'Official BEMS HR Document issued via enterprise repository.'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
