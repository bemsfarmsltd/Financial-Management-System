'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Users,
  GraduationCap,
  Award,
  Plus,
  Search,
  Download,
  RefreshCw,
  CheckCircle2,
  X,
  ArrowRight,
  Building2,
  Mail,
  UserPlus,
  BookOpen,
} from 'lucide-react';

interface HrRecruitmentPanelProps {
  selectedSubsidiaryId: string;
  activeBrandColor: string;
}

interface VacancyApplicant {
  id: string;
  vacancyId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  stage: string;
  rating?: number | null;
  notes?: string | null;
  appliedAt: string;
}

interface Vacancy {
  id: string;
  title: string;
  department: string;
  employmentType: string;
  location?: string | null;
  salaryBand?: string | null;
  headcount: number;
  status: string;
  subsidiaryId?: string | null;
  subsidiary?: { name: string; code?: string } | null;
  applicants?: VacancyApplicant[];
  createdAt: string;
}

interface TrainingCourse {
  id: string;
  title: string;
  category: string;
  provider?: string | null;
  durationHours?: number | null;
  isMandatory: boolean;
  description?: string | null;
  _count?: { assignments: number };
}

interface TrainingAssignment {
  id: string;
  courseId: string;
  employeeId: string;
  status: string;
  dueDate?: string | null;
  completedAt?: string | null;
  score?: number | null;
  course?: { title: string; category: string; isMandatory?: boolean };
  employee?: {
    id: string;
    fullName: string;
    staffCode?: string | null;
    department?: string | null;
    subsidiary?: { name: string } | null;
  };
}

interface StaffOption {
  id: string;
  fullName: string;
  staffCode?: string | null;
  department?: string | null;
  subsidiary?: string | null;
  jobTitle?: string | null;
  approvalStatus?: string | null;
  resumptionDate?: string | null;
  assignedCount?: number;
  completedCount?: number;
}

const ATS_STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] as const;

export default function HrRecruitmentPanel({
  selectedSubsidiaryId,
  activeBrandColor,
}: HrRecruitmentPanelProps) {
  const [subTab, setSubTab] = useState<'readiness' | 'vacancies' | 'candidates' | 'courses' | 'assignments'>('readiness');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [assignments, setAssignments] = useState<TrainingAssignment[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [vacancyForm, setVacancyForm] = useState({
    title: '',
    department: 'General Operations',
    employmentType: 'FULL_TIME',
    location: 'Benin City / Hybrid',
    salaryBand: '',
    headcount: 1,
  });

  const [applicantForm, setApplicantForm] = useState({
    vacancyId: '',
    fullName: '',
    email: '',
    phone: '',
    notes: '',
  });

  const [courseForm, setCourseForm] = useState({
    title: '',
    category: 'Compliance & Governance',
    provider: 'BEMS Academy',
    durationHours: 4,
    isMandatory: false,
    description: '',
  });

  const [assignForm, setAssignForm] = useState({
    courseId: '',
    employeeId: '',
    dueDate: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = selectedSubsidiaryId ? `?subsidiaryId=${encodeURIComponent(selectedSubsidiaryId)}` : '';
      const res = await fetch(`/api/hr/recruitment${qs}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load recruitment & L&D data');
      setVacancies(Array.isArray(data.vacancies) ? data.vacancies : []);
      setCourses(Array.isArray(data.courses) ? data.courses : []);
      setAssignments(Array.isArray(data.assignments) ? data.assignments : []);
      setStaffOptions(Array.isArray(data.staffOptions) ? data.staffOptions : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load recruitment data');
    } finally {
      setLoading(false);
    }
  }, [selectedSubsidiaryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const allApplicants = useMemo(() => {
    return vacancies.flatMap((v) =>
      (v.applicants || []).map((a) => ({
        ...a,
        vacancyTitle: v.title,
        vacancyDepartment: v.department,
      }))
    );
  }, [vacancies]);

  const metrics = useMemo(() => {
    const openVacancies = vacancies.filter((v) => v.status === 'OPEN').length;
    const activeCandidates = allApplicants.filter((a) => !['HIRED', 'REJECTED'].includes(a.stage)).length;
    const totalCourses = courses.length;
    const completedAssignments = assignments.filter((a) => a.status === 'COMPLETED').length;
    const completionRate = assignments.length > 0 ? Math.round((completedAssignments / assignments.length) * 100) : 0;
    return { openVacancies, activeCandidates, totalCourses, completionRate, completedAssignments };
  }, [vacancies, allApplicants, courses, assignments]);

  const filteredVacancies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vacancies.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        (v.subsidiary?.name || '').toLowerCase().includes(q)
      );
    });
  }, [vacancies, searchQuery, statusFilter]);

  const filteredApplicants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allApplicants.filter((a) => {
      if (stageFilter !== 'ALL' && a.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.vacancyTitle.toLowerCase().includes(q)
      );
    });
  }, [allApplicants, searchQuery, stageFilter]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        (c.provider || '').toLowerCase().includes(q)
      );
    });
  }, [courses, searchQuery]);

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assignments.filter((a) => {
      if (statusFilter !== 'ALL' && a.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (a.employee?.fullName || '').toLowerCase().includes(q) ||
        (a.course?.title || '').toLowerCase().includes(q)
      );
    });
  }, [assignments, searchQuery, statusFilter]);

  const handleAction = async (payload: Record<string, unknown>, successMessage: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/recruitment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          subsidiaryId: selectedSubsidiaryId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Action failed');
      showNotice(successMessage);
      await fetchData();
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateVacancy = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleAction(
      {
        action: 'CREATE_VACANCY',
        ...vacancyForm,
        headcount: Number(vacancyForm.headcount) || 1,
      },
      'Job vacancy published to ATS pipeline.'
    );
    if (ok) {
      setShowVacancyModal(false);
      setVacancyForm({
        title: '',
        department: 'General Operations',
        employmentType: 'FULL_TIME',
        location: 'Benin City / Hybrid',
        salaryBand: '',
        headcount: 1,
      });
    }
  };

  const handleAddApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleAction(
      { action: 'ADD_APPLICANT', ...applicantForm },
      'Candidate added to vacancy pipeline.'
    );
    if (ok) {
      setShowApplicantModal(false);
      setApplicantForm({ vacancyId: '', fullName: '', email: '', phone: '', notes: '' });
    }
  };

  const handleAdvanceApplicant = async (applicantId: string, nextStage: string) => {
    await handleAction(
      { action: 'ADVANCE_APPLICANT', applicantId, stage: nextStage },
      nextStage === 'HIRED'
        ? 'Candidate marked HIRED and staged in Pending Onboarding.'
        : `Candidate moved to ${nextStage}.`
    );
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleAction(
      {
        action: 'CREATE_COURSE',
        ...courseForm,
        durationHours: Number(courseForm.durationHours) || 1,
      },
      'Training course added to L&D catalog.'
    );
    if (ok) {
      setShowCourseModal(false);
      setCourseForm({
        title: '',
        category: 'Compliance & Governance',
        provider: 'BEMS Academy',
        durationHours: 4,
        isMandatory: false,
        description: '',
      });
    }
  };

  const handleAssignTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await handleAction(
      { action: 'ASSIGN_TRAINING', ...assignForm },
      'Training assigned to employee.'
    );
    if (ok) {
      setShowAssignModal(false);
      setAssignForm({ courseId: '', employeeId: '', dueDate: '' });
    }
  };

  const exportCsv = () => {
    let rows: string[][] = [];
    let filename = 'hr_recruitment.csv';
    if (subTab === 'vacancies') {
      filename = 'hr_vacancies.csv';
      rows = [
        ['Title', 'Department', 'Type', 'Headcount', 'Applicants', 'Status'],
        ...filteredVacancies.map((v) => [
          v.title,
          v.department,
          v.employmentType,
          String(v.headcount),
          String(v.applicants?.length || 0),
          v.status,
        ]),
      ];
    } else if (subTab === 'candidates') {
      filename = 'hr_candidates.csv';
      rows = [
        ['Candidate', 'Email', 'Vacancy', 'Stage', 'Applied'],
        ...filteredApplicants.map((a) => [
          a.fullName,
          a.email,
          a.vacancyTitle,
          a.stage,
          new Date(a.appliedAt).toLocaleDateString(),
        ]),
      ];
    } else if (subTab === 'courses') {
      filename = 'hr_training_courses.csv';
      rows = [
        ['Title', 'Category', 'Provider', 'Hours', 'Mandatory', 'Enrolled'],
        ...filteredCourses.map((c) => [
          c.title,
          c.category,
          c.provider || '',
          String(c.durationHours || 0),
          c.isMandatory ? 'Yes' : 'No',
          String(c._count?.assignments || 0),
        ]),
      ];
    } else {
      filename = 'hr_training_assignments.csv';
      rows = [
        ['Employee', 'Course', 'Status', 'Due Date', 'Completed At'],
        ...filteredAssignments.map((a) => [
          a.employee?.fullName || '',
          a.course?.title || '',
          a.status,
          a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '',
          a.completedAt ? new Date(a.completedAt).toLocaleDateString() : '',
        ]),
      ];
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'HIRED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OFFER':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'INTERVIEW':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'SCREENING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {toast}
          </span>
          <button onClick={() => setToast(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Vacancies</span>
            <Briefcase className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.openVacancies}</div>
          <p className="mt-1 text-xs text-slate-500">{vacancies.length} total requisitions tracked</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Candidates</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.activeCandidates}</div>
          <p className="mt-1 text-xs text-slate-500">{allApplicants.length} total applicants in ATS</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Training Courses</span>
            <GraduationCap className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalCourses}</div>
          <p className="mt-1 text-xs text-slate-500">{assignments.length} active staff enrollments</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completion Rate</span>
            <Award className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.completionRate}%</div>
          <p className="mt-1 text-xs text-slate-500">{metrics.completedAssignments} certifications completed</p>
        </div>
      </div>

      {/* Underline Sub-Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-t-2xl px-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6 overflow-x-auto">
            {[
              { id: 'readiness', label: 'Staff Onboarding & Training Matrix', count: staffOptions.length },
              { id: 'vacancies', label: 'Vacancies & ATS Pipeline', count: vacancies.length },
              { id: 'candidates', label: 'Candidate Tracker', count: allApplicants.length },
              { id: 'courses', label: 'Training Courses', count: courses.length },
              { id: 'assignments', label: 'Enrollments & Certifications', count: assignments.length },
            ].map((t) => {
              const active = subTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSubTab(t.id as typeof subTab);
                    setStageFilter('ALL');
                    setStatusFilter('ALL');
                  }}
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
            <button
              onClick={() => {
                if (vacancies.length > 0 && !applicantForm.vacancyId) {
                  setApplicantForm((p) => ({ ...p, vacancyId: vacancies[0].id }));
                }
                setShowApplicantModal(true);
              }}
              disabled={vacancies.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add Candidate
            </button>
            <button
              onClick={() => setShowVacancyModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95"
              style={{ backgroundColor: activeBrandColor }}
            >
              <Plus className="h-3.5 w-3.5" /> New Vacancy
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Export Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${subTab}...`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            />
          </div>

          {subTab === 'vacancies' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="PAUSED">Paused</option>
              <option value="CLOSED">Closed</option>
            </select>
          )}

          {subTab === 'candidates' && (
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="ALL">All ATS Stages</option>
              {ATS_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}

          {subTab === 'assignments' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Progress</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'courses' && (
            <button
              onClick={() => setShowCourseModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <BookOpen className="h-3.5 w-3.5" /> New Course
            </button>
          )}
          {subTab === 'assignments' && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Assign Training
            </button>
          )}
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          Loading Recruitment & Learning Management telemetry...
        </div>
      ) : subTab === 'vacancies' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredVacancies.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No job vacancies found</p>
              <p className="text-xs text-slate-500 mt-1">Create a vacancy requisition to begin tracking candidates.</p>
            </div>
          ) : (
            filteredVacancies.map((v) => {
              const count = v.applicants?.length || 0;
              const hired = (v.applicants || []).filter((a) => a.stage === 'HIRED').length;
              return (
                <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{v.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {v.department} · {v.employmentType.replace('_', ' ')}
                          {v.subsidiary?.name ? ` · ${v.subsidiary.name}` : ''}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          v.status === 'OPEN'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {v.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                      <div>
                        <div className="text-xs text-slate-500">Headcount</div>
                        <div className="text-sm font-bold text-slate-900">{v.headcount}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Applicants</div>
                        <div className="text-sm font-bold text-slate-900">{count}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Hired</div>
                        <div className="text-sm font-bold text-emerald-700">{hired}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500">{v.location || 'Standard Site'} {v.salaryBand ? `· ${v.salaryBand}` : ''}</span>
                    <button
                      onClick={() => {
                        setApplicantForm((p) => ({ ...p, vacancyId: v.id }));
                        setShowApplicantModal(true);
                      }}
                      className="font-semibold hover:underline flex items-center gap-1"
                      style={{ color: activeBrandColor }}
                    >
                      Add Candidate <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : subTab === 'candidates' ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Vacancy</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Applied</th>
                  <th className="px-4 py-3 text-right">Advance Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplicants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No candidates match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredApplicants.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{a.fullName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {a.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{a.vacancyTitle}</div>
                        <div className="text-xs text-slate-500">{a.vacancyDepartment}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStageBadge(a.stage)}`}>
                          {a.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(a.appliedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          value={a.stage}
                          disabled={submitting || a.stage === 'HIRED'}
                          onChange={(e) => handleAdvanceApplicant(a.id, e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {ATS_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : subTab === 'courses' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No training courses in catalog</p>
              <p className="text-xs text-slate-500 mt-1">Create a course to start assigning mandatory or optional staff training.</p>
            </div>
          ) : (
            filteredCourses.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {c.category}
                    </span>
                    {c.isMandatory && (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Mandatory
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-900">{c.title}</h3>
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">{c.description || 'Enterprise workforce development module.'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{c.provider || 'BEMS Academy'} · {c.durationHours || 1}h</span>
                  <button
                    onClick={() => {
                      setAssignForm((p) => ({ ...p, courseId: c.id }));
                      setShowAssignModal(true);
                    }}
                    className="font-semibold hover:underline"
                    style={{ color: activeBrandColor }}
                  >
                    Assign ({c._count?.assignments || 0})
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : subTab === 'readiness' ? (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Workforce Onboarding &amp; Training Readiness</h3>
              <p className="text-xs text-slate-500">
                Live onboarding status and training completion across all active staff.
              </p>
            </div>
            {courses.length === 0 && (
              <button
                onClick={() => handleAction({ action: 'SEED_STANDARD_COURSES' }, '4 standard BEMS compliance courses seeded.')}
                disabled={submitting}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                + Seed 4 Standard Courses
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Subsidiary &amp; Dept</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Onboarding Status</th>
                  <th className="px-4 py-3">Training Progress</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffOptions
                  .filter((s) => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      s.fullName.toLowerCase().includes(q) ||
                      (s.staffCode || '').toLowerCase().includes(q) ||
                      (s.department || '').toLowerCase().includes(q) ||
                      (s.subsidiary || '').toLowerCase().includes(q)
                    );
                  })
                  .map((s) => {
                    const assigned = s.assignedCount ?? 0;
                    const completed = s.completedCount ?? 0;
                    const pct = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{s.fullName}</div>
                          <div className="text-xs text-slate-500">{s.staffCode || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">{s.subsidiary || 'BEMS Group'}</div>
                          <div className="text-xs text-slate-500">{s.department || 'General'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{s.jobTitle || 'Staff'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              s.approvalStatus === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {s.approvalStatus || 'APPROVED'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">
                              {completed}/{assigned} ({pct}%)
                            </span>
                            <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setAssignForm((p) => ({
                                ...p,
                                employeeId: s.id,
                                courseId: p.courseId || courses[0]?.id || '',
                              }));
                              setShowAssignModal(true);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Assign Course
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Training Course</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No training assignments recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{a.employee?.fullName || 'Staff'}</div>
                        <div className="text-xs text-slate-500">
                          {a.employee?.staffCode || ''} {a.employee?.department ? `· ${a.employee.department}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{a.course?.title || 'Course'}</div>
                        <div className="text-xs text-slate-500">{a.course?.category || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'Flexible'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            a.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status !== 'COMPLETED' ? (
                          <button
                            disabled={submitting}
                            onClick={() =>
                              handleAction(
                                { action: 'COMPLETE_TRAINING', assignmentId: a.id, score: 100 },
                                'Training marked as completed.'
                              )
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Mark Completed
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">
                            Certified {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Vacancy Modal */}
      {showVacancyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Create Job Vacancy</h3>
              <button onClick={() => setShowVacancyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateVacancy} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Title</label>
                <input
                  required
                  type="text"
                  value={vacancyForm.title}
                  onChange={(e) => setVacancyForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Senior Backend Engineer"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    required
                    type="text"
                    value={vacancyForm.department}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, department: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={vacancyForm.employmentType}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, employmentType: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern / NYSC</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={vacancyForm.location}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, location: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Open Headcount</label>
                  <input
                    type="number"
                    min={1}
                    value={vacancyForm.headcount}
                    onChange={(e) => setVacancyForm((p) => ({ ...p, headcount: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Salary Band (Optional)</label>
                <input
                  type="text"
                  value={vacancyForm.salaryBand}
                  onChange={(e) => setVacancyForm((p) => ({ ...p, salaryBand: e.target.value }))}
                  placeholder="e.g. ₦350,000 - ₦500,000"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVacancyModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: activeBrandColor }}
                >
                  {submitting ? 'Publishing...' : 'Publish Vacancy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
      {showApplicantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add Candidate to ATS</h3>
              <button onClick={() => setShowApplicantModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddApplicant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vacancy</label>
                <select
                  required
                  value={applicantForm.vacancyId}
                  onChange={(e) => setApplicantForm((p) => ({ ...p, vacancyId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select vacancy...</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title} ({v.department})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={applicantForm.fullName}
                  onChange={(e) => setApplicantForm((p) => ({ ...p, fullName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={applicantForm.email}
                    onChange={(e) => setApplicantForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={applicantForm.phone}
                    onChange={(e) => setApplicantForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recruiter Notes</label>
                <textarea
                  rows={3}
                  value={applicantForm.notes}
                  onChange={(e) => setApplicantForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApplicantModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: activeBrandColor }}
                >
                  {submitting ? 'Saving...' : 'Add Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Create Training Course</h3>
              <button onClick={() => setShowCourseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course Title</label>
                <input
                  required
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Data Privacy & Financial Ethics"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    required
                    type="text"
                    value={courseForm.category}
                    onChange={(e) => setCourseForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={courseForm.durationHours}
                    onChange={(e) => setCourseForm((p) => ({ ...p, durationHours: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={courseForm.isMandatory}
                  onChange={(e) => setCourseForm((p) => ({ ...p, isMandatory: e.target.checked }))}
                />
                Mandatory for all active staff
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: activeBrandColor }}
                >
                  {submitting ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Training Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Assign Staff Training</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAssignTraining} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
                <select
                  required
                  value={assignForm.courseId}
                  onChange={(e) => setAssignForm((p) => ({ ...p, courseId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee</label>
                <select
                  required
                  value={assignForm.employeeId}
                  onChange={(e) => setAssignForm((p) => ({ ...p, employeeId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Select employee...</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} {s.staffCode ? `(${s.staffCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={assignForm.dueDate}
                  onChange={(e) => setAssignForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: activeBrandColor }}
                >
                  {submitting ? 'Assigning...' : 'Assign Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
