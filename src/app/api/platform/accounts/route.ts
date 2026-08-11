import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getPlanQuotaDefaults } from "@/lib/commercial-plan-catalog";
import { z } from "zod";

const createAccountSchema = z.object({
  name: z.string().min(2, "Nom du compte requis"),
  ownerName: z.string().optional().default(""),
  ownerEmail: z.union([z.string().email(), z.literal("")]).optional().default(""),
  ownerPhone: z.string().optional().default(""),
  plan: z.enum(["free", "starter", "pro", "enterprise", "custom"]).default("starter"),
  // Commercial catalog defaults are applied after validation. Explicit values
  // remain supported for negotiated/custom contracts.
  maxRestaurants: z.number().int().min(1).optional(),
  maxSecondaryRestaurants: z.number().int().min(0).optional(),
  maxAdmins: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxOrdersPerMonth: z.number().int().min(1, "Le quota mensuel de commandes doit être au moins 1").default(1000),
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

    const input = validation.data;
    const defaults = getPlanQuotaDefaults(input.plan);
    const accountData = {
      ...input,
      maxRestaurants: input.maxRestaurants ?? defaults.maxRestaurants,
      maxSecondaryRestaurants: input.maxSecondaryRestaurants ?? defaults.maxSecondaryRestaurants,
      maxAdmins: input.maxAdmins ?? defaults.maxAdmins,
      maxUsers: input.maxUsers ?? defaults.maxUsers,
    };

    if (accountData.maxSecondaryRestaurants > accountData.maxRestaurants - 1) {
      return NextResponse.json(
        { error: "Le nombre de restaurants secondaires ne peut pas dépasser maxRestaurants - 1." },
        { status: 400 }
      );
    }
    if (accountData.maxUsers < accountData.maxAdmins) {
      return NextResponse.json(
        { error: "Le nombre maximum d'utilisateurs doit être supérieur ou égal au nombre maximum d'administrateurs." },
        { status: 400 }
      );
    }

    const account = await db.account.create({ data: accountData });

    await logAudit({
      actorId: admin.id,
      actorType: "platform_admin",
      action: "account_create",
      entityType: "Account",
      entityId: account.id,
      accountId: account.id,
      after: accountData,
      request,
    });

    return NextResponse.json(bigIntToNumber(account), { status: 201 });
  } catch (error) {
    console.error("[platform/accounts POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
