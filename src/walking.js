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
    if (!best || offset < best.offset) best = {offset, remaining: Math.max(0, route.length-travelled-t*length), name: edge.name};
    travelled += length;
  }
  return best;
}
