import { db, dbReady } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";

// GET /api/staff/schedule — get weekly schedule for all staff
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const staff = await db.staff.findMany({
      where: { restaurantId: admin.restaurantId },
      select: { id: true, name: true, role: true, weeklySchedule: true, totalHours: true, status: true },
      orderBy: { name: "asc" },
    });

    const schedule = staff.map(s => {
      let shifts: Array<{ day: number; startHour: number; endHour: number }> = [];
      try { shifts = JSON.parse(s.weeklySchedule || "[]"); } catch { shifts = []; }
      const weeklyHours = shifts.reduce((sum, shift) => sum + (shift.endHour - shift.startHour), 0);
      return {
        id: s.id,
        name: s.name,
        role: s.role,
        status: s.status,
        shifts,
        weeklyHours,
        totalHours: s.totalHours,
      };
    });

    return NextResponse.json({ data: schedule });
  } catch (error) {
    console.error("[staff/schedule:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH /api/staff/schedule — update a staff member's schedule
// Body: { staffId: "...", shifts: [{day, startHour, endHour}] }
export async function PATCH(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { staffId, shifts } = body as { staffId?: string; shifts?: Array<{ day: number; startHour: number; endHour: number }> };

    if (!staffId) return NextResponse.json({ error: "staffId requis" }, { status: 400 });
    if (!Array.isArray(shifts)) return NextResponse.json({ error: "shifts doit être un tableau" }, { status: 400 });

    // Verify staff belongs to this restaurant
    const existing = await db.staff.findFirst({
      where: { id: staffId, restaurantId: admin.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

    // Calculate total hours
    const totalWeekHours = shifts.reduce((sum, s) => sum + (s.endHour - s.startHour), 0);

    await db.staff.update({
      where: { id: staffId },
      data: { weeklySchedule: JSON.stringify(shifts) },
    });

    return NextResponse.json({
      ok: true,
      staffId,
      shifts,
      weeklyHours: totalWeekHours,
    });
  } catch (error) {
    console.error("[staff/schedule:PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/staff/schedule — clock in/out (pointeuse)
// Body: { staffId: "...", action: "clockIn" | "clockOut", hours: 4.5 }
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { staffId, action, hours } = body as { staffId?: string; action?: string; hours?: number };

    if (!staffId || !action) return NextResponse.json({ error: "staffId et action requis" }, { status: 400 });

    const existing = await db.staff.findFirst({
      where: { id: staffId, restaurantId: admin.restaurantId },
    });
    if (!existing) return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });

    if (action === "clockOut" && typeof hours === "number") {
      await db.staff.update({
        where: { id: staffId },
        data: { totalHours: { increment: hours } },
      });
      return NextResponse.json({ ok: true, action: "clockOut", hoursAdded: hours, totalHours: existing.totalHours + hours });
    }

    return NextResponse.json({ ok: true, action, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[staff/schedule:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
