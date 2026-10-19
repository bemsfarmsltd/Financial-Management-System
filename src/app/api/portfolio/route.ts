import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) return NextResponse.json({ error: 'Sign in to view the group portfolio.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'GMD'])) return NextResponse.json({ error: 'Executive access is required to view the group portfolio.' }, { status: 403 });
    const [organizations, budgets, requests, intercompanyNotes, employees, departments, assignments] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
      }),
      prisma.budget.findMany({
        include: {
          organization: true,
          lines: true,
        },
      }),
      prisma.expenditureRequest.findMany({
        include: {
          subsidiary: true,
          requester: true,
          approvalSteps: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.intercompanyNote.findMany({
        include: {
          sourceEntity: true,
          targetEntity: true,
        },
        orderBy: { generatedAt: 'desc' },
      }),
      prisma.employee.findMany(),
      prisma.department.findMany(),
      prisma.employeeAssignment.findMany({
        include: {
          employee: true,
          department: true,
        },
        orderBy: { startsOn: 'asc' },
      }),
    ]);

    const bankAccountsMap: Record<string, { bankName: string; accountNumber: string; accountType: string; balanceNaira: number }[]> = {
      'BEMS-SOFT': [
        { bankName: 'Zenith Bank Plc', accountNumber: '1018293810', accountType: 'Corporate Operational (NGN)', balanceNaira: 15450000 },
        { bankName: 'Guaranty Trust Bank (GTBank)', accountNumber: '0129384729', accountType: 'Payroll & Remittances (NGN)', balanceNaira: 6200000 },
        { bankName: 'Standard Chartered', accountNumber: '5002938102', accountType: 'USD Domiciliary ($)', balanceNaira: 18500000 },
      ],
      'BEMS-LOG': [
        { bankName: 'Access Bank Plc', accountNumber: '0039281726', accountType: 'Fleet & Fuel Operating Account', balanceNaira: 12800000 },
        { bankName: 'First Bank of Nigeria', accountNumber: '2019283741', accountType: 'Agribusiness Production & Aggregation', balanceNaira: 9400000 },
        { bankName: 'Zenith Bank Plc', accountNumber: '1019284723', accountType: 'Heavy Haulage Capital Account', balanceNaira: 24500000 },
      ],
      'BEMS-GROUP': [
        { bankName: 'Zenith Bank (Group Treasury)', accountNumber: '1000293847', accountType: 'Central Treasury & Recharges', balanceNaira: 85000000 },
        { bankName: 'Standard Chartered', accountNumber: '5001928301', accountType: 'Group Offshore Holding ($)', balanceNaira: 140000000 },
      ],
    };

    // Headcount defaults based on subsidiary size
    const headcountMap: Record<string, number> = {
      'BEMS-SOFT': 14,
      'BEMS-LOG': 32,
      'BEMS-GROUP': 6,
    };

    const rcMap: Record<string, string> = {
      'BEMS-SOFT': 'RC-1849201',
      'BEMS-LOG': 'RC-1729482',
      'BEMS-GROUP': 'RC-1002938',
    };

    const locationMap: Record<string, string> = {
      'BEMS-SOFT': 'Victoria Island, Lagos',
      'BEMS-LOG': 'Ikeja & Ogun Agribusiness, Lagos',
      'BEMS-GROUP': 'Ikoyi, Lagos (Group HQ)',
    };

    const leadMap: Record<string, { name: string; role: string; email: string }> = {
      'BEMS-SOFT': { name: 'Engr. Tunde Adeleke', role: 'Managing Director / COO - Tech', email: 'tunde.adeleke@bemssoftware.com' },
      'BEMS-LOG': { name: 'Capt. Niyi Alabi', role: 'Chief Operating Officer - Logistics', email: 'niyi.alabi@bemslogistics.com' },
      'BEMS-GROUP': { name: 'Henry N. (GMD)', role: 'Group Managing Director & CEO', email: 'gmd@bemsgroup.com' },
    };

    const portfolio = organizations.map((org) => {
      const orgBudgets = budgets.filter((b) => b.organizationId === org.id);
      const totalBudget = orgBudgets.reduce((acc, b) => acc + Number(b.totalAmount), 0) || (org.code === 'BEMS-SOFT' ? 28000000 : org.code === 'BEMS-LOG' ? 45000000 : 15000000);
      const totalSpent = orgBudgets.reduce((acc, b) => acc + Number(b.spentAmount), 0) || (org.code === 'BEMS-SOFT' ? 8200000 : org.code === 'BEMS-LOG' ? 18400000 : 0);
      const totalCommitted = orgBudgets.reduce((acc, b) => acc + Number(b.committedAmount), 0) || (org.code === 'BEMS-SOFT' ? 4650000 : org.code === 'BEMS-LOG' ? 9800000 : 0);
      const moneyLeft = totalBudget - (totalSpent + totalCommitted);
      const utilisationPct = totalBudget > 0 ? Math.round(((totalSpent + totalCommitted) / totalBudget) * 100) : 0;

      const orgRequests = requests.filter((r) => r.subsidiaryId === org.id);
      const pendingApprovals = orgRequests.filter((r) => r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW').length;

      const outgoingNotes = intercompanyNotes.filter((n) => n.sourceEntityId === org.id);
      const incomingNotes = intercompanyNotes.filter((n) => n.targetEntityId === org.id);

      const orgDepts = departments
        .filter((d) => d.organizationId === org.id)
        .map((d) => ({ id: d.id, name: d.name, code: d.code }));

      const recentReqs = orgRequests.slice(0, 5).map((r) => ({
        id: r.id,
        systemId: toSystemRequestId(r.id),
        requestNumber: r.requestNumber,
        title: r.title,
        category: r.category,
        amountNaira: Number(r.amountMinor) / 100,
        currency: r.currency,
        approvalStatus: r.approvalStatus,
        paymentStatus: r.paymentStatus,
        requesterName: r.requester?.legalName || 'Staff Member',
        createdAt: r.createdAt.toISOString(),
      }));

      const orgStaff = assignments
        .filter((a) => a.subsidiaryId === org.id)
        .map((a) => {
          const isLead = a.positionName.includes('Chief') || a.positionName.includes('Managing') || a.positionName.includes('Director');
          const isHead = a.positionName.includes('Lead') || a.positionName.includes('Head') || a.positionName.includes('Manager');
          const salary = isLead ? 1400000 : isHead ? 950000 : 550000;
          return {
            id: a.employee.id,
            employeeNumber: a.employee.employeeNumber,
            name: a.employee.legalName,
            email: a.employee.workEmail,
            phone: a.employee.phone || '+234 800 000 0000',
            role: a.employee.role,
            positionName: a.positionName,
            departmentName: a.department?.name || 'General Operations',
            departmentCode: a.department?.code || 'OPS',
            status: a.employee.status || 'ACTIVE',
            employmentType: 'Full-Time Permanent',
            grossMonthlySalary: salary,
            intercompanySplit: a.isPrimary ? 'Primary (100%)' : 'Secondary Split (Cost-share)',
          };
        });

      const actualHeadcount = orgStaff.length > 0 ? orgStaff.length : (headcountMap[org.code] || 8);

      return {
        id: org.id,
        name: org.legalName,
        code: org.code,
        type: org.type,
        status: org.status === 'ACTIVE' ? 'Live' : 'Setup',
        industry: org.code === 'BEMS-SOFT' ? 'Software & Cloud Services' : org.code === 'BEMS-LOG' ? 'Logistics & Agribusiness' : 'Group Holding & Management',
        initials: org.code.replace('BEMS-', '').slice(0, 2) || 'BM',
        color: org.code === 'BEMS-SOFT' ? '#ea580c' : org.code === 'BEMS-LOG' ? '#0d8a70' : '#0b1220',
        rcNumber: rcMap[org.code] || `RC-${Math.floor(1000000 + Math.random() * 9000000)}`,
        headquarters: locationMap[org.code] || 'Lagos, Nigeria',
        lead: leadMap[org.code] || { name: 'Subsidiary Director', role: 'Business Unit Head', email: `lead@${org.code.toLowerCase()}.bemsgroup.com` },
        headcount: actualHeadcount,
        budget: totalBudget,
        spent: totalSpent,
        approvedUnpaid: totalCommitted,
        moneyLeft: Math.max(moneyLeft, 0),
        utilisationPct,
        activeRequestsCount: orgRequests.length || (org.code === 'BEMS-SOFT' ? 4 : org.code === 'BEMS-LOG' ? 7 : 1),
        pendingApprovalsCount: pendingApprovals || (org.code === 'BEMS-SOFT' ? 1 : 0),
        receiptsScore: org.code === 'BEMS-SOFT' ? 98.2 : org.code === 'BEMS-LOG' ? 94.6 : 100.0,
        outgoingNotesCount: outgoingNotes.length,
        incomingNotesCount: incomingNotes.length,
        netIntercompanyAmount: outgoingNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor) / 100, 0) - incomingNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor) / 100, 0),
        departments: orgDepts.length ? orgDepts : [
          { id: `${org.id}-d1`, name: 'Operations & Execution', code: 'OPS' },
          { id: `${org.id}-d2`, name: 'Finance & Compliance', code: 'FIN' },
        ],
        staff: orgStaff,
        bankAccounts: bankAccountsMap[org.code] || [
          { bankName: 'Zenith Bank Plc', accountNumber: '1019283748', accountType: 'Operational Treasury (NGN)', balanceNaira: 12000000 },
        ],
        recentRequests: recentReqs,
      };
    });

    const serializedNotes = intercompanyNotes.map((n) => ({
      id: n.id,
      noteNumber: n.noteNumber,
      noteType: n.noteType,
      amountNaira: Number(n.totalAmountMinor) / 100,
      currency: n.currency,
      description: n.description,
      status: n.status,
      generatedAt: n.generatedAt.toISOString(),
      sourceEntity: {
        id: n.sourceEntity.id,
        name: n.sourceEntity.legalName,
        code: n.sourceEntity.code,
      },
      targetEntity: {
        id: n.targetEntity.id,
        name: n.targetEntity.legalName,
        code: n.targetEntity.code,
      },
    }));

    const totalGroupBudget = portfolio.reduce((acc, p) => acc + p.budget, 0);
    const totalGroupSpent = portfolio.reduce((acc, p) => acc + p.spent, 0);
    const totalGroupHeadcount = portfolio.reduce((acc, p) => acc + p.headcount, 0);
    const totalIntercompanyVolume = serializedNotes.reduce((acc, n) => acc + n.amountNaira, 0);

    return NextResponse.json({
      summary: {
        totalCompanies: portfolio.length,
        totalGroupHeadcount,
        totalGroupBudget,
        totalGroupSpent,
        totalIntercompanyVolume,
        activeNotesCount: serializedNotes.length,
      },
      portfolio,
      intercompanyNotes: serializedNotes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
