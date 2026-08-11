import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import { commercialFeatureGate } from "@/lib/commercial-feature-gate";
import { expenseSchema, expensePatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter } from "@/lib/pagination";

export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'expenses');
    if (featureGate) return featureGate;
    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(sp, ['createdAt', 'amount', 'category', 'date'] as const, 'createdAt');
    const search = parseSearch(sp);
    const categoryFilter = parseStatusFilter(sp, ['ingredients', 'utilities', 'rent', 'salary', 'equipment', 'transport', 'other'], 'category');
    const where = {
      restaurantId: admin.restaurantId,
      ...(categoryFilter && { category: categoryFilter }),
      ...(search && { OR: [{ description: { contains: search } }, { paidBy: { contains: search } }] }),
    };
    const [expenses, total] = await Promise.all([
      db.expense.findMany({ where, orderBy: { [sortBy]: sortOrder }, skip: prismaSkip(page, limit), take: prismaTake(limit) }),
      db.expense.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({ data: bigIntToNumber(expenses), pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'expenses');
    if (featureGate) return featureGate;
    const validation = expenseSchema.safeParse(await request.json());
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    const expense = await db.expense.create({ data: { ...validation.data, restaurantId: admin.restaurantId } });
    return NextResponse.json(bigIntToNumber(expense), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'expenses');
    if (featureGate) return featureGate;
    const validation = expensePatchSchema.safeParse(await request.json());
    if (!validation.success) return NextResponse.json({ error: validation.error.issues[0]?.message || "Données invalides" }, { status: 400 });
    const { id, ...data } = validation.data;
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    const existing = await db.expense.findFirst({ where: { id, restaurantId: admin.restaurantId } });
    if (!existing) return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
    const expense = await db.expense.update({ where: { id }, data });
    return NextResponse.json(bigIntToNumber(expense));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager", "accountant"])) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const featureGate = await commercialFeatureGate(admin.restaurantId, 'expenses');
    if (featureGate) return featureGate;
    const url = new URL(request.url);
    let id: string | undefined = url.searchParams.get("id") || undefined;
    if (!id) { try { id = (await request.json())?.id; } catch { /* empty body */ } }
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
    await db.expense.deleteMany({ where: { id, restaurantId: admin.restaurantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
