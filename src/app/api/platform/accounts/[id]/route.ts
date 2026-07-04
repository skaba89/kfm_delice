import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// GET — Get account details (platform admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const account = await db.account.findUnique({
      where: { id },
      include: {
        restaurants: { select: { id: true, name: true, slug: true, type: true, status: true, plan: true } },
        _count: { select: { admins: true } },
      },
    });

    if (!account) return NextResponse.json({ error: "Compte non trouvé" }, { status: 404 });

    return NextResponse.json(bigIntToNumber(account));
  } catch (error) {
    console.error("[platform/accounts/[id] GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
