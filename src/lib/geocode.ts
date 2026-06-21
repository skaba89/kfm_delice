/**
 * Geocoding helper using Nominatim (OpenStreetMap's free geocoder).
 *
 * - Free for low-volume usage (1 req/sec, no API key)
 * - Returns lat/lng for a given address string
 * - Biased toward Guinea (viewbox + countrycodes=gn) for KFM Delice
 *
 * Endpoint: https://nominatim.openstreetmap.org/search
 * Docs: https://nominatim.org/release-docs/develop/api/Search/
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Bounding box around Guinea (approximate)
// [south, west, north, east] → used as viewbox to bias results
const GUINEA_BBOX = "7.2,-15.0,12.7,-7.6";

export interface GeocodedAddress {
  lat: number;
  lng: number;
  displayName: string;
  type?: string;
  importance?: number;
}

// Simple in-memory cache (per-page-load) to avoid re-geocoding the same address
const cache = new Map<string, GeocodedAddress | null>();

/**
 * Geocode a delivery address into lat/lng coordinates.
 *
 * Returns null if the address cannot be geocoded (network error, no result, etc.).
 * The caller should fall back to a sensible default (e.g. restaurant location).
 *
 * @param address - The delivery address string (e.g. "Kaloum, Conakry")
 * @param signal  - Optional AbortSignal to cancel the request
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal
): Promise<GeocodedAddress | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  // Cache hit?
  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached;

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: "json",
      limit: "1",
      countrycodes: "gn", // bias to Guinea
      viewbox: GUINEA_BBOX,
      bounded: "0", // 0 = prefer results within viewbox but allow outside
      "accept-language": "fr",
    });

    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal,
      headers: {
        // Nominatim requires a valid UA / referrer policy
        // (browser fetch automatically sets Referer)
      },
    });

    if (!res.ok) {
      cache.set(trimmed, null);
      return null;
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      type?: string;
      importance?: number;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      cache.set(trimmed, null);
      return null;
    }

    const first = data[0];
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      cache.set(trimmed, null);
      return null;
    }

    const result: GeocodedAddress = {
      lat,
      lng,
      displayName: first.display_name,
      type: first.type,
      importance: first.importance,
    };
    cache.set(trimmed, result);
    return result;
  } catch {
    // Network error or aborted — don't cache, allow retry later
    return null;
  }
}

/**
 * Compute the road-distance estimate between two coordinates (km).
 * Uses Haversine as a straight-line proxy, then applies a 1.3x factor
 * to approximate road distance in an urban environment.
 */
export function estimateRoadKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const crowFlies = 2 * R * Math.asin(Math.sqrt(a));
  return crowFlies * 1.3;
}

/**
 * Estimate delivery ETA in minutes from a road distance in km.
 * Assumes 25 km/h average urban speed + 5 min for handoff.
 */
export function estimateEtaMinutes(roadKm: number): number {
  const travelMin = (roadKm / 25) * 60;
  return Math.max(5, Math.round(travelMin + 5));
}
