---
Task ID: 1
Agent: Super Z (main)
Task: End-to-end audit and fix of KFM Delice admin panel for commercialization

Work Log:
- Explored entire project: 32 API routes, 15 Prisma models, 106 components
- Identified systemic issue: Prisma model methods crash with 500 when SQLite schema has missing columns
- Created comprehensive `scripts/ensure-schema.cjs` that creates ALL tables with correct schema before Next.js starts
- Fixed `src/lib/db.ts`: made schema fix synchronous with `dbReady` promise, expanded missing columns list to 47 columns
- Added `bigIntToNumber()` helper for safe BigInt→Number JSON serialization
- Fixed `package.json` start/dev scripts to run ensure-schema before prisma db push
- Converted login endpoints (customer-login, driver-login, platform-login) to raw SQL
- Converted change-password endpoint to raw SQL
- Fixed multi-tenant bugs: payment, tracking, driver-orders, driver-location (replaced `db.restaurant.findFirst()` with proper restaurantId)
- Added `await dbReady` to ALL 32 API route handlers
- Fixed frontend bugs:
  - CRUD error handling (apiPatch/apiPost/apiDelete now check res.ok and throw on error)
  - MustChangePasswordDialog infinite loop (updateUserData instead of reload)
  - DeliveriesTab driver assignment (added assigningOrderId state)
  - Manual refresh full-page spinner (use tabLoading instead)
  - Auto-logout English error detection
- Added `updateUserData()` to auth-context
- Fixed BigInt serialization in drivers, stats, and customers endpoints

Stage Summary:
- 14/14 critical API endpoints return 200 (stats, drivers, staff, orders, menu, reservations, reviews, customers, admins, invoices, quotes, expenses, payments, analytics)
- Login works: admin@kfm-delice.com / kfm2024
- Database schema is correctly initialized on Render startup
- All CRUD operations have proper error handling
- Frontend dashboard renders correctly with all tabs
- 7 commits pushed to main branch, deployed on Render
