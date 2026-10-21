'use client';

import React from 'react';
import { StaffDashboardClient } from './StaffDashboardClient';

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  employeeNumber?: string;
  phone?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
}

interface StaffWorkspaceProps {
  user: StaffUser;
  businessName: string;
  onNavigate?: (tab: string) => void;
  setNotice?: (msg: string) => void;
}

export function StaffWorkspaceModule({
  user,
  businessName,
}: StaffWorkspaceProps) {
  return (
    <StaffDashboardClient
      user={user}
      businessName={businessName}
    />
  );
}
