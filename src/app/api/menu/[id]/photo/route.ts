import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// POST /api/menu/[id]/photo — upload a photo for a menu item
// Accepts base64 image data in JSON body (avoids multipart complexity)
// Body: { image: "data:image/jpeg;base64,..." }
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const item = await db.menuItem.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true, name: true },
    });
    if (!item) return NextResponse.json({ error: "Plat introuvable" }, { status: 404 });

    const body = await request.json();
    const { image } = body as { image?: string };

    if (!image || !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Image invalide — format data:image/... requis" }, { status: 400 });
    }

    // Validate size (max ~2MB base64 = ~2.7M chars)
    if (image.length > 3_000_000) {
      return NextResponse.json({ error: "Image trop grande (max 2MB)" }, { status: 400 });
    }

    // Store the base64 image directly (in production, upload to S3/Cloudinary)
    await db.menuItem.update({
      where: { id },
      data: { image },
    });

    return NextResponse.json({
      ok: true,
      menuItemId: id,
      name: item.name,
      imageLength: image.length,
      message: "Photo mise à jour avec succès",
    });
  } catch (error) {
    console.error("[menu/photo:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
