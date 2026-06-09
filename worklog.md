---
Task ID: 1
Agent: Main
Task: Fix all broken pages, buttons, actions and add missing functionality

Work Log:
- Audited entire project: 12 pages, 26 API routes, ~50 components
- Identified 9 critical/medium issues
- Fixed /api/upload route (was missing, broke image upload in MenuTab)
- Fixed auth-context.tsx: 401 auto-logout was too aggressive, now only logs out for actual token errors
- Fixed OverviewTab: replaced localStorage.getItem with apiFetch prop
- Fixed DriverLogin: lat/lng now come from API (was hardcoded to 0,0)
- Fixed Driver login API: now returns lat/lng fields
- Fixed CustomerProfile: added "current password" field for security
- Fixed customer PATCH API: verifies currentPassword before allowing password change
- Fixed validation schema: added currentPassword to customerUpdateSchema
- Fixed loyalty discount: now applied at checkout with visible discount line
- Fixed delivery fee: now comes from restaurant settings (deliveryFee=5000 from DB)
- Fixed use-customer-cart: cartSubtotal, discountPercent, discountAmount, deliveryFee
- Fixed CustomerOrdering: shows loyalty discount banner and discount line in cart
- Fixed auth-context FormData: no longer sets Content-Type for FormData uploads
- Fixed tsconfig.json: excluded hotel-booking-pro from TypeScript compilation
- Installed missing dependencies: jsonwebtoken, ws, @types/jsonwebtoken, @types/ws
- All pages return HTTP 200
- All API endpoints work correctly
- Build passes with 0 errors

Stage Summary:
- 9 bugs fixed across auth, upload, analytics, driver GPS, password security, loyalty, delivery fee
- All pages and API endpoints verified working
- Application is fully functional
