'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Info,
  DollarSign,
  Calendar,
  MessageSquare,
  CheckSquare,
  Megaphone,
  Search,
  Filter,
  Check,
  ExternalLink,
  Settings,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  FileQuestion,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { formatDateTime } from '@/lib/formatters';

interface NotificationItem {
  id: string;
  category: string;
  priority: string;
  kind: string;
  title: string;
  body: string;
  metadata?: any;
  actionLabel?: string | null;
  actionUrl?: string | null;
  linkUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  subsidiary?: {
    id: string;
    legalName: string;
    code: string;
    brandColor?: string;
  } | null;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Notifications', icon: Bell },
  { id: 'ATTENDANCE', label: 'Attendance', icon: Clock },
  { id: 'PAYROLL_DEDUCTIONS', label: 'Payroll & Deductions', icon: DollarSign },
  { id: 'REQUESTS_APPROVALS', label: 'Requests & Approvals', icon: CheckCircle2 },
  { id: 'LEAVE', label: 'Leave', icon: Calendar },
  { id: 'TASKS', label: 'Tasks', icon: CheckSquare },
  { id: 'ANNOUNCEMENTS', label: 'Announcements', icon: Megaphone },
  { id: 'SECURITY', label: 'Security', icon: ShieldAlert },
];

export default function NotificationCentrePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-400">Loading Notification Centre...</div>}>
      <NotificationCentreContent />
    </Suspense>
  );
}

function NotificationCentreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeCategory, setActiveCategory] = useState(searchParams?.get('category') || 'ALL');
  const [activePriority, setActivePriority] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNREAD' | 'READ'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Preferences modal
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [preferences, setPreferences] = useState<any>({
    attendanceAlerts: true,
    taskAlerts: true,
    messageAlerts: true,
    announcementAlerts: true,
    leaveAlerts: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState('');

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams();
      if (activeCategory !== 'ALL') params.set('category', activeCategory);
      if (activePriority !== 'ALL') params.set('priority', activePriority);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        if (data.preferences) setPreferences(data.preferences);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, activePriority, statusFilter, searchQuery, page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifications(prev =>
        prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);

      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSavingPrefs(true);
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      if (res.ok) {
        setPrefsNotice('Preferences saved successfully!');
        setTimeout(() => setPrefsNotice(''), 3000);
      }
    } catch (err) {
      console.error('Save preferences error:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            Critical Alert
          </span>
        );
      case 'IMPORTANT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Info
          </span>
        );
    }
  };

  const getCategoryMeta = (category: string) => {
    switch (category) {
      case 'ATTENDANCE':
        return { label: 'Attendance', color: 'text-indigo-600 bg-indigo-50 border-indigo-200', icon: Clock };
      case 'PAYROLL_DEDUCTIONS':
        return { label: 'Payroll & Salary', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: DollarSign };
      case 'REQUESTS_APPROVALS':
        return { label: 'Requisition', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: CheckCircle2 };
      case 'LEAVE':
        return { label: 'Leave', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Calendar };
      case 'TASKS':
        return { label: 'Task', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: CheckSquare };
      case 'ANNOUNCEMENTS':
        return { label: 'Announcement', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: Megaphone };
      case 'SECURITY':
        return { label: 'Security', color: 'text-rose-700 bg-rose-50 border-rose-200', icon: ShieldAlert };
      default:
        return { label: 'General', color: 'text-slate-600 bg-slate-50 border-slate-200', icon: Bell };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C] shadow-sm">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Notification Centre</h1>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-extrabold bg-[#EA580C] text-white rounded-full shadow-sm">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Centralized event stream for attendance, payroll deductions, approvals, and announcements.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchNotifications(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg hover:bg-emerald-100 transition shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}

              <Link
                href="/disputes"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition shadow-sm"
              >
                <FileQuestion className="w-3.5 h-3.5" />
                Staff Disputes
              </Link>

              <button
                onClick={() => setIsPreferencesOpen(true)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                title="Notification Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pt-4 border-t border-slate-100 mt-3 no-scrollbar">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Search & Sub-filters Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notifications, reasons..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white text-slate-900 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto justify-end">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority:</span>
            {['ALL', 'CRITICAL', 'IMPORTANT', 'INFORMATIONAL'].map(p => (
              <button
                key={p}
                onClick={() => {
                  setActivePriority(p);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                  activePriority === p
                    ? 'bg-orange-50 text-[#EA580C] border-orange-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p === 'ALL' ? 'All' : p.charAt(0) + p.slice(1).toLowerCase()}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            {['ALL', 'UNREAD', 'READ'].map(s => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s as any);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition ${
                  statusFilter === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'UNREAD' ? 'Unread' : 'Read'}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-white rounded-xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 mb-1">You are all caught up!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              {searchQuery || activeCategory !== 'ALL' || activePriority !== 'ALL'
                ? 'No notifications match your current filter parameters. Try clearing the search or category filters.'
                : 'No active notifications require your attention. Any new attendance flags, salary deductions, or approvals will appear here.'}
            </p>
            {(searchQuery || activeCategory !== 'ALL' || activePriority !== 'ALL') && (
              <button
                onClick={() => {
                  setActiveCategory('ALL');
                  setActivePriority('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                  setPage(1);
                }}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(item => {
              const catMeta = getCategoryMeta(item.category);
              const CatIcon = catMeta.icon;
              const isUnread = !item.readAt;

              return (
                <div
                  key={item.id}
                  className={`group relative bg-white rounded-xl border p-4 sm:p-5 transition-all shadow-sm hover:shadow-md ${
                    isUnread
                      ? 'border-orange-300 ring-1 ring-orange-200/50 bg-gradient-to-r from-orange-50/20 via-white to-white'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Icon + Category & Subsidiary Badges */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${catMeta.color}`}
                      >
                        <CatIcon className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {/* Subsidiary Badge */}
                          {item.subsidiary && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                              {item.subsidiary.code || item.subsidiary.legalName}
                            </span>
                          )}

                          {/* Category Badge */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${catMeta.color}`}>
                            {catMeta.label}
                          </span>

                          {/* Priority Pill */}
                          {getPriorityBadge(item.priority)}

                          {/* Relative Time */}
                          <span className="text-[11px] text-slate-400 font-medium ml-auto sm:ml-0">
                            {formatDateTime(item.createdAt)}
                          </span>

                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-[#EA580C]" title="Unread" />
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-sm font-extrabold text-slate-900 leading-snug mb-1">
                          {item.title}
                        </h4>

                        {/* Body Text */}
                        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                          {item.body}
                        </p>

                        {/* Metadata Pills (if deduction or lateness) */}
                        {item.metadata && (item.metadata.grossMinor || item.metadata.minutesLate) && (
                          <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-slate-100 text-[11px]">
                            {item.metadata.minutesLate > 0 && (
                              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Late Arrival: {item.metadata.minutesLate} mins
                              </span>
                            )}
                            {item.metadata.deductionPercent > 0 && (
                              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Penalty Rate: {item.metadata.deductionPercent}%
                              </span>
                            )}
                            {item.metadata.deductionMinor && (
                              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                Deducted: ₦{(Number(item.metadata.deductionMinor) / 100).toLocaleString('en-NG')}
                              </span>
                            )}
                            {item.metadata.netMinor && (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Updated Net: ₦{(Number(item.metadata.netMinor) / 100).toLocaleString('en-NG')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                      {item.actionLabel && (item.actionUrl || item.linkUrl) && (
                        <Link
                          href={item.actionUrl || item.linkUrl || '#'}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition shadow-sm ${
                            item.actionLabel.toLowerCase().includes('dispute')
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          {item.actionLabel}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}

                      {isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(item.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-6">
            <span className="text-xs text-slate-500 font-medium">
              Page {page} of {totalPages} ({totalCount} total notifications)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Preferences Modal */}
      {isPreferencesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C]">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Notification Preferences</h3>
                  <p className="text-xs text-slate-500">Customize which non-essential alerts you receive.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPreferencesOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {prefsNotice && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                {prefsNotice}
              </div>
            )}

            <div className="space-y-3 mb-6">
              {/* Mandatory Notice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-extrabold text-slate-900 block mb-0.5">Mandatory Corporate Policies:</span>
                Salary deductions, requisition approvals, and security alerts are locked <strong>ON</strong> by company policy to protect financial transparency.
              </div>

              {/* Attendance */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Attendance Confirmations</span>
                  <span className="text-[11px] text-slate-500">Receive punch-in and clock-out confirmations</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.attendanceAlerts}
                  onChange={e => setPreferences((p: any) => ({ ...p, attendanceAlerts: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </label>

              {/* Tasks */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Task Assignments</span>
                  <span className="text-[11px] text-slate-500">Notifications when follow-up tasks are assigned or due</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.taskAlerts}
                  onChange={e => setPreferences((p: any) => ({ ...p, taskAlerts: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </label>

              {/* Messages */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Internal Chat & Mentions</span>
                  <span className="text-[11px] text-slate-500">Direct team messages and request clarification alerts</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.messageAlerts}
                  onChange={e => setPreferences((p: any) => ({ ...p, messageAlerts: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </label>

              {/* Announcements */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Company Announcements</span>
                  <span className="text-[11px] text-slate-500">Broadcast news, holiday schedules, and general updates</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.announcementAlerts}
                  onChange={e => setPreferences((p: any) => ({ ...p, announcementAlerts: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </label>

              {/* Leave */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Leave & Resumption Reminders</span>
                  <span className="text-[11px] text-slate-500">Reminders prior to approved leave and resumption dates</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.leaveAlerts}
                  onChange={e => setPreferences((p: any) => ({ ...p, leaveAlerts: e.target.checked }))}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsPreferencesOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              >
                Close
              </button>
              <button
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="px-5 py-2 text-xs font-bold bg-[#EA580C] text-white rounded-lg hover:bg-orange-600 transition shadow-sm disabled:opacity-50"
              >
                {savingPrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
