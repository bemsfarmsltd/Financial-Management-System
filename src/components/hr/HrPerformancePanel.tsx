'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Target,
  Plus,
  Award,
  CalendarRange,
  TrendingUp,
  X,
  Search,
  Download,
  RefreshCw,
  Users,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';

interface HrPerformancePanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor?: string;
}

interface StaffScorecard {
  id: string;
  employeeNumber: string;
  legalName: string;
  jobTitle: string;
  subsidiary: string;
  department: string;
  resumptionDate?: string | null;
  totalPunches: number;
  lateCount: number;
  punctualityPct: number;
  totalTrainings: number;
  completedTrainings: number;
  trainingPct: number;
  openDisciplinary: number;
  compositeScore: number;
  probationStatus: 'CONFIRMED' | 'PROBATION' | 'DUE_CONFIRMATION';
  daysSinceResumption: number;
  probationDaysLeft: number;
}

export default function HrPerformancePanel({
  selectedSubsidiaryId,
  activeBrandColor = '#ea580c',
}: HrPerformancePanelProps) {
  const [tab, setTab] = useState<'SCORECARDS' | 'PROBATION' | 'KPIS' | 'CYCLES' | 'EVALS'>('SCORECARDS');
  const [kpis, setKpis] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [pips, setPips] = useState<any[]>([]);
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [scorecards, setScorecards] = useState<StaffScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState<'KPI' | 'CYCLE' | 'EVAL' | 'PIP' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [kpiForm, setKpiForm] = useState({ title: '', targetMetric: '', weightPercent: '25', reviewPeriod: 'QUARTERLY', employeeId: '' });
  const [cycleForm, setCycleForm] = useState({ title: '', cycleType: 'QUARTERLY', startDate: '', endDate: '' });
  const [evalForm, setEvalForm] = useState({ cycleId: '', employeeId: '', overallScore: '85', reviewerSummary: '', pipRequired: false });
  const [pipForm, setPipForm] = useState({ employeeId: '', startDate: '', endDate: '', goalsSummary: '' });
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/performance${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setKpis(data.kpis || []);
        setCycles(data.cycles || []);
        setEvaluations(data.evaluations || []);
        setPips(data.pips || []);
        setStaffOptions(data.staffOptions || []);
        setScorecards(data.staffScorecards || []);
      }
    } catch {
      setBanner({ type: 'err', text: 'Failed to load performance workspace.' });
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submit = async (payload: Record<string, unknown>, successMsg = 'Performance record saved.') => {
    setSubmitting(true);
    setBanner(null);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/performance${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: 'err', text: data.error || 'Action failed.' });
      } else {
        setBanner({ type: 'ok', text: successMsg });
        setShowModal(null);
        await loadData();
      }
    } catch {
      setBanner({ type: 'err', text: 'Network error saving performance record.' });
    } finally {
      setSubmitting(false);
    }
  };

  const avgReadiness = useMemo(() => {
    if (!scorecards.length) return 0;
    return Math.round(scorecards.reduce((acc, s) => acc + s.compositeScore, 0) / scorecards.length);
  }, [scorecards]);

  const probationStaff = useMemo(() => {
    return scorecards.filter((s) => s.probationStatus !== 'CONFIRMED');
  }, [scorecards]);

  const filteredScorecards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scorecards.filter((s) => {
      if (!q) return true;
      return (
        s.legalName.toLowerCase().includes(q) ||
        s.employeeNumber.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.subsidiary.toLowerCase().includes(q)
      );
    });
  }, [scorecards, searchQuery]);

  const totalKpiWeight = kpis.reduce((acc, k) => acc + Number(k.weightPercent || 0), 0);

  const exportCsv = () => {
    const rows = [
      ['Staff ID', 'Employee', 'Subsidiary', 'Department', 'Punctuality %', 'Training %', 'Open Queries', 'Composite Score %', 'Probation Status'],
      ...filteredScorecards.map((s) => [
        s.employeeNumber,
        s.legalName,
        s.subsidiary,
        s.department,
        String(s.punctualityPct),
        String(s.trainingPct),
        String(s.openDisciplinary),
        String(s.compositeScore),
        s.probationStatus,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bems_workforce_performance_scorecards.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium flex items-center justify-between ${
            banner.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <span>{banner.text}</span>
          <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-2 border-t-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workforce Readiness</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{avgReadiness}%</div>
          <p className="mt-1 text-xs text-slate-500">Live composite across {scorecards.length} staff</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-2 border-t-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Probation Watch</span>
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{probationStaff.length}</div>
          <p className="mt-1 text-xs text-slate-500">Within 90-day confirmation window</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-2" style={{ borderTopColor: activeBrandColor }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Configured KPIs</span>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${activeBrandColor}15`, color: activeBrandColor }}>
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{kpis.length}</div>
          <p className="mt-1 text-xs text-slate-500">Total weight: {totalKpiWeight}%</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-2 border-t-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Appraisals &amp; PIPs</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {evaluations.length} / {pips.filter((p) => p.status === 'ACTIVE').length}
          </div>
          <p className="mt-1 text-xs text-slate-500">{cycles.length} review cycles configured</p>
        </div>
      </div>

      {/* Underline Sub-Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 overflow-x-auto">
            {[
              { id: 'SCORECARDS', label: 'Live Staff Scorecards', count: scorecards.length },
              { id: 'PROBATION', label: 'Probation & Confirmation', count: probationStaff.length },
              { id: 'KPIS', label: 'KPI Library', count: kpis.length },
              { id: 'CYCLES', label: 'Review Cycles', count: cycles.length },
              { id: 'EVALS', label: 'Evaluations & PIPs', count: evaluations.length + pips.length },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                    active ? 'text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                  style={active ? { borderColor: activeBrandColor, color: activeBrandColor } : undefined}
                >
                  <span>{t.label}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pb-2">
            {kpis.length === 0 && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit({ action: 'SEED_STANDARD_KPIS' }, '4 BEMS Enterprise KPIs seeded.')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Seed Standard KPIs
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setShowModal(tab === 'CYCLES' ? 'CYCLE' : tab === 'EVALS' ? 'EVAL' : 'KPI')
              }
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
              style={{ backgroundColor: activeBrandColor }}
            >
              <Plus className="h-3.5 w-3.5" />
              {tab === 'CYCLES' ? 'New Review Cycle' : tab === 'EVALS' ? 'Log Evaluation' : 'Add KPI'}
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm min-w-[240px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search staff, ID, or department..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowModal('PIP')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Start PIP
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Computing live staff performance scorecards...
        </div>
      ) : tab === 'SCORECARDS' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Subsidiary &amp; Dept</th>
                  <th className="px-4 py-3">Punctuality</th>
                  <th className="px-4 py-3">Training</th>
                  <th className="px-4 py-3">Standing</th>
                  <th className="px-4 py-3">Composite Score</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredScorecards.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No active staff matched your search.
                    </td>
                  </tr>
                ) : (
                  filteredScorecards.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{s.legalName}</div>
                        <div className="text-xs text-slate-500">{s.employeeNumber} · {s.jobTitle}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-800">{s.subsidiary}</div>
                        <div className="text-xs text-slate-500">{s.department}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                        {s.punctualityPct}% <span className="text-slate-400">({s.totalPunches} logs)</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                        {s.trainingPct}% <span className="text-slate-400">({s.completedTrainings}/{s.totalTrainings})</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                            s.openDisciplinary === 0
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {s.openDisciplinary === 0 ? 'Clean Record' : `${s.openDisciplinary} Open Query`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${s.compositeScore}%`,
                                backgroundColor: s.compositeScore >= 85 ? '#10b981' : s.compositeScore >= 65 ? activeBrandColor : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-900">{s.compositeScore}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEvalForm((p) => ({
                              ...p,
                              employeeId: s.id,
                              overallScore: String(s.compositeScore),
                            }));
                            setShowModal('EVAL');
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Evaluate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'PROBATION' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Resumption Date</th>
                  <th className="px-4 py-3">Tenure</th>
                  <th className="px-4 py-3">Confirmation Window</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {probationStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                      <div className="text-sm font-semibold text-slate-700">All active staff have completed their 90-day probation window</div>
                    </td>
                  </tr>
                ) : (
                  probationStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{s.legalName}</div>
                        <div className="text-xs text-slate-500">{s.employeeNumber} · {s.department}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {s.resumptionDate ? new Date(s.resumptionDate).toLocaleDateString() : 'Not set'}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{s.daysSinceResumption} days</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            s.probationStatus === 'DUE_CONFIRMATION'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {s.probationDaysLeft} days to confirmation
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setEvalForm((p) => ({
                              ...p,
                              employeeId: s.id,
                              overallScore: String(s.compositeScore),
                              reviewerSummary: '90-Day Probation Confirmation Review',
                            }));
                            setShowModal('EVAL');
                          }}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
                          style={{ backgroundColor: activeBrandColor }}
                        >
                          Confirm / Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'KPIS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kpis.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Target className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700">No KPIs configured yet</div>
              <p className="text-xs text-slate-500 mt-1 mb-4">Seed the 4 standard BEMS Enterprise KPIs in one click or add custom metrics.</p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submit({ action: 'SEED_STANDARD_KPIS' }, '4 BEMS Enterprise KPIs seeded.')}
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                style={{ backgroundColor: activeBrandColor }}
              >
                <Sparkles className="h-3.5 w-3.5" /> Seed 4 Standard BEMS KPIs
              </button>
            </div>
          ) : (
            kpis.map((k) => (
              <div key={k.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                    {k.reviewPeriod}
                  </span>
                  <h3 className="mt-2 text-base font-bold text-slate-900">{k.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">Target: {k.targetMetric}</p>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                  {k.weightPercent}% Weight
                </span>
              </div>
            ))
          )}
        </div>
      ) : tab === 'CYCLES' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cycles.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <CalendarRange className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-700">No review cycles created yet</div>
            </div>
          ) : (
            cycles.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{c.cycleType} · {c.startDate} → {c.endDate}</p>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {c.status}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 text-xs font-bold uppercase text-slate-600">
              Logged Staff Evaluations ({evaluations.length})
            </div>
            <div className="divide-y divide-slate-100">
              {evaluations.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No formal evaluations logged yet.</div>
              ) : (
                evaluations.map((e) => (
                  <div key={e.id} className="p-4 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">{e.employee?.legalName}</div>
                      <div className="text-xs text-slate-500">{e.cycle?.title || 'Ad-hoc Review'} · {e.reviewerSummary || 'Completed'}</div>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-700">
                      {e.overallScore}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 text-xs font-bold uppercase text-slate-600">
              Performance Improvement Plans ({pips.length})
            </div>
            <div className="divide-y divide-slate-100">
              {pips.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No active PIPs.</div>
              ) : (
                pips.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">{p.employee?.legalName}</div>
                      <div className="text-xs text-slate-500">{p.startDate} → {p.endDate} · {p.goalsSummary}</div>
                    </div>
                    <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      {p.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {showModal === 'KPI'
                  ? 'Add Enterprise KPI'
                  : showModal === 'CYCLE'
                    ? 'Create Review Cycle'
                    : showModal === 'EVAL'
                      ? 'Log Staff Evaluation'
                      : 'Start Performance Improvement Plan'}
              </h3>
              <button onClick={() => setShowModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {showModal === 'KPI' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit({ action: 'CREATE_KPI', ...kpiForm });
                }}
                className="space-y-3"
              >
                <input required placeholder="KPI Title" value={kpiForm.title} onChange={(e) => setKpiForm({ ...kpiForm, title: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input required placeholder="Target Metric (e.g. ≥ 95% SLA)" value={kpiForm.targetMetric} onChange={(e) => setKpiForm({ ...kpiForm, targetMetric: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" min={1} max={100} placeholder="Weight %" value={kpiForm.weightPercent} onChange={(e) => setKpiForm({ ...kpiForm, weightPercent: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <select value={kpiForm.reviewPeriod} onChange={(e) => setKpiForm({ ...kpiForm, reviewPeriod: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="MONTHLY">MONTHLY</option>
                    <option value="QUARTERLY">QUARTERLY</option>
                    <option value="ANNUAL">ANNUAL</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-xl px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: activeBrandColor }}>Save KPI</button>
                </div>
              </form>
            )}

            {showModal === 'CYCLE' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit({ action: 'CREATE_CYCLE', ...cycleForm });
                }}
                className="space-y-3"
              >
                <input required placeholder="Cycle Title (e.g. Q4 2026 Appraisal)" value={cycleForm.title} onChange={(e) => setCycleForm({ ...cycleForm, title: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input required type="date" value={cycleForm.startDate} onChange={(e) => setCycleForm({ ...cycleForm, startDate: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input required type="date" value={cycleForm.endDate} onChange={(e) => setCycleForm({ ...cycleForm, endDate: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-xl px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: activeBrandColor }}>Create Cycle</button>
                </div>
              </form>
            )}

            {showModal === 'EVAL' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit({ action: 'SUBMIT_EVALUATION', ...evalForm });
                }}
                className="space-y-3"
              >
                <select required value={evalForm.cycleId} onChange={(e) => setEvalForm({ ...evalForm, cycleId: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Select Review Cycle...</option>
                  {cycles.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <select required value={evalForm.employeeId} onChange={(e) => setEvalForm({ ...evalForm, employeeId: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Select Employee...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
                </select>
                <input required type="number" min={0} max={100} placeholder="Overall Score %" value={evalForm.overallScore} onChange={(e) => setEvalForm({ ...evalForm, overallScore: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <textarea rows={3} placeholder="Reviewer Summary..." value={evalForm.reviewerSummary} onChange={(e) => setEvalForm({ ...evalForm, reviewerSummary: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-xl px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: activeBrandColor }}>Submit Evaluation</button>
                </div>
              </form>
            )}

            {showModal === 'PIP' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit({ action: 'CREATE_PIP', ...pipForm });
                }}
                className="space-y-3"
              >
                <select required value={pipForm.employeeId} onChange={(e) => setPipForm({ ...pipForm, employeeId: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Select Employee...</option>
                  {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.legalName}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input required type="date" value={pipForm.startDate} onChange={(e) => setPipForm({ ...pipForm, startDate: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <input required type="date" value={pipForm.endDate} onChange={(e) => setPipForm({ ...pipForm, endDate: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <textarea required rows={3} placeholder="Improvement goals & milestones..." value={pipForm.goalsSummary} onChange={(e) => setPipForm({ ...pipForm, goalsSummary: e.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={submitting} className="rounded-xl px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: activeBrandColor }}>Start PIP</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
