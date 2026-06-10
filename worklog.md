---
Task ID: 2
Agent: Super Z (Main)
Task: Phase 2 — Performance et stabilité

Work Log:

### Task 2.1: WebSocket Integration in AdminDashboard
- Replaced 30s polling interval in `useAdminData` with WebSocket event listeners
- Added `useWebSocket` hook integration in `useAdminData` (connects admin user to WS server)
- Registered listeners for all WS events (ORDER_NEW, ORDER_STATUS_CHANGED, RESERVATION_NEW, etc.)
- On WS events: refresh stats + invalidate relevant tab cache + reload if currently active
- Added WS connection indicator (Wifi/WifiOff icon) in DashboardShell header
- Added `tabLoading` spinner in header for tab transitions

### Task 2.2: Lazy Tab Loading (replaced 13×1000 bulk fetch)
- Rewrote `useAdminData` from scratch:
  - On mount: loads stats only (lightweight, needed for sidebar badges)
  - On tab change: loads only that tab's data with `limit=100-200`
  - Caches previously loaded tabs (instant switch on revisit)
  - CRUD operations: refresh stats + active tab only (not all 13 endpoints)
  - `loadData()` full refresh: clears cache, reloads stats + active tab
- Added badge counts to `/api/stats` endpoint:
  - `menuCount`, `staffCount`, `customerCount`, `adminCount`
  - `pendingInvoices`, `sentQuotes`, `expenseCount`, `pendingPayments`
  - These are DB-level counts (no full table scans), replacing the need to load full arrays just for sidebar badges
- Updated `Stats` type with new badge count fields
- Updated `AdminDashboard` sidebar to use stats-based badges instead of array lengths

### Task 2.3: Search/Filter/Sort for Reviews, Staff, Admins Routes
- Reviews: added search (customerName, comment), filter (rating 1-5), sort (createdAt, rating, customerName)
- Staff: added search (name, phone, role), filter (role, status), sort (createdAt, name, role, status)
- Admins: added search (name, email), filter (role, status), sort (createdAt, name, role)
- Admins GET: added `select` clause to exclude password hashes from responses
- Updated `AdminDB` type: `password` is now optional

### DashboardShell Enhancements
- Added `wsIndicator` prop (ReactNode) for WebSocket status indicator
- Added `loading` prop for tab content loading spinner
- Both rendered in the header area alongside refresh button and theme toggle

Files Modified:
- `src/lib/hooks/use-admin-data.ts` — Complete rewrite with lazy loading + WS integration
- `src/components/AdminDashboard.tsx` — Updated to pass activeTab, admin.id; use stats-based badges; show WS indicator
- `src/components/layout/DashboardShell.tsx` — Added wsIndicator + loading props
- `src/app/api/stats/route.ts` — Added 8 badge count fields (DB-level counts)
- `src/lib/types.ts` — Added badge counts to Stats type; made AdminDB.password optional
- `src/lib/hooks/use-admin-crud.ts` — Minor fix for optional password
- `src/app/api/reviews/route.ts` — Search/filter/sort support
- `src/app/api/staff/route.ts` — Search/filter/sort support
- `src/app/api/admins/route.ts` — Search/filter/sort + password exclusion

Build: `npx next build` passes ✅
TypeScript: `npx tsc --noEmit` — zero errors ✅
ESLint: Only pre-existing warnings ✅

Stage Summary:
- Phase 2 complete: WebSocket real-time + lazy tab loading + search/filter/sort
- Performance improvement: 13×1000 items on mount → 1 stats call + 1 tab call (100-200 items)
- Real-time: Polling replaced by WebSocket events with selective refresh
- All 12 list endpoints now have consistent search/filter/sort support
