import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticatePlatformAdmin } from "@/lib/auth";
import { parsePagination, parseSorting, parseSearch } from "@/lib/pagination";

// GET /api/platform/audit-logs — List audit logs (platform admin only)
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticatePlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Accès plateforme requis" }, { status: 403 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    const { sortBy, sortOrder } = parseSorting(
      sp,
      ['createdAt', 'action', 'entityType', 'actorType'] as const,
      'createdAt'
    );
    const search = parseSearch(sp);

    const actorTypeFilter = sp.get('actorType');
    const actionFilter = sp.get('action');
    const entityTypeFilter = sp.get('entityType');
    const accountIdFilter = sp.get('accountId');
    const restaurantIdFilter = sp.get('restaurantId');

    const where: Record<string, unknown> = {};
    if (actorTypeFilter) where.actorType = actorTypeFilter;
    if (actionFilter) where.action = { contains: actionFilter };
    if (entityTypeFilter) where.entityType = entityTypeFilter;
    if (accountIdFilter) where.accountId = accountIdFilter;
    if (restaurantIdFilter) where.restaurantId = restaurantIdFilter;
    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entityType: { contains: search } },
        { actorId: { contains: search } },
        { entityId: { contains: search } },
      ];
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(logs),
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error("[audit-logs] GET error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
