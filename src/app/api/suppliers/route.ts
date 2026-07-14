import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// GET /api/suppliers — list suppliers
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const suppliers = await db.supplier.findMany({
      where: { restaurantId: admin.restaurantId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: suppliers });
  } catch (error) {
    console.error("[suppliers:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/suppliers — create supplier
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const body = await request.json();
    const { name, contactName, phone, email, address, category, notes } = body;
    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

    const supplier = await db.supplier.create({
      data: {
        restaurantId: admin.restaurantId,
        name, contactName: contactName || "", phone: phone || "",
        email: email || "", address: address || "",
        category: category || "general", notes: notes || "",
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("[suppliers:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
