import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, hasRole, hashPassword, verifyPassword } from "@/lib/auth";
import { customerUpdateSchema, customerCreateSchema } from "@/lib/validations";
import { parsePagination, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";

// GET: Admin auth required (list all customers) — uses raw SQL to avoid schema mismatch
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
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'name', 'email', 'totalSpent', 'loyaltyPoints'] as const, 'createdAt');
    const search = parseSearch(sp);
    const statusFilter = parseStatusFilter(sp, ['active', 'inactive', 'suspended']);

    const restaurantId = admin.restaurantId;

    // Build WHERE clause for raw SQL
    const conditions: string[] = ['c.restaurantId = ?'];
    const params: unknown[] = [restaurantId];
    if (statusFilter) { conditions.push('c.status = ?'); params.push(statusFilter); }
    if (search) {
      conditions.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)');
      const likeSearch = `%${search}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }
    const whereClause = conditions.join(' AND ');

    // Validate sort column
    const validSortCols = ['createdAt', 'name', 'email', 'totalSpent', 'loyaltyPoints'];
    const safeSortBy = validSortCols.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Count
    const countResult = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM Customer c WHERE ${whereClause}`,
      ...params
    );
    const total = countResult[0] ? Number(countResult[0].count) : 0;

    // Fetch data — explicit column list to avoid missing column errors
    const offset = (page - 1) * limit;
    const rawCustomers = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT c.id, c.email, c.name, c.phone, c.address,
        c.loyaltyPoints, c.totalOrders, c.totalSpent, c.status,
        COALESCE(c.mustChangePassword, 0) as mustChangePassword,
        c.restaurantId, c.createdAt, c.updatedAt
      FROM Customer c WHERE ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`,
      ...params, limit, offset
    );
    const customers = rawCustomers.map(r => bigIntToNumber(r));

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: customers,
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
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validation = customerCreateSchema.safeParse(body);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Données invalides";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const data = validation.data;
    // Check existing via raw SQL
    const existing = bigIntToNumber(await db.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT id FROM Customer WHERE email = ? AND restaurantId = ?',
      data.email, admin.restaurantId
    )) as Array<{ id: string }>;
    if (existing.length > 0) {
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
    return NextResponse.json(customer, { status: 201 });
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

    // If admin, check role
    if (auth.type === "admin" && !hasRole(auth.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = { ...rest };

    // If password field is provided, verify current password first (for customers)
    if (password) {
      if (auth.type === "customer") {
        if (!currentPassword) {
          return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
        }
        // Use raw SQL to get password (avoid schema mismatch)
        const rows = bigIntToNumber(await db.$queryRawUnsafe<Array<{ password: string }>>(
          'SELECT password FROM Customer WHERE id = ?', id
        )) as Array<{ password: string }>;
        if (!rows[0]) {
          return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
        }
        const isValid = await verifyPassword(currentPassword, rows[0].password);
        if (!isValid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
        }
      }
      updateData.password = await hashPassword(password);
    }

    // Use raw SQL for update to avoid schema mismatch
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(updateData)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
    if (setClauses.length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }
    values.push(id);
    await db.$executeRawUnsafe(
      `UPDATE Customer SET ${setClauses.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      ...values
    );

    // Fetch updated customer via raw SQL
    const updated = bigIntToNumber(await db.$queryRawUnsafe<Array<{
      id: string; email: string; name: string; phone: string; address: string;
      loyaltyPoints: number; totalOrders: number; totalSpent: number;
      status: string; restaurantId: string;
    }>>(
      `SELECT id, email, name, phone, address, loyaltyPoints, totalOrders, totalSpent,
        status, restaurantId FROM Customer WHERE id = ?`, id
    )) as Array<Record<string, unknown>>;

    return NextResponse.json(updated[0] || { id });
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
    await db.$executeRawUnsafe(
      'DELETE FROM Customer WHERE id = ? AND restaurantId = ?',
      id, admin.restaurantId
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[customers] DELETE error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
