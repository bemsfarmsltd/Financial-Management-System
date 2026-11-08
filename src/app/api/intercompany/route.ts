import { executeDashboardCommand } from '@/lib/staged-actions';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { resolveOrganizationScope } from '@/lib/organizations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to view intercompany records.' }, { status: 401 });
    if (!hasAnyRole(actor, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json({ error: 'Executive or Super admin access is required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const subsidiary = searchParams.get('subsidiary') || searchParams.get('organization_id');

    let whereClause = {};
    if (subsidiary && subsidiary !== 'ALL') {
      const scope = await resolveOrganizationScope(subsidiary);
      if (!scope.isGroup) {
        whereClause = {
          OR: [
            { sourceEntityId: { in: scope.organizationIds } },
            { targetEntityId: { in: scope.organizationIds } }
          ]
        };
      }
    }

    const notes = await prisma.intercompanyNote.findMany({
      where: whereClause,
      include: {
        sourceEntity: true,
        targetEntity: true,
      },
      orderBy: { generatedAt: 'desc' },
    });

    const safeNotes = JSON.parse(
      JSON.stringify(notes, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );

    return NextResponse.json(
      { notes: safeNotes },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to issue intercompany notes.' }, { status: 401 });
    const body = await request.json();
    const result = await executeDashboardCommand(actor, 'intercompany_note', { sub_action: 'CREATE_NOTE', mode: 'CREATE_NOTE', sourceEntityId: body.sourceEntityId, targetEntityId: body.targetEntityId, amount: body.amount, currency: body.currency, description: body.description });
    return NextResponse.json({ note: body.noteType === 'CREDIT_NOTE' ? result.creditNote : result.debitNote, pairedNotes: result }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
