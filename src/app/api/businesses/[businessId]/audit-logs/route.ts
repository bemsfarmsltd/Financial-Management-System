import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const logs = await prisma.auditEvent.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' }
    });

    const formatted = logs.map(l => ({
      id: l.id,
      actorName: l.actorName,
      category: l.targetType || 'COMPLIANCE',
      message: `${l.action.replaceAll('_', ' ')} (${l.targetId || l.id})`,
      createdAt: l.createdAt.toISOString()
    }));

    return NextResponse.json(formatted);
  } catch (err: any) {
    return NextResponse.json([]);
  }
}
