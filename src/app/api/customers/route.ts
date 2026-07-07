import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole, hashPassword, verifyPassword } from "@/lib/auth";
import { customerUpdateSchema, customerCreateSchema } from "@/lib/validations";
import { parsePagination, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";
import { Prisma } from "@prisma/client";

// GET: Admin auth required (list all customers for the admin's restaurant)
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "cashier"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'name', 'email', 'totalSpent', 'loyaltyPoints'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['active', 'inactive', 'suspended']);

    const restaurantId = admin.restaurantId;

    // Build WHERE clause via Prisma (cross-database compatible).
    // Raw SQL `FROM Customer` fails on PostgreSQL because unquoted
    // identifiers are folded to lowercase.
    const where: Prisma.CustomerWhereInput = { restaurantId };
    if (statusFilter) where.status = statusFilter;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, email: true, name: true, phone: true, address: true,
          loyaltyPoints: true, totalOrders: true, totalSpent: true, status: true,
          mustChangePassword: true, restaurantId: true, createdAt: true, updatedAt: true,
        },
      }),
      db.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(customers),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error("[customers] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Admin auth required (create customer)
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "cashier"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = customerCreateSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = validation.data;
    // Check existing — Customer has @@unique([email, restaurantId])
    const existing = await db.customer.findFirst({
      where: { email: data.email, restaurantId: admin.restaurantId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    // Hash password; default to a random temp password if not provided
    const passwordToHash = data.password || Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    const hashedPassword = await hashPassword(passwordToHash);

    const customer = await db.customer.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        phone: data.phone,
        address: data.address,
        restaurantId: admin.restaurantId,
      },
    });
    return NextResponse.json(bigIntToNumber(customer), { status: 201 });
  } catch (error) {
    console.error("[customers] POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH: Customer can update own profile OR admin can update any
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const auth = await authenticateAny(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const validation = customerUpdateSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { id, password, currentPassword, ...rest } = validation.data;

    // If customer, can only update own profile
    if (auth.type === "customer" && auth.id !== id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // If admin, check role + multi-tenant isolation
    if (auth.type === "admin" && !hasRole(auth.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // ── Multi-tenant isolation: verify the customer belongs to the
    // admin's restaurant before any update. For customer self-update,
    // the JWT already proves ownership, but we still verify the customer
    // record exists and matches.
    const tenantRestaurantId =
      auth.type === "admin" ? auth.restaurantId : auth.restaurantId;
    const existingCustomer = await db.customer.findFirst({
      where: { id, restaurantId: tenantRestaurantId },
      select: { id: true, password: true },
    });
    if (!existingCustomer) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { ...rest };

    // If password field is provided, verify current password first (for customers)
    if (password) {
      if (auth.type === "customer") {
        if (!currentPassword) {
          return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
        }
        const isValid = await verifyPassword(currentPassword, existingCustomer.password);
        if (!isValid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
        }
      }
      updateData.password = await hashPassword(password);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    const updated = await db.customer.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true, address: true,
        loyaltyPoints: true, totalOrders: true, totalSpent: true,
        status: true, restaurantId: true,
      },
    });

    return NextResponse.json(bigIntToNumber(updated));
  } catch (error) {
    console.error("[customers] PATCH error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE: Admin only
export async function DELETE(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager", "cashier"])) {
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

    // ── Multi-tenant isolation: findFirst by id + restaurantId before
    // delete. The previous raw SQL `DELETE FROM Customer WHERE id = ? AND
    // restaurantId = ?` was correct logically but failed on PostgreSQL
    // due to identifier case-folding.
    const existing = await db.customer.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    await db.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[customers] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
