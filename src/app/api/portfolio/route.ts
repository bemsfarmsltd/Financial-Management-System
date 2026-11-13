import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { toSystemRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view the group portfolio.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive access is required to view the group portfolio.' }, { status: 403 });
    }
    const [organizations, budgets, requests, intercompanyNotes, departments, assignments, disbursements, accountabilityCases, companyBankAccounts, allStaffEmployees] = await Promise.all([
      prisma.organization.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          settings: true,
        },
      }),
      prisma.budget.findMany({
        where: { status: 'ACTIVE' },
        include: {
          organization: true,
          lines: true,
        },
      }),
      prisma.expenditureRequest.findMany({
        include: {
          subsidiary: true,
          requester: {
            select: {
              id: true,
              legalName: true,
              workEmail: true,
              role: true,
            },
          },
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
      prisma.department.findMany(),
      prisma.employeeAssignment.findMany({
        where: {
          status: 'ACTIVE',
          employee: {
            status: 'ACTIVE',
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              legalName: true,
              workEmail: true,
              phone: true,
              role: true,
              status: true,
              employmentAgreements: {
                where: { status: 'ACTIVE' },
                take: 1,
                include: {
                  compensations: {
                    orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
                    take: 1,
                  },
                },
              },
            },
          },
          department: true,
        },
        orderBy: { startsOn: 'asc' },
      }),
      prisma.disbursement.findMany({
        include: {
          payerOrg: true,
        },
      }),
      prisma.accountabilityCase.findMany({
        include: {
          request: true,
        },
      }),
      prisma.companyBankAccount.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { balance: 'desc' },
      }),
      prisma.employee.findMany({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
        },
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          workEmail: true,
          phone: true,
          assignments: {
            where: { status: 'ACTIVE' },
            include: {
              subsidiary: { select: { id: true, legalName: true, code: true } },
              department: { select: { id: true, name: true } },
            },
          },
          employmentAgreements: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: {
              compensations: {
                orderBy: [{ version: 'desc' }, { effectiveFrom: 'desc' }],
                take: 1,
              },
            },
          },
        },
        orderBy: { legalName: 'asc' },
      }),
    ]);

    const portfolio = organizations.map((org) => {
      const orgBudgets = budgets.filter((b) => b.organizationId === org.id);
      const totalBudget = orgBudgets.reduce((acc, b) => acc + Number(b.totalAmount), 0);

      const orgDisbursements = disbursements.filter((d) => d.payerOrgId === org.id);
      const totalSpent = orgDisbursements.reduce((acc, d) => acc + Number(d.amountMinor) / 100, 0);

      const orgRequests = requests.filter((r) => r.subsidiaryId === org.id);
      const totalCommitted = orgRequests
        .filter((r) => r.approvalStatus === 'APPROVED' && !['SETTLED', 'RECIPIENT_CONFIRMED', 'PAID'].includes(r.paymentStatus))
        .reduce((acc, r) => acc + Number(r.amountMinor) / 100, 0);

      const moneyLeft = Math.max(0, totalBudget - (totalSpent + totalCommitted));
      const utilisationPct = totalBudget > 0 ? Math.min(100, Math.round(((totalSpent + totalCommitted) / totalBudget) * 100)) : 0;

      const pendingApprovals = orgRequests.filter((r) => r.approvalStatus === 'SUBMITTED' || r.approvalStatus === 'IN_REVIEW').length;

      const outgoingNotes = intercompanyNotes.filter((n) => n.sourceEntityId === org.id);
      const incomingNotes = intercompanyNotes.filter((n) => n.targetEntityId === org.id);

      const orgDepts = departments
        .filter((d) => d.organizationId === org.id)
        .map((d) => ({ id: d.id, name: d.name, code: d.code }));

      const getSetting = (key: string) => org.settings?.find((s) => s.key === key)?.value || null;
      const orgAssignment = assignments.find((a) => a.department?.organizationId === org.id || a.subsidiaryId === org.id);
      const lead = {
        name: getSetting('EXECUTIVE_LEAD_NAME') || (orgAssignment ? orgAssignment.employee.legalName : actor.legalName),
        role: getSetting('EXECUTIVE_LEAD_TITLE') || (orgAssignment ? orgAssignment.positionName || orgAssignment.employee.role || 'Managing Director' : 'Managing Director'),
        email: getSetting('EXECUTIVE_LEAD_EMAIL') || (orgAssignment ? orgAssignment.employee.workEmail : actor.workEmail),
        phone: getSetting('EXECUTIVE_LEAD_PHONE') || (orgAssignment ? orgAssignment.employee.phone : actor.phone) || null,
      };

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

      const seenOrgEmpIds = new Set<string>();
      const orgStaff = assignments
        .filter((a) => a.subsidiaryId === org.id && a.employee.role === 'STAFF')
        .filter((a) => {
          if (seenOrgEmpIds.has(a.employee.id)) return false;
          seenOrgEmpIds.add(a.employee.id);
          return true;
        })
        .map((a) => {
          const activeComp = a.employee.employmentAgreements?.[0]?.compensations?.[0];
          const grossMonthlySalary = activeComp ? Number(activeComp.grossMinor || BigInt(0)) / 100 : 0;
          return {
            id: a.employee.id,
            employeeNumber: a.employee.employeeNumber,
            name: a.employee.legalName,
            email: a.employee.workEmail,
            phone: a.employee.phone || null,
            role: a.employee.role,
            positionName: a.positionName,
            departmentName: a.department?.name || 'General Operations',
            departmentCode: a.department?.code || 'OPS',
            status: a.employee.status || 'ACTIVE',
            employmentType: 'Full-Time Permanent',
            intercompanySplit: a.isPrimary ? 'Primary (100%)' : 'Secondary Split (Cost-share)',
            grossMonthlySalary,
          };
        });

      const seenOrgLeaderIds = new Set<string>();
      const orgLeadership = assignments
        .filter((a) => a.subsidiaryId === org.id && a.employee.role !== 'STAFF')
        .filter((a) => {
          if (seenOrgLeaderIds.has(a.employee.id)) return false;
          seenOrgLeaderIds.add(a.employee.id);
          return true;
        })
        .map((a) => {
          return {
            id: a.employee.id,
            employeeNumber: a.employee.employeeNumber,
            name: a.employee.legalName,
            email: a.employee.workEmail,
            phone: a.employee.phone || null,
            role: a.employee.role,
            positionName: a.positionName || (a.employee.role === 'GMD' ? 'Group Managing Director' : 'Super Admin'),
            departmentName: a.department?.name || 'Executive Directorate',
            departmentCode: a.department?.code || 'EXEC',
            status: a.employee.status || 'ACTIVE',
          };
        });

      const actualHeadcount = orgStaff.length;

      const orgCases = accountabilityCases.filter((c) => c.request?.subsidiaryId === org.id);
      const closedCases = orgCases.filter((c) => c.status === 'CLOSED' || c.status === 'VERIFIED').length;
      const receiptsScore = orgCases.length > 0 ? Math.round((closedCases / orgCases.length) * 100) : 0;

      const orgBankAccounts = companyBankAccounts.filter((b) => b.organizationId === org.id);
      const bankAccounts = orgBankAccounts.map((b) => ({
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountType: b.accountType || 'Corporate Operational (NGN)',
        balanceNaira: Number(b.balance),
      }));

      const DEFAULT_LOGOS: Record<string, string> = {
        'BEMS-GROUP': '/bems-group-logo.png?v=20261024',
        'BBH': '/logos/bbh.svg',
        'BTECH': '/logos/smartairs.svg',
        'BSA': '/logos/studio-arella.svg',
        'BEDU': '/logos/bedu.svg',
        'BAGRO': '/logos/bems-farms.svg',
      };

      const resolvedColor = org.brandColor || getSetting('BRAND_COLOR') || (org.type === 'GROUP' ? '#ea580c' : '#0d8a70');
      const resolvedLogo = org.logoUrl || getSetting('BRAND_LOGO_URL') || DEFAULT_LOGOS[org.code] || (org.type === 'GROUP' ? '/bems-group-logo.png?v=20261024' : null);
      const resolvedIndustry = getSetting('SUBSIDIARY_INDUSTRY') || (
        org.type === 'GROUP'
          ? 'Group Holding & Executive Governance'
          : org.code.includes('LOG') || org.code.includes('AGRO')
          ? 'Logistics & Agribusiness'
          : org.code.includes('SOFT') || org.code.includes('BBH') || org.code.includes('TECH')
          ? 'Software & Cloud Services'
          : org.code.includes('BSA')
          ? 'Media, Broadcast & Creative Production'
          : org.code.includes('EDU')
          ? 'Education & EdTech Services'
          : 'Corporate Operating Subsidiary'
      );

      return {
        id: org.id,
        name: org.legalName,
        code: org.code,
        type: org.type,
        status: org.status === 'ACTIVE' ? 'Live' : 'Setup',
        industry: resolvedIndustry,
        initials: org.code.replace('BEMS-', '').slice(0, 2) || 'BM',
        color: resolvedColor,
        brandColor: resolvedColor,
        logoUrl: resolvedLogo,
        rcNumber: getSetting('RC_NUMBER') || 'RC-REGISTERED',
        tinNumber: getSetting('TIN_NUMBER') || null,
        incorporationDate: getSetting('INCORPORATION_DATE') || null,
        websiteUrl: getSetting('WEBSITE_URL') || null,
        description: getSetting('CORPORATE_DESCRIPTION') || null,
        headquarters: getSetting('HEADQUARTERS_LOCATION') || 'Lagos, Nigeria',
        lead,
        headcount: actualHeadcount,
        adminCount: orgLeadership.length,
        staff: orgStaff,
        leadership: orgLeadership,
        budget: totalBudget,
        spent: totalSpent,
        approvedUnpaid: totalCommitted,
        moneyLeft,
        utilisationPct,
        activeRequestsCount: orgRequests.length,
        pendingApprovalsCount: pendingApprovals,
        receiptsScore,
        outgoingNotesCount: outgoingNotes.length,
        incomingNotesCount: incomingNotes.length,
        netIntercompanyAmount: outgoingNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor) / 100, 0) - incomingNotes.reduce((acc, n) => acc + Number(n.totalAmountMinor) / 100, 0),
        departments: orgDepts.length ? orgDepts : [
          { id: `${org.id}-d1`, name: 'Operations & Execution', code: 'OPS' },
          { id: `${org.id}-d2`, name: 'Finance & Compliance', code: 'FIN' },
        ],
        bankAccounts,
        recentRequests: recentReqs,
      };
    });

    const allGroupStaff = allStaffEmployees.map((emp) => {
      const primaryAssignment = emp.assignments.find((a) => a.isPrimary) || emp.assignments[0];
      const activeComp = emp.employmentAgreements?.[0]?.compensations?.[0];
      return {
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        name: emp.legalName,
        email: emp.workEmail,
        phone: emp.phone || null,
        positionName: primaryAssignment?.positionName || 'Staff Member',
        departmentName: primaryAssignment?.department?.name || 'Operations',
        primarySubsidiaryId: primaryAssignment?.subsidiaryId || null,
        primarySubsidiaryName: primaryAssignment?.subsidiary?.legalName || 'BEMS Group',
        subsidiaryIds: Array.from(new Set(emp.assignments.map((a) => a.subsidiaryId))),
        grossMonthlySalary: activeComp ? Number(activeComp.grossMinor || BigInt(0)) / 100 : 0,
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
    const totalExecutiveAdmins = assignments.filter((a) => a.employee.role !== 'STAFF').length;
    const totalIntercompanyVolume = serializedNotes.reduce((acc, n) => acc + n.amountNaira, 0);

    return NextResponse.json({
      summary: {
        totalCompanies: portfolio.length,
        totalOrganizations: portfolio.length,
        totalGroupHeadcount,
        totalGroupStaff: totalGroupHeadcount,
        totalExecutiveAdmins,
        totalGroupBudget,
        totalGroupSpent,
        totalIntercompanyVolume,
        activeNotesCount: serializedNotes.length,
      },
      group: portfolio.find(p => p.type === 'GROUP') || null,
      portfolio: portfolio,
      allGroupStaff,
      intercompanyNotes: serializedNotes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
