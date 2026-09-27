import express from "express";
import { areaBox, areaQuery, fetchArea } from "./overpass.js";
const app = express();
app.disable("x-powered-by");
const cache = new Map();
const pending = new Map();
function send(res, data) {
  // Let Vercel's CDN absorb repeat loads of the same area.
  res.set("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  res.json(data);
}
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
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`,
    saved = cache.get(key);
  if (saved && Date.now() - saved.time < 6 * 3600000) return send(res, saved.data);
  // Visitors loading the same area share one upstream request.
  if (!pending.has(key))
    pending.set(
      key,
      fetchArea(areaQuery(areaBox(Number(lat.toFixed(3)), Number(lng.toFixed(3))))).finally(() =>
        pending.delete(key),
      ),
    );
  try {
    const data = await pending.get(key);
    if (cache.size > 50) cache.clear();
    cache.set(key, { time: Date.now(), data });
    send(res, data);
  } catch {
    res.status(503).json({
      error:
        "Live map data is busy right now. Your current map is unchanged. Retry shortly, or search FIU campus places.",
    });
  }
});

export default app;
