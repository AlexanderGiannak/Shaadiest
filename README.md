# Shaadiest Path 🌿

A ShellHacks ’26 walking-route prototype that trades a little distance for less sun. Created as its own project at `Shellhacks26/ShaadiestPath`.

## Run

Requires Node.js 22.12+.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5186**. The app and API run together; no API keys are required. The separate hot-reload port is 5187. The development server listens only on the local machine.

```sh
npm test        # routing, shadow, access, parser and geometry tests
npm run build   # production client
npm start       # serves the build and API together
```

Use `PORT=5188 npm run dev` to change the HTTP port. `OVERPASS_URL=https://your-server/api/interpreter npm run dev` overrides the public map-data providers. A public launch would need a hosted provider or your own OSM service rather than depending on community endpoints.

## Try it

1. The opening **Explore demo** uses illustrative paths, trees and buildings over a Miami basemap; there is no opaque background overlay. Compare the diagonal walk with the tree-lined perimeter. Streets, trees, buildings and place labels in this mode are synthetic and are explicitly marked as demo data.
2. Set a start and destination, then adjust the extra-distance budget. Select either route card to see that route on the map.
3. Use Morning/Midday/Evening or the full-day slider and date to project building and tree shadows. The time toolbar occupies its own space above the map; it never covers the map. “Find my shady path” opens a route summary and grouped path directions.
4. Switch to **Live map** to load roughly a 1.6 km square around the map center. Click the map and choose Set as start/destination, or use the Drop start/Drop destination toolbar. Drag either pin to adjust it. Pins snap to the closest point on a walking segment within 80 m; segments are split without changing access direction. Escape or Cancel exits placement mode. This works in both demo and live modes.
5. Pan to any neighborhood and choose Live map or Load this area. Select a 1–5 mile range around the map center (1 mile by default). Search the loaded area for starting points and destinations by mapped names, alternative names, and abbreviations, or drop pins. Loading another area clears the previous route. Place search uses the loaded OpenStreetMap dataset, not a worldwide address geocoder. Geolocation happens only when you press its button and grant browser permission.

Live area loading and map tiles require internet. OpenStreetMap's community Overpass servers can be slow or unavailable; failed loads show an explicit error and do not replace the current dataset. On September 27, 2026, a one-mile request to the deployed API succeeded, while the default two-mile request failed with a provider error. The default is now one mile. The live parsing and loading pipeline was also checked in a browser using the returned OSM data; provider availability can still vary.

## How the routing works

- **Walking graph:** OpenStreetMap ways become connected edges at shared OSM nodes. Motorways, trunks, construction, private/no foot access and nonwalking areas are excluded. `foot=yes` can override general vehicle access restrictions. Explicit `oneway:foot` is respected, including reversed direction. Ordinary car one-way tags do not restrict walking.
- **Sun:** SunCalc **1.9.0** calculates solar altitude and azimuth. This version deliberately uses radians and the south-based azimuth convention; newer major versions must be checked before upgrading.
- **Buildings:** Heights use `height`, then `building:levels × 3 m`, then a 9 m fallback. Footprints are swept away from the sun and projected by sweeping individual wall edges, preserving concave notches. Shadow length is capped at 250 m.
- **Trees:** Individual mapped crowns use `diameter_crown` or an 8 m diameter. Mapped closed forest/wood ways count as canopy. Individual crowns are approximated as irregular, lobed elevated crowns (10 m fallback tree height). Their projected shadows move and stretch with the sun; the visible green canopy stays fixed. Routing samples the projected shadows. Forest polygons remain an approximate fixed canopy.
- **Exposure:** Each walking edge is sampled at intervals of at most 5 m. Samples inside canopy or building shade count as shaded; covered paths count as shaded. Nighttime has no direct solar exposure.
- **Routing:** Binary-heap Dijkstra first computes the shortest walk. It then generates candidates at nine sun-penalty weights using `length × (1 + weight × exposed_fraction)`. Candidates beyond the user's detour allowance are rejected; among the remaining candidates, the one with the least **total sun-exposed distance** wins. This is an approximation, not an exact constrained global optimum. Ties retain the shorter/earlier route.
- **Time estimates:** A fixed 80 meters/minute walking pace. Demo dates use fixed UTC−04:00. Live dates/times use the browser time zone, shown in the UI; this can differ from the destination time zone when traveling.

## Important prototype limits

Shade is an estimate based on mapped features, not a sensor reading or a claim about temperature. OSM has incomplete trees and heights; unmapped canopy is treated as unknown/unshaded. Building heights are assumed meters. Multipolygon forests, terrain, cloud cover, seasonal foliage, actual tree crown shape, separate road sidewalks, crossing rules, foot-access barriers, conditional access and changing shade during a walk are not fully modeled. A road's mapped pedestrian access is not an accessibility or crossing-safety guarantee. Directions describe path segments; this is not GPS-guided turn-by-turn navigation. The default campus is not a survey of FIU.

## Structure

- `src/main.js` — interface, Leaflet map, state and API integration
- `src/engine.js` — geometry, sun/shade model, OSM conversion and routing
- `src/demo.js` — repeatable synthetic campus dataset
- `src/style.css` — responsive layout and visual system
- `server.js` — Vite/production serving, Overpass proxy, bounded requests and memory cache
- `tests/engine.test.js` — algorithm and parsing regression tests

## Data and references

[OpenStreetMap contributors](https://www.openstreetmap.org/copyright) provide live map and geographic data under the ODbL. Basemap tiles come from OpenStreetMap. [Leaflet](https://leafletjs.com/reference.html) renders the map, [SunCalc](https://github.com/mourner/suncalc/tree/v1.9.0) supplies solar position, [Photon](https://github.com/komoot/photon) supplies place search and [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API) supplies walking paths, trees and buildings. No Google or Apple credentials or proprietary map data are used.

### Building avoidance

Live loading includes building ways, building parts, and building relations. Relation outer rings are joined across member ways; incomplete relation outlines reject the new area load. Routes and dropped pins reject edges crossing building interiors, including tagged tunnels and building passages. Indoor corridors are excluded. Relation courtyards are conservatively treated as blocked. Routing uses mapped outdoor alternatives and reports no connection when none exists; missing or inaccurate OSM footprints remain a limitation. Restart the server after query changes and reload the area to fetch the expanded building dataset.

### Live walking location

Press the location icon and allow browser location access to start tracking; press it again to stop. The blue dot shows position and the circle shows reported accuracy. Dragging the map pauses following; the walking icon resumes it. On a live route, the location panel estimates remaining route distance and reports off-route or stale GPS fixes. It does not automatically reroute. Tracking stays in this page and stops when you leave; GPS coordinates are not sent to the application server by tracking. Browser geolocation requires localhost or HTTPS.

Live mode clears illustrative demo overlays before loading. Failed loads show an empty live state with a retry button, or preserve a previously loaded live area. The one-mile default reduces public-provider load; larger ranges may be slower or unavailable. Shade and building collision checks use spatial buckets to avoid scanning every mapped feature for every path.

### Pin placement and loaded coverage

Basemap tiles can show streets outside the loaded walking network. Dropping a live pin or choosing Use current location now loads the required area when its 80-meter snapping neighborhood is missing. Area expansion includes existing pins, up to the five-mile loading limit. Provider failures are shown as loading errors rather than distance errors; paths excluded by building footprints have a separate explanation. Location tracking alone makes no area request; explicitly choosing the current location as a route endpoint may request map data around it.
