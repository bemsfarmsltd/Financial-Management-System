import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedEmployee(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        _count: {
          select: {
            requests: true,
            invoices: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      count: vendors.length,
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        code: v.code,
        category: v.category,
        taxId: v.taxId,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        bankName: v.bankName,
        accountNumber: v.accountNumber,
        accountName: v.accountName,
        rating: v.rating,
        notes: v.notes,
        totalRequests: v._count.requests,
        totalInvoices: v._count.invoices,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedEmployee(req);
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name: string = (body.name || '').trim();
    const category: string = (body.category || 'GENERAL').toUpperCase().trim();
    const taxId: string = (body.taxId || '').trim();
    const contactEmail: string = (body.contactEmail || body.email || '').trim();
    const contactPhone: string = (body.contactPhone || body.phone || '').trim();
    const bankName: string = (body.bankName || '').trim();
    const accountNumber: string = (body.accountNumber || '').trim().replace(/\D/g, '');
    const accountName: string = (body.accountName || '').trim();
    const notes: string = (body.notes || '').trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false, error: 'Vendor name is required (min 2 chars).' }, { status: 400 });
    }

    if (accountNumber && accountNumber.length !== 10) {
      return NextResponse.json(
        { ok: false, error: 'Bank account number must be exactly 10 digits (NUBAN standard).' },
        { status: 400 }
      );
    }

    // Generate unique vendor code
    const count = await prisma.vendor.count();
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const prefix = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 3).toUpperCase() : 'VND';
    const code = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const vendor = await prisma.vendor.create({
      data: {
        name,
        code,
        category,
        taxId: taxId || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountName: accountName || null,
        notes: notes || null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Vendor "${vendor.name}" registered successfully with code ${vendor.code}.`,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        code: vendor.code,
        category: vendor.category,
        bankName: vendor.bankName,
        accountNumber: vendor.accountNumber,
        accountName: vendor.accountName,
      },
    });
  } catch (error: any) {
    console.error('Error creating vendor:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
