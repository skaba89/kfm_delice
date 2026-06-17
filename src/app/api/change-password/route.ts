import { db, dbReady, bigIntToNumber } from "@/lib/db";
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

    // Find the user and verify current password using raw SQL
    let user: { id: string; password: string; mustChangePassword: number } | null = null;
    const tableName = auth.type.charAt(0).toUpperCase() + auth.type.slice(1); // Admin, Customer, Driver

    const rows = bigIntToNumber(await db.$queryRawUnsafe(
      `SELECT id, password, COALESCE(mustChangePassword, 0) as mustChangePassword FROM ${tableName} WHERE id = ?`,
      auth.id
    )) as any[];

    if (rows && rows.length > 0) {
      user = {
        id: String(rows[0].id),
        password: String(rows[0].password),
        mustChangePassword: Number(rows[0].mustChangePassword),
      };
    }

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Verify current password (skip if mustChangePassword — they might not know the temp one)
    if (!user.mustChangePassword) {
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
      }
    }

    // Hash and update using raw SQL
    const hashedNewPassword = await hashPassword(newPassword);

    await db.$executeRawUnsafe(
      `UPDATE ${tableName} SET password = ?, mustChangePassword = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      hashedNewPassword,
      auth.id
    );

    return NextResponse.json({ success: true, message: "Mot de passe modifié avec succès" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
