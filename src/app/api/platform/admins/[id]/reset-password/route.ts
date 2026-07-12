import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/platform/admins/[id]/reset-password
 * Super admin resets any restaurant admin's password.
 * Works across ALL restaurants (no restaurantId check).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbReady;
    const platformAdmin = await authenticatePlatformAdmin(request);
    if (!platformAdmin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const { id: adminId } = await params;
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit faire au moins 6 caractères" },
        { status: 400 }
      );
    }

    // Find the admin (any restaurant)
    const admin = await db.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, restaurantId: true },
    });

    if (!admin) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Hash and update
    const hashedPassword = await hashPassword(newPassword);
    await db.admin.update({
      where: { id: adminId },
      data: {
        password: hashedPassword,
        mustChangePassword: true,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Audit log
    await logAudit({
      actorId: platformAdmin.id,
      actorType: "platform_admin",
      action: "platform_admin_password_reset",
      entityType: "Admin",
      entityId: adminId,
      restaurantId: admin.restaurantId,
      after: { email: admin.email, mustChangePassword: true },
      request,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Mot de passe réinitialisé pour ${admin.name} (${admin.email}). L'utilisateur devra le changer à la prochaine connexion.`,
    });
  } catch (error) {
    console.error("[platform/admins/reset-password] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
