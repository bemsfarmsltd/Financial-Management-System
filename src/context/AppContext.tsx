"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "GMD" | "COO" | "HEAD_OF_ADMIN" | "FINANCE" | "VERIFIER" | "STAFF";
  position: string;
  avatarUrl: string;
}

export const USERS: CurrentUser[] = [
  {
    id: "gmd-user",
    name: "Henry Nwosu",
    email: "henry@bemsgroup.com",
    role: "GMD",
    position: "Group Managing Director",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  },
  {
    id: "coo-user",
    name: "Adaobi Okeke",
    email: "adaobi@bemsgroup.com",
    role: "COO",
    position: "Chief Operating Officer",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
  },
  {
    id: "admin-user",
    name: "Babatunde Adeleke",
    email: "babatunde@bemsgroup.com",
    role: "HEAD_OF_ADMIN",
    position: "Head of Administration",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
  },
  {
    id: "finance-user",
    name: "Ngozi Eze",
    email: "ngozi@bemsgroup.com",
    role: "FINANCE",
    position: "Senior Finance Officer",
    avatarUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150",
  },
  {
    id: "verifier-user",
    name: "Chinedu Obi",
    email: "chinedu@bemsgroup.com",
    role: "VERIFIER",
    position: "Internal Audit & Accountability Verifier",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
  },
  {
    id: "staff-user",
    name: "Temitope Bakare",
    email: "temitope@bemsgroup.com",
    role: "STAFF",
    position: "Lead DevOps Engineer",
    avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
  },
];

export interface OrganizationOption {
  code: string;
  name: string;
  shortName: string;
}

export const ORGANIZATIONS: OrganizationOption[] = [
  { code: "ALL", name: "Consolidated Group View (All Entities)", shortName: "All Entities" },
  { code: "BEMS-GROUP", name: "Bems Group Holdings Ltd (Group HQ)", shortName: "Group HQ" },
  { code: "BEMS-TECH", name: "Bems Group Cloud & Technologies Ltd", shortName: "Tech Ltd" },
  { code: "BEMS-MEDIA", name: "Bems Group Media & Logistics Ltd", shortName: "Media Ltd" },
];

interface AppContextType {
  currentUser: CurrentUser;
  setCurrentUser: (user: CurrentUser) => void;
  selectedOrgCode: string;
  setSelectedOrgCode: (code: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser>(USERS[0]); // Placeholder while the session loads
  const [selectedOrgCode, setSelectedOrgCode] = useState<string>("ALL");

  useEffect(() => {
    let active = true;
    const loadSession = () => {
      fetch('/api/auth/session', { credentials: 'include' })
        .then((response) => response.json())
        .then((data) => {
          if (!active || !data?.user) return;
          const user = data.user;
          const role = String(user.role || 'STAFF') as CurrentUser['role'];
          setCurrentUser({
            id: user.id,
            name: user.name || user.fullName || 'Employee',
            email: user.email,
            role,
            position: role === 'SYSTEM_ADMIN' ? 'System Admin' : role.replaceAll('_', ' '),
            avatarUrl: user.avatarUrl || '',
          });
        })
        .catch(() => undefined);
    };
    const refresh = () => loadSession();
    loadSession();
    window.addEventListener('bems-session-changed', refresh);
    return () => { active = false; window.removeEventListener('bems-session-changed', refresh); };
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        selectedOrgCode,
        setSelectedOrgCode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
