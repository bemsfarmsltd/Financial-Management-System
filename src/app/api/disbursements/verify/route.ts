import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json({ error: 'The requesting staff member confirms whether they received the payment.' }, { status: 410 });
}
