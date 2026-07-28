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
    // Validation: sanitize + validate all string fields
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    const contactName = typeof body.contactName === "string" ? body.contactName.trim().slice(0, 200) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 50) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    const address = typeof body.address === "string" ? body.address.trim().slice(0, 500) : "";
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 100) : "general";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

    const supplier = await db.supplier.create({
      data: {
        restaurantId: admin.restaurantId,
        name, contactName, phone, email, address, category, notes,
      },
    });
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("[suppliers:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
