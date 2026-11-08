'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Zap, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { StaffDashboardClient } from './StaffDashboardClient';

interface StaffPortalContainerProps {
  user: any;
  businessName: string;
  subsidiaries?: any[];
  vendors?: any[];
  currentStaff?: any;
}

export function StaffPortalContainer({
  user,
  businessName,
  subsidiaries = [],
  vendors = [],
  currentStaff,
}: StaffPortalContainerProps) {
  // View Engine Mode: 'FLUTTER_NATIVE' (the exact mobile app) or 'WEB_TWIN' (the Next.js client)
  const [engineMode, setEngineMode] = useState<'FLUTTER_NATIVE' | 'WEB_TWIN'>('FLUTTER_NATIVE');
  
  // Desktop Frame Style for Flutter App: 'PHONE_FRAME' (centered mobile simulator) or 'FULL_SCREEN' (wide)
  const [desktopLayout, setDesktopLayout] = useState<'PHONE_FRAME' | 'FULL_SCREEN'>('PHONE_FRAME');
  
  const [iframeKey, setIframeKey] = useState<number>(Date.now());
  const [isLoadingEngine, setIsLoadingEngine] = useState(true);

  // Auto-seed session into Flutter's Web SharedPreferences (localStorage)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && user) {
        const flutterUserPayload = {
          id: user.id || '',
          fullName: user.fullName || '',
          email: user.email || '',
          phone: user.phone || '',
          employeeNumber: user.employeeNumber || '',
          role: user.role || 'STAFF',
          subsidiary: user.subsidiary || businessName || 'BEMS Group',
          department: user.department || 'General Operations',
          jobTitle: user.jobTitle || 'Staff Personnel',
          workLocation: user.workLocation || 'UMUAHIA_OPS_HUB',
          staffGrade: user.staffGrade || 'OFFICER',
          bankName: user.bankName || '',
          accountNumber: user.accountNumber || '',
          accountName: user.accountName || user.fullName || '',
          salaryBankName: user.salaryBankName || user.bankName || '',
          salaryAccountNumber: user.salaryAccountNumber || user.accountNumber || '',
          salaryAccountName: user.salaryAccountName || user.fullName || '',
          avatarUrl: user.avatarUrl || '',
          token: user.id || 'bems-staff-active-token',
        };
        window.localStorage.setItem('flutter.bems_staff_user', JSON.stringify(flutterUserPayload));
      }
    } catch (e) {
      console.warn('Could not auto-seed Flutter storage:', e);
    }
  }, [user, businessName]);

  const handleReloadEngine = () => {
    setIsLoadingEngine(true);
    setIframeKey(Date.now());
  };

  if (engineMode === 'WEB_TWIN') {
    return (
      <div className="relative">
        {/* Floating Switcher Back to Native Mobile */}
        <div className="fixed top-3 right-4 z-50">
          <button
            onClick={() => setEngineMode('FLUTTER_NATIVE')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EA580C] text-white rounded-full text-xs font-black shadow-lg shadow-orange-500/30 hover:bg-orange-700 transition-all"
            title="Switch to Native Flutter Mobile App Engine"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Switch to Native Mobile App</span>
          </button>
        </div>
        <StaffDashboardClient
          user={user}
          businessName={businessName}
          subsidiaries={subsidiaries}
          vendors={vendors}
          currentStaff={currentStaff}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans select-none overflow-hidden">
      {/* Top Desktop Controls Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-slate-800 z-40 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center font-black text-xs text-white shadow-md">
            B
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wide text-slate-900">BEMS STAFF APP</span>
              <span className="px-1.5 py-0.5 rounded text-[9.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Native Flutter Engine
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {user.fullName} · {user.employeeNumber} · {user.subsidiary}
            </p>
          </div>
        </div>

        {/* Layout & Engine Controls */}
        <div className="flex items-center gap-2">
          {/* Frame Toggle (Desktop only) */}
          <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setDesktopLayout('PHONE_FRAME')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                desktopLayout === 'PHONE_FRAME'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Centered Mobile Phone Mockup"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile View</span>
            </button>
            <button
              onClick={() => setDesktopLayout('FULL_SCREEN')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                desktopLayout === 'FULL_SCREEN'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Expand to Full Desktop Monitor"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </button>
          </div>

          {/* Reload Flutter App Button */}
          <button
            onClick={handleReloadEngine}
            className="p-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all"
            title="Reload Mobile Engine"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Open in Standalone Tab */}
          <a
            href="/staff-app/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm transition-all"
            title="Open pure Flutter app in dedicated tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Dedicated Tab</span>
          </a>

          {/* Switch to Web Twin */}
          <button
            onClick={() => setEngineMode('WEB_TWIN')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-orange-600 border border-orange-200 text-xs font-black shadow-sm transition-all"
            title="Switch to lightweight React web dashboard"
          >
            <Zap className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden sm:inline">React Twin</span>
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-0 md:p-4 bg-slate-100 relative overflow-hidden">
        {/* Loading Overlay */}
        {isLoadingEngine && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-30 transition-opacity">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-orange-500/25 animate-pulse mb-3">
              B
            </div>
            <p className="text-sm font-bold text-slate-900">Starting BEMS Staff Mobile Engine...</p>
            <p className="text-xs text-slate-500 mt-1">Connecting to live ERP services</p>
          </div>
        )}

        {/* Responsive Frame */}
        <div
          className={`w-full transition-all duration-300 flex items-center justify-center ${
            desktopLayout === 'FULL_SCREEN'
              ? 'h-full max-w-none'
              : 'md:max-w-[420px] md:h-[calc(100vh-68px)] md:my-auto'
          }`}
        >
          <div
            className={`w-full h-full bg-white overflow-hidden transition-all duration-300 ${
              desktopLayout === 'PHONE_FRAME'
                ? 'md:rounded-[36px] md:border-[8px] md:border-slate-300 md:shadow-xl relative'
                : 'rounded-none'
            }`}
          >
            {/* Phone Speaker Notch (Desktop Phone Mockup only) */}
            {desktopLayout === 'PHONE_FRAME' && (
              <div className="hidden md:flex absolute top-2 left-1/2 -translate-x-1/2 z-20 items-center justify-center">
                <div className="w-20 h-4 bg-slate-200 rounded-full flex items-center justify-center">
                  <div className="w-10 h-1 bg-slate-400 rounded-full"></div>
                </div>
              </div>
            )}

            {/* The Native Flutter Web Application */}
            <iframe
              key={iframeKey}
              src="/staff-app/index.html"
              onLoad={() => setIsLoadingEngine(false)}
              className="w-full h-full border-0 block"
              allow="camera; geolocation; microphone; clipboard-read; clipboard-write; display-capture"
              title="BEMS Staff Portal Mobile App"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
