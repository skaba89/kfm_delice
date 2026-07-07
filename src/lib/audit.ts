import { db } from './db';

/**
 * Log a business action to the AuditLog table.
 * Safe to call — never throws (catches all errors internally).
 */
export async function logAudit(params: {
  actorId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  accountId?: string | null;
  restaurantId?: string | null;
  before?: unknown;
  after?: unknown;
  request?: Request;
}): Promise<void> {
  try {
    const ipAddress = params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
    const userAgent = params.request?.headers.get('user-agent') || '';

    await db.auditLog.create({
      data: {
        actorId: params.actorId,
        actorType: params.actorType,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        ...(params.accountId && { accountId: params.accountId }),
        ...(params.restaurantId && { restaurantId: params.restaurantId }),
        ...(params.before !== undefined && { before: params.before as never }),
        ...(params.after !== undefined && { after: params.after as never }),
        ipAddress,
        userAgent,
      },
    });
  } catch (e) {
    console.warn('[audit] Failed to log:', e instanceof Error ? e.message : String(e));
  }
}
