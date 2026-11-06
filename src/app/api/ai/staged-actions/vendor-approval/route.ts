import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedEmployee, hasAnyRole } from '@/lib/auth';
import { stageAction } from '@/lib/staged-actions';

export async function POST(req: Request) {
  try {
    const actor = await getAuthenticatedEmployee(req, { allowServiceToken: true });
    if (!actor) return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Authentication required.' }, { status: 401 });
    if (!hasAnyRole(actor, ['GMD', 'SYSTEM_ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ ok: false, error_code: 'NOT_PERMITTED', message: 'Only GMD or Super Admin can stage vendor approvals.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode: rawMode,
      vendor_id,
      vendorId,
      name,
      category,
      tin,
      taxId,
      bank_name,
      bankName,
      account_number,
      accountNumber,
      account_name,
      accountName,
      contact_person,
      contact_phone,
      contactPhone,
      contactEmail,
      notes,
    } = body;

    const targetVendorId = String(vendor_id || vendorId || '').trim();
    const mode = String(
      rawMode || (targetVendorId ? 'APPROVE_EXISTING_VENDOR' : 'REGISTER_NEW_VENDOR')
    )
      .toUpperCase()
      .trim();

    if (mode === 'APPROVE_EXISTING_VENDOR' || mode === 'APPROVE') {
      const existing = targetVendorId
        ? await prisma.vendor.findFirst({
            where: { OR: [{ id: targetVendorId }, { code: { equals: targetVendorId, mode: 'insensitive' } }] },
          })
        : name
        ? await prisma.vendor.findFirst({
            where: { name: { equals: String(name).trim(), mode: 'insensitive' } },
          })
        : null;

      if (!existing) {
        return NextResponse.json(
          { ok: false, error_code: 'VENDOR_NOT_FOUND', message: 'Existing vendor record was not found for approval.' },
          { status: 404 }
        );
      }

      const finalBank = String(bank_name || bankName || existing.bankName || '').trim();
      const finalAcctNum = String(account_number || accountNumber || existing.accountNumber || '')
        .replace(/\D/g, '');
      const finalAcctName = String(account_name || accountName || existing.accountName || existing.name || '').trim();
      const rawTin = String(tin || taxId || existing.taxId || '').trim();
      const finalTin = rawTin && rawTin.toUpperCase() !== 'PENDING_TIN' ? rawTin : null;

      if (!finalBank || finalBank.toLowerCase() === 'commercial bank' || finalAcctNum.length !== 10 || finalAcctNum === '0000000000' || !finalAcctName) {
        return NextResponse.json(
          {
            ok: false,
            error_code: 'INCOMPLETE_VENDOR_BANKING',
            message: `Vendor "${existing.name}" requires a verified bank name, 10-digit NUBAN account number, and beneficiary account name before approval.`,
          },
          { status: 400 }
        );
      }

      const staged = await stageAction({
        userId: actor.id,
        actionType: 'vendor_approval',
        materialPayload: {
          mode: 'APPROVE_EXISTING_VENDOR',
          vendor_id: existing.id,
          code: existing.code,
          name: existing.name,
          category: category || existing.category || 'GENERAL',
          taxId: finalTin,
          bank_name: finalBank,
          account_number: finalAcctNum,
          account_name: finalAcctName,
          contact_phone: contact_phone || contactPhone || existing.contactPhone || null,
          contactEmail: contactEmail || existing.contactEmail || null,
          notes: notes || existing.notes || null,
        },
        summary: `Verify & approve existing supplier: ${existing.name} (${existing.code})`,
        preview: {
          mode: 'APPROVE_EXISTING_VENDOR',
          vendor_code: existing.code,
          vendor_name: existing.name,
          category: category || existing.category || 'GENERAL',
          tax_id_tin: finalTin || 'Not Provided',
          disbursement_bank: `${finalBank} · ${finalAcctNum} (${finalAcctName})`,
          status: 'VERIFIED_ACTIVE',
        },
      });
      return NextResponse.json(staged);
    }

    const cleanName = String(name || '').trim();
    const cleanBank = String(bank_name || bankName || '').trim();
    const cleanAcctNum = String(account_number || accountNumber || '').replace(/\D/g, '');
    const cleanAcctName = String(account_name || accountName || contact_person || '').trim();
    const rawTinVal = String(tin || taxId || '').trim();
    const cleanTin = rawTinVal && rawTinVal.toUpperCase() !== 'PENDING_TIN' ? rawTinVal : null;

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'Vendor name (min 2 chars) is required.' },
        { status: 400 }
      );
    }
    if (!cleanBank || cleanBank.toLowerCase() === 'commercial bank') {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'A verified bank_name is required (placeholders are not permitted).' },
        { status: 400 }
      );
    }
    if (cleanAcctNum.length !== 10 || cleanAcctNum === '0000000000') {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'A valid 10-digit NUBAN account_number is required.' },
        { status: 400 }
      );
    }
    if (!cleanAcctName) {
      return NextResponse.json(
        { ok: false, error_code: 'VALIDATION_FAILED', message: 'account_name (verified NIBSS beneficiary name) is required.' },
        { status: 400 }
      );
    }

    const dup = await prisma.vendor.findFirst({
      where: {
        OR: [
          { name: { equals: cleanName, mode: 'insensitive' } },
          { accountNumber: cleanAcctNum },
          ...(cleanTin ? [{ taxId: { equals: cleanTin, mode: 'insensitive' as const } }] : []),
        ],
      },
    });
    if (dup) {
      return NextResponse.json(
        {
          ok: false,
          error_code: 'DUPLICATE_VENDOR',
          message: `Vendor "${dup.name}" (${dup.code}) is already registered with matching name, NUBAN, or TIN. Use APPROVE_EXISTING_VENDOR instead.`,
          existing_vendor_id: dup.id,
        },
        { status: 409 }
      );
    }

    const count = await prisma.vendor.count();
    const words = cleanName.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const prefix = words.length >= 2 ? words.map((w) => w[0]).join('').slice(0, 3).toUpperCase() : 'VND';
    const code = `${prefix}-${String(count + 1).padStart(4, '0')}`;
    const cleanCategory = String(category || 'GENERAL').toUpperCase().trim();

    const staged = await stageAction({
      userId: actor.id,
      actionType: 'vendor_approval',
      materialPayload: {
        mode: 'REGISTER_NEW_VENDOR',
        code,
        name: cleanName,
        category: cleanCategory,
        taxId: cleanTin,
        bank_name: cleanBank,
        account_number: cleanAcctNum,
        account_name: cleanAcctName,
        contact_person: contact_person || cleanAcctName,
        contact_phone: contact_phone || contactPhone || null,
        contactEmail: contactEmail || null,
        notes: notes || null,
      },
      summary: `Register new verified supplier: ${cleanName} (${code}) · ${cleanBank} ${cleanAcctNum}`,
      preview: {
        mode: 'REGISTER_NEW_VENDOR',
        vendor_code: code,
        vendor_name: cleanName,
        category: cleanCategory,
        tax_id_tin: cleanTin || 'Not Provided',
        disbursement_bank: `${cleanBank} · ${cleanAcctNum} (${cleanAcctName})`,
        status: 'NEW_REGISTRATION',
      },
    });

    return NextResponse.json(staged);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error_code: 'VALIDATION_FAILED', message: err.message }, { status: 500 });
  }
}
