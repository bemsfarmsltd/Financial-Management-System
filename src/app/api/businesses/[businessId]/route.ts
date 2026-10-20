import { NextResponse } from 'next/server';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ id: businessId, ...body });
}
