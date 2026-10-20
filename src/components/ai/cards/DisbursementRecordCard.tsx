'use client';

import React, { useState } from 'react';
import { DisbursementRecordCardData } from '../types';
import { CheckCircle2, Landmark, FileText, Upload, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  data: DisbursementRecordCardData;
  confirmed?: boolean;
  cancelled?: boolean;
  resultMessage?: string;
  onRecordDisbursement: (data: {
    requestId: string;
    bankName: string;
    externalReference: string;
    receiptFileName?: string;
  }) => void;
  onCancel?: () => void;
}

export function DisbursementRecordCard({ data, confirmed, cancelled, resultMessage, onRecordDisbursement, onCancel }: Props) {
  const [bankName, setBankName] = useState('Zenith Bank Plc');
  const [externalReference, setExternalReference] = useState(
    data.externalReference || `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [uploadedReceipt, setUploadedReceipt] = useState<string | null>('bank_transfer_slip_receipt.pdf');
  const [submitting, setSubmitting] = useState(false);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (confirmed || resultMessage) {
    return (
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '14px',
          marginTop: '8px',
          fontSize: '12px',
          color: '#166534',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <CheckCircle2 size={16} color="#16a34a" />
          <strong style={{ fontSize: '13px' }}>Transfer Record Committed</strong>
        </div>
        <p style={{ margin: 0, color: '#15803d' }}>
          {resultMessage || `Payment transfer of ${formatNaira(data.amountNaira)} for ${data.requestNumber} recorded (Ref: ${externalReference}). Awaiting recipient confirmation.`}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginTop: '8px',
        fontSize: '12px',
        color: '#0f172a',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
            Disbursement Record Gate
          </span>
          <h3 style={{ margin: '4px 0 2px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{data.title}</h3>
          <span style={{ color: '#64748b', fontSize: '11px' }}>{data.requestNumber} · Payer: {data.payerOrgName}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{formatNaira(data.amountNaira)}</strong>
        </div>
      </div>

      {/* Beneficiary Box */}
      <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block' }}>Verified Beneficiary</span>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <strong style={{ color: '#1e293b' }}>{data.beneficiaryName}</strong>
          <span style={{ color: '#475569' }}>{data.beneficiaryBank} · {data.beneficiaryAccount}</span>
        </div>
      </div>

      {/* Payer Bank & Reference Input */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
            Payer Bank Executed:
          </label>
          <select
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', background: '#ffffff' }}
          >
            <option value="Zenith Bank Plc">Zenith Bank Plc</option>
            <option value="Access Bank Plc">Access Bank Plc</option>
            <option value="Guaranty Trust Bank">Guaranty Trust Bank</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
            Bank Transfer Reference:
          </label>
          <input
            type="text"
            value={externalReference}
            onChange={(e) => setExternalReference(e.target.value)}
            style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Attached Receipt File */}
      <div style={{ background: '#f1f5f9', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileText size={14} color="#0284c7" />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>{uploadedReceipt}</span>
        </div>
        <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>✓ Attached</span>
      </div>

      {/* Off-platform notice */}
      <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
        <AlertCircle size={13} color="#d97706" />
        <span style={{ fontSize: '10px', color: '#b45309' }}>
          This records the completed bank transfer and initiates staff payment confirmation. No direct funds are moved by AI.
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setSubmitting(true);
            onRecordDisbursement({
              requestId: data.requestId,
              bankName,
              externalReference,
              receiptFileName: uploadedReceipt || undefined,
            });
          }}
          style={{
            flex: 2,
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '9px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ShieldCheck size={14} />
          Record Payment & Send for Confirmation
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              background: '#f1f5f9',
              color: '#475569',
              border: 'none',
              borderRadius: '6px',
              padding: '9px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
