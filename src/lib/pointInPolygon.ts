/**
 * Ray-casting algorithm to determine if a point is inside a polygon.
 * @param lat - Latitude of the point to check
 * @param lng - Longitude of the point to check
 * @param polygon - Array of [lat, lng] coordinate pairs defining the polygon
 * @returns true if the point is inside the polygon
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][]
): boolean {
  if (!polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lng !== yj > lng &&
      lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}
