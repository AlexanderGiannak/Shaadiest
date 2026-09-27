import { project, snapToPath } from "./engine.js";

export function areaPlaces(raw) {
  const seen = new Set();
  return raw.elements.flatMap(e => {
    const tags = e.tags || {};
    if (!tags.name || tags.highway) return [];
    const geometry = e.geometry || e.members?.flatMap(m => m.geometry || []) || [];
    const point = Number.isFinite(e.lat) ? {lat:e.lat,lng:e.lon} : geometry.length ? {
      lat:geometry.reduce((sum,p)=>sum+p.lat,0)/geometry.length,
      lng:geometry.reduce((sum,p)=>sum+p.lon,0)/geometry.length,
    } : null;
    if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return [];
    const key = `${tags.name.toLowerCase()}:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const boundaries = e.geometry ? [e.geometry] : (e.members || []).filter(m => m.role !== "inner").map(m => m.geometry || []);
    return [{boundaries, name:tags.name, aliases:[tags.short_name,tags.alt_name,tags.ref].filter(Boolean).join(" "), ...point}];
  });
}
export function searchPlaces(places, query) {
  const normalize = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return words.length ? places.filter(p => words.every(w=>normalize(p.name+" "+p.aliases).includes(w)))
    .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,8) : [];
}

// Large places are searchable by their mapped perimeter as well as their center.
// Keep separate relation members separate so gaps never become invented edges.
export function snapPlace(data, place) {
  const center = snapToPath(data, project(place, data.origin));
  if (center) return center;
  let best = null;
  const consider = point => {
    const snap = snapToPath(data, point);
    if (snap && (!best || snap.distance < best.distance)) best = snap;
  };
  for (const boundary of place.boundaries || []) {
    const points = boundary.map(p => project({lat:p.lat, lng:p.lon}, data.origin));
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      consider(a);
      if (!i) continue;
      const b = points[i - 1];
      const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20);
      for (let step = 1; step < steps; step++) {
        const t = step / steps;
        consider([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
  }
  return best;
}
