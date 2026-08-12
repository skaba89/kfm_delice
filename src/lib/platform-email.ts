import {
  getEmailProviderInfo,
  sendEmail,
  type EmailPayload,
} from '@/lib/email';

export type PlatformEmailDeliveryResult = {
  success: boolean;
  configured: boolean;
  provider: 'resend' | 'smtp' | 'console';
  error?: string;
};

/**
 * Financial/platform email must never treat the development console fallback
 * as a real delivery channel. Restaurant emails keep their historical behavior;
 * platform billing callers use this stricter gateway.
 */
export function isPlatformEmailDeliveryConfigured(): boolean {
  return getEmailProviderInfo().provider !== 'console';
}

export function getPlatformEmailProvider(): 'resend' | 'smtp' | 'console' {
  return getEmailProviderInfo().provider;
}

export async function sendPlatformEmail(payload: EmailPayload): Promise<PlatformEmailDeliveryResult> {
  const provider = getPlatformEmailProvider();
  if (provider === 'console') {
    return {
      success: false,
      configured: false,
      provider,
      error: 'Aucun provider email réel n’est configuré.',
    };
  }

  const result = await sendEmail(payload);
  return {
    success: result.success && result.provider !== 'console',
    configured: true,
    provider: result.provider,
    ...(result.error ? { error: result.error } : {}),
  };
}
