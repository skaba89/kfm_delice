import { Suspense } from "react";
import { QrScanClient } from "./QrScanClient";

// ────────────────────────────────────────────────────────────────
// /q/[token] — PUBLIC QR scan landing page
//
// When a customer scans the QR code on a restaurant table, their
// phone's browser opens this page. We then:
//   1. Call /api/qr/table/[token] to resolve the token
//   2. If valid → redirect to /menu?restaurant=<slug>&tableToken=<tableId>
//   3. If invalid → show a clear error page (no fallback to default tenant)
//
// We use a server component wrapper + a client component so the
// Suspense boundary is correct (useSearchParams requires Suspense
// in Next.js 16 when used in a client component).
// ────────────────────────────────────────────────────────────────

export default async function QrScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
          <div className="animate-pulse text-orange-500 text-lg">Chargement…</div>
        </div>
      }
    >
      <QrScanClient token={token} />
    </Suspense>
  );
}
