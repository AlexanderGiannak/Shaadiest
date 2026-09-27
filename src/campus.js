export const campusCenter = { lat: 25.756, lng: -80.374 };
// Initial search window: FIU Modesto A. Maidique campus, Miami.
export function inCampus(lat, lng) {
  return lat >= 25.7485 && lat <= 25.7625 && lng >= -80.3835 && lng <= -80.3675;
}
export function campusPlaces(raw) {
  const seen = new Set();
  return raw.elements.flatMap(e => {
    const tags = e.tags || {};
    if (!tags.name || tags.highway) return [];
    const geometry = e.geometry || e.members?.flatMap(m => m.geometry || []) || [];
    const point = Number.isFinite(e.lat) ? {lat:e.lat,lng:e.lon} : geometry.length ? {
      lat:geometry.reduce((sum,p)=>sum+p.lat,0)/geometry.length,
      lng:geometry.reduce((sum,p)=>sum+p.lon,0)/geometry.length,
    } : null;
    if (!point || !inCampus(point.lat,point.lng)) return [];
    const key = tags.name.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{name:tags.name, aliases:[tags.short_name,tags.alt_name,tags.ref].filter(Boolean).join(" "), ...point}];
  });
}
export function searchCampus(places, query) {
  const normalize = value => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return words.length ? places.filter(p => inCampus(p.lat,p.lng) && words.every(w=>normalize(p.name+" "+p.aliases).includes(w)))
    .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,8) : [];
}
