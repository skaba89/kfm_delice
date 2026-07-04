import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, hashPassword, verifyPassword, ADMIN_ROLES } from "@/lib/auth";
import { adminSchema, adminPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter, buildSearchWhere } from "@/lib/pagination";

// All methods: Admin only (most restrictive)
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'name', 'role'] as const, 'createdAt');
    const search = parseSearch(sp);
    const roleFilter = parseStatusFilter(sp, ADMIN_ROLES as unknown as string[], 'role');
    const statusFilter = parseStatusFilter(sp, ['active', 'inactive']);

    const restaurantId = admin.restaurantId;

    const where = {
      restaurantId,
      ...(roleFilter && { role: roleFilter }),
      ...(statusFilter && { status: statusFilter }),
      ...(search && buildSearchWhere(search, ['name', 'email'])),
    };
    const [admins, total] = await Promise.all([
      db.admin.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.admin.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: admins,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = adminSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { password, ...rest } = validation.data;
    const createData: { email: string; name: string; password: string; role?: string; status?: string; restaurantId: string } = {
      email: rest.email,
      name: rest.name,
      password: password ? await hashPassword(password) : await hashPassword('changeme123'),
      restaurantId: admin.restaurantId,
    };
    if (rest.role) createData.role = rest.role;
    if (rest.status) createData.status = rest.status;

    const newAdmin = await db.admin.create({ data: createData });
    return NextResponse.json(newAdmin, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = adminPatchSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, password, currentPassword, ...rest } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // ── Multi-tenant isolation ──────────────────────────────────
    // Verify the target admin belongs to the requesting admin's restaurant.
    // Without this, an admin of restaurant A could change the password of
    // an admin of restaurant B by guessing an admin UUID — full account
    // takeover across tenants.
    const targetAdmin = await db.admin.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true, password: true },
    });
    if (!targetAdmin) {
      return NextResponse.json({ error: "Administrateur introuvable" }, { status: 404 });
    }

    const updateData: { email?: string; name?: string; password?: string; role?: string; status?: string } = { ...rest };
    if (password) {
      // If the admin is changing their own password, verify current password
      if (admin.id === id) {
        if (!currentPassword) {
          return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
        }
        const isValid = await verifyPassword(currentPassword, targetAdmin.password);
        if (!isValid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
        }
      }
      // If a different admin is changing this admin's password, no currentPassword needed
      updateData.password = await hashPassword(password);
    }

    const updatedAdmin = await db.admin.update({ where: { id }, data: updateData });
    return NextResponse.json(updatedAdmin);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const url = new URL(request.url);
    let id: string | undefined = url.searchParams.get("id") || undefined;
    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch { /* empty body, ignore */ }
    }
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }
    // Scope delete to admin's restaurant
    await db.admin.deleteMany({ where: { id, restaurantId: admin.restaurantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
