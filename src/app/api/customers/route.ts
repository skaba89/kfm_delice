import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, authenticateAny, authenticateCustomer, hasRole, hashPassword, verifyPassword } from "@/lib/auth";
import { customerUpdateSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";

// GET: Admin auth required (list all customers)
export async function GET(request: Request) {
  try {
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

    const where = {
      ...(statusFilter && { status: statusFilter }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
        ],
      }),
    };
    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.customer.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: customers,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST: Admin auth required (create customer)
export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const data = await request.json();
    const existing = await db.customer.findFirst({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 400 });
    }

    // Hash password if provided
    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    const customer = await db.customer.create({ data });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH: Customer can update own profile OR admin can update any
export async function PATCH(request: Request) {
  try {
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
        // Customers must provide their current password to change it
        if (!currentPassword) {
          return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
        }
        const customer = await db.customer.findUnique({ where: { id } });
        if (!customer) {
          return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
        }
        const isValid = await verifyPassword(currentPassword, customer.password);
        if (!isValid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
        }
      }
      updateData.password = await hashPassword(password);
    }

    const customer = await db.customer.update({ where: { id }, data: updateData });
    return NextResponse.json(customer);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE: Admin only
export async function DELETE(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await request.json();
    await db.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
