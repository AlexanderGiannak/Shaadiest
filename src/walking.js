import { distance } from "./engine.js";
// Match a GPS fix to the selected route without changing the routing graph.
export function walkingProgress(nodes, route, point) {
  let travelled = 0, best = null;
  for (const edge of route.segments) {
    const a = nodes[edge.from].point, b = nodes[edge.to].point;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = distance(a, b);
    const t = length ? Math.max(0, Math.min(1, ((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(length*length))) : 0;
    const offset = distance(point, [a[0]+t*dx,a[1]+t*dy]);
    if (!best || offset < best.offset) best = {offset, remaining: Math.max(0, route.length-travelled-t*length), name: edge.name, bearing: (Math.atan2(dx,dy)*180/Math.PI+360)%360};
    travelled += length;
  }
  return best;
}

export function travelHeading(fix, now = Date.now()) {
  const c = fix?.coords;
  return c && now-fix.timestamp <= 20000 && c.accuracy <= 35 &&
    Number.isFinite(c.heading) && c.heading >= 0 && c.heading < 360 &&
    Number.isFinite(c.speed) && c.speed >= 0.5 ? c.heading : null;
}
export function directionGuidance(heading, bearing) {
  if (!Number.isFinite(heading) || !Number.isFinite(bearing)) return "Walk a little to detect your direction";
  const delta = Math.abs(((heading-bearing+540)%360)-180);
  return delta <= 60 ? "Heading the right way" : delta >= 120 ? "Heading away — turn around" : "Turn toward the route";
}
