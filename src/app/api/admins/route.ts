import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, hashPassword } from "@/lib/auth";
import { adminSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";

// All methods: Admin only (most restrictive)
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { page, limit } = parsePagination(new URL(request.url).searchParams);

    const [admins, total] = await Promise.all([
      db.admin.findMany({
        orderBy: { createdAt: "desc" },
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.admin.count(),
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
    const createData: { email: string; name: string; password: string; role?: string; status?: string } = {
      email: rest.email,
      name: rest.name,
      password: password ? await hashPassword(password) : await hashPassword('changeme123'),
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

    const { id, password, ...rest } = validation.data;
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const updateData: { email?: string; name?: string; password?: string; role?: string; status?: string } = { ...rest };
    if (password) {
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
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id } = await request.json();
    await db.admin.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
