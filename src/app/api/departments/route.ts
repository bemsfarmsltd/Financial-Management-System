import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveAuthorizedOrganizationScope } from '@/lib/organizations';

export async function GET(req: NextRequest) {
    try {
        const authUser = await getAuthenticatedEmployee(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const requestedOrgId =
            searchParams.get('subsidiaryId') ||
            searchParams.get('organizationId') ||
            searchParams.get('subsidiary') ||
            searchParams.get('orgId') ||
            'ALL';

        const scope = await resolveAuthorizedOrganizationScope(authUser, requestedOrgId);
        if (scope.organizationIds.length === 0) {
            return NextResponse.json({
                status: 'success',
                departments: [],
                data: [],
                total: 0
            });
        }

        const departments = await prisma.department.findMany({
            where: {
                organizationId: { in: scope.organizationIds }
            },
            include: {
                organization: {
                    select: { id: true, legalName: true, code: true }
                },
                _count: {
                    select: { employeeAssignments: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({
            status: 'success',
            departments,
            data: departments,
            total: departments.length
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to list departments.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const authUser = await getAuthenticatedEmployee(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
        }

        if (!hasAnyRole(authUser, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
            return NextResponse.json(
                { error: 'Executive clearance (Super admin or GMD) required to create departments.' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(req.url);
        const body = await req.json();
        const name = String(body.name || '').trim();
        const rawCode = String(body.code || '').trim();
        const requestedOrgId = String(
            body.organizationId ||
            body.subsidiaryId ||
            searchParams.get('subsidiaryId') ||
            searchParams.get('organizationId') ||
            ''
        ).trim();

        if (!name || name.length < 2) {
            return NextResponse.json(
                { error: 'Explicit department name (at least 2 characters) is required.' },
                { status: 400 }
            );
        }

        if (!requestedOrgId || requestedOrgId === 'ALL') {
            return NextResponse.json(
                { error: 'An explicit target subsidiary/organization ID is required to create a department.' },
                { status: 400 }
            );
        }

        const scope = await resolveAuthorizedOrganizationScope(authUser, requestedOrgId);
        const targetOrgId = scope.organizationIds[0];
        if (!targetOrgId) {
            return NextResponse.json(
                { error: 'Target subsidiary could not be resolved or authorized.' },
                { status: 403 }
            );
        }

        const code = (rawCode || name.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase().slice(0, 16)).toUpperCase();

        const existing = await prisma.department.findFirst({
            where: {
                organizationId: targetOrgId,
                OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    { code: { equals: code, mode: 'insensitive' } }
                ]
            }
        });

        if (existing) {
            return NextResponse.json({
                status: 'success',
                department: existing,
                message: `Department "${existing.name}" (${existing.code}) already exists in this subsidiary.`
            });
        }

        const created = await prisma.department.create({
            data: {
                organizationId: targetOrgId,
                name,
                code
            },
            include: {
                organization: {
                    select: { id: true, legalName: true, code: true }
                }
            }
        });

        await prisma.auditEvent.create({
            data: {
                actorId: authUser.id,
                actorName: authUser.legalName || authUser.workEmail || 'Executive',
                actorRole: authUser.role,
                groupId: targetOrgId,
                subsidiaryId: targetOrgId,
                targetType: 'DEPARTMENT',
                targetId: created.id,
                action: 'DEPARTMENT_CREATED',
                correlationId: `dept_${created.id}`,
                metadata: JSON.stringify({
                    id: created.id,
                    organizationId: created.organizationId,
                    name: created.name,
                    code: created.code
                })
            }
        }).catch(() => null);

        return NextResponse.json({
            status: 'success',
            department: created,
            message: `Department "${created.name}" (${created.code}) created.`
        }, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create department.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
