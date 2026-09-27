import L from "leaflet";
import polygonClipping from "polygon-clipping";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { demoData } from "./demo.js";
import {
  parseOSM,
  project,
  unproject,
  scoreGraph,
  routes,
  snapToPath,
  canopyOutline,
} from "./engine.js";
const icons = {
  leaf: '<path d="M5 14C5 5 14 4 20 3c1 10-4 17-12 15l8-10"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="m10 22 2-7-3-4 2-4 4 3h4M6 14l3-3m4 4 5 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
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
<div id="search-box" hidden><form id="search-form"><label for="search">Find a neighborhood</label><div class="search-row"><input id="search" placeholder="e.g. FIU, Miami" minlength="3" required/><button class="square" aria-label="Search places">${icon("arrow")}</button></div></form><div id="search-results"></div></div>
<div class="journey"><div class="place-label"><button id="drop-start" class="pin-picker" type="button" aria-label="Choose starting point on map" title="Choose starting point on map" aria-pressed="false">${icon("pin")}</button><span class="field"><span class="small-label">STARTING FROM</span><select id="start" aria-label="Starting point"></select><button id="pick-start" class="pick-label" hidden>Choose on map</button></span></div><button class="swap" id="swap" aria-label="Swap start and destination">${icon("swap")}</button><div class="field-divider"></div><div class="place-label"><button id="drop-end" class="pin-picker" type="button" aria-label="Choose destination on map" title="Choose destination on map" aria-pressed="false">${icon("pin")}</button><span class="field"><span class="small-label">HEADING TO</span><select id="end" aria-label="Destination"></select><button id="pick-end" class="pick-label" hidden>Choose on map</button></span></div></div>
<div class="time-card"><div class="time-head"><div class="sun-disc">${icon("sun")}</div><div><span class="small-label">PLAN WITH THE SUN</span><h3>Shade moves. Your route can too.</h3></div><div class="time-value" id="time-value"></div></div><div class="time-controls"><label class="date-wrap"><span class="sr-only">Departure date</span><input id="date" type="date" value="${dateValue}"/></label><input id="time" type="range" min="0" max="1439" step="1" value="${Math.round(clockHour * 60)}" aria-label="Departure time"/></div><div class="time-foot"><span id="timezone">Demo time · Miami (UTC−04:00)</span><span>12 AM <span class="time-separator">⸱</span> 11:59 PM</span></div><div class="time-presets" aria-label="Time of day"><button id="reset-time" type="button" title="Reset to your current local date and time" aria-label="Reset to current local date and time">Now</button><button data-hour="9">Morning</button><button data-hour="13">Midday</button><button data-hour="17">Evening</button></div><p id="sun-summary" aria-live="polite"></p></div>
<div class="preference"><div><label for="detour">Room for a cooler walk</label><strong id="detour-label">+50% distance</strong></div><input id="detour" type="range" min="0" max="75" step="5" value="50"/><div class="range-labels"><span>More direct</span><span>More shade</span></div></div>
<button id="find" class="primary">${icon("leaf")} Find my shady path ${icon("arrow")}</button>
<div id="status" class="status" role="status" aria-live="polite"></div>
<div class="results-heading"><h2>Your walking routes</h2><span>${icon("walk")} ON FOOT</span></div><div id="route-cards"></div><div class="nav-card" id="navigation" hidden></div>
<div class="insight" id="insight"></div><div class="data-note">${icon("info")}<span id="data-note"></span></div>
<footer class="sidebar-footer"><span>A WALK ON THE BRIGHT SIDE. SORT OF.</span><span>↗</span></footer></aside>
<section class="map-shell" aria-label="Walking route map"><div id="map"></div><div class="map-top"><span class="location-pill">${icon("pin")}<span id="map-location">Miami · Campus demo</span><span class="live-dot"></span></span><button id="load-area" class="map-button" hidden>Load this area ${icon("arrow")}</button></div>
<div class="pin-tools"><button id="cancel-drop" hidden>Cancel</button></div><div class="map-hint" id="map-hint" hidden></div><div class="map-controls"><button id="locate" aria-label="Go to my location" title="Go to my location">${icon("locate")}</button><button id="fit" aria-label="Fit route" title="Fit route">${icon("pin")}</button><button id="layers" aria-label="Toggle shade overlay" aria-pressed="true" title="Toggle shade overlay">${icon("layers")}</button></div>
<div class="map-legend"><span><i class="legend-dot green"></i> Tree canopy</span><span><i class="legend-dot purple"></i> Cast shadow</span><span><i class="legend-line"></i> Shortest route</span></div>

</section></main>
<dialog id="about-dialog"><button class="dialog-close" aria-label="Close explanation">×</button><div class="eyebrow">A LITTLE SCIENCE. A BETTER WALK.</div><h2>Follow the shade.</h2><p>We build a walking network from OpenStreetMap, estimate tree canopy and project building shadows for your departure time. Each path is sampled every 5 meters.</p><p>The shade route minimizes estimated sun-exposed distance among several weighted route candidates, while staying within your detour limit. It is an approximation, not a guaranteed global optimum.</p><h3>What’s an estimate?</h3><p>Missing building heights use 3 meters per floor or a 9-meter default. Unmeasured trees use an 8-meter crown diameter and a 10-meter height. Crown shadows shift and stretch with the sun. Forest areas count as canopy. Building shadows sweep individual walls to preserve footprint notches. Tree crowns use approximate irregular outlines, not measured foliage. Clouds, terrain and changes during the walk are not modeled.</p><p>OSM coverage varies: unmapped trees do not mean no trees. Demo streets, buildings and trees are illustrative. Live routes use mapped public walking access; check signs and crossings on the ground.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap data & contributors ↗</a></dialog>`;
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
const movableControls = [$("#search-box"), $(".mode-switch"), $(".time-card")].map(node => {
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
const map = L.map("map", {
  zoomControl: false,
  preferCanvas: true,
  attributionControl: true,
}).setView([data.origin.lat, data.origin.lng], 17);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
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
  for (const which of ["start", "end"]) {
    const sel = $("#" + which);
    sel.innerHTML = "";
    for (const p of data.places || []) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name;
      sel.append(o);
    }
    sel.value = which === "start" ? start : end;
    sel.hidden = data.source !== "demo";
    $("#pick-" + which).hidden = data.source === "demo";
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
}
function drawShade() {
  shadeLayer.clearLayers();
  if (!scored) return;
  if (showShade && !scored.shapes.night) {
    const shapes = [
      ...scored.shapes.polygons,
      ...scored.shapes.treeShadows,
    ].filter(
      (p) =>
        p.length >= 3 &&
        Math.abs(
          p.reduce((s, a, i) => {
            const b = p[(i + 1) % p.length];
            return s + a[0] * b[1] - b[0] * a[1];
          }, 0),
        ) > 0.001,
    );
    const merged = shapes.length
      ? polygonClipping.union(...shapes.map((p) => [[...p, p[0]]]))
      : [];
    for (const polygon of merged) {
      const rings = polygon.map((ring) => ring.map(ll));
      // A soft perimeter around a uniform union, with courtyard holes retained.
      L.polygon(rings, {
        pane: "shade",
        color: "#534b70",
        weight: 6,
        opacity: 0.09,
        fill: false,
        interactive: false,
      }).addTo(shadeLayer);
      L.polygon(rings, {
        pane: "shade",
        stroke: false,
        fillColor: "#514864",
        fillOpacity: 0.34,
        interactive: false,
      }).addTo(shadeLayer);
    }
  }
  for (const tree of data.trees) {
    L.polygon(canopyOutline(tree).map(ll), {
      pane: "trees",
      color: "#447247",
      weight: 1.2,
      fillColor: "#85b469",
      fillOpacity: 0.65,
      interactive: false,
    }).addTo(shadeLayer);
    L.circle(ll(tree.point), {
      pane: "trees",
      radius: 0.8,
      color: "#496140",
      weight: 1,
      fillOpacity: 1,
      interactive: false,
    }).addTo(shadeLayer);
  }
  for (const polygon of data.woods || [])
    L.polygon(polygon.map(ll), {
      pane: "trees",
      color: "#719655",
      weight: 1,
      fillOpacity: 0.3,
      interactive: false,
    }).addTo(shadeLayer);
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
const formatDistance = (m) =>
  m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
function drawRoutes(fit = false) {
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
    { pane: "routes", color: "#fff", weight: 9, opacity: 0.85 },
  ).addTo(routeLayer);
  L.polyline(
    other.path.map((i) => ll(data.nodes[i].point)),
    { pane: "routes", color: "#91978e", weight: 4, dashArray: "7 8" },
  ).addTo(routeLayer);
  L.polyline(
    chosen.path.map((i) => ll(data.nodes[i].point)),
    { pane: "routes", color: "#fff", weight: 11, opacity: 1 },
  ).addTo(routeLayer);
  L.polyline(
    chosen.path.map((i) => ll(data.nodes[i].point)),
    {
      pane: "routes",
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
      return `<button class="route-card ${selected === kind ? "selected" : ""}" data-route="${kind}" aria-pressed="${selected === kind}"><div class="route-card-head"><span class="route-icon">${icon(kind === "shadiest" ? "leaf" : "walk")}</span><strong>${kind === "shadiest" ? "The shaadiest path" : "The shortest path"}</strong><span class="radio"></span></div><div class="route-metrics"><strong>${r.minutes}<small>min</small></strong><span>${formatDistance(r.length)} walk</span><span class="shade-badge">${Math.round(r.shade * 100)}% shade</span></div><div class="shade-track"><span style="width:${r.shade * 100}%"></span></div></button>`;
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
  if (!$("#date").value) {
    setStatus("Choose a departure date.", true);
    return;
  }
  scored = scoreGraph(data, date());
  drawShade();
  if (start === null || end === null) {
    pair = null;
    renderCards();
    drawRoutes();
    return;
  }
  try {
    pair = routes(data, scored, start, end, detour);
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
  box.innerHTML = `<div class="nav-heading"><strong>${data.source === "demo" ? "Demo walk" : "Walking directions"}</strong><button id="close-nav" aria-label="Close directions">×</button></div><p>${route.minutes} min · ${formatDistance(route.length)} · ${Math.round(route.shade * 100)}% estimated shade</p><ol id="steps"></ol>`;
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
  [start, end] = [end, start];
  setOptions();
  if (data.source === "live") {
    const a = $("#pick-start").textContent;
    $("#pick-start").textContent = $("#pick-end").textContent;
    $("#pick-end").textContent = a;
  }
  calculate();
};
$("#detour").oninput = (e) => {
  detour = Number(e.target.value) / 100;
  $("#detour-label").textContent = `+${e.target.value}% distance`;
  calculate();
};
function setHour(value, fit = false) {
  clockHour = Number(value);
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
  calculate(fit);
}
$("#time").oninput = (e) => setHour(Number(e.target.value) / 60);
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
$("#date").onchange = () => calculate();
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
  for (const [which, id, label] of [
    ["start", start, "A"],
    ["end", end, "B"],
  ]) {
    if (id === null) continue;
    const marker = L.marker(ll(data.nodes[id].point), {
      draggable: true,
      autoPan: true,
      title: `Drag ${which === "start" ? "start" : "destination"} pin`,
      alt: `${which === "start" ? "Start" : "Destination"} pin`,
      icon: L.divIcon({
        className: `drop-pin ${which}`,
        html: `<span>${label}</span>`,
        iconSize: [34, 44],
        iconAnchor: [17, 43],
      }),
    }).addTo(markerLayer);
    marker.bindTooltip(
      `${label} · ${which === "start" ? "Start" : "Destination"} · drag to move`,
      { direction: "top", offset: [0, -35] },
    );
    marker.on("dragend", () => placePin(which, marker.getLatLng()));
  }
}
function cancelPick() {
  pick = null;
  $("#map-hint").hidden = true;
  $("#cancel-drop").hidden = true;
  $("#drop-start").setAttribute("aria-pressed", "false");
  $("#drop-end").setAttribute("aria-pressed", "false");
  map.getContainer().style.cursor = "";
  map.closePopup();
}
function choose(which) {
  if (mobileLayout.matches) setSheetExpanded(false);
  pick = which;
  $("#map-hint").hidden = false;
  $("#cancel-drop").hidden = false;
  $("#map-hint").textContent =
    `Click to drop ${which === "start" ? "start" : "destination"} · snaps to nearest walking path · Esc to cancel`;
  $("#drop-start").setAttribute("aria-pressed", which === "start");
  $("#drop-end").setAttribute("aria-pressed", which === "end");
  map.getContainer().style.cursor = "crosshair";
}
function placePin(which, position) {
  if (busy) {
    drawPins();
    return;
  }
  const snap = snapToPath(data, project(position, data.origin));
  if (!snap) {
    setStatus(
      "No walking path within 80 m. Move closer to a mapped path.",
      true,
    );
    drawPins();
    return;
  }
  if (snap.id === (which === "start" ? end : start)) {
    setStatus(
      "Place the pins at different points along the walking path.",
      true,
    );
    drawPins();
    return;
  }
  data = snap.data;
  if (which === "start") start = snap.id;
  else end = snap.id;
  if (data.source === "demo" && !data.places.some((p) => p.id === snap.id))
    data.places.push({ id: snap.id, name: `Dropped pin · ${snap.edge.name}` });
  setOptions();
  $("#pick-" + which).textContent =
    `${which === "start" ? "Start" : "Destination"} · ${snap.edge.name}`;
  cancelPick();
  calculate();
  drawPins();
  setStatus(
    `Pin placed on ${snap.edge.name}${snap.distance >= 1 ? ` · snapped ${Math.round(snap.distance)} m to path` : ""}. Drag either pin to adjust.`,
  );
  if (which === "end") setSheetExpanded(true);
  if (start !== null && end === null) choose("end");
}
$("#pick-start").onclick = () => choose("start");
$("#pick-end").onclick = () => choose("end");
$("#drop-start").onclick = () => choose("start");
$("#drop-end").onclick = () => choose("end");
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
  $("#search-box").hidden = !live;
  $("#load-area").hidden = !live;
}
async function loadArea() {
  if (busy) return;
  busy = true;
  $("#load-area").disabled = true;
  $("#load-area").textContent = "Loading walking paths…";
  setStatus(
    "Loading paths, trees and buildings. This can take up to a minute.",
  );
  const center = map.getCenter();
  try {
    const r = await fetch(`/api/area?lat=${center.lat}&lng=${center.lng}`);
    const raw = await r.json();
    if (!r.ok) throw Error(raw.error);
    const next = parseOSM(raw, center);
    if (!next.edges.length)
      throw Error(
        "No walkable paths found. Move to another neighborhood and try again.",
      );
    data = next;
    start = null;
    end = null;
    pair = null;
    navigating = false;
    $("#navigation").hidden = true;
    routeLayer.clearLayers();
    markerLayer.clearLayers();
    drawBase();
    setOptions();
    $("#pick-start").textContent = "Choose on map";
    $("#pick-end").textContent = "Choose on map";
    $("#map-location").textContent = "Live · OpenStreetMap";
    updateNote();
    calculate();
    choose("start");
    setStatus("Area loaded. Pick two points on mapped walking paths.");
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    busy = false;
    $("#load-area").disabled = false;
    $("#load-area").innerHTML = `Load this area ${icon("arrow")}`;
  }
}
$("#live-mode").onclick = () => {
  modeUI(true);
  loadArea();
};
$("#load-area").onclick = loadArea;
$("#demo-mode").onclick = () => {
  if (busy) {
    setStatus("Wait for the current map to finish loading.");
    return;
  }
  modeUI(false);
  data = demoData();
  start = 0;
  end = 48;
  cancelPick();
  $("#map-hint").hidden = true;
  map.getContainer().style.cursor = "";
  navigating = false;
  $("#navigation").hidden = true;
  $("#map-location").textContent = "Miami · Campus demo";
  setOptions();
  updateNote();
  drawBase();
  calculate(true);
};
$("#search-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = $("#search-form button");
  button.disabled = true;
  setStatus("Finding places…");
  $("#search-results").innerHTML = "";
  try {
    const r = await fetch(
      "/api/search?q=" + encodeURIComponent($("#search").value),
    );
    const values = await r.json();
    if (!r.ok) throw Error(values.error);
    if (!values.length)
      throw Error("No places found. Try a city or a more specific name.");
    for (const p of values) {
      const b = document.createElement("button");
      b.textContent = p.display_name;
      b.onclick = () => {
        map.setView([Number(p.lat), Number(p.lon)], 16);
        $("#search-results").innerHTML = "";
        $("#map-location").textContent = p.display_name
          .split(",")
          .slice(0, 2)
          .join(",");
        if (mobileLayout.matches) {
          modeUI(true);
          loadArea();
        }
        setStatus("Place found. Select “Load this area” to get walking paths.");
      };
      $("#search-results").append(b);
    }
    setStatus();
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    button.disabled = false;
  }
};
$("#locate").onclick = () => {
  if (!navigator.geolocation) {
    setStatus("Location is not supported in this browser.", true);
    return;
  }
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (p) => {
      map.setView([p.coords.latitude, p.coords.longitude], 16);
      modeUI(true);
      setStatus(
        "Location found. Select “Load this area” to get walking paths.",
      );
    },
    () =>
      setStatus(
        "Location unavailable. Search for a neighborhood or move the map instead.",
        true,
      ),
    { timeout: 10000 },
  );
};
setOptions();
updateNote();
drawBase();
setHour(clockHour, true);
