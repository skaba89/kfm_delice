const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) return 'denied';
  return await Notification.requestPermission();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('[SW] Service Worker registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('[SW] Registration failed:', error);
    return null;
  }
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  if (!registration) return null;

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY,
    });
    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

export async function showLocalNotification(title: string, body: string, url?: string): Promise<void> {
  if (!isPushNotificationSupported()) return;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  if (registration) {
    registration.showNotification(title, {
      body,
      icon: '/images/icon-192.png',
      badge: '/images/favicon-32.png',
      vibrate: [100, 50, 100],
      data: { url: url || '/' },
      actions: [
        { action: 'open', title: 'Ouvrir' },
        { action: 'close', title: 'Fermer' },
      ],
    } as NotificationOptions);
  }
}

/**
 * Subscribe the current user to push notifications and save to server.
 */
export async function subscribeAndSave(userId: string, userType: string): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) return false;

    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return false;

    // Try to subscribe via pushManager (requires VAPID key)
    let subscription: PushSubscription | null = null;
    if (VAPID_PUBLIC_KEY) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
    }

    // Save subscription to server
    if (subscription) {
      const token = localStorage.getItem('kfm_delice_token');
      await fetch('/api/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
    }

    return true;
  } catch (error) {
    console.error('[Push] Subscribe and save failed:', error);
    return false;
  }
}

/**
 * Send a local notification for order events (no server required).
 * Useful for real-time order status updates via WebSocket.
 */
export function notifyOrderEvent(event: string, data: Record<string, unknown>): void {
  const notifications: Record<string, { title: string; body: string }> = {
    'order:new': { title: 'Nouvelle commande !', body: `Commande de ${data.customerName || 'un client'} — ${data.orderType || ''}` },
    'order:status_changed': { title: 'Statut commande', body: `Commande mise à jour : ${data.status || ''}` },
    'order:assigned': { title: 'Commande assignée', body: `Livraison assignée pour ${data.customerName || ''}` },
    'reservation:new': { title: 'Nouvelle réservation !', body: `${data.customerName || ''} — ${data.guests || ''} pers.` },
    'reservation:status_changed': { title: 'Réservation mise à jour', body: `Statut : ${data.status || ''}` },
    'tracking:update': { title: 'Suivi livraison', body: `Votre commande est en route !` },
    'admin:notification': { title: 'Notification admin', body: String(data.type || 'Nouvelle notification') },
  };

  const notification = notifications[event];
  if (notification) {
    showLocalNotification(notification.title, notification.body);
  }
}

// ============================================================
// PWA Install Prompt
// ============================================================

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Listen for the beforeinstallprompt event (call once on app mount).
 */
export function setupInstallPromptListener(
  onAvailable?: (available: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    // Prevent the default mini-infobar
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    onAvailable?.(true);
    console.log('[PWA] Install prompt ready');
  };

  window.addEventListener('beforeinstallprompt', handler);

  // Cleanup function
  return () => {
    window.removeEventListener('beforeinstallprompt', handler);
  };
}

/**
 * Show the PWA install prompt (if available).
 * Returns true if the user accepted, false otherwise.
 */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return result.outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Install prompt error:', error);
    return false;
  }
}

/**
 * Check if the app is installed (running in standalone mode).
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         (navigator as unknown as { standalone?: boolean }).standalone === true;
}

// Initialize PWA features
export async function initPWA(): Promise<void> {
  await registerServiceWorker();
}
