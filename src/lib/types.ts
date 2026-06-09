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
}
export interface StaffDB {
  id: string; name: string; phone: string; role: string;
  salary: number; status: string; hireDate: string; notes: string; createdAt: string;
}
export interface AdminDB {
  id: string; email: string; password: string; name: string;
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
export interface AdminUser { id: string; email: string; name: string; role: string; }
export interface CustomerUser { id: string; email: string; name: string; phone: string; address: string; loyaltyPoints: number; totalOrders: number; totalSpent: number; status: string; }
export interface DriverUser { id: string; email: string; name: string; phone: string; vehicle: string; status: string; rating: number; totalDeliveries: number; zone: string; currentOrderId: string; lat: number; lng: number; }
