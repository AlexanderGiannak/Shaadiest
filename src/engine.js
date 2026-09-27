import SunCalc from "suncalc";
export const origin = { lat: 25.756, lng: -80.374 };
export function project(p, o) {
  return [
    (p.lng - o.lng) * 111320 * Math.cos((o.lat * Math.PI) / 180),
    (p.lat - o.lat) * 111320,
  ];
}
export function unproject(p, o) {
  return {
    lat: o.lat + p[1] / 111320,
    lng: o.lng + p[0] / (111320 * Math.cos((o.lat * Math.PI) / 180)),
  };
}
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function inside(p, poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
export function hull(points) {
  const a = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const h = [];
  for (const p of a) {
    while (h.length > 1 && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
    h.push(p);
  }
  const n = h.length;
  for (let i = a.length - 2; i >= 0; i--) {
    const p = a[i];
    while (h.length > n && cross(h.at(-2), h.at(-1), p) <= 0) h.pop();
    h.push(p);
  }
  h.pop();
  return h;
}
// SunCalc 1.9 azimuth is measured from south: this vector points away from the sun.
export function shadowShapes(data, date) {
  const sun = SunCalc.getPosition(date, data.origin.lat, data.origin.lng);
  const night = sun.altitude <= 0;
  const direction = [Math.sin(sun.azimuth), Math.cos(sun.azimuth)];
  const shadowLength = (height) =>
    Math.min(250, height / Math.tan(Math.max(0.04, sun.altitude)));
  const polygons = night
    ? []
    : data.buildings.flatMap((b) => {
        const length = shadowLength(b.height);
        const shift = (p) => [
          p[0] + direction[0] * length,
          p[1] + direction[1] * length,
        ];
        // Sweep each wall separately: preserve concave notches instead of filling
        // the entire footprint's convex hull.
        const points = b.points;
        return [
          points,
          points.map(shift),
          ...points.map((p, i) => {
            const q = points[(i + 1) % points.length];
            return [p, q, shift(q), shift(p)];
          }),
        ];
      });
  // Approximate the crown as an elevated ellipsoid. Its projected footprint moves
  // away from the sun and stretches at low solar elevations; the trunk stays fixed.
  const treeShadows = night
    ? []
    : data.trees.map((tree) => {
        const height = tree.height || 10;
        const centerHeight = height * 0.7;
        const offset = shadowLength(centerHeight);
        const along = Math.min(
          65,
          Math.hypot(
            tree.radius,
            (height * 0.3) / Math.tan(Math.max(0.04, sun.altitude)),
          ),
        );
        const center = [
          tree.point[0] + direction[0] * offset,
          tree.point[1] + direction[1] * offset,
        ];
        return crownProfile(tree).map(([cx, cy]) => {
          return [
            center[0] +
              direction[0] * along * cx -
              direction[1] * tree.radius * cy,
            center[1] +
              direction[1] * along * cx +
              direction[0] * tree.radius * cy,
          ];
        });
      });
  return {
    sun,
    night,
    polygons,
    treeShadows,
    trees: data.trees,
    woods: data.woods || [],
  };
}
export function sampleShade(a, b, shapes, covered = false) {
  if (shapes.night || covered) return 1;
  const n = Math.max(1, Math.ceil(distance(a, b) / 5));
  let shaded = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n,
      p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    if (
      (shapes.treeShadows
        ? shapes.treeShadows.some((poly) => inside(p, poly))
        : shapes.trees.some((c) => distance(c.point, p) <= c.radius)) ||
      shapes.polygons.some((poly) => inside(p, poly)) ||
      shapes.woods.some((poly) => inside(p, poly))
    )
      shaded++;
  }
  return shaded / n;
}
export function scoreGraph(data, date) {
  const shapes = shadowShapes(data, date);
  const bounds = polygon => polygon.reduce((box, p) => [
    Math.min(box[0], p[0]), Math.min(box[1], p[1]),
    Math.max(box[2], p[0]), Math.max(box[3], p[1]),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  const indexed = Object.fromEntries(["polygons", "treeShadows", "woods"].map(key =>
    [key, shapes[key].map(polygon => ({polygon, box: bounds(polygon)}))]));
  return {
    shapes,
    edges: data.edges.map(e => {
      const a = data.nodes[e.a].point, b = data.nodes[e.b].point;
      const box = bounds([a, b]);
      // Reject distant shapes before the detailed five-meter sampling.
      const nearby = shapes.night || e.covered ? shapes : {
        ...shapes,
        ...Object.fromEntries(Object.entries(indexed).map(([key, entries]) => [key,
          entries.filter(({box: other}) => other[0] <= box[2] && other[2] >= box[0] &&
            other[1] <= box[3] && other[3] >= box[1]).map(entry => entry.polygon),
        ])),
      };
      return {...e, length: distance(a, b), shade: sampleShade(a, b, nearby, e.covered)};
    }),
  };
}
// Binary heap keeps Dijkstra responsive on real neighborhood networks.
class Heap {
  constructor() {
    this.a = [];
  }
  push(v) {
    let i = this.a.push(v) - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= v[0]) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const top = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1][0] < this.a[c][0]) c++;
        if (this.a[c][0] >= last[0]) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = last;
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}
export function shortestPath(nodes, edges, start, end, weight = 0) {
  const adj = nodes.map(() => []);
  edges.forEach((e) => {
    adj[e.a].push([e.b, e]);
    if (!e.oneway) adj[e.b].push([e.a, e]);
  });
  const costs = nodes.map(() => Infinity),
    prev = [],
    q = new Heap();
  costs[start] = 0;
  q.push([0, start]);
  while (q.size) {
    const [cost, u] = q.pop();
    if (cost !== costs[u]) continue;
    if (u === end) break;
    for (const [v, e] of adj[u]) {
      const next = cost + e.length * (1 + weight * (1 - e.shade));
      if (next < costs[v]) {
        costs[v] = next;
        prev[v] = [u, e];
        q.push([next, v]);
      }
    }
  }
  if (!Number.isFinite(costs[end])) return null;
  const path = [end],
    segments = [];
  for (let at = end; at !== start;) {
    const [u, e] = prev[at];
    segments.push({ ...e, from: u, to: at });
    path.push(u);
    at = u;
  }
  path.reverse();
  segments.reverse();
  const length = segments.reduce((s, e) => s + e.length, 0),
    exposed = segments.reduce((s, e) => s + e.length * (1 - e.shade), 0);
  return {
    path,
    segments,
    length,
    exposed,
    shade: length ? 1 - exposed / length : 1,
    minutes: Math.max(1, Math.round(length / 80)),
  };
}
export function routes(data, scored, start, end, detour = 0.5) {
  if (start === end)
    throw new Error("Choose two different places for your walk.");
  const shortest = shortestPath(data.nodes, scored.edges, start, end, 0);
  if (!shortest)
    throw new Error(
      "These points are not connected by mapped walking paths. Try closer points or load a larger area.",
    );
  const candidates = [shortest];
  for (const w of [0.5, 1, 2, 4, 8, 16, 32, 64, 128]) {
    const r = shortestPath(data.nodes, scored.edges, start, end, w);
    if (r && r.length <= shortest.length * (1 + detour) + 0.01)
      candidates.push(r);
  }
  const shadiest = candidates.reduce(
    (best, r) => (r.exposed < best.exposed - 0.01 ? r : best),
    shortest,
  );
  return { shortest, shadiest };
}
export function nearestNode(data, p) {
  let best = -1,
    d = Infinity;
  data.nodes.forEach((n, i) => {
    const v = distance(n.point, p);
    if (v < d) {
      d = v;
      best = i;
    }
  });
  return { id: best, distance: d };
}
export function walkable(t = {}) {
  const explicit = ["yes", "designated", "permissive"].includes(t.foot);
  return (
    !!t.highway &&
    ![
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "construction",
      "proposed",
      "raceway",
    ].includes(t.highway) &&
    !["no", "private"].includes(t.foot) &&
    (explicit ||
      (!["no", "private"].includes(t.access) &&
        !["cycleway", "bridleway"].includes(t.highway))) &&
    t.area !== "yes"
  );
}
export function parseOSM(raw, center) {
  // Overpass uses lon; Leaflet and our internal coordinates use lng.
  const projectOSM = (p) => project({ lat: p.lat, lng: p.lon }, center);
  const nodes = [],
    edges = [],
    buildings = [],
    trees = [],
    woods = [],
    lookup = new Map(),
    rawNodes = new Map(
      raw.elements.filter((e) => e.type === "node").map((n) => [n.id, n]),
    );
  const getNode = (id) => {
    if (lookup.has(id)) return lookup.get(id);
    const n = rawNodes.get(id);
    if (!n) return null;
    const i = nodes.length;
    lookup.set(id, i);
    nodes.push({ point: projectOSM(n), name: n.tags?.name });
    return i;
  };
  for (const el of raw.elements) {
    const t = el.tags || {};
    if (el.type === "node" && t.natural === "tree") {
      const radius = Math.max(
        1,
        Math.min(15, (parseFloat(t["diameter_crown"]) || 8) / 2),
      );
      trees.push({
        point: projectOSM(el),
        radius,
        height: Math.max(3, Math.min(50, parseFloat(t.height) || 10)),
      });
    }
    if (el.type !== "way") continue;
    if (walkable(t)) {
      for (let i = 1; i < el.nodes.length; i++) {
        let a = getNode(el.nodes[i - 1]),
          b = getNode(el.nodes[i]);
        if (a === null || b === null || a === b) continue;
        if (t["oneway:foot"] === "-1") [a, b] = [b, a];
        edges.push({
          a,
          b,
          name:
            t.name ||
            {
              footway: "Walking path",
              steps: "Steps",
              pedestrian: "Pedestrian walkway",
            }[t.highway] ||
            "Unnamed " + t.highway,
          covered: t.covered === "yes" || t.tunnel === "yes",
          oneway: ["yes", "-1"].includes(t["oneway:foot"]),
        });
      }
    }
    const geometry =
      el.geometry || el.nodes?.map((id) => rawNodes.get(id)).filter(Boolean);
    if (!geometry || geometry.length < 3) continue;
    const points = geometry.map(projectOSM);
    if (t.building && t.building !== "no")
      buildings.push({
        points,
        height: Math.max(
          3,
          Math.min(
            300,
            parseFloat(t.height) || parseFloat(t["building:levels"]) * 3 || 9,
          ),
        ),
        estimated: !t.height,
      });
    if (t.natural === "wood" || t.landuse === "forest") woods.push(points);
  }
  return {
    origin: center,
    nodes,
    edges,
    buildings,
    trees,
    woods,
    source: "live",
  };
}

// Stable, asymmetric crown lobes: no animation jitter when changing the sun.
export function crownProfile(tree) {
  const phase = tree.point[0] * 0.17 + tree.point[1] * 0.31;
  return Array.from({ length: 48 }, (_, i) => {
    const a = (i * Math.PI) / 24;
    const r =
      0.86 +
      0.1 * Math.sin(5 * a + phase) +
      0.07 * Math.cos(9 * a - phase) +
      0.035 * Math.sin(13 * a);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}
export function canopyOutline(tree) {
  return crownProfile(tree).map(([x, y]) => [
    tree.point[0] + x * tree.radius,
    tree.point[1] + y * tree.radius,
  ]);
}
export function snapToPath(data, point, maxDistance = 80) {
  let best = null;
  data.edges.forEach((edge, index) => {
    const a = data.nodes[edge.a].point,
      b = data.nodes[edge.b].point;
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      length2 = dx * dx + dy * dy;
    if (!length2) return;
    const t = Math.max(
      0,
      Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2),
    );
    const snapped = [a[0] + t * dx, a[1] + t * dy],
      d = distance(point, snapped);
    if (!best || d < best.distance)
      best = { edge, index, t, point: snapped, distance: d };
  });
  if (!best || best.distance > maxDistance) return null;
  if (distance(best.point, data.nodes[best.edge.a].point) < 1)
    return { ...best, id: best.edge.a, data };
  if (distance(best.point, data.nodes[best.edge.b].point) < 1)
    return { ...best, id: best.edge.b, data };
  const id = data.nodes.length;
  return {
    ...best,
    id,
    data: {
      ...data,
      nodes: [...data.nodes, { point: best.point }],
      edges: data.edges.flatMap((e, i) =>
        i === best.index
          ? [
              { ...e, b: id },
              { ...e, a: id },
            ]
          : [e],
      ),
    },
  };
}
