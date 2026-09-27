import polygonClipping from "polygon-clipping";
import { shadowPolygons } from "./shadow-geometry.js";

export function mergeShadows(polygons = [], treeShadows = [], union = polygonClipping.union) {
  const shapes = shadowPolygons(polygons, treeShadows);
  if (!shapes.length) return {polygons: [], fallback: false};
  try {
    // One MultiPolygon argument avoids the JavaScript argument-count limit.
    return {polygons: union(shapes), fallback: false};
  } catch {
    // Retry floating-point topology failures at centimeter display precision.
    try {
      return {polygons: union(shadowPolygons(polygons, treeShadows, 100)), fallback: false};
    } catch {
      // Draw every valid shape in one nonzero-fill canvas path. Overlaps retain
      // uniform opacity and no shadow is discarded because the union failed.
      return {polygons: shapes, fallback: true};
    }
  }
}
