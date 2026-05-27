export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/** Geocode an address string using Nominatim (OpenStreetMap). Free, no API key. */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const result = await geocodeNominatim(address);
  if (result) return result;

  // Fallback: strip apartment/unit designators and retry — helps with addresses
  // like "123 Main St Apt 4B" that Nominatim doesn't resolve at unit granularity
  const stripped = address
    .replace(/\b(apt|apartment|unit|suite|ste|#)\s*[\w-]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped !== address) {
    const strippedResult = await geocodeNominatim(stripped);
    if (strippedResult) return strippedResult;
  }

  // Final fallback: US Census Bureau geocoder — handles newer streets that
  // haven't made it into OpenStreetMap data yet
  return geocodeCensus(address);
}

async function geocodeNominatim(address: string): Promise<GeocodeResult | null> {
  const encoded = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=us`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "OTGFueling/1.0",
    },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data || data.length === 0) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

async function geocodeCensus(address: string): Promise<GeocodeResult | null> {
  const encoded = encodeURIComponent(address);
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&format=json`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "OTGFueling/1.0" },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const matches = data?.result?.addressMatches;
    if (!matches || matches.length === 0) return null;

    const match = matches[0];
    return {
      lat: match.coordinates.y,
      lng: match.coordinates.x,
      displayName: match.matchedAddress,
    };
  } catch {
    return null;
  }
}
