import { NextResponse } from 'next/server';
import { destroyEmployeeSession } from '@/lib/auth';

export async function POST() {
  await destroyEmployeeSession();
  return NextResponse.json({ success: true });
}
