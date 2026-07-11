/**
 * Geo utilities — distance calculation, nearby search.
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula.
 * @returns distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Check if a driver is within the delivery radius.
 * @param driverLat Driver latitude
 * @param driverLng Driver longitude
 * @param targetLat Target latitude (restaurant or customer)
 * @param targetLng Target longitude
 * @param radiusKm Maximum distance in km
 */
export function isWithinRadius(
  driverLat: number,
  driverLng: number,
  targetLat: number,
  targetLng: number,
  radiusKm: number
): boolean {
  const distance = haversineDistance(driverLat, driverLng, targetLat, targetLng);
  return distance <= radiusKm;
}

/**
 * Sort drivers by distance from a target point (nearest first).
 */
export function sortByDistance<T extends { lat: number; lng: number }>(
  drivers: T[],
  targetLat: number,
  targetLng: number
): Array<T & { distanceKm: number }> {
  return drivers
    .map((d) => ({
      ...d,
      distanceKm: haversineDistance(d.lat, d.lng, targetLat, targetLng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// Default Conakry coordinates (for fallback when no GPS)
export const CONAKRY_CENTER = { lat: 9.5092, lng: -13.7122 };
