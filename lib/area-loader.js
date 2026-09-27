const defaultHosts = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export function createAreaLoader({fetchImpl = fetch, hosts = defaultHosts, now = Date.now, timeoutMs = 22000} = {}) {
  const cache = new Map();
  const pending = new Map();
  return async function loadArea(lat, lng, radius) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${radius}`;
    const saved = cache.get(key);
    if (saved && now() - saved.time < 3600000) return saved.data;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      // Public loading ranges are whole miles; geographic math uses kilometers.
      const dy = (radius * 1.609344) / 111.32;
      const dx = dy / Math.cos(lat * Math.PI / 180);
      const bbox = `${lat-dy},${lng-dx},${lat+dy},${lng+dx}`;
      // Avoid fetching enormous named administrative and route relations.
      const query = `[out:json][timeout:18];(way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed)$"](${bbox});way[building](${bbox});way["building:part"](${bbox});relation[building](${bbox});relation["building:part"](${bbox});nwr[amenity~"^(restaurant|fast_food|cafe|food_court|bar|pub|ice_cream)$"](${bbox});node[name](${bbox});way[name][highway!~"."](${bbox});node[natural=tree](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox}););out body geom;>;out skel qt;`;
      for (const host of hosts) {
        try {
          const response = await fetchImpl(host, {
            method: "POST",
            headers: {"User-Agent":"ShaadiestPath/1.0", Accept:"application/json", "Content-Type":"application/x-www-form-urlencoded"},
            body: new URLSearchParams({data:query}),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!response.ok) continue;
          const data = await response.json();
          if (data.remark || !Array.isArray(data.elements) || !data.elements.length) continue;
          if (cache.size >= 40) cache.delete(cache.keys().next().value);
          cache.set(key, {time:now(), data});
          return data;
        } catch { /* Try the next provider within the server's time budget. */ }
      }
      // Previously complete data is preferable to losing the user's loaded area.
      if (saved && now() - saved.time < 86400000) {
        return {...saved.data, stale:true};
      }
      throw new Error("Map providers are busy. Your current map is unchanged. Try the smallest area or retry shortly.");
    })();
    pending.set(key, request);
    try { return await request; }
    finally { pending.delete(key); }
  };
}
