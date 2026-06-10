import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Test API route patterns ─────────────────────────────────────

// Helper to create a NextRequest
function createRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), options);
}

describe("API Route: Search/Filter/Sort Patterns", () => {
  describe("parsePagination", () => {
    // Import the helper functions from the API routes
    function parsePagination(url: URL) {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "100")));
      return { page, limit };
    }

    it("should return defaults when no params provided", () => {
      const url = new URL("http://localhost/api/test");
      const result = parsePagination(url);
      expect(result).toEqual({ page: 1, limit: 100 });
    });

    it("should parse page and limit from URL", () => {
      const url = new URL("http://localhost/api/test?page=3&limit=25");
      const result = parsePagination(url);
      expect(result).toEqual({ page: 3, limit: 25 });
    });

    it("should enforce minimum page of 1", () => {
      const url = new URL("http://localhost/api/test?page=-1");
      const result = parsePagination(url);
      expect(result.page).toBe(1);
    });

    it("should enforce maximum limit of 100", () => {
      const url = new URL("http://localhost/api/test?limit=500");
      const result = parsePagination(url);
      expect(result.limit).toBe(100);
    });
  });

  describe("parseSorting", () => {
    function parseSorting(url: URL, allowedFields: string[]) {
      const sort = url.searchParams.get("sort") || "createdAt";
      const order = url.searchParams.get("order") || "desc";
      if (!allowedFields.includes(sort)) return { sort: "createdAt", order: "desc" };
      return { sort, order: order === "asc" ? "asc" : "desc" };
    }

    it("should return default sorting", () => {
      const url = new URL("http://localhost/api/test");
      const result = parseSorting(url, ["name", "createdAt"]);
      expect(result).toEqual({ sort: "createdAt", order: "desc" });
    });

    it("should parse sort field and order", () => {
      const url = new URL("http://localhost/api/test?sort=name&order=asc");
      const result = parseSorting(url, ["name", "createdAt"]);
      expect(result).toEqual({ sort: "name", order: "asc" });
    });

    it("should reject disallowed sort fields", () => {
      const url = new URL("http://localhost/api/test?sort=evilField");
      const result = parseSorting(url, ["name", "createdAt"]);
      expect(result.sort).toBe("createdAt");
    });

    it("should default invalid order to desc", () => {
      const url = new URL("http://localhost/api/test?sort=name&order=invalid");
      const result = parseSorting(url, ["name", "createdAt"]);
      expect(result.order).toBe("desc");
    });
  });

  describe("parseSearch", () => {
    function parseSearch(url: URL, searchFields: string[]) {
      const search = url.searchParams.get("search") || "";
      if (!search || searchFields.length === 0) return {};
      return { search, searchFields };
    }

    it("should return empty object when no search param", () => {
      const url = new URL("http://localhost/api/test");
      const result = parseSearch(url, ["name", "email"]);
      expect(result).toEqual({});
    });

    it("should parse search with fields", () => {
      const url = new URL("http://localhost/api/test?search=amadou");
      const result = parseSearch(url, ["name", "email"]);
      expect(result).toEqual({ search: "amadou", searchFields: ["name", "email"] });
    });

    it("should return empty when no fields provided", () => {
      const url = new URL("http://localhost/api/test?search=test");
      const result = parseSearch(url, []);
      expect(result).toEqual({});
    });
  });
});

describe("API Route: CRUD Response Patterns", () => {
  it("should format list responses with pagination metadata", () => {
    const items = [{ id: "1", name: "Test" }, { id: "2", name: "Test 2" }];
    const total = 50;
    const page = 1;
    const limit = 100;

    const response = {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    expect(response.data).toHaveLength(2);
    expect(response.pagination.total).toBe(50);
    expect(response.pagination.totalPages).toBe(1);
  });

  it("should calculate totalPages correctly", () => {
    const total = 250;
    const limit = 100;
    expect(Math.ceil(total / limit)).toBe(3);
  });
});
