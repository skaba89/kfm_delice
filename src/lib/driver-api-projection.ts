import type { Prisma } from '@prisma/client';

export const DRIVER_ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  vehicle: true,
  status: true,
  rating: true,
  totalDeliveries: true,
  zone: true,
  lat: true,
  lng: true,
  lastLocationUpdate: true,
  currentOrderId: true,
  commissionRate: true,
  totalEarnings: true,
  restaurantId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DriverSelect;

export const DRIVER_CUSTOMER_ORDER_SELECT = {
  id: true,
  name: true,
  phone: true,
  vehicle: true,
  status: true,
  rating: true,
  lat: true,
  lng: true,
  currentOrderId: true,
} satisfies Prisma.DriverSelect;

export const DRIVER_ADMIN_ORDER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  vehicle: true,
  status: true,
  rating: true,
  totalDeliveries: true,
  zone: true,
  lat: true,
  lng: true,
  currentOrderId: true,
} satisfies Prisma.DriverSelect;
