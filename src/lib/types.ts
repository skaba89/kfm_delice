export interface Reservation {
  id: string; customerName: string; phone: string; date: string;
  time: string; guests: number; zone: string; notes: string;
  status: string; loyaltyPoint: number; createdAt: string;
}
export interface MenuItemDB {
  id: string; name: string; description: string; price: number;
  category: string; image: string; badge: string; popular: boolean;
  available: boolean; order: number;
}
export interface DriverDB {
  id: string; email: string; name: string; phone: string; vehicle: string;
  status: string; rating: number; totalDeliveries: number;
  zone: string; lat: number; lng: number; currentOrderId: string;
  lastLocationUpdate: string; createdAt: string;
}
export interface OrderDB {
  id: string; customerName: string; phone: string; items: string;
  total: number; status: string; orderType: string; paymentMethod: string;
  deliveryAddress: string; deliveryFee: number; tableNumber: number;
  discount: number; tax: number; note: string;
  estimatedDeliveryTime: string; driverLat: number; driverLng: number;
  driverId: string | null;
  driver: DriverDB | null; createdAt: string;
}
export interface ReviewDB {
  id: string; customerName: string; rating: number; comment: string;
  date: string; createdAt: string;
}
export interface Stats {
  todayReservations: number; pendingReservations: number; todayRevenue: number;
  totalOrders: number; activeOrders: number; avgRating: number;
  totalReviews: number; popularDishes: { name: string; count: number; price: number; category: string }[];
  recentReservations: { id: string; customerName: string; date: string; time: string; guests: number; zone: string; status: string }[];
  deliveryOrders: number; activeDeliveries: number; availableDrivers: number;
  totalDrivers: number; deliveryRevenue: number; dineInOrders: number; takeawayOrders: number;
  deliveryFee?: number; minDelivery?: number;
  ordersByHour?: { hour: string; count: number }[];
  // Badge counts for sidebar (avoid loading full arrays just for counts)
  menuCount: number; staffCount: number; customerCount: number; adminCount: number;
  pendingInvoices: number; sentQuotes: number; expenseCount: number; pendingPayments: number;
}
export interface StaffDB {
  id: string; name: string; phone: string; role: string;
  salary: number; status: string; hireDate: string; notes: string; createdAt: string;
}
export interface AdminDB {
  id: string; email: string; password?: string; name: string;
  role: string; status: string; createdAt: string;
}
export interface InvoiceDB {
  id: string; number: string; customerName: string; customerPhone: string;
  items: string; subtotal: number; tax: number; total: number;
  status: string; dueDate: string; notes: string; createdAt: string;
}
export interface QuoteDB {
  id: string; number: string; customerName: string; customerPhone: string;
  items: string; subtotal: number; discount: number; total: number;
  status: string; validUntil: string; notes: string; createdAt: string;
}
export interface ExpenseDB {
  id: string; description: string; amount: number; category: string;
  date: string; paidBy: string; notes: string; createdAt: string;
}
export interface CustomerDB {
  id: string; email: string; name: string; phone: string; address: string;
  loyaltyPoints: number; totalOrders: number; totalSpent: number;
  status: string; createdAt: string;
}
export interface PaymentDB {
  id: string; orderId: string; amount: number; method: string;
  status: string; transactionRef: string; phone: string;
  customerName: string; paidAt: string; failedReason: string;
  createdAt: string;
}
export interface RestaurantDB {
  id: string; name: string; slug: string; tagline: string; description: string;
  phone: string; whatsapp: string; email: string; address: string; hours: string;
  rating: number; tables: number; deliveryFee: number; minDelivery: number;
  deliveryZones: string; plan: string; status: string; currency: string; locale: string;
  ownerEmail: string; ownerName: string; ownerPhone: string;
  primaryColor?: string; accentColor?: string; secondaryColor?: string; logo?: string; heroImage?: string;
  latitude?: number; longitude?: number;
  facebook?: string; instagram?: string; twitter?: string;
  taxRate?: number;
  createdAt: string; updatedAt: string;
}
export interface AdminUser { id: string; email: string; name: string; role: string; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean; }
export interface CustomerUser { id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean; }
export interface DriverUser { id: string; email: string; name: string; phone: string; vehicle: string; status: string; rating: number; totalDeliveries: number; zone: string; currentOrderId: string; lat: number; lng: number; restaurantId?: string; restaurantSlug?: string; mustChangePassword?: boolean; }
