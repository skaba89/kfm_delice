import { NextResponse } from "next/server";

// GET /api/currency/convert?from=GNF&to=EUR&amount=50000
// Returns converted amount using fixed exchange rates (updated quarterly)
// In production, this would call a live FX API

const RATES: Record<string, number> = {
  GNF: 1,      // base currency
  EUR: 0.0001, // 1 GNF = 0.0001 EUR
  USD: 0.00012, // 1 GNF = 0.00012 USD
  XOF: 0.0556,  // 1 GNF = 0.0556 XOF (Franc CFA)
};

const SYMBOLS: Record<string, string> = {
  GNF: "GNF",
  EUR: "€",
  USD: "$",
  XOF: "FCFA",
};

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const from = (sp.get("from") || "GNF").toUpperCase();
    const to = (sp.get("to") || "EUR").toUpperCase();
    const amount = parseFloat(sp.get("amount") || "0");

    if (!RATES[from] || !RATES[to]) {
      return NextResponse.json({ error: `Devise non supportée. Disponibles: ${Object.keys(RATES).join(", ")}` }, { status: 400 });
    }

    // Convert via GNF as base
    const amountInGNF = amount / RATES[from];
    const converted = amountInGNF * RATES[to];
    const rounded = to === "GNF" || to === "XOF" ? Math.round(converted) : Math.round(converted * 100) / 100;

    return NextResponse.json({
      from,
      to,
      amount,
      converted: rounded,
      rate: RATES[to] / RATES[from],
      symbol: SYMBOLS[to],
      formatted: `${rounded.toLocaleString("fr-FR")} ${SYMBOLS[to]}`,
    });
  } catch (error) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
