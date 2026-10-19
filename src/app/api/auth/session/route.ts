import { NextResponse } from 'next/server';
import { getAuthenticatedEmployee, publicEmployee } from '@/lib/auth';

export async function GET() {
  const employee = await getAuthenticatedEmployee();
  return NextResponse.json({ user: employee ? publicEmployee(employee) : null });
}
