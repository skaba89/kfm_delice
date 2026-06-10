import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const customerRegisterSchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe requis (min 6 caractères)'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nom requis'),
  description: z.string().optional(),
  price: z.number().min(0, 'Prix doit être positif'),
  category: z.string().min(1, 'Catégorie requise'),
  image: z.string().optional(),
  badge: z.string().optional(),
  popular: z.boolean().optional(),
  available: z.boolean().optional(),
  order: z.number().optional(),
});

export const reservationSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().min(1, 'Nom client requis'),
  phone: z.string().optional(),
  date: z.string().min(1, 'Date requise'),
  time: z.string().min(1, 'Heure requise'),
  guests: z.number().min(1, 'Min 1 convive').optional(),
  zone: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export const orderSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  items: z.string(), // JSON string
  total: z.number().min(0),
  status: z.string().optional(),
  orderType: z.string().optional(),
  paymentMethod: z.enum(['cash', 'orange_money', 'mtn_money', 'card']).optional(),
  paymentStatus: z.enum(['pending', 'processing', 'paid', 'failed', 'refunded']).optional(),
  deliveryAddress: z.string().optional(),
  deliveryFee: z.number().optional(),
  tableNumber: z.number().optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  note: z.string().optional(),
  driverId: z.string().nullable().optional(),
});

export const paymentSchema = z.object({
  orderId: z.string().min(1, 'ID commande requis'),
  method: z.enum(['cash', 'orange_money', 'mtn_money', 'card'], { message: 'Méthode de paiement invalide' }),
  phone: z.string().optional(),
  customerName: z.string().optional(),
});

export const paymentStatusSchema = z.object({
  id: z.string().min(1, 'ID paiement requis'),
  status: z.enum(['pending', 'processing', 'paid', 'failed', 'refunded'], { message: 'Statut invalide' }),
  transactionRef: z.string().optional(),
  failedReason: z.string().optional(),
});

export const driverSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nom requis'),
  phone: z.string().min(1, 'Téléphone requis'),
  vehicle: z.string().optional(),
  status: z.string().optional(),
  rating: z.number().optional(),
  totalDeliveries: z.number().optional(),
  zone: z.string().optional(),
});

export const staffSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nom requis'),
  phone: z.string().optional(),
  role: z.string().min(1, 'Rôle requis'),
  salary: z.number().optional(),
  status: z.string().optional(),
  hireDate: z.string().optional(),
  notes: z.string().optional(),
});

export const reviewSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().min(1, 'Nom requis'),
  rating: z.number().min(1).max(5, 'Note entre 1 et 5'),
  comment: z.string().optional(),
  date: z.string().min(1, 'Date requise'),
});

export const invoiceSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1, 'Numéro requis'),
  customerName: z.string().min(1, 'Nom client requis'),
  customerPhone: z.string().optional(),
  items: z.string(),
  subtotal: z.number().min(0),
  tax: z.number().optional(),
  total: z.number().min(0),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  orderId: z.string().optional(),
});

export const quoteSchema = z.object({
  id: z.string().optional(),
  number: z.string().min(1, 'Numéro requis'),
  customerName: z.string().min(1, 'Nom client requis'),
  customerPhone: z.string().optional(),
  items: z.string(),
  subtotal: z.number().min(0),
  discount: z.number().optional(),
  total: z.number().min(0),
  status: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

export const expenseSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Description requise'),
  amount: z.number().min(0, 'Montant doit être positif'),
  category: z.string().min(1, 'Catégorie requise'),
  date: z.string().min(1, 'Date requise'),
  paidBy: z.string().optional(),
  notes: z.string().optional(),
});

export const adminSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe min 6 caractères').optional(),
  name: z.string().min(1, 'Nom requis'),
  role: z.string().optional(),
  status: z.string().optional(),
});

export const customerUpdateSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  password: z.string().min(6).optional(),
  currentPassword: z.string().optional(),
});

export const trackingSchema = z.object({
  orderId: z.string().optional(),
  phone: z.string().optional(),
});

// ────────────────────────────────────────────────────────────────
// Partial schemas for PATCH operations (all fields optional except id)
// ────────────────────────────────────────────────────────────────

export const menuItemPatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  name: z.string().min(1, 'Nom requis').optional(),
  description: z.string().optional(),
  price: z.number().min(0, 'Prix doit être positif').optional(),
  category: z.string().min(1, 'Catégorie requise').optional(),
  image: z.string().optional(),
  badge: z.string().optional(),
  popular: z.boolean().optional(),
  available: z.boolean().optional(),
  order: z.number().optional(),
});

export const reservationPatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  customerName: z.string().min(1, 'Nom client requis').optional(),
  phone: z.string().optional(),
  date: z.string().min(1, 'Date requise').optional(),
  time: z.string().min(1, 'Heure requise').optional(),
  guests: z.number().min(1, 'Min 1 convive').optional(),
  zone: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export const orderPatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  items: z.string().optional(),
  total: z.number().min(0).optional(),
  status: z.string().optional(),
  orderType: z.string().optional(),
  paymentMethod: z.enum(['cash', 'orange_money', 'mtn_money', 'card']).optional(),
  paymentStatus: z.enum(['pending', 'processing', 'paid', 'failed', 'refunded']).optional(),
  deliveryAddress: z.string().optional(),
  deliveryFee: z.number().optional(),
  tableNumber: z.number().optional(),
  discount: z.number().optional(),
  tax: z.number().optional(),
  note: z.string().optional(),
  driverId: z.string().nullable().optional(),
  estimatedDeliveryTime: z.string().optional(),
});

export const driverPatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  name: z.string().min(1, 'Nom requis').optional(),
  phone: z.string().min(1, 'Téléphone requis').optional(),
  vehicle: z.string().optional(),
  status: z.string().optional(),
  rating: z.number().optional(),
  totalDeliveries: z.number().optional(),
  zone: z.string().optional(),
  currentOrderId: z.string().nullable().optional(),
});

export const staffPatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  name: z.string().min(1, 'Nom requis').optional(),
  phone: z.string().optional(),
  role: z.string().min(1, 'Rôle requis').optional(),
  salary: z.number().optional(),
  status: z.string().optional(),
  hireDate: z.string().optional(),
  notes: z.string().optional(),
});

export const adminPatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  email: z.string().email('Email invalide').optional(),
  password: z.string().min(6, 'Mot de passe min 6 caractères').optional(),
  name: z.string().min(1, 'Nom requis').optional(),
  role: z.string().optional(),
  status: z.string().optional(),
});

export const invoicePatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  number: z.string().min(1, 'Numéro requis').optional(),
  customerName: z.string().min(1, 'Nom client requis').optional(),
  customerPhone: z.string().optional(),
  items: z.string().optional(),
  subtotal: z.number().min(0).optional(),
  tax: z.number().optional(),
  total: z.number().min(0).optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export const quotePatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  number: z.string().min(1, 'Numéro requis').optional(),
  customerName: z.string().min(1, 'Nom client requis').optional(),
  customerPhone: z.string().optional(),
  items: z.string().optional(),
  subtotal: z.number().min(0).optional(),
  discount: z.number().optional(),
  total: z.number().min(0).optional(),
  status: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
});

export const expensePatchSchema = z.object({
  id: z.string().min(1, 'ID requis'),
  description: z.string().min(1, 'Description requise').optional(),
  amount: z.number().min(0, 'Montant doit être positif').optional(),
  category: z.string().min(1, 'Catégorie requise').optional(),
  date: z.string().min(1, 'Date requise').optional(),
  paidBy: z.string().optional(),
  notes: z.string().optional(),
});

export const driverLoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const customerCreateSchema = z.object({
  name: z.string().min(2, 'Nom requis (min 2 caractères)'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe requis (min 6 caractères)').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const driverLocationPatchSchema = z.object({
  driverId: z.string().min(1, 'ID livreur requis'),
  lat: z.number().min(-90).max(90, 'Latitude invalide'),
  lng: z.number().min(-180).max(180, 'Longitude invalide'),
  orderId: z.string().optional(),
  status: z.string().optional(),
});

export const driverMePatchSchema = z.object({
  status: z.enum(['available', 'busy', 'offline']).optional(),
  lat: z.number().min(-90).max(90, 'Latitude invalide').optional(),
  lng: z.number().min(-180).max(180, 'Longitude invalide').optional(),
  zone: z.string().optional(),
});

export const driverOrderPatchSchema = z.object({
  orderId: z.string().min(1, 'ID commande requis'),
  status: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
