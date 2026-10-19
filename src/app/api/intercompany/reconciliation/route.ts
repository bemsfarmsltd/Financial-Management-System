import { NextResponse } from "next/server";
import { getAuthenticatedEmployee, hasAnyRole } from "@/lib/auth";
import { getIntercompanyMatrix } from "@/lib/services/intercompany";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getAuthenticatedEmployee();
    if (!actor) {
      return NextResponse.json({ error: "Sign in to view intercompany reconciliation." }, { status: 401 });
    }
    if (!hasAnyRole(actor, ["SYSTEM_ADMIN", "GMD", "COO", "FINANCE"])) {
      return NextResponse.json({ error: "Finance or executive access required." }, { status: 403 });
    }

    const matrix = await getIntercompanyMatrix();
    return NextResponse.json({
      success: true,
      matrix,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate reconciliation" }, { status: 500 });
  }
}
