"use client";

import { useState } from "react";
import {
  User, CalendarCheck, ShoppingBag, MessageSquare, Award,
  UserCheck, ShoppingCart,
  LayoutDashboard,
} from "lucide-react";
import { DashboardShell, type SidebarItem } from "@/components/layout/DashboardShell";
import type { OrderDB, CustomerUser } from "@/lib/types";
import { useCustomerData } from "@/lib/hooks/use-customer-data";
import { useCustomerCart } from "@/lib/hooks/use-customer-cart";
import { CustomerDashboard } from "@/components/customer/CustomerDashboard";
import { CustomerOrders } from "@/components/customer/CustomerOrders";
import { CustomerReservations } from "@/components/customer/CustomerReservations";
import { CustomerReviews } from "@/components/customer/CustomerReviews";
import { CustomerLoyalty } from "@/components/customer/CustomerLoyalty";
import { CustomerOrdering } from "@/components/customer/CustomerOrdering";
import { CustomerProfile } from "@/components/customer/CustomerProfile";

interface CustomerAccountProps {
  customer: CustomerUser;
  onLogout: () => void;
  onUpdate: (c: CustomerUser) => void;
  onTrackOrder: (order: OrderDB) => void;
}

export function CustomerAccount({ customer, onLogout, onUpdate, onTrackOrder }: CustomerAccountProps) {
  const [activeTab, setActiveTab] = useState("dashboard");

  const data = useCustomerData(customer, onUpdate);
  const cart = useCustomerCart(customer, data.loadData);

  const sidebarItems: SidebarItem[] = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "commandes", label: "Mes Commandes", icon: ShoppingBag, badge: data.orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length || undefined },
    { id: "reservations", label: "Réservations", icon: CalendarCheck, badge: data.reservations.filter(r => r.status === "pending" || r.status === "confirmed").length || undefined },
    { id: "avis", label: "Mes Avis", icon: MessageSquare, badge: data.reviews.length || undefined },
    { id: "fidelite", label: "Fidélité", icon: Award },
    { id: "commander", label: "Commander", icon: ShoppingCart },
    { id: "profil", label: "Mon Profil", icon: User },
  ];

  if (data.loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <svg className="w-8 h-8 text-emerald-500 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
    );
  }

  return (
    <DashboardShell
      brandIcon={<UserCheck className="w-5 h-5 text-white" />}
      brandTitle="KFM Delice"
      brandSubtitle="Mon Compte"
      brandGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
      sidebarItems={sidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userName={customer.name}
      userInitial={customer.name[0]}
      avatarGradient="bg-gradient-to-br from-emerald-400 to-teal-500"
      onRefresh={data.loadData}
      onLogout={onLogout}
      collapsible={false}
    >
      {activeTab === "dashboard" && (
        <CustomerDashboard
          customer={customer}
          orders={data.orders}
          reservations={data.reservations}
          reviews={data.reviews}
          onTabChange={setActiveTab}
          onShowQuickReserve={() => { setActiveTab("reservations"); data.setShowQuickReserve(true); }}
        />
      )}
      {activeTab === "commandes" && (
        <CustomerOrders
          orders={data.orders}
          orderFilter={data.orderFilter}
          setOrderFilter={data.setOrderFilter}
          orderSearch={data.orderSearch}
          setOrderSearch={data.setOrderSearch}
          onTrackOrder={onTrackOrder}
          onReorder={data.reorder}
        />
      )}
      {activeTab === "reservations" && (
        <CustomerReservations
          reservations={data.reservations}
          showQuickReserve={data.showQuickReserve}
          setShowQuickReserve={data.setShowQuickReserve}
          reserveForm={data.reserveForm}
          setReserveForm={data.setReserveForm}
          reserveSaving={data.reserveSaving}
          submitReservation={data.submitReservation}
        />
      )}
      {activeTab === "avis" && (
        <CustomerReviews
          reviews={data.reviews}
          reviewForm={data.reviewForm}
          setReviewForm={data.setReviewForm}
          reviewSaving={data.reviewSaving}
          reviewMsg={data.reviewMsg}
          submitReview={data.submitReview}
        />
      )}
      {activeTab === "fidelite" && (
        <CustomerLoyalty customer={customer} />
      )}
      {activeTab === "commander" && (
        <CustomerOrdering
          menuItems={data.menuItems}
          cart={cart.cart}
          addToCart={cart.addToCart}
          removeFromCart={cart.removeFromCart}
          updateCartQty={cart.updateCartQty}
          cartSubtotal={cart.cartSubtotal}
          cartTotal={cart.cartTotal}
          discountPercent={cart.discountPercent}
          discountAmount={cart.discountAmount}
          deliveryFee={cart.deliveryFee}
          orderCategoryFilter={cart.orderCategoryFilter}
          setOrderCategoryFilter={cart.setOrderCategoryFilter}
          checkoutStep={cart.checkoutStep}
          setCheckoutStep={cart.setCheckoutStep}
          checkoutForm={cart.checkoutForm}
          setCheckoutForm={cart.setCheckoutForm}
          orderSubmitting={cart.orderSubmitting}
          submitOrder={cart.submitOrder}
        />
      )}
      {activeTab === "profil" && (
        <CustomerProfile
          profileForm={data.profileForm}
          setProfileForm={data.setProfileForm}
          passwordForm={data.passwordForm}
          setPasswordForm={data.setPasswordForm}
          profileSaving={data.profileSaving}
          profileMsg={data.profileMsg}
          saveProfile={data.saveProfile}
          savePassword={data.savePassword}
        />
      )}
    </DashboardShell>
  );
}
