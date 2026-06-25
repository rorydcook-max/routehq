export function isMapsUrl(location: string): boolean {
  return location.includes("google.com/maps") || location.includes("maps/search");
}

export function formatDeliveryLocation(location: string | null | undefined): string {
  if (!location) return "";
  if (!isMapsUrl(location)) return location;
  try {
    const url = new URL(location);
    const query = url.searchParams.get("query");
    if (query) {
      const parts = query.split(",");
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
      }
      return query;
    }
  } catch {
    // not a valid URL
  }
  return "Location confirmed";
}
