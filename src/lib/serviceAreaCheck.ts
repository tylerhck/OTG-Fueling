import { haversineDistance } from "./haversine";
import { pointInPolygon } from "./pointInPolygon";

interface ServiceAreaLike {
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  polygon?: any;
}

/**
 * Check if a lat/lng point is inside a service area.
 * Uses polygon check if polygon is defined (3+ points), otherwise falls back to circle radius.
 */
export function isInServiceArea(
  lat: number,
  lng: number,
  area: ServiceAreaLike
): boolean {
  // If polygon is defined with 3+ points, use point-in-polygon
  if (area.polygon && Array.isArray(area.polygon) && area.polygon.length >= 3) {
    return pointInPolygon(lat, lng, area.polygon as [number, number][]);
  }

  // Fallback to circle (haversine distance)
  const dist = haversineDistance(lat, lng, area.centerLat, area.centerLng);
  return dist <= area.radiusMiles;
}

/**
 * Check if a lat/lng point is inside ANY of the given service areas.
 */
export function isInAnyServiceArea(
  lat: number,
  lng: number,
  areas: ServiceAreaLike[]
): boolean {
  if (areas.length === 0) return true; // No areas configured = allow all
  return areas.some((area) => isInServiceArea(lat, lng, area));
}
