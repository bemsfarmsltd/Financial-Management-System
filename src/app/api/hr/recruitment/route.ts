import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveHrContext, logHrAudit, canUseSubFilter } from '@/lib/hrRouteHelper';

export async function GET(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { orgWhere, allowedSubIds, useSubFilter } = ctx;

    const [rawVacancies, courses, rawAssignments, rawStaff] = await Promise.all([
      prisma.jobVacancy.findMany({
        where: orgWhere,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, legalName: true, code: true } },
          applicants: { orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.trainingCourse.findMany({
        where: useSubFilter
          ? { OR: [{ organizationId: null }, { organizationId: { in: allowedSubIds } }] }
          : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { assignments: true } },
        },
      }),
      prisma.employeeTrainingAssignment.findMany({
        where: useSubFilter
          ? {
              employee: {
                assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } },
              },
            }
          : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          course: { select: { id: true, title: true, category: true, isMandatory: true } },
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              legalName: true,
              assignments: {
                where: { status: 'ACTIVE' },
                select: {
                  subsidiary: { select: { legalName: true } },
                  department: { select: { name: true } },
                },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.employee.findMany({
        where: {
          role: 'STAFF',
          status: 'ACTIVE',
          ...(useSubFilter
            ? { assignments: { some: { subsidiaryId: { in: allowedSubIds }, status: 'ACTIVE' } } }
            : {}),
        },
        orderBy: { legalName: 'asc' },
        select: {
          id: true,
          employeeNumber: true,
          legalName: true,
          jobTitle: true,
          approvalStatus: true,
          resumptionDate: true,
          assignments: {
            where: { status: 'ACTIVE' },
            select: {
              subsidiary: { select: { legalName: true } },
              department: { select: { name: true } },
            },
            take: 1,
          },
          trainingAssignments: {
            select: { status: true },
          },
        },
      }),
    ]);

    const vacancies = rawVacancies.map((v) => ({
      ...v,
      department: v.location || 'General',
      subsidiary: v.organization ? { name: v.organization.legalName, code: v.organization.code } : null,
      applicants: v.applicants.map((a) => ({
        ...a,
        appliedAt: a.createdAt.toISOString(),
      })),
    }));

    const assignments = rawAssignments.map((a) => ({
      ...a,
      employee: a.employee
        ? {
            id: a.employee.id,
            fullName: a.employee.legalName,
            staffCode: a.employee.employeeNumber,
            department: a.employee.assignments[0]?.department?.name || 'General',
            subsidiary: a.employee.assignments[0]?.subsidiary
              ? { name: a.employee.assignments[0].subsidiary.legalName }
              : null,
          }
        : undefined,
    }));

    const staffOptions = rawStaff.map((s) => {
      const assignedCount = s.trainingAssignments.length;
      const completedCount = s.trainingAssignments.filter((t) => t.status === 'COMPLETED').length;
      return {
        id: s.id,
        fullName: s.legalName,
        staffCode: s.employeeNumber,
        jobTitle: s.jobTitle || 'Staff',
        approvalStatus: s.approvalStatus,
        resumptionDate: s.resumptionDate,
        department: s.assignments[0]?.department?.name || 'General',
        subsidiary: s.assignments[0]?.subsidiary?.legalName || 'BEMS Group',
        assignedCount,
        completedCount,
      };
    });

    return NextResponse.json({ success: true, vacancies, courses, assignments, staffOptions });
  } catch (error) {
    console.error('HR Recruitment GET error:', error);
    return NextResponse.json({ error: 'Failed to load recruitment & training data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await resolveHrContext(req);
    if ('error' in ctx) return ctx.error;
    const { actor, hrScope, defaultOrgId } = ctx;

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'CREATE_VACANCY') {
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const employmentType = String(body.employmentType || 'FULL_TIME');
      const location = String(body.location || 'Lagos HQ');
      const salaryBand = body.salaryBand ? String(body.salaryBand) : undefined;
      const headcount = Math.max(1, Number(body.headcount || 1));
      const organizationId = String(body.organizationId || defaultOrgId);

      if (!title || !description) {
        return NextResponse.json({ error: 'Vacancy title and description are required.' }, { status: 400 });
      }
      if (!canUseSubFilter(hrScope, organizationId)) {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      }

      const vacancy = await prisma.jobVacancy.create({
        data: { organizationId, title, description, employmentType, location, salaryBand, headcount, createdById: actor.id },
      });
      return NextResponse.json({ success: true, vacancy });
    }

    if (action === 'ADD_APPLICANT') {
      const vacancyId = String(body.vacancyId || '');
      const fullName = String(body.fullName || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = body.phone ? String(body.phone) : undefined;
      if (!vacancyId || !fullName || !email) {
        return NextResponse.json({ error: 'Vacancy, applicant name, and email are required.' }, { status: 400 });
      }

      const applicant = await prisma.jobApplicant.create({
        data: { vacancyId, fullName, email, phone, stage: 'APPLIED' },
      });
      return NextResponse.json({ success: true, applicant });
    }

    if (action === 'ADVANCE_APPLICANT') {
      const id = String(body.applicantId || body.id || '');
      const stage = String(body.stage || '');
      const interviewNotes = body.interviewNotes ? String(body.interviewNotes) : undefined;
      const applicant = await prisma.jobApplicant.findUnique({
        where: { id },
        include: { vacancy: true },
      });
      if (!applicant) return NextResponse.json({ error: 'Applicant not found.' }, { status: 404 });

      let hiredEmployeeId = applicant.hiredEmployeeId;
      if (stage === 'HIRED' && !hiredEmployeeId) {
        const existingEmp = await prisma.employee.findUnique({ where: { workEmail: applicant.email } });
        if (existingEmp) {
          hiredEmployeeId = existingEmp.id;
        } else {
          const empNum = `BEMS-HR-${Math.floor(1000 + Math.random() * 9000)}`;
          const newEmp = await prisma.employee.create({
            data: {
              employeeNumber: empNum,
              legalName: applicant.fullName,
              workEmail: applicant.email,
              phone: applicant.phone,
              role: 'STAFF',
              status: 'ACTIVE',
              approvalStatus: 'PENDING_APPROVAL',
              jobTitle: applicant.vacancy.title,
              employmentType: applicant.vacancy.employmentType,
              onboardedById: actor.id,
              assignments: {
                create: {
                  subsidiaryId: applicant.vacancy.organizationId,
                  positionName: applicant.vacancy.title,
                  isPrimary: true,
                  status: 'ACTIVE',
                },
              },
            },
          });
          hiredEmployeeId = newEmp.id;
        }
      }

      const updated = await prisma.jobApplicant.update({
        where: { id },
        data: {
          stage,
          interviewNotes: interviewNotes ?? applicant.interviewNotes,
          hiredEmployeeId,
        },
      });

      await logHrAudit({
        actorId: actor.id,
        actorName: actor.legalName,
        actorRole: actor.role,
        groupId: defaultOrgId || applicant.vacancy.organizationId,
        subsidiaryId: applicant.vacancy.organizationId,
        targetType: 'RECRUITMENT',
        targetId: id,
        action: stage,
        metadata: { hiredEmployeeId },
      });

      return NextResponse.json({ success: true, applicant: updated });
    }

    if (action === 'CREATE_COURSE') {
      const title = String(body.title || '').trim();
      const category = String(body.category || 'COMPLIANCE');
      const provider = body.provider ? String(body.provider) : undefined;
      const durationHours = Math.max(1, Number(body.durationHours || 2));
      const isMandatory = Boolean(body.isMandatory);

      if (!title) return NextResponse.json({ error: 'Course title is required.' }, { status: 400 });
      const course = await prisma.trainingCourse.create({
        data: { organizationId: defaultOrgId || null, title, category, provider, durationHours, isMandatory },
      });
      return NextResponse.json({ success: true, course });
    }

    if (action === 'ASSIGN_TRAINING') {
      const courseId = String(body.courseId || '');
      const employeeId = String(body.employeeId || '');
      const dueDate = body.dueDate ? String(body.dueDate) : undefined;
      if (!courseId || !employeeId) {
        return NextResponse.json({ error: 'Course and employee are required.' }, { status: 400 });
      }
      const assignment = await prisma.employeeTrainingAssignment.create({
        data: { courseId, employeeId, dueDate, status: 'ASSIGNED' },
      });
      return NextResponse.json({ success: true, assignment });
    }

    if (action === 'COMPLETE_TRAINING') {
      const id = String(body.assignmentId || body.id || '');
      const updated = await prisma.employeeTrainingAssignment.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return NextResponse.json({ success: true, assignment: updated });
    }

    if (action === 'SEED_STANDARD_COURSES') {
      const defaults = [
        { title: 'BEMS Code of Conduct & Ethics', category: 'COMPLIANCE', provider: 'BEMS HR Academy', durationHours: 2, isMandatory: true },
        { title: 'Workplace Safety & Operations SOP', category: 'SAFETY', provider: 'BEMS Operations', durationHours: 3, isMandatory: true },
        { title: 'Data Privacy & Information Security', category: 'SECURITY', provider: 'BemsSoft Security', durationHours: 2, isMandatory: true },
        { title: 'Financial Accountability & Expense Policy', category: 'FINANCE', provider: 'BEMS Treasury', durationHours: 2, isMandatory: false },
      ];
      await prisma.trainingCourse.createMany({
        data: defaults.map((c) => ({ ...c, organizationId: defaultOrgId || null })),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported recruitment/training action.' }, { status: 400 });
  } catch (error) {
    console.error('HR Recruitment POST error:', error);
    return NextResponse.json({ error: 'Failed to process recruitment action' }, { status: 500 });
  }
}

