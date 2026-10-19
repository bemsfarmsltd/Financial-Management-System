'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  Send,
  CheckCircle2,
  X,
  Plus,
  RefreshCw,
  Building2,
  Lock,
  MessageSquare,
  FileText,
  ChevronRight,
  Info
} from 'lucide-react';

interface Incident {
  id: string;
  incidentCode: string;
  title: string;
  subsidiary: string;
  declaredBy: string;
  role: string;
  amount: number;
  amountFormatted: string;
  justification: string;
  declaredAt: string;
  reconciliationDeadline: string;
  hoursRemaining: number;
  status: string;
  alertChannelBridge: string;
  auditStatus: string;
}

interface EmergencyData {
  capAmount: number;
  capAmountFormatted: string;
  activeExemptionsCount: number;
  protocol: {
    slaHours: number;
    notificationBridge: string;
    ratificationAuthority: string;
    allowedRoles: string[];
  };
  incidents: Incident[];
}

export function EmergencyOverridesView({
  businessName,
  userName,
  onNavigate,
  onSelectBusiness
}: {
  businessName: string;
  userName: string;
  onNavigate?: (view: string) => void;
  onSelectBusiness?: (id: string) => void;
}) {
  const [data, setData] = useState<EmergencyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [declareModalOpen, setDeclareModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Form state
  const [organizations, setOrganizations] = useState<{ id: string; legalName: string; code: string }[]>([]);
  const [selectedSubId, setSelectedSubId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [justification, setJustification] = useState('');
  const [declaring, setDeclaring] = useState(false);

  const fetchEmergencyData = async () => {
    try {
      setLoading(true);
      const [res, orgRes] = await Promise.all([
        fetch('/api/emergency'),
        fetch('/api/organizations')
      ]);
      const json = await res.json();
      const orgJson = await orgRes.json();
      setData(json);
      if (orgJson && orgJson.organizations) {
        setOrganizations(orgJson.organizations);
        if (orgJson.organizations.length > 0) {
          setSelectedSubId(orgJson.organizations[0].id);
        }
      }
    } catch (e: any) {
      setNotice('Failed to load incident protocol data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergencyData();
  }, []);

  const handleDeclare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubId || !title.trim() || !amount || !justification.trim()) {
      setNotice('Please fill in all incident details.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setNotice('Please enter a valid amount.');
      return;
    }
    if (numAmount > 1000000) {
      setNotice('Amount exceeds the emergency override cap of ₦1,000,000.');
      return;
    }

    try {
      setDeclaring(true);
      const res = await fetch('/api/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subsidiaryId: selectedSubId,
          title,
          amount: numAmount,
          justification,
          declarerEmail: 'edwin@bemsfarms.com'
        })
      });
      const result = await res.json();
      if (!res.ok) {
        setNotice(result.error || 'Failed to declare emergency incident.');
        return;
      }
      setNotice(`Emergency bypass ${result.requestNumber} registered. WhatsApp alert pushed to GMD.`);
      setDeclareModalOpen(false);
      setTitle('');
      setAmount('');
      setJustification('');
      fetchEmergencyData();
    } catch (e: any) {
      setNotice('Network error declaring emergency incident.');
    } finally {
      setDeclaring(false);
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100%', color: '#0f172a' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            INCIDENT PROTOCOL · SOP-EMG-01
          </span>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '3px 0 2px', letterSpacing: '-0.3px', color: '#0f172a' }}>
            Emergency & Exemption Overrides
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Deterministic bypass of standard multi-tier approval gates for life safety or critical facility breakdown, backed by a 24-hour accountability clock.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={fetchEmergencyData}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              fontSize: '10px',
              fontWeight: 600,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setDeclareModalOpen(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #b42335',
              background: 'linear-gradient(135deg, #dc2626, #b42335)',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(180, 35, 53, 0.25)'
            }}
          >
            <AlertTriangle size={12} />
            Declare Emergency Bypass
          </button>
        </div>
      </div>

      {notice && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '11px',
          fontWeight: 600,
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ border: 0, background: 'none', color: '#991b1b', cursor: 'pointer' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* TOP KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          borderRadius: '10px',
          padding: '12px 14px',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box',
          boxShadow: '0 8px 20px rgba(234, 88, 12, 0.22)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#fed7aa', textTransform: 'uppercase' }}>
              EMERGENCY FACILITY CAP
            </span>
            <ShieldAlert size={12} color="#fed7aa" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1 }}>{data?.capAmountFormatted || '₦1,000,000'}</div>
            <div style={{ fontSize: '9px', color: '#ffedd5', marginTop: '2px' }}>Per Incident Exemption Limit</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              ACTIVE INCIDENTS
            </span>
            <AlertTriangle size={12} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
              {data?.activeExemptionsCount || 0}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Awaiting Post-Facto Receipts</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              RECONCILIATION SLA
            </span>
            <Clock size={12} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', lineHeight: 1.1 }}>24 Hours</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Mandatory Receipt Clock</div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '75px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.8px', color: '#64748b', textTransform: 'uppercase' }}>
              ALERT BRIDGE
            </span>
            <MessageSquare size={12} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', lineHeight: 1.1 }}>WhatsApp + SMS</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Instant Push to GMD</div>
          </div>
        </div>
      </div>

      {/* POLICY BANNER */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#fef3c7',
            display: 'grid',
            placeItems: 'center',
            color: '#b45309',
            flexShrink: 0
          }}>
            <ShieldAlert size={16} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              Pre-Authorized Emergency Cap: ₦1,000,000
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Duty Officers and Facility Leads can trigger instant disbursement for urgent facility breakdown or life safety. Sequential gates are bypassed, an instant alert is pushed to the GMD, and the 24-hour reconciliation clock begins.
            </div>
          </div>
        </div>
        <button
          onClick={() => setDeclareModalOpen(true)}
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            fontSize: '10px',
            fontWeight: 700,
            color: '#0f172a',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}
        >
          Declare Incident →
        </button>
      </div>

      {/* INCIDENT REGISTER */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '10px 14px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Emergency Exemption & Incident Register
            </h3>
            <span style={{ fontSize: '9px', color: '#64748b' }}>
              Real-time audit log of all emergency overrides and their 24h accountability reconciliation status
            </span>
          </div>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '10px',
            background: '#f1f5f9',
            color: '#475569'
          }}>
            {data?.incidents.length || 0} Records
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>
            Loading incident protocol records…
          </div>
        ) : !data || data.incidents.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>No Active Emergency Overrides</h4>
            <p style={{ margin: 0, fontSize: '10px', color: '#64748b' }}>All group facilities and operations are running under standard sequential approval tiers.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {data.incidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: inc.status === 'RECONCILED' ? '#ecfdf5' : '#fef2f2',
                    color: inc.status === 'RECONCILED' ? '#059669' : '#dc2626',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{inc.incidentCode}</span>
                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                        {inc.subsidiary}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inc.title}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                      Declared by {inc.declaredBy} ({inc.role}) · {new Date(inc.declaredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{inc.amountFormatted}</div>
                  <div style={{ marginTop: '3px' }}>
                    {inc.status === 'RECONCILED' ? (
                      <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                        ✓ Reconciled & Closed
                      </span>
                    ) : (
                      <span style={{ fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#fffbeb', color: '#b45309' }}>
                        ⏳ {inc.hoursRemaining}h remaining to reconcile
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedIncident(inc)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '5px',
                    border: '1px solid #fed7aa',
                    background: '#fff7ed',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#ea580c',
                    cursor: 'pointer'
                  }}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DECLARE EMERGENCY MODAL */}
      {declareModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 26, 66, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'min(500px, 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fef2f2'
            }}>
              <div>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#dc2626', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  URGENT BYPASS INITIATION
                </span>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b', margin: '2px 0 0' }}>
                  Declare Emergency Facility Override
                </h3>
              </div>
              <button
                onClick={() => setDeclareModalOpen(false)}
                style={{ border: 0, background: 'none', color: '#991b1b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleDeclare} style={{ padding: '16px' }}>
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '10px',
                color: '#92400e',
                lineHeight: 1.5,
                marginBottom: '12px'
              }}>
                <strong>Warning:</strong> Submitting an emergency override triggers an instant high-priority WhatsApp push to the Group Managing Director and starts an unalterable 24-hour accountability deadline. Maximum allowed amount is ₦1,000,000.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Subsidiary Entity *
                  </label>
                  <select
                    value={selectedSubId}
                    onChange={(e) => setSelectedSubId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      color: '#0f172a',
                      background: '#fff'
                    }}
                  >
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.legalName} ({org.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Incident Title / Failure Component *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cold-Storage Compressor Emergency Replacement"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Emergency Amount (NGN) · Max ₦1,000,000 *
                  </label>
                  <input
                    type="number"
                    max={1000000}
                    placeholder="e.g. 750000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      color: '#0f172a',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Technical Justification & Immediate Impact *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Detail the imminent risk to life safety, revenue loss, or core operations requiring instant bypass..."
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 9px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '11px',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setDeclareModalOpen(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={declaring}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #b42335',
                    background: 'linear-gradient(135deg, #dc2626, #b42335)',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: declaring ? 'not-allowed' : 'pointer'
                  }}
                >
                  {declaring ? 'Transmitting…' : 'Authorize Emergency Bypass 🚨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INCIDENT DETAIL MODAL */}
      {selectedIncident && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6, 26, 66, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            width: 'min(500px, 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <div>
                <span style={{ fontSize: '8px', fontWeight: 800, color: '#64748b', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  INCIDENT AUDIT TRAIL
                </span>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '2px 0 0' }}>
                  {selectedIncident.incidentCode} · {selectedIncident.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                style={{ border: 0, background: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>SUBSIDIARY</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>{selectedIncident.subsidiary}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>AMOUNT AUTHORIZED</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>{selectedIncident.amountFormatted}</div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>DECLARING OFFICER</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {selectedIncident.declaredBy} ({selectedIncident.role})
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>JUSTIFICATION</div>
                <div style={{ fontSize: '10px', color: '#334155', marginTop: '2px', lineHeight: 1.5 }}>
                  {selectedIncident.justification}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>RECONCILIATION DEADLINE</div>
                <div style={{ fontSize: '10px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                  {new Date(selectedIncident.reconciliationDeadline).toLocaleString()} ({selectedIncident.hoursRemaining}h remaining)
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  Close Audit View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
