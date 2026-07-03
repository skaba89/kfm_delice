import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAny, hashPassword, verifyPassword } from "@/lib/auth";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(6, 'Nouveau mot de passe requis (min 6 caractères)'),
  confirmPassword: z.string().min(1, 'Confirmation requise'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// POST /api/change-password — Change password for any authenticated user
export async function POST(request: Request) {
  try {
    await dbReady;

    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { currentPassword, newPassword } = validation.data;

    // Find the user and verify current password using Prisma client.
    // The previous raw SQL (`FROM ${tableName}`) was:
    //   1. Broken on PostgreSQL (unquoted identifiers folded to lowercase)
    //   2. A SQL injection risk if `auth.type` was ever attacker-controlled
    //      (it isn't, but the pattern is dangerous).
    let existingUser: { id: string; password: string; mustChangePassword: boolean } | null = null;

    if (auth.type === 'admin') {
      const admin = await db.admin.findUnique({
        where: { id: auth.id },
        select: { id: true, password: true, mustChangePassword: true },
      });
      if (admin) {
        existingUser = {
          id: admin.id,
          password: admin.password,
          mustChangePassword: !!admin.mustChangePassword,
        };
      }
    } else if (auth.type === 'customer') {
      const customer = await db.customer.findUnique({
        where: { id: auth.id },
        select: { id: true, password: true, mustChangePassword: true },
      });
      if (customer) {
        existingUser = {
          id: customer.id,
          password: customer.password,
          mustChangePassword: !!customer.mustChangePassword,
        };
      }
    } else if (auth.type === 'driver') {
      const driver = await db.driver.findUnique({
        where: { id: auth.id },
        select: { id: true, password: true, mustChangePassword: true },
      });
      if (driver) {
        existingUser = {
          id: driver.id,
          password: driver.password,
          mustChangePassword: !!driver.mustChangePassword,
        };
      }
    } else {
      // platform_admin — no password change flow currently
      return NextResponse.json({ error: "Type d'utilisateur non supporté" }, { status: 400 });
    }

    if (!existingUser) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Verify current password (skip if mustChangePassword — they might not know the temp one)
    if (!existingUser.mustChangePassword) {
      const isValid = await verifyPassword(currentPassword, existingUser.password);
      if (!isValid) {
        return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
      }
    }

    // Hash and update via Prisma client.
    const hashedNewPassword = await hashPassword(newPassword);

    if (auth.type === 'admin') {
      await db.admin.update({
        where: { id: auth.id },
        data: { password: hashedNewPassword, mustChangePassword: false },
      });
    } else if (auth.type === 'customer') {
      await db.customer.update({
        where: { id: auth.id },
        data: { password: hashedNewPassword, mustChangePassword: false },
      });
    } else if (auth.type === 'driver') {
      await db.driver.update({
        where: { id: auth.id },
        data: { password: hashedNewPassword, mustChangePassword: false },
      });
    }

    return NextResponse.json({ success: true, message: "Mot de passe modifié avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
