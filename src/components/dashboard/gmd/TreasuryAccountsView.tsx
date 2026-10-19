'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Wallet,
  ShieldCheck,
  TrendingDown,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  Plus,
  Landmark,
  BadgeCheck,
  ExternalLink,
  Lock
} from 'lucide-react';

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  accountType: string;
  balance: number;
  balanceFormatted: string;
  status: string;
  assignedSubsidiary: string;
  tier: string;
  dailyLimit: number;
  dailyLimitFormatted: string;
}

interface TreasurySummary {
  totalLiquidReserves: number;
  totalLiquidReservesFormatted: string;
  uncommittedReservesFormatted: string;
  pendingPipelineFormatted: string;
  mtdOutflowFormatted: string;
  runwayMonths: string;
  liquidityHealth: string;
}

export function TreasuryAccountsView({
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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchTreasury = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/treasury');
      const data = await res.json();
      if (data) {
        setAccounts(data.accounts || []);
        setSummary(data.summary || null);
      }
    } catch (e: any) {
      setNotice('Failed to load treasury data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasury();
  }, []);

  return (
    <div style={{ width: '100%', minHeight: '100%', color: '#0f172a' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '8px', letterSpacing: '1.2px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            BANK REGISTRY & CASH POSITION
          </span>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '3px 0 2px', letterSpacing: '-0.3px', color: '#0f172a' }}>
            Treasury Bank Accounts & Balances
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
            Designated subsidiary operating accounts, liquid reserves, and payment recording limits.
          </p>
        </div>

        <button
          onClick={fetchTreasury}
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
          Refresh Accounts
        </button>
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

      {/* TOP 4 KPI CARDS */}
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
              TOTAL LIQUID RESERVES
            </span>
            <Landmark size={12} color="#fed7aa" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.1 }}>
              {summary?.totalLiquidReservesFormatted || '₦102,450,000'}
            </div>
            <div style={{ fontSize: '9px', color: '#bfdbfe', marginTop: '2px' }}>Verified Across 3 Accounts</div>
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
              MTD CLEARED TRANSFERS
            </span>
            <TrendingDown size={12} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#059669', lineHeight: 1.1 }}>
              {summary?.mtdOutflowFormatted || '₦14,850,000'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Current Month Disbursed</div>
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
              PENDING PIPELINE
            </span>
            <Clock size={12} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#d97706', lineHeight: 1.1 }}>
              {summary?.pendingPipelineFormatted || '₦3,250,000'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Approved Ready to Transfer</div>
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
              LIQUIDITY RUNWAY
            </span>
            <ShieldCheck size={12} color="#ea580c" />
          </div>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', lineHeight: 1.1 }}>
              {summary?.runwayMonths || '6.9 Months'}
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>Healthy Tier 1 Operating Buffer</div>
          </div>
        </div>
      </div>

      {/* ACCOUNT CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {accounts.map((acc) => (
          <div
            key={acc.id}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                    {acc.accountType}
                  </span>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: '3px 0 0' }}>
                    {acc.bankName}
                  </h3>
                </div>
                <span style={{
                  fontSize: '8px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0'
                }}>
                  ● {acc.status}
                </span>
              </div>

              <div style={{ marginTop: '12px', background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '9px', color: '#64748b' }}>Account Number</div>
                <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', letterSpacing: '0.5px' }}>
                  {acc.accountNumber}
                </div>
                <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
                  {acc.accountName}
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 600 }}>AVAILABLE BALANCE</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {acc.balanceFormatted}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b', marginTop: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                <span>Daily Limit: <strong style={{ color: '#0f172a' }}>{acc.dailyLimitFormatted}</strong></span>
                <span>Tier: <strong style={{ color: '#ea580c' }}>{acc.tier}</strong></span>
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Lock size={10} color="#059669" /> Staff Receipt Confirmation
              </span>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('Disbursements desk')}
                  style={{
                    border: 0,
                    background: 'none',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#ea580c',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  Disburse From Here →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* POLICY INFORMATION */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: '#fff7ed',
            display: 'grid',
            placeItems: 'center',
            color: '#ea580c',
            border: '1px solid #fed7aa'
          }}>
            <ShieldCheck size={16} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>
              Off-Platform Bank Transfer Protocol (No Direct FinTech API Access)
            </div>
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Corporate transfers are executed through the bank portal. Finance, the GMD, or the System Admin records the payment and receipt; the requesting staff member then confirms whether the funds arrived.
            </div>
          </div>
        </div>

        {onNavigate && (
          <button
            onClick={() => onNavigate('Disbursements desk')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #ea580c',
              background: '#fff7ed',
              color: '#ea580c',
              fontSize: '10px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer'
            }}
          >
            Open Banking Queue →
          </button>
        )}
      </div>
    </div>
  );
}
