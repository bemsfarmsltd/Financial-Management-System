import React from "react";
import { prisma } from "@/lib/prisma";
import { NewRequestForm } from "./NewRequestForm";

import { redirect } from 'next/navigation';
import { getAuthenticatedEmployee } from '@/lib/auth';

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const actor = await getAuthenticatedEmployee();
  if (!actor || actor.role === 'GMD' || actor.role === 'SYSTEM_ADMIN') {
    redirect('/');
  }
  const [subsidiaries, vendors, employees] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { legalName: "asc" },
    }),
    prisma.vendor.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      orderBy: { legalName: "asc" },
    }),
  ]);

  return (
    <NewRequestForm
      subsidiaries={subsidiaries}
      vendors={vendors}
      employees={employees}
    />
  );
}
