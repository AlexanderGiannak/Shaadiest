import express from "express";
const app = express();
app.disable("x-powered-by");
const cache = new Map();
let areaPending = false;
const agent = {
  "User-Agent": "ShaadiestPath-ShellHacks26/1.0 (local hackathon prototype)",
  Accept: "application/json",
};
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
  const query = `[out:json][timeout:30];(way[highway][highway!~"^(motorway|motorway_link|trunk|trunk_link|construction|proposed)$"](${bbox});way[building](${bbox});way["building:part"](${bbox});relation[building](${bbox});relation["building:part"](${bbox});nwr[name](${bbox});node[natural=tree](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox}););out body geom;>;out skel qt;`;
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

export default app;
