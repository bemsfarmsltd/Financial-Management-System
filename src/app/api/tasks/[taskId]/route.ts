import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee } from '@/lib/auth';
import { executeDashboardCommand } from '@/lib/staged-actions';
export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const actor = await getAuthenticatedEmployee(request);
    if (!actor) return NextResponse.json({ error: 'Sign in to update a task.' }, { status: 401 });
    const { taskId } = await params;
    const body = await request.json();
    if (!['COMPLETED', 'PENDING'].includes(body.status)) return NextResponse.json({ error: 'Choose a supported task status.' }, { status: 400 });
    const task = await executeDashboardCommand(actor, 'task_action', { taskId, sub_action: body.status === 'COMPLETED' ? 'COMPLETE_TASK' : 'REOPEN_TASK', responseNotes: body.responseNotes });
    return NextResponse.json({ task });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 400 }); }
}
