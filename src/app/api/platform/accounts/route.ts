import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createAccountSchema = z.object({
  name: z.string().min(2, "Nom du compte requis"),
  ownerName: z.string().optional().default(""),
  ownerEmail: z.string().email().optional().default(""),
  ownerPhone: z.string().optional().default(""),
  plan: z.enum(["free", "starter", "pro", "enterprise", "custom"]).default("starter"),
  maxRestaurants: z.number().min(1).default(1),
  maxSecondaryRestaurants: z.number().min(0).default(0),
  maxAdmins: z.number().min(1).default(3),
  maxUsers: z.number().min(1).default(10),
  contractStartDate: z.string().optional().default(""),
  contractEndDate: z.string().optional().default(""),
});

// GET — List all accounts (platform admin only)
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const accounts = await db.account.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { restaurants: true, admins: true } } },
    });

    return NextResponse.json({ data: bigIntToNumber(accounts) });
  } catch (error) {
    console.error("[platform/accounts GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — Create a new account (platform admin only)
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    }

    const account = await db.account.create({ data: validation.data });

    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "account_create",
      entityType: "Account",
      entityId: account.id,
      accountId: account.id,
      after: validation.data,
      request,
    });

    return NextResponse.json(bigIntToNumber(account), { status: 201 });
  } catch (error) {
    console.error("[platform/accounts POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
