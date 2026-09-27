// Reject invalid fixes before passing coordinates or radii to the map renderer.
export function validLocationFix(fix) {
  const c = fix?.coords;
  return !!c && Number.isFinite(c.latitude) && Math.abs(c.latitude) <= 85 &&
    Number.isFinite(c.longitude) && Math.abs(c.longitude) <= 180 &&
    Number.isFinite(c.accuracy) && c.accuracy >= 0 && Number.isFinite(fix.timestamp);
}
