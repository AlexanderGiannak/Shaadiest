// Display-only cleanup. Routing continues to use the original shadow geometry.
export function shadowPolygons(polygons = [], treeShadows = [], precision = 1000) {
  const result = [];
  for (const shape of [...polygons, ...treeShadows]) {
    if (!Array.isArray(shape) || shape.some(p => !Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) continue;
    const ring = [];
    for (const point of shape) {
      const p = point.map(value => Math.round(value * precision) / precision);
      const previous = ring.at(-1);
      if (!previous || p[0] !== previous[0] || p[1] !== previous[1]) ring.push(p);
    }
    if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
    if (ring.length < 3) continue;
    const origin = ring[0];
    const area = ring.reduce((sum, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return sum + (a[0]-origin[0])*(b[1]-origin[1]) - (b[0]-origin[0])*(a[1]-origin[1]);
    }, 0);
    if (Math.abs(area) <= 0.001) continue;
    // Consistent winding makes overlapping fallback shapes fill as a union.
    if (area < 0) ring.reverse();
    ring.push([...ring[0]]);
    result.push([ring]);
  }
  return result;
}
