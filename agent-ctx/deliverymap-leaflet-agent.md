# Task: Replace SVG-based DeliveryMap with Leaflet/OpenStreetMap

## Summary
Replaced the custom SVG-based map component with a real interactive Leaflet/OpenStreetMap map using `react-leaflet`.

## Files Modified
- `src/components/DeliveryMap.tsx` — Rewritten as a dynamic loader wrapper (SSR-safe)
- `src/components/DeliveryMapInner.tsx` — New file with full react-leaflet implementation

## Architecture
The solution uses a two-file pattern to handle Leaflet's SSR incompatibility:
1. **DeliveryMap.tsx** (wrapper) — Client component that dynamically imports the inner component via `useEffect` + `import()`. Shows a loading spinner while the map loads.
2. **DeliveryMapInner.tsx** (inner) — Contains all react-leaflet code, only loaded client-side.

## Key Features Implemented
1. **Center on Conakry, Guinea** — Default center [9.5092, -13.7122], zoom 13
2. **Restaurant marker** — Orange custom divIcon with "KFM" label, popup with details
3. **Driver markers** — Color-coded by status (green=available, orange=busy, gray=offline), with vehicle emoji, popup with full details (phone, vehicle, zone, deliveries, rating, current order, call link)
4. **Delivery zones** — Semi-transparent Circle overlay (3km radius) around restaurant (hidden in simple mode)
5. **Customer tracking mode** (`simple=true`):
   - Polyline route: restaurant → driver (purple dashed) → destination (red dashed)
   - Destination marker (red divIcon with 📍)
   - Smaller map height (300px vs 500px)
6. **Auto-fit bounds** — FitBounds component that adjusts map view to show all drivers + restaurant + destination
7. **Auto-refresh** — Driver position polling every 15s via `apiFetch("/api/driver-location")`
8. **Legend overlay** — Status color legend in bottom-left (hidden in simple mode)
9. **Live indicator** — Auto-update badge in top-right
10. **Zero-position handling** — Drivers with lat=0, lng=0 are not shown

## Props Interface (Preserved)
Same interface as the original SVG version — no changes needed in consuming components:
- `DeliveriesTab.tsx` — Admin view with all drivers
- `DeliveryTrackingPage.tsx` — Customer tracking with simple mode
- `DriverMapTab.tsx` — Driver view with focusDriverId

## Technical Details
- Custom `L.divIcon` markers instead of default Leaflet markers (avoids icon path issues)
- OpenStreetMap tile layer (free, no API key)
- `FitBounds` uses a stable key to prevent unnecessary re-fitting on re-renders
- Map container uses `borderRadius: 0.75rem` for rounded corners
- Leaflet CSS imported via `import "leaflet/dist/leaflet.css"` in inner component
