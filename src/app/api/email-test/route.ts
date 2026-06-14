import { NextResponse } from "next/server";
import { authenticateAdmin, hasRole } from "@/lib/auth";
import {
  sendEmail,
  getEmailProviderInfo,
  orderConfirmationTemplate,
  reservationConfirmationTemplate,
  invoiceCreatedTemplate,
  orderStatusUpdateTemplate,
  passwordResetTemplate,
  welcomeTemplate,
} from "@/lib/email";

// POST: Admin-only endpoint to send a test email
export async function POST(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { to, template } = body as { to?: string; template?: string };

    if (!to || !template) {
      return NextResponse.json(
        { error: "Champs requis : to, template" },
        { status: 400 }
      );
    }

    const validTemplates = [
      "orderConfirmation",
      "reservationConfirmation",
      "invoiceCreated",
      "orderStatusUpdate",
      "passwordReset",
      "welcome",
    ];

    if (!validTemplates.includes(template)) {
      return NextResponse.json(
        { error: `Template invalide. Templates disponibles : ${validTemplates.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate a sample email from the requested template
    let emailContent: { subject: string; html: string };

    switch (template) {
      case "orderConfirmation":
        emailContent = orderConfirmationTemplate({
          customerName: "Test Client",
          orderNumber: "TEST-001",
          items: [
            { name: "Riz Sauce Arachide", qty: 2, price: 25000 },
            { name: "Poulet Braisé", qty: 1, price: 35000 },
            { name: "Jus de Bissap", qty: 3, price: 5000 },
          ],
          total: 100000,
          orderType: "delivery",
          estimatedTime: "30-45 min",
        });
        break;

      case "reservationConfirmation":
        emailContent = reservationConfirmationTemplate({
          customerName: "Test Client",
          date: "15 Juin 2025",
          time: "19:30",
          guests: 4,
          zone: "terrasse",
          confirmationCode: "KFM-ABC123",
        });
        break;

      case "invoiceCreated":
        emailContent = invoiceCreatedTemplate({
          customerName: "Test Client",
          invoiceNumber: "FAC-2025-001",
          amount: 250000,
          dueDate: "30 Juin 2025",
        });
        break;

      case "orderStatusUpdate":
        emailContent = orderStatusUpdateTemplate({
          customerName: "Test Client",
          orderNumber: "TEST-001",
          newStatus: "preparing",
        });
        break;

      case "passwordReset":
        emailContent = passwordResetTemplate({
          resetLink: "https://kfm-delice.com/reset-password?token=test-token-123",
          expiryHours: 1,
        });
        break;

      case "welcome":
        emailContent = welcomeTemplate({
          customerName: "Test Client",
          loginLink: "https://kfm-delice.com/login",
        });
        break;

      default:
        return NextResponse.json(
          { error: "Template non implémenté" },
          { status: 400 }
        );
    }

    const result = await sendEmail({
      to,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return NextResponse.json({
      success: result.success,
      provider: result.provider,
      error: result.error,
      template,
      to,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET: Return email service status (admin-only)
export async function GET(request: Request) {
  try {
    const admin = await authenticateAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!hasRole(admin.role, ["admin", "manager"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const info = getEmailProviderInfo();
    return NextResponse.json({
      provider: info.provider,
      from: info.from,
      templates: [
        "orderConfirmation",
        "reservationConfirmation",
        "invoiceCreated",
        "orderStatusUpdate",
        "passwordReset",
        "welcome",
      ],
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
