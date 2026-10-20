import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ businessId: string; templateId: string }> }
) {
  const { businessId, templateId } = await params;
  return NextResponse.json({ ok: true, imported: templateId, businessId });
}
