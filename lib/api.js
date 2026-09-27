import express from "express";
import { createAreaLoader } from "./area-loader.js";
const app = express();
app.disable("x-powered-by");
const loadArea = createAreaLoader(process.env.OVERPASS_URL ? {hosts:[process.env.OVERPASS_URL]} : {});
app.get("/api/area", async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const radius = req.query.radius === undefined ? 2 : Number(req.query.radius);
  if (req.query.lat === undefined || req.query.lng === undefined ||
      !Number.isFinite(radius) || radius < 1 || radius > 3 ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) {
    return res.status(400).json({error:"Invalid map coordinates or radius (use 1–3 km)."});
  }
  try { res.json(await loadArea(lat, lng, radius)); }
  catch (error) { res.status(503).json({error:error.message}); }
});
export default app;
