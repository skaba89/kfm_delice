import { describe, it, expect } from "vitest";
import {
  parsePagination, paginate, prismaSkip, prismaTake,
  parseSorting, parseSearch, parseStatusFilter, parseDateRange, buildSearchWhere,
} from "@/lib/pagination";

describe("parsePagination", () => {
  it("returns defaults when no params", () => {
    const params = new URLSearchParams();
    const result = parsePagination(params);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it("parses page and limit from params", () => {
    const params = new URLSearchParams("page=3&limit=50");
    const result = parsePagination(params);
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it("clamps page to minimum 1", () => {
    const params = new URLSearchParams("page=0");
    const result = parsePagination(params);
    expect(result.page).toBe(1);
  });

  it("clamps negative page to 1", () => {
    const params = new URLSearchParams("page=-5");
    const result = parsePagination(params);
    expect(result.page).toBe(1);
  });

  it("clamps limit to maximum 100", () => {
    const params = new URLSearchParams("limit=500");
    const result = parsePagination(params);
    expect(result.limit).toBe(100);
  });

  it("clamps limit to minimum 1", () => {
    const params = new URLSearchParams("limit=0");
    const result = parsePagination(params);
    expect(result.limit).toBe(1);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 50 }, (_, i) => i + 1);

  it("returns first page", () => {
    const result = paginate(items, 1, 20);
    expect(result.data).toHaveLength(20);
    expect(result.data[0]).toBe(1);
    expect(result.pagination).toEqual({
      page: 1, limit: 20, total: 50, totalPages: 3, hasNext: true, hasPrev: false,
    });
  });

  it("returns second page", () => {
    const result = paginate(items, 2, 20);
    expect(result.data).toHaveLength(20);
    expect(result.data[0]).toBe(21);
    expect(result.pagination.hasNext).toBe(true);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("returns last page with remaining items", () => {
    const result = paginate(items, 3, 20);
    expect(result.data).toHaveLength(10);
    expect(result.data[0]).toBe(41);
    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it("handles empty array", () => {
    const result = paginate([], 1, 20);
    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe("prismaSkip / prismaTake", () => {
  it("prismaSkip calculates offset correctly", () => {
    expect(prismaSkip(1, 20)).toBe(0);
    expect(prismaSkip(2, 20)).toBe(20);
    expect(prismaSkip(3, 20)).toBe(40);
  });

  it("prismaTake returns limit", () => {
    expect(prismaTake(20)).toBe(20);
    expect(prismaTake(100)).toBe(100);
  });
});

describe("parseSorting", () => {
  it("returns default sorting when no params", () => {
    const sp = new URLSearchParams();
    const result = parseSorting(sp, ["createdAt", "name"] as const, "createdAt");
    expect(result.sortBy).toBe("createdAt");
    expect(result.sortOrder).toBe("desc");
  });

  it("parses valid sortBy and sortOrder", () => {
    const sp = new URLSearchParams("sortBy=name&sortOrder=asc");
    const result = parseSorting(sp, ["createdAt", "name", "price"] as const, "createdAt");
    expect(result.sortBy).toBe("name");
    expect(result.sortOrder).toBe("asc");
  });

  it("falls back to default when sortBy is not in allowed fields", () => {
    const sp = new URLSearchParams("sortBy=hacked&sortOrder=asc");
    const result = parseSorting(sp, ["createdAt", "name"] as const, "createdAt");
    expect(result.sortBy).toBe("createdAt");
  });

  it("falls back to desc when sortOrder is invalid", () => {
    const sp = new URLSearchParams("sortBy=name&sortOrder=random");
    const result = parseSorting(sp, ["createdAt", "name"] as const, "createdAt");
    expect(result.sortOrder).toBe("desc");
  });

  it("respects custom default order", () => {
    const sp = new URLSearchParams();
    const result = parseSorting(sp, ["order", "price"] as const, "order", "asc");
    expect(result.sortOrder).toBe("asc");
  });
});

describe("parseSearch", () => {
  it("returns null when no search param", () => {
    const sp = new URLSearchParams();
    expect(parseSearch(sp)).toBeNull();
  });

  it("returns trimmed search string", () => {
    const sp = new URLSearchParams("search=  hello world  ");
    expect(parseSearch(sp)).toBe("hello world");
  });

  it("returns null for empty/whitespace-only search", () => {
    const sp = new URLSearchParams("search=   ");
    expect(parseSearch(sp)).toBeNull();
  });

  it("uses custom param name", () => {
    const sp = new URLSearchParams("q=test");
    expect(parseSearch(sp, "q")).toBe("test");
  });
});

describe("parseStatusFilter", () => {
  it("returns null when no status param", () => {
    const sp = new URLSearchParams();
    expect(parseStatusFilter(sp, ["active", "inactive"])).toBeNull();
  });

  it("returns status when valid", () => {
    const sp = new URLSearchParams("status=active");
    expect(parseStatusFilter(sp, ["active", "inactive"])).toBe("active");
  });

  it("returns null when status not in allowed list", () => {
    const sp = new URLSearchParams("status=hacked");
    expect(parseStatusFilter(sp, ["active", "inactive"])).toBeNull();
  });

  it("uses custom param name", () => {
    const sp = new URLSearchParams("vehicle=moto");
    expect(parseStatusFilter(sp, ["moto", "velo", "voiture"], "vehicle")).toBe("moto");
  });
});

describe("parseDateRange", () => {
  it("returns null dates when no params", () => {
    const sp = new URLSearchParams();
    const result = parseDateRange(sp);
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it("parses valid dates", () => {
    const sp = new URLSearchParams("from=2026-01-01&to=2026-12-31");
    const result = parseDateRange(sp);
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeInstanceOf(Date);
  });

  it("returns null for invalid dates", () => {
    const sp = new URLSearchParams("from=not-a-date&to=also-invalid");
    const result = parseDateRange(sp);
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it("handles only from date", () => {
    const sp = new URLSearchParams("from=2026-06-01");
    const result = parseDateRange(sp);
    expect(result.from).toBeInstanceOf(Date);
    expect(result.to).toBeNull();
  });
});

describe("buildSearchWhere", () => {
  it("returns empty object when no search", () => {
    expect(buildSearchWhere(null, ["name", "email"])).toEqual({});
  });

  it("builds single field search", () => {
    const result = buildSearchWhere("test", ["name"]);
    expect(result).toEqual({ name: { contains: "test" } });
  });

  it("builds multi-field OR search", () => {
    const result = buildSearchWhere("test", ["name", "email"]);
    expect(result).toEqual({
      OR: [
        { name: { contains: "test" } },
        { email: { contains: "test" } },
      ],
    });
  });
});
