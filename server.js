import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
const port = Number(process.env.PORT) || 5186;
const cache = new Map();
let searchAt = 0,
  searchPending = false,
  areaPending = false;
const agent = {
  "User-Agent": "ShaadiestPath-ShellHacks26/1.0 (local hackathon prototype)",
  Accept: "application/json",
};
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 3 || q.length > 150)
    return res
      .status(400)
      .json({ error: "Enter a place name between 3 and 150 characters." });
  const key = "q:" + q;
  if (cache.has(key)) return res.json(cache.get(key));
  if (searchPending || Date.now() - searchAt < 1100)
    return res
      .status(429)
      .json({ error: "Please wait a moment before searching again." });
  searchAt = Date.now();
  searchPending = true;
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.search = new URLSearchParams({ q, limit: "5" });
    const r = await fetch(url, {
      headers: agent,
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok)
      throw Error(
        "Place search is unavailable. Move the map and load your area instead.",
      );
    const raw = await r.json();
    const data = (raw.features || []).map((f) => ({
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      display_name: [
        f.properties.name,
        f.properties.street,
        f.properties.city,
        f.properties.state,
        f.properties.country,
      ]
        .filter(Boolean)
        .join(", "),
    }));
    if (cache.size > 100) cache.clear();
    cache.set(key, data);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  } finally {
    searchPending = false;
  }
});
app.get("/api/area", async (req, res) => {
  const lat = Number(req.query.lat),
    lng = Number(req.query.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 85 ||
    Math.abs(lng) > 180
  )
    return res.status(400).json({ error: "Invalid map coordinates." });
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`,
    saved = cache.get(key);
  if (saved && Date.now() - saved.time < 3600000) return res.json(saved.data);
  if (areaPending)
    return res
      .status(429)
      .json({ error: "A map is already loading. Please try again shortly." });
  areaPending = true;
  const dy = 0.0072,
    dx = dy / Math.cos((lat * Math.PI) / 180),
    bbox = `${lat - dy},${lng - dx},${lat + dy},${lng + dx}`;
  const query = `[out:json][timeout:30];(way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed)$"](${bbox});way[building](${bbox});node[natural=tree](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox}););out body geom;>;out skel qt;`;
  try {
    let data;
    for (const host of process.env.OVERPASS_URL
      ? [process.env.OVERPASS_URL]
      : [
          "https://overpass-api.de/api/interpreter",
          "https://overpass.private.coffee/api/interpreter",
        ]) {
      try {
        const r = await fetch(host, {
          method: "POST",
          headers: {
            ...agent,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(35000),
        });
        if (!r.ok) continue;
        data = await r.json();
        if (data.remark || !data.elements?.length) {
          data = null;
          continue;
        }
        break;
      } catch {}
    }
    if (!data)
      throw Error(
        "Live map data is unavailable right now. Try again, or explore the demo.",
      );
    if (cache.size > 100) cache.clear();
    cache.set(key, { time: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  } finally {
    areaPending = false;
  }
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true, hmr: { port: 5187 } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(port, "127.0.0.1", () =>
  console.log(`Shaadiest Path → http://localhost:${port}`),
);
