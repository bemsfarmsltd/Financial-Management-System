'use client';

import React, { useState } from 'react';
import { ScenarioSimulatorCardData } from '../types';
import { Zap } from 'lucide-react';

interface Props {
  data: ScenarioSimulatorCardData;
  onApplyRecommendation?: (prompt: string) => void;
}

export function ScenarioSimulatorCard({ data, onApplyRecommendation }: Props) {
  const [delayExpenditureDays, setDelayExpenditureDays] = useState(0);
  const [additionalCapAllocatedNaira, setAdditionalCapAllocatedNaira] = useState(0);

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Simulation logic
  const adjustedCommitments = Math.max(0, data.pendingCommitmentsNaira - (delayExpenditureDays > 14 ? data.pendingCommitmentsNaira * 0.4 : 0));
  const effectiveMonthlyBurn = Math.max(1000000, data.monthlyBurnNaira + (additionalCapAllocatedNaira / 3));
  const simulatedLiquid = data.initialLiquidNaira - (delayExpenditureDays > 0 ? adjustedCommitments * 0.5 : adjustedCommitments);
  const simulatedRunway = (simulatedLiquid / effectiveMonthlyBurn).toFixed(1);

  const runwayDiff = (Number(simulatedRunway) - data.initialRunwayMonths).toFixed(1);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        padding: '18px',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
        marginTop: '10px',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: '#f5f3ff',
              color: '#7c3aed',
              border: '1px solid #ddd6fe',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            What-If Scenario Modeler
          </span>
          <span style={{ color: '#64748b', fontSize: '11px' }}>Non-destructive Sandbox</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px' }}>
          <span style={{ color: Number(runwayDiff) >= 0 ? '#059669' : '#e11d48', fontWeight: 800 }}>
            {Number(runwayDiff) >= 0 ? `+${runwayDiff} Mo` : `${runwayDiff} Mo`}
          </span>
        </div>
      </div>

      {/* Primary KPI Result */}
      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Simulated Cash Runway</span>
            <strong style={{ fontSize: '26px', color: '#0f172a', fontWeight: 800 }}>{simulatedRunway} Months</strong>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Base baseline: {data.initialRunwayMonths} months</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Liquid Reserve Buffer</span>
            <strong style={{ fontSize: '17px', color: '#0284c7', fontWeight: 800 }}>{formatNaira(simulatedLiquid)}</strong>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#475569', fontWeight: 600 }}>Stagger Non-Urgent Requisitions:</span>
            <strong style={{ color: '#7c3aed' }}>{delayExpenditureDays} Days Delay</strong>
          </div>
          <input
            type="range"
            min="0"
            max="45"
            step="5"
            value={delayExpenditureDays}
            onChange={(e) => setDelayExpenditureDays(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#7c3aed' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#475569', fontWeight: 600 }}>Additional Capex / Headroom:</span>
            <strong style={{ color: '#0284c7' }}>+{formatNaira(additionalCapAllocatedNaira)}</strong>
          </div>
          <input
            type="range"
            min="0"
            max="25000000"
            step="1000000"
            value={additionalCapAllocatedNaira}
            onChange={(e) => setAdditionalCapAllocatedNaira(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#0284c7' }}
          />
        </div>
      </div>

      {/* Action Recommendation */}
      <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <Zap size={14} color="#059669" />
          <strong style={{ color: '#047857', fontSize: '11.5px' }}>Recommended Strategy</strong>
        </div>
        <p style={{ margin: 0, color: '#065f46', fontSize: '11px', lineHeight: 1.45 }}>
          Staggering logistics diesel batching by 14 days and maintaining current software licenses extends group runway to{' '}
          <strong>{simulatedRunway} months</strong> without impacting operational deliveries.
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => onApplyRecommendation && onApplyRecommendation('Prepare the recommended 14-day staggered requisition plan')}
          style={{
            flex: 2,
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '9px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(124, 58, 237, 0.25)',
          }}
        >
          Adopt Recommended Schedule →
        </button>
        <button
          type="button"
          onClick={() => {
            setDelayExpenditureDays(0);
            setAdditionalCapAllocatedNaira(0);
          }}
          style={{
            flex: 1,
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            color: '#475569',
            borderRadius: '8px',
            padding: '9px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
