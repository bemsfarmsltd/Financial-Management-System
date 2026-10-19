import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) {
      return NextResponse.json({ error: "Sign in to view vendors." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { taxId: { contains: search } },
      ];
    }

    const vendors = await prisma.vendor.findMany({
      where,
      include: {
        _count: {
          select: { requests: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ vendors });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch vendors" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) {
      return NextResponse.json({ error: "Sign in to register vendors." }, { status: 401 });
    }
    if (!hasAnyRole(actor, ["SYSTEM_ADMIN", "GMD", "COO", "FINANCE", "HEAD_OF_ADMIN"])) {
      return NextResponse.json({ error: "Administrative or Finance access is required." }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      category,
      taxId,
      contactEmail,
      contactPhone,
      bankName,
      accountNumber,
      accountName,
      notes,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Provide a valid vendor/supplier name." }, { status: 400 });
    }

    // Auto-generate code if not provided
    const count = await prisma.vendor.count();
    const code = body.code || `VND-${String(count + 1).padStart(4, "0")}`;

    const vendor = await prisma.vendor.create({
      data: {
        name: name.trim(),
        code,
        category: category || "GENERAL",
        taxId: taxId || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        bankName: bankName || null,
        accountNumber: accountNumber || null,
        accountName: accountName || null,
        notes: notes || null,
        rating: 5,
      },
    });

    return NextResponse.json({ success: true, vendor }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create vendor" }, { status: 500 });
  }
}
