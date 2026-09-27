// Shared by the area API and scripts/campus-snapshot.js.
const hosts = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
      "https://overpass-api.de/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
      "https://overpass.private.coffee/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];
const keep = new Set([
  "highway", "name", "short_name", "alt_name", "ref", "building", "building:part",
  "height", "building:levels", "natural", "landuse", "diameter_crown", "foot",
  "access", "indoor", "area", "covered", "tunnel", "oneway:foot", "type",
]);

export function areaBox(lat, lng) {
  const dy = 0.0072,
    dx = dy / Math.cos((lat * Math.PI) / 180);
  return `${lat - dy},${lng - dx},${lat + dy},${lng + dx}`;
}

// Only what the client parses. The old `nwr[name]` pulled every bus route and
// US 41 with full geometry, and `>;` duplicated every node: ~7 MB per area,
// which timed out public servers and exceeded Vercel's response limit.
// Ways keep `nodes` plus inline `geometry`, so no separate node dump is needed.
export function areaQuery(bbox) {
  return `[out:json][timeout:45];(way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed)$"](${bbox});way[building](${bbox});way["building:part"](${bbox});relation[building](${bbox});relation["building:part"](${bbox});node[name](${bbox});way[name][!highway](${bbox});relation[name][type=multipolygon](${bbox});node[natural=tree](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox}););out body geom;`;
}

function compact(data) {
  return {
    elements: data.elements.map(({ bounds, tags, members, ...e }) => {
      const out = { ...e };
      if (tags) out.tags = Object.fromEntries(Object.entries(tags).filter(([k]) => keep.has(k)));
      if (members) out.members = members.map(({ type, ref, role, geometry }) => ({ type, ref, role, geometry }));
      return out;
    }),
  };
}

// Ask every mirror at once and keep the first complete answer; public servers
// are often overloaded, so waiting on them one by one outlasts the function.
export async function fetchArea(query, timeout = 50000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const data = await Promise.any(
      hosts.map(async (host) => {
        const r = await fetch(host, {
          method: "POST",
          headers: {
            "User-Agent": "ShaadiestPath-ShellHacks26/1.0 (hackathon prototype)",
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        });
        if (!r.ok) throw Error(`${host} ${r.status}`);
        const json = await r.json();
        if (json.remark || !json.elements?.length) throw Error(`${host} incomplete`);
        return json;
      }),
    );
    return compact(data);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
