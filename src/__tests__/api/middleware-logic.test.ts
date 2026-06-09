import { describe, it, expect } from "vitest";
import type { SidebarItem } from "@/components/layout/DashboardShell";

describe("DashboardShell SidebarItem type", () => {
  it("accepts valid sidebar items", () => {
    const items: SidebarItem[] = [
      { id: "overview", label: "Vue d'ensemble", icon: () => null },
      { id: "orders", label: "Commandes", icon: () => null, badge: 5 },
    ];

    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("overview");
    expect(items[1].badge).toBe(5);
  });

  it("badge is optional", () => {
    const item: SidebarItem = { id: "test", label: "Test", icon: () => null };
    expect(item.badge).toBeUndefined();
  });
});
