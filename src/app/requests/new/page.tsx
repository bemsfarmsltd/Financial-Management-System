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
  const [subsidiaries, vendors, employees, currentStaff] = await Promise.all([
    prisma.organization.findMany({
      where: { status: "ACTIVE" },
      orderBy: { legalName: "asc" },
      select: { id: true, legalName: true, code: true, type: true },
    }),
    prisma.vendor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true, bankName: true, accountNumber: true, accountName: true },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { legalName: "asc" },
      select: { id: true, legalName: true, workEmail: true, employeeNumber: true },
    }),
    prisma.employee.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        legalName: true,
        workEmail: true,
        employeeNumber: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        assignments: {
          where: { status: "ACTIVE" },
          select: {
            subsidiaryId: true,
            departmentId: true,
            positionName: true,
            isPrimary: true,
            subsidiary: { select: { id: true, legalName: true, code: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);

  return (
    <NewRequestForm
      subsidiaries={subsidiaries}
      vendors={vendors}
      employees={employees}
      currentStaff={currentStaff}
    />
  );
}
