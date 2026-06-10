"use client";

import { useState } from "react";
import {
  UtensilsCrossed, CalendarCheck, Users, LayoutDashboard,
  ShoppingBag, Bike, Car, RefreshCw,
  FileText, Wallet, Receipt, UserCog, ClipboardList,
  MessageSquare, CreditCard,
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
import { PosTab } from "@/components/admin/PosTab";
import { DashboardShell, type SidebarItem } from "@/components/layout/DashboardShell";
import type { AdminUser, MenuItemDB, OrderDB } from "@/lib/types";
import { useAdminData } from "@/lib/hooks/use-admin-data";
import { useMenuCrud } from "@/lib/hooks/use-menu-crud";
import { useDriverCrud } from "@/lib/hooks/use-driver-crud";
import { useStaffCrud } from "@/lib/hooks/use-staff-crud";
import { useAdminCrud } from "@/lib/hooks/use-admin-crud";
import { useInvoiceCrud } from "@/lib/hooks/use-invoice-crud";
import { useQuoteCrud } from "@/lib/hooks/use-quote-crud";
import { useExpenseCrud } from "@/lib/hooks/use-expense-crud";
import { useCustomerCrud } from "@/lib/hooks/use-customer-crud";
import { usePosCart } from "@/lib/hooks/use-pos-cart";
import { useAuth } from "@/lib/auth-context";

export function AdminDashboard({ admin, onLogout }: { admin: AdminUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState("overview");

  // ─── Data loading + generic CRUD helpers ─────────────────────
  const {
    stats, reservations, menuItems, orders, drivers, reviews,
    staffList, admins, invoices, quotes, expenses, customers, payments, loading,
    loadData, apiPatch, apiPost, apiDelete, apiFetch,
  } = useAdminData();

  // ─── Domain-specific CRUD hooks ──────────────────────────────
  const menuCrud = useMenuCrud(menuItems, apiPatch, apiPost);
  const driverCrud = useDriverCrud(apiPatch, apiPost);
  const staffCrud = useStaffCrud(apiPatch, apiPost);
  const adminCrud = useAdminCrud(apiPatch, apiPost);
  const invoiceCrud = useInvoiceCrud(invoices, apiPatch, apiPost);
  const quoteCrud = useQuoteCrud(quotes, apiPatch, apiPost);
  const expenseCrud = useExpenseCrud(apiPatch, apiPost);
  const customerCrud = useCustomerCrud(apiPatch, apiPost);

  // ─── Reviews: delete confirmation ────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Sidebar config ──────────────────────────────────────────
  const allSidebarItems: SidebarItem[] = [
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: "reservations", label: "Réservations", icon: CalendarCheck, badge: stats?.pendingReservations },
    { id: "orders", label: "Commandes", icon: ShoppingBag, badge: stats?.activeOrders },
    { id: "menu", label: "Menu", icon: UtensilsCrossed, badge: menuItems.length },
    { id: "deliveries", label: "Livraisons", icon: Bike, badge: stats?.activeDeliveries },
    { id: "drivers", label: "Livreurs", icon: Car, badge: stats?.availableDrivers },
    { id: "reviews", label: "Avis", icon: MessageSquare, badge: stats?.totalReviews },
    { id: "staff", label: "Personnel", icon: Users, badge: staffList.length },
    { id: "customers", label: "Clients", icon: Users, badge: customers.length },
    { id: "admins", label: "Utilisateurs", icon: UserCog, badge: admins.length },
    { id: "invoices", label: "Factures", icon: FileText, badge: invoices.filter(i => i.status === "pending").length || undefined },
    { id: "quotes", label: "Devis", icon: ClipboardList, badge: quotes.filter(q => q.status === "sent").length || undefined },
    { id: "expenses", label: "Dépenses", icon: Wallet, badge: expenses.length },
    { id: "payments", label: "Paiements", icon: CreditCard, badge: payments.filter(p => p.status === "pending").length || undefined },
    { id: "pos", label: "Caisse POS", icon: Receipt },
  ];
  const sidebarItems = allSidebarItems.filter(item => {
    const rolesMap: Record<string, string[]> = {
      overview: ["admin", "manager"],
      reservations: ["admin", "manager", "staff"],
      orders: ["admin", "manager", "staff"],
      menu: ["admin", "manager"],
      deliveries: ["admin", "manager", "staff"],
      drivers: ["admin", "manager"],
      reviews: ["admin", "manager", "staff"],
      staff: ["admin", "manager"],
      customers: ["admin", "manager"],
      admins: ["admin"],
      invoices: ["admin", "manager"],
      quotes: ["admin", "manager"],
      expenses: ["admin", "manager"],
      payments: ["admin", "manager"],
      pos: ["admin", "manager", "staff"],
    };
    return rolesMap[item.id]?.includes(admin.role) ?? false;
  });

  if (loading || !stats) {
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
      notificationCount={stats.pendingReservations}
      onRefresh={loadData}
      onLogout={onLogout}
    >
      {activeTab === "overview" && <OverviewTab stats={stats} orders={orders} apiFetch={apiFetch} />}
      {activeTab === "reservations" && <ReservationsTab reservations={reservations} apiPatch={apiPatch} />}
      {activeTab === "orders" && <OrdersTab orders={orders} apiPatch={apiPatch} />}
      {activeTab === "menu" && <MenuTab
        menuItems={menuItems}
        filteredMenuItems={menuCrud.filteredMenuItems}
        menuFilter={menuCrud.menuFilter} setMenuFilter={menuCrud.setMenuFilter}
        showMenuForm={menuCrud.showMenuForm} editingItem={menuCrud.editingItem}
        menuForm={menuCrud.menuForm} setMenuForm={menuCrud.setMenuForm}
        openAddMenu={menuCrud.openAddMenu} openEditMenu={menuCrud.openEditMenu} saveMenu={menuCrud.saveMenu}
        setShowMenuForm={menuCrud.setShowMenuForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm}
        apiFetch={apiFetch}
      />}
      {activeTab === "deliveries" && <DeliveriesTab orders={orders} drivers={drivers} apiPatch={apiPatch} apiFetch={apiFetch} assigningOrderId={null} setAssigningOrderId={() => {}} loadData={loadData} />}
      {activeTab === "drivers" && <DriversTab
        drivers={drivers}
        showDriverForm={driverCrud.showDriverForm} editingDriver={driverCrud.editingDriver}
        driverForm={driverCrud.driverForm} setDriverForm={driverCrud.setDriverForm}
        openAddDriver={driverCrud.openAddDriver} openEditDriver={driverCrud.openEditDriver} saveDriver={driverCrud.saveDriver}
        setShowDriverForm={driverCrud.setShowDriverForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteDriverConfirm={driverCrud.deleteDriverConfirm} setDeleteDriverConfirm={driverCrud.setDeleteDriverConfirm}
      />}
      {activeTab === "reviews" && <ReviewsTab reviews={reviews} stats={stats} apiDelete={apiDelete} deleteConfirm={deleteConfirm} setDeleteConfirm={setDeleteConfirm} />}
      {activeTab === "staff" && <StaffTab
        staffList={staffList}
        showStaffForm={staffCrud.showStaffForm} editingStaff={staffCrud.editingStaff}
        staffForm={staffCrud.staffForm} setStaffForm={staffCrud.setStaffForm}
        openAddStaff={staffCrud.openAddStaff} openEditStaff={staffCrud.openEditStaff} saveStaff={staffCrud.saveStaff}
        setShowStaffForm={staffCrud.setShowStaffForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteStaffConfirm={staffCrud.deleteStaffConfirm} setDeleteStaffConfirm={staffCrud.setDeleteStaffConfirm}
      />}
      {activeTab === "customers" && <CustomersTab
        customers={customers}
        showCustomerForm={customerCrud.showCustomerForm} editingCustomer={customerCrud.editingCustomer}
        customerForm={customerCrud.customerForm} setCustomerForm={customerCrud.setCustomerForm}
        openAddCustomer={customerCrud.openAddCustomer} openEditCustomer={customerCrud.openEditCustomer} saveCustomer={customerCrud.saveCustomer}
        setShowCustomerForm={customerCrud.setShowCustomerForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteCustomerConfirm={customerCrud.deleteCustomerConfirm} setDeleteCustomerConfirm={customerCrud.setDeleteCustomerConfirm}
      />}
      {activeTab === "admins" && <AdminsTab
        admins={admins} admin={admin}
        showAdminForm={adminCrud.showAdminForm} editingAdmin={adminCrud.editingAdmin}
        adminForm={adminCrud.adminForm} setAdminForm={adminCrud.setAdminForm}
        openAddAdmin={adminCrud.openAddAdmin} openEditAdmin={adminCrud.openEditAdmin} saveAdmin={adminCrud.saveAdmin}
        setShowAdminForm={adminCrud.setShowAdminForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteAdminConfirm={adminCrud.deleteAdminConfirm} setDeleteAdminConfirm={adminCrud.setDeleteAdminConfirm}
      />}
      {activeTab === "invoices" && <InvoicesTab
        invoices={invoices}
        showInvoiceForm={invoiceCrud.showInvoiceForm} editingInvoice={invoiceCrud.editingInvoice}
        invoiceForm={invoiceCrud.invoiceForm} setInvoiceForm={invoiceCrud.setInvoiceForm}
        openAddInvoice={invoiceCrud.openAddInvoice} openEditInvoice={invoiceCrud.openEditInvoice} saveInvoice={invoiceCrud.saveInvoice}
        setShowInvoiceForm={invoiceCrud.setShowInvoiceForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteInvoiceConfirm={invoiceCrud.deleteInvoiceConfirm} setDeleteInvoiceConfirm={invoiceCrud.setDeleteInvoiceConfirm}
      />}
      {activeTab === "quotes" && <QuotesTab
        quotes={quotes}
        showQuoteForm={quoteCrud.showQuoteForm} editingQuote={quoteCrud.editingQuote}
        quoteForm={quoteCrud.quoteForm} setQuoteForm={quoteCrud.setQuoteForm}
        openAddQuote={quoteCrud.openAddQuote} openEditQuote={quoteCrud.openEditQuote} saveQuote={quoteCrud.saveQuote}
        setShowQuoteForm={quoteCrud.setShowQuoteForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteQuoteConfirm={quoteCrud.deleteQuoteConfirm} setDeleteQuoteConfirm={quoteCrud.setDeleteQuoteConfirm}
      />}
      {activeTab === "expenses" && <ExpensesTab
        expenses={expenses}
        showExpenseForm={expenseCrud.showExpenseForm} editingExpense={expenseCrud.editingExpense}
        expenseForm={expenseCrud.expenseForm} setExpenseForm={expenseCrud.setExpenseForm}
        openAddExpense={expenseCrud.openAddExpense} openEditExpense={expenseCrud.openEditExpense} saveExpense={expenseCrud.saveExpense}
        setShowExpenseForm={expenseCrud.setShowExpenseForm}
        apiPatch={apiPatch} apiDelete={apiDelete}
        deleteExpenseConfirm={expenseCrud.deleteExpenseConfirm} setDeleteExpenseConfirm={expenseCrud.setDeleteExpenseConfirm}
      />}
      {activeTab === "payments" && <PaymentsTab payments={payments} apiPatch={apiPatch} />}
      {activeTab === "pos" && <PosTabWithState menuItems={menuItems} orders={orders} loadData={loadData} />}
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
