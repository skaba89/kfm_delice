import { randomBytes } from 'node:crypto';
import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole, hashPassword, verifyPassword, ADMIN_ROLES } from "@/lib/auth";
import { adminSchema, adminPatchSchema } from "@/lib/validations";
import { parsePagination, prismaSkip, prismaTake, parseSorting, parseSearch, parseStatusFilter, buildSearchWhere } from "@/lib/pagination";
import { logAudit } from '@/lib/audit';

const SAFE_ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  mustChangePassword: true,
  restaurantId: true,
  accountId: true,
  canCreateRestaurant: true,
  restaurantCreationLimit: true,
  restaurantsCreatedCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

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
        select: SAFE_ADMIN_SELECT,
        skip: prismaSkip(page, limit),
        take: prismaTake(limit),
      }),
      db.admin.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return NextResponse.json({
      data: bigIntToNumber(admins),
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
    if (rest.role && !ADMIN_ROLES.includes(rest.role as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.json({ error: 'Rôle administrateur invalide' }, { status: 400 });
    }

    const duplicate = await db.admin.findUnique({
      where: { email: rest.email },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json(
        { error: 'Cet email administrateur est déjà utilisé', code: 'ADMIN_EMAIL_EXISTS' },
        { status: 409 }
      );
    }

    const restaurant = await db.restaurant.findUnique({
      where: { id: admin.restaurantId },
      select: {
        id: true,
        accountId: true,
        account: {
          select: { id: true, status: true, maxAdmins: true },
        },
      },
    });
    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant introuvable' }, { status: 404 });
    }

    const account = restaurant.account;
    if (account) {
      if (account.status === 'suspended' || account.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Le compte SaaS est suspendu ou résilié', code: 'ACCOUNT_UNAVAILABLE' },
          { status: 403 }
        );
      }

      const accountRestaurants = await db.restaurant.findMany({
        where: { accountId: account.id },
        select: { id: true },
      });
      const restaurantIds = accountRestaurants.map((item) => item.id);
      const currentAdmins = await db.admin.count({
        where: { restaurantId: { in: restaurantIds } },
      });
      if (currentAdmins >= account.maxAdmins) {
        return NextResponse.json(
          {
            error: `Quota d'administrateurs atteint (${currentAdmins}/${account.maxAdmins})`,
            code: 'ACCOUNT_ADMIN_QUOTA_REACHED',
            usage: currentAdmins,
            limit: account.maxAdmins,
          },
          { status: 403 }
        );
      }
    }

    const temporaryPassword = password ? undefined : randomBytes(18).toString('base64url');
    const rawPassword = password || temporaryPassword!;
    const newAdmin = await db.admin.create({
      data: {
        email: rest.email,
        name: rest.name,
        password: await hashPassword(rawPassword),
        restaurantId: admin.restaurantId,
        accountId: restaurant.accountId,
        role: rest.role || 'admin',
        status: rest.status || 'active',
        mustChangePassword: Boolean(temporaryPassword),
      },
      select: SAFE_ADMIN_SELECT,
    });

    await logAudit({
      actorId: admin.id,
      actorType: 'admin',
      action: 'admin_create',
      entityType: 'Admin',
      entityId: newAdmin.id,
      restaurantId: admin.restaurantId,
      accountId: restaurant.accountId || undefined,
      after: {
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        temporaryPasswordIssued: Boolean(temporaryPassword),
      },
      request,
    }).catch(() => {});

    return NextResponse.json(
      bigIntToNumber({
        ...newAdmin,
        ...(temporaryPassword ? { temporaryPassword } : {}),
      }),
      { status: 201 }
    );
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
    if (rest.role && !ADMIN_ROLES.includes(rest.role as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.json({ error: 'Rôle administrateur invalide' }, { status: 400 });
    }

    const targetAdmin = await db.admin.findFirst({
      where: { id, restaurantId: admin.restaurantId },
      select: { id: true, password: true },
    });
    if (!targetAdmin) {
      return NextResponse.json({ error: "Administrateur introuvable" }, { status: 404 });
    }

    const updateData: {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      status?: string;
      mustChangePassword?: boolean;
    } = { ...rest };
    if (password) {
      if (admin.id === id) {
        if (!currentPassword) {
          return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
        }
        const isValid = await verifyPassword(currentPassword, targetAdmin.password);
        if (!isValid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
        }
      }
      updateData.password = await hashPassword(password);
      updateData.mustChangePassword = false;
    }

    const updatedAdmin = await db.admin.update({
      where: { id },
      data: updateData,
      select: SAFE_ADMIN_SELECT,
    });
    return NextResponse.json(bigIntToNumber(updatedAdmin));
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
    if (id === admin.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte administrateur', code: 'SELF_DELETE_FORBIDDEN' },
        { status: 400 }
      );
    }

    await db.admin.deleteMany({ where: { id, restaurantId: admin.restaurantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
