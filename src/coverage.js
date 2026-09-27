const metersPerDegree = 111320;
const metersPerMile = 1609.344;

// Require the complete 80 m snap neighborhood, including at loaded-area edges.
export function coversPosition(coverage, position, margin = 80) {
  if (!coverage) return false;
  const halfSize = coverage.radius * metersPerMile;
  const x = Math.abs(position.lng - coverage.center.lng) * metersPerDegree * Math.cos(coverage.center.lat * Math.PI / 180);
  const y = Math.abs(position.lat - coverage.center.lat) * metersPerDegree;
  return x + margin <= halfSize && y + margin <= halfSize;
}

export function areaForPositions(positions, minimumRadius = 1) {
  const latitudes = positions.map(p => p.lat), longitudes = positions.map(p => p.lng);
  const center = {
    lat: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    lng: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
  const reach = Math.max(...positions.map(p => Math.max(
    Math.abs(p.lat-center.lat)*metersPerDegree,
    Math.abs(p.lng-center.lng)*metersPerDegree*Math.cos(center.lat*Math.PI/180),
  )));
  const radius = Math.max(minimumRadius, Math.ceil((reach + 80) / metersPerMile));
  return radius <= 5 ? {center, radius} : null;
}
