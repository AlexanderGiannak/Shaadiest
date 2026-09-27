import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import app from "../lib/api.js";

test("area API rejects malformed coordinates and ranges before contacting providers", async () => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/area`;
    for (const query of [
      "", "?lat=&lng=-80", "?lat=%20&lng=-80", "?lat=25&lng=",
      "?lat=25&lat=26&lng=-80", "?lat=NaN&lng=-80", "?lat=86&lng=-80",
      "?lat=25&lng=181", "?lat=25&lng=-80&radius=", "?lat=25&lng=-80&radius=0",
      "?lat=25&lng=-80&radius=6", "?lat=25&lng=-80&radius=1.5",
      "?lat=25&lng=-80&radius=1&radius=2",
    ]) {
      const response = await fetch(base + query);
      assert.equal(response.status, 400, query);
      assert.match(response.headers.get("content-type"), /application\/json/);
      assert.match((await response.json()).error, /Invalid map coordinates/);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
