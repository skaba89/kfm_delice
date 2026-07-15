import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

interface RouteContext { params: Promise<{ id: string }> }

export async function PATCH(request: Request, ctx: RouteContext) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await ctx.params;
    const existing = await db.supplier.findFirst({ where: { id, restaurantId: admin.restaurantId } });
    if (!existing) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    const body = await request.json();
    const updated = await db.supplier.update({ where: { id }, data: body });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[suppliers:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await ctx.params;
    const existing = await db.supplier.findFirst({ where: { id, restaurantId: admin.restaurantId } });
    if (!existing) return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    await db.supplier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[suppliers:DELETE]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
