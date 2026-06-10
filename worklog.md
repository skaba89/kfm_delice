---
Task ID: 1
Agent: Main
Task: Fix login, audit dashboard, fix all broken features, add missing pages

Work Log:
- Fixed JWT_SECRET missing from .env file (root cause of login failure)
- Discovered and fixed critical bug: Edit buttons in 5 tabs (Staff, Admins, Invoices, Quotes, Expenses) were bypassing openEditX() hooks, causing duplicate creation instead of update
- Added partial PATCH schemas to validations.ts for all CRUD endpoints (adminPatchSchema, driverPatchSchema, menuItemPatchSchema, etc.)
- Updated all 14 API routes to use partial schemas for PATCH operations
- Added Zod validation to driver-login, driver-me, driver-location, driver-orders, customers POST
- Created /api/upload route for menu image uploads (was completely missing)
- Created CustomersTab component with full CRUD (create, read, update, delete, status toggle)
- Created PaymentsTab component with status management
- Created useCustomerCrud hook
- Added CustomerDB and PaymentDB types
- Added customerSaved/customerDeleted notifications
- Updated AdminDashboard with 2 new tabs (Customers, Payments) + sidebar items + role permissions
- Updated useAdminData to load customers and payments data
- Fixed Quote status mismatch ("rejected" → "refused" in API filter)
- Fixed notification polling bug (comparing stats to itself instead of previous values)
- Fixed GPS falsy check (lat/lng=0 being ignored)

Stage Summary:
- All 17 API endpoint tests pass
- Login works correctly (admin, customer, driver)
- All CRUD operations work with partial PATCH support
- 2 new admin tabs added: Clients (Customers) and Paiements (Payments)
- Total admin tabs: 15 (overview, reservations, orders, menu, deliveries, drivers, reviews, staff, customers, admins, invoices, quotes, expenses, payments, pos)
