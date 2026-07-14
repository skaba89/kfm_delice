import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

/**
 * POST /api/admin/fix-slugs — Fix restaurant slugs
 *
 * The slug field was incorrectly set to the description text instead
 * of a URL-safe slug (e.g. "La vraie nourriture guinéenne" instead of
 * "kfm-delice"). This endpoint regenerates proper slugs from the
 * restaurant name using the same algorithm as generateSlug().
 */
export async function POST(request: Request) {
  try {
    await dbReady;

    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
    }

    const restaurants = await db.restaurant.findMany({
      select: { id: true, name: true, slug: true },
    });

    const results: Array<{ id: string; name: string; oldSlug: string; newSlug: string; status: string }> = [];

    for (const r of restaurants) {
      const baseSlug = r.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 50);

      const isUrlSafe = /^[a-z0-9-]+$/.test(r.slug);

      if (isUrlSafe) {
        results.push({ id: r.id, name: r.name, oldSlug: r.slug, newSlug: r.slug, status: "skip (already URL-safe)" });
        continue;
      }

      let newSlug = baseSlug;
      let counter = 1;
      while (true) {
        const existing = await db.restaurant.findFirst({
          where: { slug: newSlug, NOT: { id: r.id } },
          select: { id: true },
        });
        if (!existing) break;
        newSlug = `${baseSlug}-${counter}`;
        counter++;
      }

      await db.restaurant.update({ where: { id: r.id }, data: { slug: newSlug } });

      results.push({ id: r.id, name: r.name, oldSlug: r.slug, newSlug, status: "fixed" });
    }

    return NextResponse.json({
      ok: true,
      message: "Slugs fixed — all restaurants now have URL-safe slugs",
      results,
    });
  } catch (error) {
    console.error("[admin/fix-slugs]", error);
    return NextResponse.json(
      { error: "Erreur serveur", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
