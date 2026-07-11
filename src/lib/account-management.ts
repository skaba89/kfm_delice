/**
 * Generic account management route factory.
 * Creates reset-password and unlock routes for any model.
 *
 * Usage: import and call in a route.ts file.
 */

import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { unlockAccount } from "@/lib/account-security";
import { logAudit } from "@/lib/audit";

type ModelName = 'admin' | 'customer' | 'driver';

/**
 * POST handler for resetting a user's password.
 * Admin-only. Sets mustChangePassword=true so the user must change it on next login.
 *
 * Body: { newPassword: string }
 */
export function createResetPasswordHandler(model: ModelName) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      await dbReady;
      const admin = await authenticateAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      if (!hasRole(admin.role, ["admin"])) {
        return NextResponse.json({ error: "Accès refusé — admin uniquement" }, { status: 403 });
      }

      const { id: userId } = await params;
      const body = await request.json();
      const { newPassword } = body;

      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { error: "Le mot de passe doit faire au moins 6 caractères" },
          { status: 400 }
        );
      }

      // Verify the target user belongs to the admin's restaurant
      const targetUser = await (db[model] as any).findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, restaurantId: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
      }

      if (targetUser.restaurantId !== admin.restaurantId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      // Hash new password and update
      const hashedPassword = await hashPassword(newPassword);
      await (db[model] as any).update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          mustChangePassword: true,
          loginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Audit log
      await logAudit({
        actorId: admin.id,
        actorType: "admin",
        action: `${model}_password_reset`,
        entityType: model === 'admin' ? 'Admin' : model === 'customer' ? 'Customer' : 'Driver',
        entityId: userId,
        restaurantId: admin.restaurantId,
        after: { email: targetUser.email, mustChangePassword: true },
        request,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Mot de passe réinitialisé pour ${targetUser.name}. L'utilisateur devra le changer à la prochaine connexion.`,
      });
    } catch (error) {
      console.error(`[reset-password] Error:`, error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}

/**
 * POST handler for unlocking a user's account.
 * Admin-only. Clears loginAttempts + lockedUntil.
 */
export function createUnlockHandler(model: ModelName) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      await dbReady;
      const admin = await authenticateAdmin(request);
      if (!admin) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      if (!hasRole(admin.role, ["admin"])) {
        return NextResponse.json({ error: "Accès refusé — admin uniquement" }, { status: 403 });
      }

      const { id: userId } = await params;

      // Verify the target user belongs to the admin's restaurant
      const targetUser = await (db[model] as any).findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, restaurantId: true, loginAttempts: true, lockedUntil: true },
      });

      if (!targetUser) {
        return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
      }

      if (targetUser.restaurantId !== admin.restaurantId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      // Unlock the account
      await unlockAccount(model, userId);

      // Audit log
      await logAudit({
        actorId: admin.id,
        actorType: "admin",
        action: `${model}_account_unlocked`,
        entityType: model === 'admin' ? 'Admin' : model === 'customer' ? 'Customer' : 'Driver',
        entityId: userId,
        restaurantId: admin.restaurantId,
        before: { loginAttempts: targetUser.loginAttempts, lockedUntil: targetUser.lockedUntil },
        request,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Compte débloqué pour ${targetUser.name}.`,
      });
    } catch (error) {
      console.error(`[unlock] Error:`, error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
  };
}
