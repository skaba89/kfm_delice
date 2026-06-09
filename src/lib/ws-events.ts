// WebSocket event names for RestoProGN
export const WSEvents = {
  // Order events
  ORDER_NEW: 'order:new',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  ORDER_ASSIGNED: 'order:assigned',

  // Driver events
  DRIVER_LOCATION_UPDATE: 'driver:location_update',
  DRIVER_STATUS_CHANGED: 'driver:status_changed',

  // Reservation events
  RESERVATION_NEW: 'reservation:new',
  RESERVATION_STATUS_CHANGED: 'reservation:status_changed',

  // Admin notification events
  ADMIN_NOTIFICATION: 'admin:notification',

  // Customer tracking events
  TRACKING_UPDATE: 'tracking:update',

  // Connection events
  WS_CONNECTED: 'ws:connected',
} as const;

export type WSEventName = typeof WSEvents[keyof typeof WSEvents];
