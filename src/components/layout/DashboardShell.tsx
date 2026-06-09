"use client";

import { useState, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface DashboardShellProps {
  /** Brand icon displayed in the sidebar header */
  brandIcon: ReactNode;
  /** Brand title (e.g. "KFM Delice") */
  brandTitle: string;
  /** Subtitle below the brand (e.g. "Administration") */
  brandSubtitle: string;
  /** Gradient classes for the brand icon background */
  brandGradient: string;
  /** Sidebar navigation items */
  sidebarItems: SidebarItem[];
  /** Currently active sidebar item id */
  activeTab: string;
  /** Callback when a sidebar item is clicked */
  onTabChange: (id: string) => void;
  /** Display name for the greeting */
  userName: string;
  /** First letter of the user's name (for avatar) */
  userInitial: string;
  /** Gradient classes for the user avatar */
  avatarGradient: string;
  /** Optional: notification count badge */
  notificationCount?: number;
  /** Callback for refresh button */
  onRefresh?: () => void;
  /** Callback for logout */
  onLogout: () => void;
  /** Collapsible sidebar? (default: true) */
  collapsible?: boolean;
  /** Page content */
  children: ReactNode;
}

/**
 * Shared dashboard layout with responsive sidebar + header.
 * Used by both Admin and Customer dashboards.
 */
export function DashboardShell({
  brandIcon,
  brandTitle,
  brandSubtitle,
  brandGradient,
  sidebarItems,
  activeTab,
  onTabChange,
  userName,
  userInitial,
  avatarGradient,
  notificationCount,
  onRefresh,
  onLogout,
  collapsible = true,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const activeLabel = sidebarItems.find(s => s.id === activeTab)?.label ?? "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={`${collapsed ? "w-20" : "w-64"} bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col shrink-0 hidden md:flex`}
      >
        {/* Brand */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${brandGradient} flex items-center justify-center shrink-0`}>
              {brandIcon}
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{brandTitle}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{brandSubtitle}</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.badge ? (
                <span
                  className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === item.id
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
            >
              {collapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
              {!collapsed && <span>Réduire</span>}
            </button>
          )}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ─── Mobile sidebar toggle ─── */}
      <div className="md:hidden fixed bottom-4 left-4 z-50">
        <Button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          size="sm"
          className={`rounded-full ${brandGradient} text-white shadow-lg`}
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>

      {/* ─── Mobile sidebar overlay ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-gray-900 z-50 shadow-xl flex flex-col"
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl ${brandGradient} flex items-center justify-center shrink-0`}>
                      {brandIcon}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{brandTitle}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{brandSubtitle}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {sidebarItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeTab === item.id
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                          activeTab === item.id
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </nav>
              <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">{activeLabel}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Bienvenue, {userName}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
              </button>
            )}
            <ThemeToggle />
            {notificationCount !== undefined && notificationCount > 0 && (
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 relative">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {notificationCount}
                </span>
              </button>
            )}
            <div className={`w-8 h-8 rounded-full ${avatarGradient} flex items-center justify-center text-white text-sm font-bold`}>
              {userInitial}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
