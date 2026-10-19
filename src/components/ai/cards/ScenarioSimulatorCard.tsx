'use client';

import React, { useState } from 'react';
import { ScenarioSimulatorCardData } from '../types';
import { Sliders, TrendingUp, TrendingDown, RefreshCw, Zap, ShieldCheck } from 'lucide-react';

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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        borderRadius: '14px',
        padding: '16px',
        color: '#ffffff',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        marginTop: '8px',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: 'rgba(139, 92, 246, 0.25)',
              color: '#c084fc',
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
          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Non-destructive Sandbox</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
          <span style={{ color: Number(runwayDiff) >= 0 ? '#10b981' : '#f43f5e', fontWeight: 800 }}>
            {Number(runwayDiff) >= 0 ? `+${runwayDiff} Mo` : `${runwayDiff} Mo`}
          </span>
        </div>
      </div>

      {/* Primary KPI Result */}
      <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Simulated Cash Runway</span>
            <strong style={{ fontSize: '24px', color: '#ffffff', fontWeight: 800 }}>{simulatedRunway} Months</strong>
            <span style={{ color: '#cbd5e1', fontSize: '11px', display: 'block' }}>Base baseline: {data.initialRunwayMonths} months</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Liquid Reserve Buffer</span>
            <strong style={{ fontSize: '16px', color: '#38bdf8' }}>{formatNaira(simulatedLiquid)}</strong>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#cbd5e1' }}>Stagger Non-Urgent Requisitions:</span>
            <strong style={{ color: '#c084fc' }}>{delayExpenditureDays} Days Delay</strong>
          </div>
          <input
            type="range"
            min="0"
            max="45"
            step="5"
            value={delayExpenditureDays}
            onChange={(e) => setDelayExpenditureDays(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: '#cbd5e1' }}>Additional Capex / Headroom:</span>
            <strong style={{ color: '#38bdf8' }}>+{formatNaira(additionalCapAllocatedNaira)}</strong>
          </div>
          <input
            type="range"
            min="0"
            max="25000000"
            step="1000000"
            value={additionalCapAllocatedNaira}
            onChange={(e) => setAdditionalCapAllocatedNaira(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#38bdf8' }}
          />
        </div>
      </div>

      {/* Action Recommendation */}
      <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <Zap size={13} color="#10b981" />
          <strong style={{ color: '#10b981', fontSize: '11px' }}>Recommended Strategy</strong>
        </div>
        <p style={{ margin: 0, color: '#e2e8f0', fontSize: '11px', lineHeight: 1.4 }}>
          Staggering logistics diesel batching by 14 days and maintaining current software licenses extends group runway to{' '}
          <strong>{simulatedRunway} months</strong> without impacting operational deliveries.
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          type="button"
          onClick={() => onApplyRecommendation && onApplyRecommendation('Prepare the recommended 14-day staggered requisition plan')}
          style={{
            flex: 2,
            background: '#8b5cf6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px',
            fontWeight: 800,
            cursor: 'pointer',
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
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: '#cbd5e1',
            borderRadius: '6px',
            padding: '8px',
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
