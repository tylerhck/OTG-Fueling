/**
 * IP Geolocation utility using ip-api.com (free, no API key needed, 45 req/min)
 * Falls back gracefully if the service is unavailable.
 */

export interface GeoResult {
  ip: string;
  city: string | null;
  region: string | null; // state
  country: string | null;
  isTexas: boolean;
}

export async function getGeoFromIp(ip: string): Promise<GeoResult> {
  const fallback: GeoResult = { ip, city: null, region: null, country: null, isTexas: false };

  // Skip lookup for localhost/private IPs
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.")) {
    return { ...fallback, region: "Texas", country: "United States", isTexas: true }; // Allow local dev
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`, {
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!res.ok) return fallback;

    const data = await res.json();

    if (data.status !== "success") return fallback;

    const region = data.regionName || null;
    const country = data.country || null;
    const city = data.city || null;

    // Check if the IP is in Texas
    const isTexas = region === "Texas" && country === "United States";

    return { ip, city, region, country, isTexas };
  } catch {
    // If geo lookup fails, allow login (fail open for availability)
    // But log it — we don't want to lock out admins if the geo service is down
    console.warn(`[GEO] Failed to lookup IP: ${ip}`);
    return { ...fallback, isTexas: true }; // Fail open
  }
}

/**
 * Extract client IP from request headers (works behind Railway proxy)
 */
export function getClientIp(headers: Headers): string {
  // Railway/Cloudflare/etc set these headers
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated list, first is the real client
    return forwarded.split(",")[0].trim();
  }
  
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "127.0.0.1";
}
