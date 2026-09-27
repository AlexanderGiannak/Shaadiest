import polygonClipping from "polygon-clipping";
self.onmessage = ({ data: { version, polygons, treeShadows } }) => {
  try {
    const shapes = [...polygons, ...treeShadows].filter(p => p.length >= 3 && Math.abs(p.reduce((sum, a, i) => {
      const b = p[(i + 1) % p.length];
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0)) > 0.001);
    const merged = shapes.length ? polygonClipping.union(...shapes.map(p => [[...p, p[0]]])) : [];
    self.postMessage({ version, polygons: merged });
  } catch (error) {
    self.postMessage({ version, error: error.message });
  }
};
