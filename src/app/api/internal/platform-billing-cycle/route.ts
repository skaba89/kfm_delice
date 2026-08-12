import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runPlatformBillingCycle } from '@/lib/platform-billing-cycle';

function safeSecretEquals(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return '';
  return authorization.slice('Bearer '.length).trim();
}

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.BILLING_CRON_SECRET?.trim() || '';
    if (!expectedSecret) {
      console.error('[platform-billing-cycle] BILLING_CRON_SECRET is not configured');
      return NextResponse.json(
        { error: 'Automatisation de facturation non configurée', code: 'BILLING_AUTOMATION_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    const receivedSecret = bearerToken(request);
    if (!receivedSecret || !safeSecretEquals(receivedSecret, expectedSecret)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const result = await runPlatformBillingCycle();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('[platform-billing-cycle POST]', error);
    return NextResponse.json(
      { error: 'Le cycle de facturation a échoué', code: 'BILLING_CYCLE_FAILED' },
      { status: 500 },
    );
  }
}
