import { db, dbReady, bigIntToNumber } from "@/lib/db";
import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth";
import { parsePagination, prismaSkip, prismaTake } from "@/lib/pagination";
import { WSEvents } from "@/lib/ws-events";

// ────────────────────────────────────────────────────────────────
// GET /api/chat — list chat messages for the admin's restaurant
//
// Returns the latest 50 messages by default (paginated). The client
// polls this endpoint every 5s (no WebSocket needed in production —
// the polling pattern is already used for orders + kitchen).
// ────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const sp = new URL(request.url).searchParams;
    const { page, limit } = parsePagination(sp);
    // Default to latest 50 messages, newest first
    const effectiveLimit = Math.min(limit, 100);

    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where: { restaurantId: admin.restaurantId },
        orderBy: { createdAt: "desc" },
        take: prismaTake(effectiveLimit),
        skip: prismaSkip(page, effectiveLimit),
      }),
      db.chatMessage.count({ where: { restaurantId: admin.restaurantId } }),
    ]);

    const totalPages = Math.ceil(total / effectiveLimit);
    return NextResponse.json({
      data: bigIntToNumber(messages.reverse()), // reverse to show oldest→newest in UI
      pagination: {
        page,
        limit: effectiveLimit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("[chat:GET]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────────
// POST /api/chat — post a new message
//
// Body: { content: "Message text" }
// The sender is identified by the JWT token (admin.restaurantId + admin.id).
// Content is validated: 1-1000 chars, no HTML.
// ────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    await dbReady;
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body as { content?: string };

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Message requis" }, { status: 400 });
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "Message vide" }, { status: 400 });
    }
    if (trimmed.length > 1000) {
      return NextResponse.json(
        { error: "Message trop long (max 1000 caractères)" },
        { status: 400 }
      );
    }
    // Basic sanitization — strip HTML tags to prevent XSS in the chat UI
    const sanitized = trimmed
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const message = await db.chatMessage.create({
      data: {
        restaurantId: admin.restaurantId,
        senderId: admin.id,
        senderName: admin.name || admin.email,
        senderRole: admin.role,
        content: sanitized,
      },
    });

    // Broadcast via WebSocket (localhost-only in production — polling covers the rest)
    try {
      const { broadcastToType } = await import("@/lib/websocket-server");
      broadcastToType("admin", "chat:new", {
        id: message.id,
        restaurantId: message.restaurantId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        content: message.content,
        createdAt: message.createdAt,
      });
    } catch {
      /* WS not available — polling will pick it up */
    }

    return NextResponse.json(bigIntToNumber(message), { status: 201 });
  } catch (error) {
    console.error("[chat:POST]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
