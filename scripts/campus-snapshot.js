// Refresh the bundled FIU campus data: node scripts/campus-snapshot.js
import { writeFile } from "node:fs/promises";
import { areaBox, areaQuery, fetchArea } from "../lib/overpass.js";
import { campusCenter } from "../src/campus.js";

const data = await fetchArea(areaQuery(areaBox(campusCenter.lat, campusCenter.lng)), 120000);
const file = new URL("../public/campus.json", import.meta.url);
await writeFile(file, JSON.stringify(data));
console.log(`Wrote ${data.elements.length} elements to ${file.pathname}`);
