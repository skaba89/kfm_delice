"use client";

import { useState } from "react";
import {
  UtensilsCrossed, CalendarCheck, Users, LayoutDashboard,
  ShoppingBag, Bike, Car, RefreshCw,
  FileText, Wallet, Receipt, UserCog, ClipboardList,
  MessageSquare, CreditCard, Wifi, WifiOff, Package, Settings,
} from "lucide-react";
import { OverviewTab } from "@/components/admin/OverviewTab";
import { ReservationsTab } from "@/components/admin/ReservationsTab";
import { OrdersTab } from "@/components/admin/OrdersTab";
import { MenuTab } from "@/components/admin/MenuTab";
import { DeliveriesTab } from "@/components/admin/DeliveriesTab";
import { DriversTab } from "@/components/admin/DriversTab";
import { ReviewsTab } from "@/components/admin/ReviewsTab";
import { StaffTab } from "@/components/admin/StaffTab";
import { AdminsTab } from "@/components/admin/AdminsTab";
import { InvoicesTab } from "@/components/admin/InvoicesTab";
import { QuotesTab } from "@/components/admin/QuotesTab";
import { ExpensesTab } from "@/components/admin/ExpensesTab";
import { CustomersTab } from "@/components/admin/CustomersTab";
import { PaymentsTab } from "@/components/admin/PaymentsTab";
import { InventoryTab } from "@/components/admin/InventoryTab";
import { PosTab } from "@/components/admin/PosTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { DashboardShell, type SidebarItem } from "@/components/layout/DashboardShell";
import type { AdminDB, AdminUser, MenuItemDB, OrderDB, DriverDB, StaffDB, InvoiceDB, QuoteDB, ExpenseDB, CustomerDB } from "@/lib/types";
import { useAdminData } from "@/lib/hooks/use-admin-data";
import { useCrudState, type CrudConfig } from "@/lib/hooks/use-crud-state";
import { usePosCart } from "@/lib/hooks/use-pos-cart";
import { useAuth } from "@/lib/auth-context";

// ─── Form type aliases ───────────────────────────────────────────
type DriverForm = { name: string; phone: string; vehicle: string; zone: string };
type StaffForm = { name: string; phone: string; role: string; salary: number; status: string; hireDate: string; notes: string };
type AdminForm = { email: string; password: string; name: string; role: string; status: string };
type ExpenseForm = { description: string; amount: number; category: string; date: string; paidBy: string; notes: string };
type CustomerForm = { name: string; email: string; phone: string; address: string; status: string };
type InvoiceForm = { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; tax: number; total: number; status: string; dueDate: string; notes: string };
type QuoteForm = { number: string; customerName: string; customerPhone: string; items: string; subtotal: number; discount: number; total: number; status: string; validUntil: string; notes: string };
type MenuForm = { name: string; description: string; price: number; category: string; image: string; badge: string; popular: boolean; available: boolean };

// ─── CRUD configurations (replace 7 individual hooks) ───────────
const driverConfig: CrudConfig<DriverDB, DriverForm> = {
  apiEndpoint: "/api/drivers",
  defaultForm: { name: "", phone: "", vehicle: "moto", zone: "Conakry" },
  mapEntityToForm: (d) => ({ name: d.name, phone: d.phone, vehicle: d.vehicle, zone: d.zone }),
  prepareCreate: (form) => ({ ...form, status: "available", rating: 5.0, totalDeliveries: 0 }),
};

const staffConfig: CrudConfig<StaffDB, StaffForm> = {
  apiEndpoint: "/api/staff",
  defaultForm: { name: "", phone: "", role: "serveur", salary: 0, status: "active", hireDate: "", notes: "" },
  mapEntityToForm: (s) => ({ name: s.name, phone: s.phone, role: s.role, salary: s.salary, status: s.status, hireDate: s.hireDate, notes: s.notes }),
  getAddForm: () => ({ name: "", phone: "", role: "serveur", salary: 0, status: "active", hireDate: new Date().toISOString().split("T")[0], notes: "" }),
};

const adminConfig: CrudConfig<AdminDB, AdminForm> = {
  apiEndpoint: "/api/admins",
  defaultForm: { email: "", password: "", name: "", role: "staff", status: "active" },
  mapEntityToForm: (a) => ({ email: a.email, password: "", name: a.name, role: a.role, status: a.status || "active" }),
  prepareUpdate: (form) => {
    const body: Record<string, string> = { ...form };
    if (!body.password) delete body.password;
    return body;
  },
};

const expenseConfig: CrudConfig<ExpenseDB, ExpenseForm> = {
  apiEndpoint: "/api/expenses",
  defaultForm: { description: "", amount: 0, category: "other", date: "", paidBy: "", notes: "" },
  mapEntityToForm: (e) => ({ description: e.description, amount: e.amount, category: e.category, date: e.date, paidBy: e.paidBy, notes: e.notes }),
  getAddForm: () => ({ description: "", amount: 0, category: "other", date: new Date().toISOString().split("T")[0], paidBy: "", notes: "" }),
};

const customerConfig: CrudConfig<CustomerDB, CustomerForm> = {
  apiEndpoint: "/api/customers",
  defaultForm: { name: "", email: "", phone: "", address: "", status: "active" },
  mapEntityToForm: (c) => ({ name: c.name, email: c.email, phone: c.phone, address: c.address, status: c.status }),
};

const invoiceConfig: CrudConfig<InvoiceDB, InvoiceForm> = {
  apiEndpoint: "/api/invoices",
  defaultForm: { number: "FAC-2026-001", customerName: "", customerPhone: "", items: "[]", subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: "", notes: "" },
  mapEntityToForm: (inv) => ({ number: inv.number, customerName: inv.customerName, customerPhone: inv.customerPhone, items: inv.items, subtotal: inv.subtotal, tax: inv.tax, total: inv.total, status: inv.status, dueDate: inv.dueDate, notes: inv.notes }),
  getAddForm: (context?: Record<string, unknown>) => {
    const count = (context?.count as number) || 0;
    const today = new Date().toISOString().split("T")[0];
    return { number: `FAC-2026-${String(count + 1).padStart(3, "0")}`, customerName: "", customerPhone: "", items: "[]", subtotal: 0, tax: 0, total: 0, status: "pending", dueDate: today, notes: "" };
  },
};

const quoteConfig: CrudConfig<QuoteDB, QuoteForm> = {
  apiEndpoint: "/api/quotes",
  defaultForm: { number: "DEV-2026-001", customerName: "", customerPhone: "", items: "[]", subtotal: 0, discount: 0, total: 0, status: "draft", validUntil: "", notes: "" },
  mapEntityToForm: (q) => ({ number: q.number, customerName: q.customerName, customerPhone: q.customerPhone, items: q.items, subtotal: q.subtotal, discount: q.discount, total: q.total, status: q.status, validUntil: q.validUntil, notes: q.notes }),
  getAddForm: (context?: Record<string, unknown>) => {
    const count = (context?.count as number) || 0;
    return { number: `DEV-2026-${String(count + 1).padStart(3, "0")}`, customerName: "", customerPhone: "", items: "[]", subtotal: 0, discount: 0, total: 0, status: "draft", validUntil: "", notes: "" };
  },
};

const menuConfig: CrudConfig<MenuItemDB, MenuForm> = {
  apiEndpoint: "/api/menu",
  defaultForm: { name: "", description: "", price: 0, category: "entrees", image: "", badge: "", popular: false, available: true },
  mapEntityToForm: (item) => ({ name: item.name, description: item.description, price: item.price, category: item.category, image: item.image, badge: item.badge, popular: item.popular, available: item.available }),
};

export function AdminDashboard({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");

  // ─── Data loading + WS real-time ───────────────────────────────
  const {
    stats, reservations, menuItems, orders, drivers, reviews,
    staffList, admins, invoices, quotes, expenses, customers, payments,
    loading, tabLoading, wsConnected,
    loadData, apiPatch, apiPost, apiDelete, apiFetch,
  } = useAdminData(activeTab, admin.id);

  // ─── Generic CRUD hooks (replaces 7 individual hooks) ──────────
  const driverCrud = useCrudState(driverConfig, apiPatch, apiPost);
  const staffCrud = useCrudState(staffConfig, apiPatch, apiPost);
  const adminCrud = useCrudState(adminConfig, apiPatch, apiPost);
  const expenseCrud = useCrudState(expenseConfig, apiPatch, apiPost);
  const customerCrud = useCrudState(customerConfig, apiPatch, apiPost);
  const invoiceCrud = useCrudState(invoiceConfig, apiPatch, apiPost);
  const quoteCrud = useCrudState(quoteConfig, apiPatch, apiPost);
  const menuCrud = useCrudState(menuConfig, apiPatch, apiPost);

  // ─── Menu: local filter state ────────────────────────────────
  const [menuFilter, setMenuFilter] = useState("all");

  // ─── Reviews: delete confirmation ────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Deliveries: driver assignment ───────────────────────────
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

  // If stats failed to load, use a default empty stats object so the dashboard still renders
  const safeStats = stats || {
    todayReservations: 0, pendingReservations: 0, todayRevenue: 0,
    totalOrders: 0, activeOrders: 0, avgRating: 0, totalReviews: 0,
    popularDishes: [] as { name: string; count: number; price: number; category: string }[],
    recentReservations: [] as { id: string; customerName: string; date: string; time: string; guests: number; zone: string; status: string }[],
    deliveryOrders: 0, activeDeliveries: 0, availableDrivers: 0, totalDrivers: 0,
    deliveryRevenue: 0, dineInOrders: 0, takeawayOrders: 0,
    ordersByHour: [] as { hour: string; count: number }[],
    deliveryFee: 0, minDelivery: 0,
    menuCount: 0, staffCount: 0, customerCount: 0, adminCount: 0,
    pendingInvoices: 0, sentQuotes: 0, expenseCount: 0, pendingPayments: 0,
  };

  // ─── Sidebar config (badges from stats — no full arrays needed) ─
  const allSidebarItems: SidebarItem[] = [
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: "reservations", label: "Réservations", icon: CalendarCheck, badge: safeStats.pendingReservations },
    { id: "orders", label: "Commandes", icon: ShoppingBag, badge: safeStats.activeOrders },
    { id: "menu", label: "Menu", icon: UtensilsCrossed, badge: safeStats.menuCount },
    { id: "deliveries", label: "Livraisons", icon: Bike, badge: safeStats.activeDeliveries },
    { id: "drivers", label: "Livreurs", icon: Car, badge: safeStats.availableDrivers },
    { id: "reviews", label: "Avis", icon: MessageSquare, badge: safeStats.totalReviews },
    { id: "staff", label: "Personnel", icon: Users, badge: safeStats.staffCount },
    { id: "customers", label: "Clients", icon: Users, badge: safeStats.customerCount },
    { id: "admins", label: "Utilisateurs", icon: UserCog, badge: safeStats.adminCount },
    { id: "invoices", label: "Factures", icon: FileText, badge: safeStats.pendingInvoices || undefined },
    { id: "quotes", label: "Devis", icon: ClipboardList, badge: safeStats.sentQuotes || undefined },
    { id: "expenses", label: "Dépenses", icon: Wallet, badge: safeStats.expenseCount },
    { id: "inventory", label: "Stock", icon: Package, badge: (safeStats as { lowStockCount?: number })?.lowStockCount || undefined },
    { id: "payments", label: "Paiements", icon: CreditCard, badge: safeStats.pendingPayments || undefined },
    { id: "pos", label: "Caisse POS", icon: Receipt },
    { id: "settings", label: "Paramètres", icon: Settings },
  ];
  const sidebarItems = allSidebarItems.filter(item => {
    // Sidebar visibility per admin role — 8 roles supported.
    // admin             → everything
    // manager           → everything except user management (admins)
    // staff             → operations only (reservations, orders, deliveries, reviews, POS)
    // cashier           → POS, payments, invoices, customers
    // kitchen           → kitchen display, orders, inventory
    // delivery_manager  → drivers, deliveries, orders
    // host              → reservations only
    // accountant        → invoices, quotes, expenses, payments, analytics (no ops)
    const rolesMap: Record<string, string[]> = {
      overview: ["admin", "manager", "accountant"],
      reservations: ["admin", "manager", "staff", "host"],
      orders: ["admin", "manager", "staff", "cashier", "kitchen", "delivery_manager"],
      menu: ["admin", "manager", "kitchen"],
      deliveries: ["admin", "manager", "staff", "delivery_manager"],
      drivers: ["admin", "manager", "delivery_manager"],
      reviews: ["admin", "manager", "staff"],
      staff: ["admin", "manager"],
      customers: ["admin", "manager", "cashier"],
      admins: ["admin"],
      invoices: ["admin", "manager", "cashier", "accountant"],
      quotes: ["admin", "manager", "accountant"],
      expenses: ["admin", "manager", "accountant"],
      inventory: ["admin", "manager", "kitchen"],
      payments: ["admin", "manager", "cashier", "accountant"],
      pos: ["admin", "manager", "staff", "cashier"],
      settings: ["admin", "manager"],
    };
    return rolesMap[item.id]?.includes(admin.role) ?? false;
  });

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></div>;
  }

  return (
    <DashboardShell
      brandIcon={<UtensilsCrossed className="w-5 h-5 text-white" />}
      brandTitle="KFM Delice"
      brandSubtitle="Administration"
      brandGradient="bg-gradient-to-br from-orange-500 to-red-600"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userName={admin.name}
      userInitial={admin.name[0]}
      avatarGradient="bg-gradient-to-br from-orange-400 to-red-500"
      notificationCount={safeStats.pendingReservations}
      onRefresh={loadData}
      onLogout={onLogout}
      wsIndicator={wsConnected ? <Wifi className="w-3.5 h-3.5 text-green-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
      loading={tabLoading}
    >
      {activeTab === "overview" && <OverviewTab stats={safeStats} orders={orders} apiFetch={apiFetch} />}
      {activeTab === "reservations" && <ReservationsTab reservations={reservations} apiPatch={apiPatch} />}
      {activeTab === "orders" && <OrdersTab orders={orders} apiPatch={apiPatch} />}
      {activeTab === "menu" && <MenuTab
        menuItems={menuItems}
        menuFilter={menuFilter} setMenuFilter={setMenuFilter}
        crud={menuCrud}
        apiPatch={apiPatch} apiDelete={apiDelete}
        apiFetch={apiFetch}
        readOnly={admin.role === "kitchen"}
      />}
      {activeTab === "deliveries" && <DeliveriesTab orders={orders} drivers={drivers} apiPatch={apiPatch} apiFetch={apiFetch} assigningOrderId={assigningOrderId} setAssigningOrderId={setAssigningOrderId} loadData={loadData} />}
      {activeTab === "drivers" && <DriversTab
        drivers={drivers}
        crud={driverCrud}
        apiPatch={apiPatch} apiDelete={apiDelete}
      />}
      {activeTab === "reviews" && <ReviewsTab reviews={reviews} stats={safeStats} apiDelete={apiDelete} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} />}
      {activeTab === "staff" && <StaffTab
        staffList={staffList}
        crud={staffCrud}
        apiDelete={apiDelete}
      />}
      {activeTab === "customers" && <CustomersTab
        customers={customers}
        crud={customerCrud}
        apiPatch={apiPatch} apiDelete={apiDelete}
      />}
      {activeTab === "admins" && <AdminsTab
        admins={admins} admin={admin}
        crud={adminCrud}
        apiPatch={apiPatch} apiDelete={apiDelete}
      />}
      {activeTab === "invoices" && <InvoicesTab
        invoices={invoices}
        crud={invoiceCrud}
        apiPatch={apiPatch} apiDelete={apiDelete}
      />}
      {activeTab === "quotes" && <QuotesTab
        quotes={quotes}
        crud={quoteCrud}
        apiPatch={apiPatch} apiDelete={apiDelete}
      />}
      {activeTab === "expenses" && <ExpensesTab
        expenses={expenses}
        crud={expenseCrud}
        apiDelete={apiDelete}
      />}
      {activeTab === "inventory" && <InventoryTab />}
      {activeTab === "payments" && <PaymentsTab payments={payments} apiPatch={apiPatch} />}
      {activeTab === "pos" && <PosTabWithState menuItems={menuItems} orders={orders} loadData={loadData} />}
      {activeTab === "settings" && <SettingsTab
        apiFetch={apiFetch}
        apiPatch={async (url, body) => {
          try { await apiPatch(url, body); return { success: true }; }
          catch (e) { return { success: false, error: e instanceof Error ? e.message : "Erreur" }; }
        }}
        apiPut={async (url, body) => {
          try { await apiPatch(url, body); return { success: true }; }
          catch (e) { return { success: false, error: e instanceof Error ? e.message : "Erreur" }; }
        }}
        adminRole={admin.role}
        admins={admins}
      />}
    </DashboardShell>
  );
}

// ─── PosTab wrapper that owns its own state via usePosCart ──────
function PosTabWithState({ menuItems, orders, loadData }: { menuItems: MenuItemDB[]; orders: OrderDB[]; loadData: () => Promise<void> }) {
  const { apiFetch } = useAuth();
  const pos = usePosCart(loadData, apiFetch);
  return <PosTab
    menuItems={menuItems}
    posCart={pos.posCart} setPosCart={pos.setPosCart}
    posTable={pos.posTable} setPosTable={pos.setPosTable}
    posOrderType={pos.posOrderType} setPosOrderType={pos.setPosOrderType}
    posDeliveryAddress={pos.posDeliveryAddress} setPosDeliveryAddress={pos.setPosDeliveryAddress}
    posDeliveryFee={pos.posDeliveryFee} setPosDeliveryFee={pos.setPosDeliveryFee}
    posPayment={pos.posPayment} setPosPayment={pos.setPosPayment}
    posDiscount={pos.posDiscount} setPosDiscount={pos.setPosDiscount}
    posCustomerName={pos.posCustomerName} setPosCustomerName={pos.setPosCustomerName}
    posCustomerPhone={pos.posCustomerPhone} setPosCustomerPhone={pos.setPosCustomerPhone}
    posNote={pos.posNote} setPosNote={pos.setPosNote}
    posCategoryFilter={pos.posCategoryFilter} setPosCategoryFilter={pos.setPosCategoryFilter}
    posSearch={pos.posSearch} setPosSearch={pos.setPosSearch}
    posReceipt={pos.posReceipt} setPosReceipt={pos.setPosReceipt}
    posSubmitting={pos.posSubmitting} setPosSubmitting={pos.setPosSubmitting}
    loadData={loadData} orders={orders} apiFetch={apiFetch}
  />;
}
