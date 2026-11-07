import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';

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

    const isExecutive = hasAnyRole(user, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD']);

    return NextResponse.json({
      ok: true,
      count: vendors.length,
      projection: isExecutive ? 'EXECUTIVE_FULL' : 'DIRECTORY_RESTRICTED',
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        code: v.code,
        category: v.category,
        ...(isExecutive
          ? {
              taxId: v.taxId,
              contactEmail: v.contactEmail,
              contactPhone: v.contactPhone,
              bankName: v.bankName,
              accountNumber: v.accountNumber,
              accountName: v.accountName,
              notes: v.notes,
            }
          : {}),
        rating: v.rating,
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
    if (!hasAnyRole(user, ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'GMD'])) {
      return NextResponse.json(
        { ok: false, error: 'Only Executive Leadership (GMD or Super Admin) can register corporate vendors.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const name: string = (body.name || '').trim();
    const category: string = (body.category || 'GENERAL').toUpperCase().trim();
    const rawTaxId: string = (body.taxId || body.tin || '').trim();
    const taxId = rawTaxId && rawTaxId.toUpperCase() !== 'PENDING_TIN' ? rawTaxId : '';
    const contactEmail: string = (body.contactEmail || body.email || '').trim();
    const contactPhone: string = (body.contactPhone || body.phone || '').trim();
    const bankName: string = (body.bankName || body.bank_name || '').trim();
    const accountNumber: string = (body.accountNumber || body.account_number || '').trim().replace(/\D/g, '');
    const accountName: string = (body.accountName || body.account_name || '').trim();
    const notes: string = (body.notes || '').trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false, error: 'Vendor name is required (min 2 chars).' }, { status: 400 });
    }
    if (!bankName || bankName.toLowerCase() === 'commercial bank') {
      return NextResponse.json({ ok: false, error: 'A verified commercial bank name is required.' }, { status: 400 });
    }
    if (!accountNumber || accountNumber.length !== 10 || accountNumber === '0000000000') {
      return NextResponse.json(
        { ok: false, error: 'A valid 10-digit NUBAN bank account number is required.' },
        { status: 400 }
      );
    }
    if (!accountName) {
      return NextResponse.json(
        { ok: false, error: 'Verified beneficiary account name is required.' },
        { status: 400 }
      );
    }

    const duplicate = await prisma.vendor.findFirst({
      where: {
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { accountNumber },
          ...(taxId ? [{ taxId: { equals: taxId, mode: 'insensitive' as const } }] : []),
        ],
      },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: `A vendor matching "${name}" or account ${accountNumber} is already registered (${duplicate.name} · ${duplicate.code}).`,
          existingVendorId: duplicate.id,
        },
        { status: 409 }
      );
    }

    // Generate unique vendor code
    const count = await prisma.vendor.count();
    const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const prefix = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 3).toUpperCase() : 'VND';
    const code = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const vendor = await prisma.$transaction(async (tx) => {
      const created = await tx.vendor.create({
        data: {
          name,
          code,
          category,
          taxId: taxId || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          bankName,
          accountNumber,
          accountName,
          notes: notes || null,
          rating: typeof body.rating === 'number' ? body.rating : 0,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          actorName: user.legalName,
          actorRole: user.role,
          groupId: 'BEMS-GROUP',
          targetType: 'VENDOR',
          targetId: created.id,
          action: 'VENDOR_REGISTERED',
          correlationId: `VENDOR-REG-${created.id}`,
          metadata: JSON.stringify({
            code: created.code,
            name: created.name,
            bankName: created.bankName,
            accountNumber: created.accountNumber,
          }),
        },
      });

      return created;
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
