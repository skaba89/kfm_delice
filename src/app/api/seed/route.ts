import { NextResponse } from 'next/server';

const retired = () => NextResponse.json(
  {
    error: 'Le seed HTTP est désactivé.',
    code: 'HTTP_SEED_RETIRED',
    remediation: 'Utiliser les scripts CLI contrôlés et les pipelines CI/CD prévus pour le bootstrap ou les données de test.',
  },
  { status: 410 }
);

/**
 * The web application must never be able to seed or reset a production DB.
 * CI uses scripts/auto-seed.cjs against ephemeral databases; production
 * bootstrap is performed through explicit CLI/admin procedures instead.
 */
export async function GET() {
  return retired();
}

export async function POST() {
  return retired();
}
