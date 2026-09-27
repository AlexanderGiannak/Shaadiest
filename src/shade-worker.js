import { mergeShadows } from "./shadow-union.js";
self.onmessage = ({ data: { version, polygons, treeShadows } }) => {
  self.postMessage({version, ...mergeShadows(polygons, treeShadows)});
};
