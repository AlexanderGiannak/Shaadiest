import { validLocationFix } from "./location.js";
import { shadowPolygons } from "./shadow-geometry.js";
import { coversPosition, areaForPositions } from "./coverage.js";
import { formatDistance } from "./units.js";
import { arrivalTime, mountWeather } from "./weather.js";
import { areaPlaces, searchPlaces, snapPlace } from "./campus.js";
import { walkingProgress, travelHeading, directionGuidance } from "./walking.js";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { demoData } from "./demo.js";
import {
  parseOSM,
  project,
  unproject,
  scoreGraph,
  routesThrough,
  snapToPath,
  canopyOutline,
} from "./engine.js";
const icons = {
  leaf: '<path d="M5 14C5 5 14 4 20 3c1 10-4 17-12 15l8-10"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m10 22 2-7-3-4 2-4 4 3h4M6 14l3-3m4 4 5 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  origin: '<circle cx="12" cy="12" r="7"/>',
  swap: '<path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/>',
  locate:
    '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-9 11 9 6 9-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
};
const icon = (n) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[n] || icons.leaf}</svg>`;
const $ = (s) => document.querySelector(s);
let data = demoData(),
  scored,
  pair,
  start = 0,
  end = 48,
  third = null,
  thirdEnabled = false,
  selected = "shadiest",
  pick = null,
  busy = false,
  showShade = true,
  navigating = false;
const today = new Date();
let clockHour = today.getHours() + today.getMinutes() / 60,
  detour = 0.5;
const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
$("#app").innerHTML = `
<header class="header"><a class="brand" href="/" aria-label="Shaadiest home"><span class="brandmark">${icon("leaf")}</span>shaadiest<span class="branddot">.</span></a><span class="header-note">A cooler way there.</span><div class="header-right"><span class="event">SHELLHACKS ’26</span><button class="text-button" id="about">How it works ${icon("info")}</button></div></header>
<main class="workspace"><aside class="sidebar"><div class="eyebrow">MADE FOR THE WALK</div><h1>Take the<br/> <em>shady</em> route.</h1><p class="intro">A little more green. A lot less sun.</p>
<div class="mode-switch" aria-label="Data source"><button id="demo-mode" class="active">Explore demo</button><button id="live-mode">Live map</button></div>
<div class="area-scope"><label for="area-radius">Area around map center</label><select id="area-radius" aria-label="Map loading radius"><option value="1" selected>1 mile</option><option value="2">2 miles</option><option value="3">3 miles</option><option value="4">4 miles</option><option value="5">5 miles</option></select></div><p class="campus-scope">Pan anywhere, then choose Live map or Load this area to search restaurants, cafes, shops, and buildings by name.</p><div class="journey"><div class="place-label"><button id="drop-start" class="pin-picker" type="button" aria-label="Choose starting point on map" title="Choose starting point on map" aria-pressed="false">${icon("origin")}</button><span class="field"><input id="search-start" class="endpoint-search" type="search" autocomplete="off" aria-label="Search starting point" placeholder="Search starting point" aria-controls="results-start"/><div id="results-start" class="endpoint-results" aria-live="polite"></div><select id="start" aria-label="Starting point"></select><button id="pick-start" class="pick-label" hidden>Choose on map</button></span></div><button class="swap" id="swap" aria-label="Swap start and destination">${icon("swap")}</button><div class="place-label"><button id="drop-end" class="pin-picker" type="button" aria-label="Choose destination on map" title="Choose destination on map" aria-pressed="false">${icon("pin")}</button><span class="field"><input id="search-end" class="endpoint-search" type="search" autocomplete="off" aria-label="Search destination" placeholder="Search destination" aria-controls="results-end"/><div id="results-end" class="endpoint-results" aria-live="polite"></div><select id="end" aria-label="Destination"></select><button id="pick-end" class="pick-label" hidden>Choose on map</button></span></div><div id="third-stop" class="place-label" hidden><button id="drop-third" class="pin-picker" type="button" aria-label="Choose third location on map" aria-pressed="false">${icon("pin")}</button><span class="field"><input id="search-third" class="endpoint-search" type="search" autocomplete="off" aria-label="Search third location" placeholder="Search next destination" aria-controls="results-third"/><div id="results-third" class="endpoint-results" aria-live="polite"></div><select id="third" hidden></select><button id="pick-third" hidden></button><button id="remove-stop" class="add-stop" type="button">Remove stop</button></span></div></div><div class="journey-actions"><button id="use-current-start" class="current-start" type="button">Use current location</button><button id="add-stop" class="add-stop" type="button" aria-expanded="false" aria-controls="third-stop">+ Add stop</button></div>
<div class="time-card"><div class="time-head"><div class="sun-disc">${icon("sun")}</div><div><span class="small-label">PLAN WITH THE SUN</span><h3>Shade moves. Your route can too.</h3></div><div class="time-value" id="time-value"></div></div><div class="time-controls"><label class="date-wrap"><span class="sr-only">Departure date</span><input id="date" type="date" value="${dateValue}"/></label><input id="time" type="range" min="0" max="1439" step="1" value="${Math.round(clockHour * 60)}" aria-label="Departure time"/></div><div class="time-foot"><span id="timezone">Demo time · Miami (UTC−04:00)</span><span>12 AM <span class="time-separator">⸱</span> 11:59 PM</span></div><div class="time-presets" aria-label="Time of day"><button id="reset-time" type="button" title="Reset to your current local date and time" aria-label="Reset to current local date and time">Now</button><button data-hour="9">Morning</button><button data-hour="13">Midday</button><button data-hour="17">Evening</button></div><p id="sun-summary" aria-live="polite"></p></div>
<div class="preference"><div><label for="detour">Room for a cooler walk</label><strong id="detour-label">+50% distance</strong></div><input id="detour" type="range" min="0" max="75" step="5" value="50"/><div class="range-labels"><span>More direct</span><span>More shade</span></div></div>
<button id="find" class="primary">${icon("leaf")} Find my shady path ${icon("arrow")}</button>
<div class="walking-status" id="walking-status" role="status" hidden></div><div id="status" class="status" role="status" aria-live="polite"></div>
<div class="results-heading"><h2>Your walking routes</h2><span>${icon("walk")} ON FOOT</span></div><div id="route-cards"></div><div class="nav-card" id="navigation" hidden></div>
<div class="insight" id="insight"></div><div class="data-note">${icon("info")}<span id="data-note"></span></div>
<footer class="sidebar-footer"><span>A WALK ON THE BRIGHT SIDE. SORT OF.</span><span>↗</span></footer></aside>
<section class="map-shell" aria-label="Walking route map"><div id="map"></div><div class="map-top"><span class="location-pill">${icon("pin")}<span id="map-location">Miami · Campus demo</span><span class="live-dot"></span></span><button id="load-area" class="map-button" hidden>Load this area ${icon("arrow")}</button></div>
<div class="pin-tools"><button id="cancel-drop" hidden>Cancel</button></div><div class="map-controls"><button id="locate" aria-label="Start location tracking" title="Start location tracking" aria-pressed="false">${icon("locate")}</button><button id="follow-location" hidden aria-label="Follow my location" title="Follow my location">${icon("walk")}</button><button id="fit" aria-label="Fit route" title="Fit route">${icon("pin")}</button><button id="layers" aria-label="Toggle shade overlay" aria-pressed="true" title="Toggle shade overlay">${icon("layers")}</button></div>
<div class="weather-widget" id="weather-widget"><button class="weather-toggle" aria-label="Check weather and humidity" aria-expanded="false" aria-controls="weather-panel"><span class="weather-symbol" aria-hidden="true">☀</span><span class="weather-summary">Weather</span></button><section class="weather-panel" id="weather-panel" aria-label="Departure weather" hidden><strong>Weather at map center</strong><p class="weather-details" role="status"></p><small>Hourly forecast for your selected departure.</small><div><a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a><button class="weather-refresh">Refresh</button></div></section></div><div class="map-legend"><span><i class="legend-dot green"></i> Tree canopy</span><span><i class="legend-dot purple"></i> Cast shadow</span><span><i class="legend-line"></i> Shortest route</span></div>

</section></main>
<dialog id="about-dialog"><button class="dialog-close" aria-label="Close explanation">×</button><div class="eyebrow">A LITTLE SCIENCE. A BETTER WALK.</div><h2>Follow the shade.</h2><p>We build a walking network from OpenStreetMap, estimate tree canopy and project building shadows for your departure time. Each path is sampled about every 16 feet.</p><p>The shade route minimizes estimated sun-exposed distance among several weighted route candidates, while staying within your detour limit. It is an approximation, not a guaranteed global optimum.</p><h3>What’s an estimate?</h3><p>Missing building heights use about 10 feet per floor or a 30-foot default. Unmeasured trees use a 26-foot crown diameter and a 33-foot height. Crown shadows shift and stretch with the sun. Forest areas count as canopy. Building shadows sweep individual walls to preserve footprint notches. Tree crowns use approximate irregular outlines, not measured foliage. Clouds, terrain and changes during the walk are not modeled.</p><p>OSM coverage varies: unmapped trees do not mean no trees. Demo streets, buildings and trees are illustrative. Live routes use mapped public walking access; check signs and crossings on the ground.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap data & contributors ↗</a></dialog>`;
// Keep the time toolbar outside the map canvas so it never covers geography.
const mapShell = $(".map-shell");
const mapScene = document.createElement("div");
mapScene.className = "map-scene";
while (mapShell.firstChild) mapScene.append(mapShell.firstChild);
mapShell.append($(".time-card"), mapScene);
// Move existing controls between layouts so state and event handlers stay shared.
const mobileLayout = window.matchMedia("(max-width: 800px)");
const sidebar = $(".sidebar");
const sheetToggle = document.createElement("button");
sheetToggle.className = "sheet-toggle";
sheetToggle.type = "button";
sheetToggle.setAttribute("aria-controls", "sheet-content");
const sheetContent = document.createElement("div");
sheetContent.id = "sheet-content";
while (sidebar.firstChild) sheetContent.append(sidebar.firstChild);
sidebar.append(sheetToggle, sheetContent);
const mobileSearch = document.createElement("div");
mobileSearch.className = "mobile-search";
$(".workspace").append(mobileSearch);
const mobileStatus = document.createElement("div");
mobileStatus.className = "mobile-status";
mobileStatus.setAttribute("role", "status");
mobileStatus.hidden = true;
mobileSearch.append(mobileStatus);
const movableControls = [$(".mode-switch"), $(".time-card")].map(node => {
  const anchor = document.createComment("desktop control position");
  node.before(anchor);
  return { node, anchor };
});
let sheetExpanded = false;
function setSheetExpanded(expanded) {
  sheetExpanded = expanded;
  sidebar.classList.toggle("sheet-expanded", expanded);
  sheetToggle.setAttribute("aria-expanded", String(expanded));
  sheetToggle.innerHTML = '<span class="sheet-grip"></span><span>' + (expanded ? 'Your shady walk' : 'Plan your walk') + '</span><span class="sheet-action">' + (expanded ? 'Hide ↓' : 'Open ↑') + '</span>';
  sheetContent.inert = mobileLayout.matches && !expanded;
}
sheetToggle.onclick = () => {
  if (!sheetDragged) setSheetExpanded(!sheetExpanded);
  sheetDragged = false;
};
let touchStartY;
let sheetDragged = false;
sheetToggle.addEventListener("pointerdown", e => { touchStartY = e.clientY; sheetDragged = false; sheetToggle.setPointerCapture(e.pointerId); });
sheetToggle.addEventListener("pointerup", e => {
  if (Math.abs(e.clientY - touchStartY) > 25) {
    sheetDragged = true;
    setSheetExpanded(e.clientY < touchStartY);
  }
});
function syncMobileLayout() {
  for (const {node, anchor} of movableControls) {
    if (mobileLayout.matches) {
      if (node.classList.contains("time-card")) $(".preference").before(node);
      else mobileStatus.before(node);
    } else anchor.after(node);
  }
  setSheetExpanded(sheetExpanded);
}
mobileLayout.addEventListener("change", syncMobileLayout);
syncMobileLayout();
// Avoid geometry copies and large unions on memory-constrained mobile web apps.
const lightweightMap = mobileLayout.matches || window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const map = L.map("map", {
  zoomControl: false,
  preferCanvas: true,
  attributionControl: true,
}).setView([data.origin.lat, data.origin.lng], 17);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  keepBuffer: lightweightMap ? 0 : 2,
  updateWhenIdle: true,
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
L.control.zoom({ position: "bottomright" }).addTo(map);
for (const [name, z] of [
  ["paths", 390],
  ["shade", 410],
  ["buildings", 420],
  ["trees", 430],
  ["routes", 440],
]) {
  map.createPane(name);
  map.getPane(name).style.zIndex = z;
  map.getPane(name).style.pointerEvents = "none";
}
const resizeObserver = new ResizeObserver(() =>
  map.invalidateSize({ pan: false }),
);
resizeObserver.observe(document.querySelector("#map"));
const baseLayer = L.layerGroup().addTo(map),
  shadeLayer = L.layerGroup().addTo(map),
  routeLayer = L.layerGroup().addTo(map),
  markerLayer = L.layerGroup().addTo(map);
const ll = (p) => {
  const v = unproject(p, data.origin);
  return [v.lat, v.lng];
};
function setStatus(msg = "", error = false) {
  mobileStatus.textContent = msg;
  mobileStatus.hidden = !msg;
  $("#status").textContent = msg;
  $("#status").classList.toggle("error", error);
}
function date() {
  const d = new Date(`${$("#date").value}T00:00:00`);
  d.setHours(0, Math.round(clockHour * 60), 0, 0);
  return d;
}
function setOptions() {
  for (const which of ["start", "end", "third"]) {
    const sel = $("#" + which);
    sel.innerHTML = "";
    for (const p of data.places || []) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      sel.append(o);
    }
    sel.value = which === "start" ? start : which === "end" ? end : third;
    sel.hidden = true;
    $("#pick-" + which).hidden = true;
  }
}
function drawBase() {
  baseLayer.clearLayers();
  if (data.source === "demo") {
    for (const e of data.edges)
      L.polyline([ll(data.nodes[e.a].point), ll(data.nodes[e.b].point)], {
        pane: "paths",
        color: "#e2cd97",
        weight: 5,
        opacity: 0.85,
        interactive: false,
      }).addTo(baseLayer);
  }
  for (const b of data.buildings)
    L.polygon(b.points.map(ll), {
      pane: "buildings",
      color: "#838f85",
      weight: 1,
      fillColor: "#d4d8cd",
      fillOpacity: 0.8,
      interactive: false,
    }).addTo(baseLayer);
  for (const tree of data.trees) {
    L.polygon(canopyOutline(tree).filter((_, index) => !lightweightMap || index % 4 === 0).map(ll), {
      pane: "trees",
      color: "#447247",
      weight: 1.2,
      fillColor: "#85b469",
      fillOpacity: 0.65,
      interactive: false,
    }).addTo(baseLayer);
    if (!lightweightMap) L.circle(ll(tree.point), {
      pane: "trees",
      radius: 0.8,
      color: "#496140",
      weight: 1,
      fillOpacity: 1,
      interactive: false,
    }).addTo(baseLayer);
  }
  for (const polygon of data.woods || [])
    L.polygon(polygon.map(ll), {
      pane: "trees",
      color: "#719655",
      weight: 1,
      fillOpacity: 0.3,
      interactive: false,
    }).addTo(baseLayer);

}
let shadeWorker = null;
let shadeWorking = false;
let shadeDeadline;
let pendingShade = null;
let shadeFallback = false;
try {
  if (!lightweightMap) shadeWorker = new Worker(new URL("./shade-worker.js", import.meta.url), { type: "module" });
} catch { /* Canvas fallback also works when workers are unavailable. */ }
let shadeVersion = 0;
let mergedShade = [];
let scoredData = null;
let scoredTime = null;
let calculationTimer;
function fallbackShade() {
  mergedShade = scored ? shadowPolygons(scored.shapes.polygons, scored.shapes.treeShadows) : [];
  shadeFallback = true;
  drawShade();
}
function requestShade(request) {
  if (!shadeWorker) { fallbackShade(); return; }
  if (shadeWorking) { pendingShade = request; return; }
  shadeWorking = true;
  try { shadeWorker.postMessage(request); }
  catch { disableShadeWorker(); }
}
function disableShadeWorker() {
  clearTimeout(shadeDeadline);
  shadeWorker?.terminate();
  shadeWorker = null;
  shadeWorking = false;
  pendingShade = null;
  fallbackShade();
}
if (shadeWorker) {
  shadeWorker.onmessage = ({ data: result }) => {
    clearTimeout(shadeDeadline);
    shadeWorking = false;
    if (result.version === shadeVersion) {
      if (result.error) fallbackShade();
      else {
        mergedShade = result.polygons;
        shadeFallback = result.fallback;
        drawShade();
      }
    }
    // Rapid time-slider changes keep only the newest pending calculation.
    if (pendingShade) {
      const request = pendingShade;
      pendingShade = null;
      if (request.version === shadeVersion) requestShade(request);
    }
  };
  shadeWorker.onerror = event => { event.preventDefault(); disableShadeWorker(); };
  shadeWorker.onmessageerror = disableShadeWorker;
}
function scheduleCalculation() {
  clearTimeout(calculationTimer);
  calculationTimer = setTimeout(() => calculate(), 120);
}
function drawShade() {
  shadeLayer.clearLayers();
  if (!scored) return;
  if (showShade && !scored.shapes.night) {
    const polygons = mergedShade.map(polygon => polygon.map(ring => ring.map(ll)));
    if (polygons.length) {
      if (!shadeFallback) L.polygon(polygons, {
        pane: "shade",
        color: "#534b70",
        weight: 6,
        opacity: 0.09,
        fill: false,
        interactive: false,
      }).addTo(shadeLayer);
      // Fill the entire MultiPolygon once: fallback overlaps must not become
      // darker or cancel out; merged courtyard holes keep opposite winding.
      L.polygon(polygons, {
        pane: "shade",
        stroke: false,
        fillColor: "#514864",
        fillOpacity: 0.34,
        fillRule: "nonzero",
        interactive: false,
      }).addTo(shadeLayer);
    }
  }
  const elevation = Math.round((scored.shapes.sun.altitude * 180) / Math.PI);
  const bearing =
    ((scored.shapes.sun.azimuth * 180) / Math.PI + 180 + 360) % 360;
  const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
    Math.round(bearing / 45) % 8
  ];
  $("#sun-summary").textContent = scored.shapes.night
    ? "After sunset · no direct sunlight"
    : `Sun ${elevation}° above horizon · ${compass} · shadows point ${["S", "SW", "W", "NW", "N", "NE", "E", "SE"][Math.round(bearing / 45) % 8]}`;
  $(".map-shell").classList.toggle("night", scored.shapes.night);
}
function drawRoutes(fit = false) {
  updateWalkingStatus();
  routeLayer.clearLayers();
  markerLayer.clearLayers();
  if (!pair) {
    drawPins();
    return;
  }
  const chosen = pair[selected],
    other = pair[selected === "shadiest" ? "shortest" : "shadiest"];
  L.polyline(
    other.path.map((i) => ll(data.nodes[i].point)),
    { pane: "routes", smoothFactor: 0, color: "#fff", weight: 9, opacity: 0.85 },
  ).addTo(routeLayer);
  L.polyline(
    other.path.map((i) => ll(data.nodes[i].point)),
    { pane: "routes", smoothFactor: 0, color: "#91978e", weight: 4, dashArray: "7 8" },
  ).addTo(routeLayer);
  L.polyline(
    chosen.path.map((i) => ll(data.nodes[i].point)),
    { pane: "routes", smoothFactor: 0, color: "#fff", weight: 11, opacity: 1 },
  ).addTo(routeLayer);
  L.polyline(
    chosen.path.map((i) => ll(data.nodes[i].point)),
    {
      pane: "routes",
      smoothFactor: 0,
      color: selected === "shadiest" ? "#21563d" : "#626e77",
      weight: 6,
      opacity: 1,
    },
  ).addTo(routeLayer);
  drawPins();
  if (fit)
    map.fitBounds(
      L.latLngBounds(chosen.path.map((i) => ll(data.nodes[i].point))),
      { paddingTopLeft: [45, 80], paddingBottomRight: [55, 55], maxZoom: 18 },
    );
}
function arrivalLabel(minutes) {
  const departure = date();
  const arrival = arrivalTime(departure, minutes);
  const nextDay = arrival.toDateString() !== departure.toDateString();
  return arrival.toLocaleString([], {hour:"numeric", minute:"2-digit", ...(nextDay ? {month:"short", day:"numeric"} : {})});
}
function renderCards() {
  if (!pair) {
    $("#route-cards").innerHTML =
      '<div class="empty">Choose your start and destination on the map to compare walks.</div>';
    $("#insight").innerHTML = "";
    return;
  }
  $("#route-cards").innerHTML = ["shadiest", "shortest"]
    .map((kind) => {
      const r = pair[kind];
      return `<button class="route-card ${selected === kind ? "selected" : ""}" data-route="${kind}" aria-pressed="${selected === kind}"><div class="route-card-head"><span class="route-icon">${icon(kind === "shadiest" ? "leaf" : "walk")}</span><strong>${kind === "shadiest" ? "The shaadiest path" : "The shortest path"}</strong><span class="radio"></span></div><div class="route-metrics"><strong>${r.minutes}<small>min</small></strong><span>${formatDistance(r.length)} walk</span><span class="shade-badge">${Math.round(r.shade * 100)}% shade</span></div><p class="route-arrival">Est. arrival <strong>${arrivalLabel(r.minutes)}</strong><small>Based on selected departure · your local time</small></p><div class="shade-track"><span style="width:${r.shade * 100}%"></span></div></button>`;
    })
    .join("");
  const saved = Math.max(0, pair.shortest.exposed - pair.shadiest.exposed),
    extra = pair.shadiest.minutes - pair.shortest.minutes;
  $("#insight").innerHTML =
    `<span class="insight-icon">${icon("leaf")}</span><p>${saved > 5 ? `<strong>${formatDistance(saved)} less in the sun.</strong><br/>${extra > 0 ? `Just ${extra} extra minute${extra === 1 ? "" : "s"} to take it easy.` : "A cooler walk, at a similar pace."}` : "<strong>The direct route is your best match.</strong><br/>Try another time or allow a longer detour."}</p>`;
  $("#route-cards")
    .querySelectorAll("button")
    .forEach(
      (b) =>
        (b.onclick = () => {
          selected = b.dataset.route;
          renderCards();
          drawRoutes();
          if (navigating) renderNavigation();
        }),
    );
}
function updateNote() {
  $("#data-note").textContent =
    data.source === "demo"
      ? "Illustrative campus demo · Sample paths and canopy, not navigation data. Switch to Live map for real streets."
      : `OSM estimates · ${data.trees.length} mapped trees · ${data.buildings.length} buildings. Missing features can undercount shade.`;
  $("#timezone").textContent =
    `Time zone · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
}
function calculate(fit = false) {
  clearTimeout(calculationTimer);
  if (!$("#date").value) {
    setStatus("Choose a departure date.", true);
    return;
  }
  const time = date().getTime();
  if (scoredData !== data || scoredTime !== time) {
    const geometryChanged = !scoredData || scoredData.buildings !== data.buildings ||
      scoredData.trees !== data.trees || scoredTime !== time;
    scored = scoreGraph(data, new Date(time));
    scoredData = data;
    scoredTime = time;
    if (geometryChanged) {
      const version = ++shadeVersion;
      mergedShade = [];
      drawShade();
      requestShade({ version, polygons: scored.shapes.polygons,
        treeShadows: scored.shapes.treeShadows });
    }
  }
  if (start === null || end === null || (thirdEnabled && third === null)) {
    pair = null;
    renderCards();
    drawRoutes();
    return;
  }
  try {
    pair = routesThrough(data, scored, thirdEnabled ? [start,end,third] : [start,end], detour);
    setStatus(
      scored.shapes.night
        ? "The sun is below the horizon at this location and time."
        : "",
    );
  } catch (e) {
    pair = null;
    routeLayer.clearLayers();
    markerLayer.clearLayers();
    setStatus(e.message, true);
  }
  renderCards();
  drawRoutes(fit);
  if (navigating) renderNavigation();
}
function renderNavigation() {
  const box = $("#navigation");
  box.hidden = !navigating;
  if (!pair) {
    box.hidden = true;
    return;
  }
  const route = pair[selected];
  box.innerHTML = `<div class="nav-heading"><strong>${data.source === "demo" ? "Demo walk" : "Walking directions"}</strong><button id="close-nav" aria-label="Close directions">×</button></div><p>${route.minutes} min · Arrive ${arrivalLabel(route.minutes)} · ${formatDistance(route.length)} · ${Math.round(route.shade * 100)}% estimated shade</p><ol id="steps"></ol>`;
  const grouped = [];
  for (const e of route.segments) {
    const last = grouped.at(-1);
    if (last?.name === e.name) last.length += e.length;
    else grouped.push({ name: e.name, length: e.length });
  }
  for (const s of grouped) {
    const li = document.createElement("li");
    li.textContent = `Follow ${s.name} for ${formatDistance(s.length)}.`;
    $("#steps").append(li);
  }
  $("#close-nav").onclick = () => {
    navigating = false;
    box.hidden = true;
  };
}
$("#start").onchange = (e) => {
  start = Number(e.target.value);
  calculate(true);
};
$("#end").onchange = (e) => {
  end = Number(e.target.value);
  setSheetExpanded(true);
  calculate(true);
};
$("#swap").onclick = () => {
  const last = thirdEnabled ? "third" : "end";
  if (thirdEnabled) [start,third] = [third,start];
  else [start,end] = [end,start];
  [$("#search-start").value,$("#search-"+last).value] = [$("#search-"+last).value,$("#search-start").value];
  setOptions();
  calculate();
};
$("#detour").oninput = (e) => {
  detour = Number(e.target.value) / 100;
  $("#detour-label").textContent = `+${e.target.value}% distance`;
  scheduleCalculation();
};
$("#detour").onchange = () => calculate();
function setHour(value, fit = false, deferred = false) {
  clockHour = Number(value);
  document.dispatchEvent(new Event("departure-change"));
  $("#time").value = Math.round(clockHour * 60);
  document
    .querySelectorAll("[data-hour]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        Number(button.dataset.hour) === clockHour,
      ),
    );
  $("#time-value").innerHTML =
    `${Math.floor(clockHour) % 12 || 12}:${String(Math.round(clockHour * 60) % 60).padStart(2, "0")} <small>${clockHour >= 12 ? "PM" : "AM"}</small>`;
  if (deferred) scheduleCalculation();
  else calculate(fit);
}
$("#time").oninput = (e) => setHour(Number(e.target.value) / 60, false, true);
$("#time").onchange = () => calculate();
document
  .querySelectorAll("[data-hour]")
  .forEach((button) => (button.onclick = () => setHour(button.dataset.hour)));
$("#reset-time").onclick = () => {
  const now = new Date();
  $("#date").value = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  setHour(now.getHours() + now.getMinutes() / 60);
};
$("#date").onchange = () => { calculate(); document.dispatchEvent(new Event("departure-change")); };
$("#find").onclick = () => {
  if (busy) return;
  if (!pair) {
    setStatus("Choose a start and destination first.", true);
    return;
  }
  calculate(true);
  navigating = true;
  renderNavigation();
  if (mobileLayout.matches) $("#navigation").scrollIntoView({ behavior: "smooth", block: "nearest" });
};
$("#layers").onclick = () => {
  showShade = !showShade;
  $("#layers").setAttribute("aria-pressed", showShade);
  drawShade();
};
$("#fit").onclick = () => drawRoutes(true);
$("#about").onclick = () => $("#about-dialog").showModal();
$(".dialog-close").onclick = () => $("#about-dialog").close();
function drawPins() {
  markerLayer.clearLayers();
  for (const [which, id] of [
    ["start", start],
    ["end", end],
    ["third", third],
  ]) {
    if (id === null) continue;
    const marker = L.marker(ll(data.nodes[id].point), {
      draggable: true,
      autoPan: true,
      title: `Drag ${which === "start" ? "start" : "destination"} pin`,
      alt: `${which === "start" ? "Start" : "Destination"} pin`,
      icon: L.divIcon({
        className: `drop-pin ${which === "start" ? "start" : "end"}`,
        html: `<span></span>`,
        iconSize: which === "start" ? [32,32] : [34,44],
        iconAnchor: which === "start" ? [16,16] : [17,43],
      }),
    }).addTo(markerLayer);
    marker.bindTooltip(
      `${which === "start" ? "Start" : "Destination"} · drag to move`,
      { direction: "top", offset: [0, -35] },
    );
    marker.on("dragend", () => placePin(which, marker.getLatLng()));
  }
}
function cancelPick() {
  pick = null;
  $("#cancel-drop").hidden = true;
  $("#drop-start").setAttribute("aria-pressed", "false");
  $("#drop-end").setAttribute("aria-pressed", "false");
  $("#drop-third").setAttribute("aria-pressed", "false");
  map.getContainer().style.cursor = "";
  map.closePopup();
}
function choose(which) {
  if (mobileLayout.matches) setSheetExpanded(false);
  pick = which;
  $("#cancel-drop").hidden = false;
  $("#drop-start").setAttribute("aria-pressed", which === "start");
  $("#drop-end").setAttribute("aria-pressed", which === "end");
  $("#drop-third").setAttribute("aria-pressed", which === "third");
  map.getContainer().style.cursor = "crosshair";
}
async function placePin(which, position, resolvedSnap = null, minimumRadius = Number($("#area-radius").value)) {
  if (busy) {
    drawPins();
    return;
  }
  if (!resolvedSnap && data.source === "live" &&
      (!data.edges.length || !coversPosition(data.coverage, position))) {
    const retained = Object.entries({start, end, third})
      .filter(([key,id]) => key !== which && id !== null)
      .map(([key,id]) => [key, unproject(data.nodes[id].point, data.origin)]);
    const area = areaForPositions([position, ...retained.map(([,p]) => p)], minimumRadius);
    if (!area) {
      setStatus("These pins span more than the supported map area. Choose closer points, or load a new area to start another walk.", true);
      drawPins();
      return false;
    }
    if (!await loadArea(area.center, area.radius)) { drawPins(); return false; }
    for (const [key, previous] of retained) {
      const restored = snapToPath(data, project(previous, data.origin));
      if (!restored) {
        setStatus("The refreshed map could not restore your existing pin. Choose your start and destination again.", true);
        calculate();
        return false;
      }
      data = restored.data;
      if (key === "start") start = restored.id;
      else if (key === "end") end = restored.id;
      else third = restored.id;
      $("#search-" + key).value = "Dropped pin · " + restored.edge.name;
    }
  }
  const snap = resolvedSnap || snapToPath(data, project(position, data.origin));
  if (!snap) {
    setStatus(
      !data.edges.length
        ? "Walking paths have not loaded. Choose Live map or Load this area and retry."
        : snapToPath({...data, buildings: []}, project(position, data.origin))
          ? "Nearby mapped paths cross a building footprint and cannot be used. Choose an outdoor path or entrance."
          : "No eligible walking path within 262 ft in the loaded street data. Streets visible on the basemap may not allow walking.",
      true,
    );
    drawPins();
    return;
  }
  if (Object.entries({start,end,third}).some(([key,id]) => key !== which && id === snap.id)) {
    setStatus(
      "Place the pins at different points along the walking path.",
      true,
    );
    drawPins();
    return;
  }
  data = snap.data;
  $("#search-"+which).value = "Dropped pin · " + snap.edge.name;
  $("#results-"+which).replaceChildren();
  if (which === "start") start = snap.id;
  else if (which === "end") end = snap.id;
  else third = snap.id;
  if (data.source === "demo" && !data.places.some((p) => p.id === snap.id))
    data.places.push({ id: snap.id, name: `Dropped pin · ${snap.edge.name}` });
  setOptions();
  $("#pick-" + which).textContent =
    `${which === "start" ? "Start" : "Destination"} · ${snap.edge.name}`;
  cancelPick();
  calculate();
  drawPins();
  setStatus(
    `Pin placed on ${snap.edge.name}${snap.distance >= 1 ? ` · snapped ${formatDistance(snap.distance)} to path` : ""}. Drag either pin to adjust.`,
  );
  if (which === "end") setSheetExpanded(true);
  if (start !== null && end === null) choose("end");
  return true;
}
$("#pick-start").onclick = () => choose("start");
$("#pick-end").onclick = () => choose("end");
$("#drop-start").onclick = () => choose("start");
$("#drop-end").onclick = () => choose("end");
$("#drop-third").onclick = () => choose("third");
$("#add-stop").onclick = () => {
  thirdEnabled = true;
  $("#third-stop").hidden = false;
  $("#add-stop").hidden = true;
  $("#add-stop").setAttribute("aria-expanded","true");
  $("#search-third").focus();
  calculate();
};
$("#remove-stop").onclick = () => {
  thirdEnabled = false; third = null;
  $("#third-stop").hidden = true;
  $("#add-stop").hidden = false;
  $("#add-stop").setAttribute("aria-expanded","false");
  $("#search-third").value = "";
  $("#results-third").replaceChildren();
  if (pick === "third") cancelPick();
  calculate();
  $("#add-stop").focus();
};
$("#cancel-drop").onclick = cancelPick;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") cancelPick();
});
map.on("click", (e) => {
  if (busy) return;
  if (pick) {
    placePin(pick, e.latlng);
    return;
  }
  const menu = document.createElement("div");
  menu.className = "pin-menu";
  const heading = document.createElement("strong");
  heading.textContent = "Plan a walk from here";
  menu.append(heading);
  for (const [which, label] of [
    ["start", "Set as start"],
    ["end", "Set as destination"],
  ]) {
    const button = document.createElement("button");
    button.textContent = label;
    button.onclick = () => placePin(which, e.latlng);
    menu.append(button);
  }
  L.popup({ closeButton: true })
    .setLatLng(e.latlng)
    .setContent(menu)
    .openOn(map);
});
function modeUI(live) {
  $("#live-mode").classList.toggle("active", live);
  $("#demo-mode").classList.toggle("active", !live);

  $("#load-area").hidden = !live;
}
let loadedPlaces = [];

function enterLiveMode(center) {
  modeUI(true);
  // Remove illustrative content before showing the live loading state.
  if (data.source === "demo") {
    cancelPick();
    data = parseOSM({elements: []}, center);
    loadedPlaces = [];
    start = end = third = null;
    pair = null;
    navigating = false;
    $("#navigation").hidden = true;
    ++shadeVersion;
    mergedShade = [];
    scored = null;
    scoredData = null;
    baseLayer.clearLayers();
    shadeLayer.clearLayers();
    routeLayer.clearLayers();
    markerLayer.clearLayers();
    for (const which of ["start", "end", "third"]) {
      $("#search-" + which).value = "";
      $("#results-" + which).replaceChildren();
    }
    setOptions();
    renderCards();
    $("#map-location").textContent = "Live map · waiting for area data";
    $("#data-note").textContent = "Live streets have not loaded yet. Retry loading or choose Explore demo.";
  }
}

async function loadArea(centerOverride = null, radiusOverride = null) {
  if (busy) return;
  busy = true;
  enterLiveMode(centerOverride || map.getCenter());
  $("#load-area").disabled = true;
  $("#load-area").textContent = "Loading walking paths…";
  setStatus(
    "Loading paths, trees and buildings. This can take up to a minute.",
  );
  const center = centerOverride || map.getCenter();
  const radius = radiusOverride ?? Number($("#area-radius").value);
  try {
    const r = await fetch(`/api/area?lat=${center.lat}&lng=${center.lng}&radius=${radius}`, {signal: AbortSignal.timeout(50000)});
    const raw = await r.json().catch(() => { throw Error("Map loading timed out. Your current map is unchanged. Try a smaller area or retry."); });
    if (!r.ok) throw Error(raw.error || "Map loading failed. Please retry.");
    const next = parseOSM(raw, center);
    if (!next.edges.length)
      throw Error(
        "No walkable paths found. Move to another neighborhood and try again.",
      );
    next.coverage = {center: {lat: center.lat, lng: center.lng}, radius};
    const places = areaPlaces(raw);
    data = next;
    $("#area-radius").value = String(radius);
    loadedPlaces = places;
    for (const which of ["start","end","third"]) { $("#search-"+which).value=""; $("#results-"+which).replaceChildren(); }
    start = null;
    end = null;
    third = null;
    pair = null;
    navigating = false;
    $("#navigation").hidden = true;
    routeLayer.clearLayers();
    markerLayer.clearLayers();
    drawBase();
    setOptions();
    $("#pick-start").textContent = "Choose on map";
    $("#pick-end").textContent = "Choose on map";
    $("#map-location").textContent = `Live · ${radius} ${radius === 1 ? "mile" : "miles"} around loaded center`;
    updateNote();
    calculate();
    choose("start");
    setStatus(raw.searchLimited ? "Walking paths and shade data loaded. Place search is limited while providers are busy; use the pin buttons to choose your route." : raw.stale ? "Using recently saved map data while providers are busy. Search nearby places or drop pins." : "Area loaded. Search nearby places or drop pins. Pan and load another area to explore farther.");
    return true;
  } catch (e) {
    setStatus(e.name === "TimeoutError" ? "Map loading timed out. Your current map is unchanged. Try a smaller area or retry." : e.message, true);
  } finally {
    busy = false;
    $("#load-area").disabled = false;
    $("#load-area").innerHTML = `Load this area ${icon("arrow")}`;
  }
}
$("#live-mode").onclick = () => {
  loadArea();
};
$("#load-area").onclick = () => loadArea();
$("#demo-mode").onclick = () => {
  if (busy) {
    setStatus("Wait for the current map to finish loading.");
    return;
  }
  modeUI(false);
  data = demoData();
  for (const which of ["start","end","third"]) { $("#search-"+which).value=""; $("#results-"+which).replaceChildren(); }
  start = 0;
  end = 48;
  third = null;
  cancelPick();
  map.getContainer().style.cursor = "";
  navigating = false;
  $("#navigation").hidden = true;
  $("#map-location").textContent = "Miami · Campus demo";
  setOptions();
  updateNote();
  drawBase();
  calculate(true);
};
for (const which of ["start", "end", "third"]) {
  const input = $("#search-"+which), results = $("#results-"+which);
  let timer, revision = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const request = ++revision, query = input.value.trim();
    results.replaceChildren();
    if (query.length < 2) return;
    timer = setTimeout(async () => {
      if (busy) { results.textContent = "Map is loading. Type again when it finishes."; return; }
      if (data.source !== "live" || !data.edges.length) {
        results.textContent = "Loading nearby places…";
        const ok = await loadArea();
        if (request !== revision) return;
        input.value = query;
        if (!ok) { results.textContent = "Area data unavailable. Try searching again."; return; }
        modeUI(true);
      }
      if (request !== revision) return;
      results.replaceChildren();
      const matches = searchPlaces(loadedPlaces,query);
      if (!matches.length) results.textContent = "No matching places in the loaded area. Pan and load another area, try another name, or drop a pin.";
      for (const place of matches) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = place.name;
        const detail = document.createElement("small");
        detail.className = "place-result-detail";
        detail.textContent = [place.category, place.cuisine, place.address].filter(Boolean).join(" · ");
        button.append(detail);
        button.onclick = async () => {
          if (busy || (which === "third" && !thirdEnabled)) return;
          const snapped = snapPlace(data, place);
          if (!snapped) { setStatus("Could not connect this place to a mapped walking path. Choose a nearby entrance on the map.",true); return; }
          if (!await placePin(which,place,snapped)) return;
          input.value = place.name;
          results.replaceChildren();
          map.panTo(unproject(data.nodes[which === "start" ? start : which === "end" ? end : third].point,data.origin));
        };
        results.append(button);
      }
    },250);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") { ++revision; clearTimeout(timer); results.replaceChildren(); }
    if (event.key === "Enter") { event.preventDefault(); results.querySelector("button")?.focus(); }
  });
}
let locationWatch = null, locationSession = 0, latestFix = null, following = false;
let positionMarker = null, accuracyCircle = null;
let lastLocationRender = 0;
const locationLayer = L.layerGroup().addTo(map);
function locationIcon() {
  const heading = travelHeading(latestFix);
  return L.divIcon({className:"live-location", iconSize:[32,32], iconAnchor:[16,16],
    html:`${heading === null ? "" : `<span class="location-heading" style="transform:rotate(${heading}deg)"></span>`}<span class="location-dot"></span>`});
}
function updateLocationDirection() {
  if (positionMarker) positionMarker.setIcon(locationIcon());
}

function updateWalkingStatus(message) {
  const box = $("#walking-status");
  box.hidden = locationWatch === null && !message;
  if (message) { box.textContent = message; return; }
  if (!latestFix) { box.textContent = "Finding your location…"; return; }
  updateLocationDirection();
  const age = Date.now() - latestFix.timestamp;
  const accuracy = Math.round(latestFix.coords.accuracy);
  if (age > 20000) { box.textContent = "Location is stale — waiting for a fresh GPS update."; return; }
  const label = "Live location · accuracy ±" + formatDistance(accuracy);
  if (accuracy > 35) { box.textContent = label + " · Waiting for a more accurate fix."; return; }
  if (data.source !== "live" || !pair) { box.textContent = label + " · Load your area and choose a walking route."; return; }
  const point = project({lat:latestFix.coords.latitude,lng:latestFix.coords.longitude}, data.origin);
  const progress = walkingProgress(data.nodes,pair[selected],point);
  if (!progress) { box.textContent = label; return; }
  if (progress.offset > Math.max(25,accuracy)) {
    box.textContent = label + " · Off route — return to the marked path. Route has not been recalculated.";
  } else {
    const destination = data.nodes[pair[selected].path.at(-1)].point;
    const atDestination = Math.hypot(point[0]-destination[0],point[1]-destination[1]) <= 15 && progress.remaining <= 20;
    box.textContent = atDestination ? "You are near your destination · " + label :
      directionGuidance(travelHeading(latestFix), progress.bearing) + " · " + formatDistance(progress.remaining) + " remaining · about " + Math.max(1,Math.round(progress.remaining/80)) + " min · " + (progress.name || "Walking path") + " · accuracy ±" + formatDistance(accuracy);
  }
}
function stopTracking(message) {
  ++locationSession;
  if (locationWatch !== null) navigator.geolocation.clearWatch(locationWatch);
  locationWatch = null; latestFix = null; following = false; lastLocationRender = 0;
  locationLayer.clearLayers(); positionMarker = accuracyCircle = null;
  $("#locate").setAttribute("aria-pressed","false");
  $("#locate").setAttribute("aria-label","Start location tracking");
  $("#locate").title = "Start location tracking";
  $("#follow-location").hidden = true;
  updateWalkingStatus(message);
}
map.on("dragstart", () => { following = false; });
$("#follow-location").onclick = () => {
  following = true;
  if (latestFix) map.panTo([latestFix.coords.latitude, latestFix.coords.longitude], {animate:false});
};
$("#locate").onclick = () => {
  if (locationWatch !== null) { stopTracking("Location tracking stopped."); return; }
  if (!navigator.geolocation) { updateWalkingStatus("Location is not supported in this browser."); return; }
  const session = ++locationSession;
  following = true;
  $("#locate").setAttribute("aria-pressed","true");
  $("#locate").setAttribute("aria-label","Stop location tracking");
  $("#locate").title = "Stop location tracking";
  $("#follow-location").hidden = false;
  updateWalkingStatus("Finding your location… Allow location access to track your walk.");
  locationWatch = navigator.geolocation.watchPosition(position => {
    if (session !== locationSession) return;
    if (!validLocationFix(position)) { updateWalkingStatus("Waiting for a valid GPS location…"); return; }
    if (latestFix && position.timestamp < latestFix.timestamp) return;
    const first = !latestFix;
    latestFix = position;
    const latlng = [position.coords.latitude, position.coords.longitude];
    if (!positionMarker) {
      accuracyCircle = L.circle(latlng,{radius:Math.min(position.coords.accuracy, 1000),color:"#2877df",weight:1,fillOpacity:0.08,interactive:false}).addTo(locationLayer);
      positionMarker = L.marker(latlng,{icon: locationIcon(), interactive:false, zIndexOffset:1000}).addTo(locationLayer);
    } else {
      positionMarker.setLatLng(latlng);
      accuracyCircle.setLatLng(latlng).setRadius(Math.min(position.coords.accuracy, 1000));
    }
    if (following) {
      if (first) map.setView(latlng,17);
      else map.panTo(latlng,{animate:false});
    }
    if (first && data.source !== "live") enterLiveMode({lat:position.coords.latitude, lng:position.coords.longitude});
    updateWalkingStatus();
  }, error => {
    if (session !== locationSession) return;
    if (error.code === 1) stopTracking("Location permission denied. Enable it in your browser to track your walk.");
    else { latestFix = null; locationLayer.clearLayers(); positionMarker = accuracyCircle = null;
      updateWalkingStatus("GPS unavailable — waiting for a location update. You can stop tracking with the location button."); }
  }, {enableHighAccuracy:true,maximumAge:2000,timeout:15000});
};
// Explicitly choosing the current location loads its walking area when needed.
$("#use-current-start").onclick = async () => {
  if (busy) { setStatus("Wait for the area to finish loading, then use your location."); return; }
  if (data.source !== "live") { setStatus("Load a Live map area first, then use your current location as the start."); return; }
  if (!navigator.geolocation) { setStatus("Location is not supported in this browser.", true); return; }
  const button = $("#use-current-start");
  button.disabled = true;
  button.textContent = "Finding location…";
  try {
    const fix = latestFix && Date.now() - latestFix.timestamp < 10000
      ? latestFix
      : await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject,
        {enableHighAccuracy:true, maximumAge:0, timeout:15000}));
    if (!validLocationFix(fix)) throw Error("Your device returned an invalid location. Try again or place the start on the map.");
    if (fix.coords.accuracy > 50) throw Error("Location is too approximate to set your start. Try again outdoors or place the start on the map.");
    if (busy || data.source !== "live") throw Error("The map area changed. Try using your location again after loading a Live map area.");
    const position = {lat:fix.coords.latitude,lng:fix.coords.longitude};
    if (await placePin("start", position, null, 1) && locationWatch === null) $("#locate").onclick();
  } catch (error) {
    setStatus(error.code === 1 ? "Location permission denied. Allow location access or choose your start on the map."
      : error.code === 2 || error.code === 3 ? "Could not get your location. Try again or choose your start on the map."
      : error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Use current location";
  }
};
setInterval(() => { if (locationWatch !== null && latestFix) updateWalkingStatus(); },5000);
function suspendMapWork() {
  stopTracking();
  clearTimeout(calculationTimer);
  clearTimeout(shadeDeadline);
  shadeWorker?.terminate();
  shadeWorker = null;
  shadeWorking = false;
  pendingShade = null;
}
window.addEventListener("pagehide", suspendMapWork);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) suspendMapWork();
  else if (scored && !scored.shapes.night && !mergedShade.length) fallbackShade();
});

setOptions();
updateNote();
drawBase();
setHour(clockHour, true);

mountWeather(map, $("#weather-widget"), date);
