"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "SUPER_ADMIN" | "GMD" | "STAFF" | string;
  position: string;
  avatarUrl: string;
}

export const USERS: CurrentUser[] = [
  {
    id: "gmd-user",
    name: "Henry Adeleke",
    email: "henrysolomon50@gmail.com",
    role: "GMD",
    position: "The Group Managing Director",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
  },
  {
    id: "admin-user",
    name: "Bems Group Admin",
    email: "bemssofthubltd@gmail.com",
    role: "SYSTEM_ADMIN",
    position: "Super admin",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
  },
  {
    id: "staff-user",
    name: "Solomon",
    email: "henovatetech@gmail.com",
    role: "STAFF",
    position: "Staff",
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
      fetch('/api/auth/session?_t=' + Date.now(), { credentials: 'include', cache: 'no-store' })
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
            position: (role === 'SYSTEM_ADMIN' || role === 'SUPER_ADMIN')
              ? 'Super admin'
              : (role === 'GMD' ? 'The Group Managing Director' : (role === 'STAFF' ? 'Staff' : role.replaceAll('_', ' '))),
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
