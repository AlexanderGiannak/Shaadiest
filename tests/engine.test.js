import test from "node:test";
import assert from "node:assert/strict";
import { demoData } from "../src/demo.js";
import {
  crossesBuilding,
  routes,
  scoreGraph,
  shortestPath,
  sampleShade,
  parseOSM,
  walkable,
  shadowShapes,
  snapToPath,
  canopyOutline,
  inside,
  project,
  unproject,
} from "../src/engine.js";
const date = new Date("2026-09-26T14:00:00-04:00");
test("shade route saves exposure while obeying detour cap", () => {
  const d = demoData(),
    s = scoreGraph(d, date),
    r = routes(d, s, 0, 48, 0.5);
  assert.ok(r.shadiest.exposed < r.shortest.exposed);
  assert.ok(r.shadiest.length <= r.shortest.length * 1.5);
  assert.equal(r.shadiest.path[0], 0);
  assert.equal(r.shadiest.path.at(-1), 48);
  console.log({
    shortest: r.shortest.length,
    shadeRoute: r.shadiest.length,
    shortestShade: r.shortest.shade,
    shadeRouteShade: r.shadiest.shade,
  });
});
test("zero detour never returns a longer path", () => {
  const d = demoData(),
    s = scoreGraph(d, date),
    r = routes(d, s, 0, 48, 0);
  assert.ok(r.shadiest.length <= r.shortest.length + 0.01);
});
test("disconnected and identical endpoints fail with actionable errors", () => {
  const d = { nodes: [{ point: [0, 0] }, { point: [1, 1] }], edges: [] };
  assert.throws(() => routes(d, { edges: [] }, 0, 1), /not connected/);
  assert.throws(() => routes(d, { edges: [] }, 0, 0), /different/);
});
test("walking one-way restrictions are respected", () => {
  const n = [{}, {}],
    e = [{ a: 0, b: 1, length: 10, shade: 0.5, oneway: true }];
  assert.equal(shortestPath(n, e, 1, 0), null);
  assert.equal(shortestPath(n, e, 0, 1).length, 10);
});
test("tree canopy is sampled; covered paths and nighttime have no direct sun", () => {
  const s = {
    night: false,
    trees: [{ point: [5, 0], radius: 3 }],
    polygons: [],
    woods: [],
  };
  assert.equal(sampleShade([0, 0], [10, 0], s), 1);
  assert.equal(sampleShade([0, 0], [10, 0], { ...s, trees: [] }), 0);
  assert.equal(sampleShade([0, 0], [10, 0], s, true), 1);
  assert.equal(sampleShade([0, 0], [10, 0], { ...s, night: true }), 1);
});
test("building shadows change with departure time", () => {
  const d = demoData();
  const morning = shadowShapes(d, new Date("2026-09-26T09:00:00-04:00")),
    afternoon = shadowShapes(d, date);
  assert.notDeepEqual(morning.polygons, afternoon.polygons);
  assert.ok(!morning.night && !afternoon.night);
  assert.equal(
    shadowShapes(d, new Date("2026-09-26T01:00:00-04:00")).night,
    true,
  );
});
test("public foot access overrides general vehicle restrictions but private foot access does not", () => {
  assert.equal(walkable({ highway: "footway", access: "private" }), false);
  assert.equal(
    walkable({ highway: "service", access: "no", foot: "yes" }),
    true,
  );
  assert.equal(walkable({ highway: "motorway", foot: "yes" }), false);
  assert.equal(walkable({ highway: "path", foot: "private" }), false);
  assert.equal(walkable({ highway: "cycleway" }), false);
});
test("OSM parsing builds shared-node graph and shade geometry", () => {
  const center = { lat: 25, lng: -80 };
  const raw = {
    elements: [
      { type: "node", id: 1, lat: 25, lon: -80 },
      { type: "node", id: 2, lat: 25.001, lon: -80 },
      {
        type: "node",
        id: 3,
        lat: 25.001,
        lon: -80.001,
        tags: { natural: "tree" },
      },
      { type: "way", id: 4, nodes: [1, 2], tags: { highway: "footway" } },
      { type: "way", id: 5, nodes: [2, 3], tags: { highway: "path" } },
      {
        type: "way",
        id: 6,
        nodes: [1, 2, 3, 1],
        tags: { building: "yes", "building:levels": "4" },
      },
    ],
  };
  const d = parseOSM(raw, center);
  assert.equal(d.nodes.length, 3);
  assert.equal(d.edges.length, 2);
  assert.equal(d.buildings[0].height, 12);
  assert.equal(d.trees[0].radius, 4);
  const s = scoreGraph(d, date);
  const route = shortestPath(d.nodes, s.edges, 0, 2);
  assert.ok(route);
  assert.ok(d.nodes.every(n => n.point.every(Number.isFinite)));
  assert.ok(d.buildings.every(b => b.points.every(p => p.every(Number.isFinite))));
  assert.ok(d.trees.every(t => t.point.every(Number.isFinite)));
  assert.ok(d.nodes[2].point[0] < -90);
  assert.ok(s.edges.every(e => Number.isFinite(e.length) && e.length > 0));
  const withGeometry = structuredClone(raw);
  withGeometry.elements.find(e => e.id === 6).geometry = [
    {lat: 25, lon: -80}, {lat: 25.001, lon: -80},
    {lat: 25.001, lon: -80.001}, {lat: 25, lon: -80},
  ];
  assert.deepEqual(parseOSM(withGeometry, center).buildings, d.buildings);
});
test("local projection round trips accurately", () => {
  const o = { lat: 25, lng: -80 },
    p = { lat: 25.005, lng: -79.997 },
    back = unproject(project(p, o), o);
  assert.ok(Math.abs(back.lat - p.lat) < 1e-9);
  assert.ok(Math.abs(back.lng - p.lng) < 1e-9);
});

test("tree shadows move west in the morning and east in the afternoon", () => {
  const d = {
    origin: { lat: 25.756, lng: -80.374 },
    buildings: [],
    trees: [{ point: [0, 0], radius: 4, height: 10 }],
  };
  const morning = shadowShapes(d, new Date("2026-09-26T09:00:00-04:00"));
  const evening = shadowShapes(d, new Date("2026-09-26T17:00:00-04:00"));
  const center = (p) => p.reduce((s, v) => s + v[0], 0) / p.length;
  assert.ok(center(morning.treeShadows[0]) < 0);
  assert.ok(center(evening.treeShadows[0]) > 0);
  assert.notDeepEqual(morning.treeShadows, evening.treeShadows);
  assert.equal(
    shadowShapes(d, new Date("2026-09-26T01:00:00-04:00")).treeShadows.length,
    0,
  );
});
test("routing samples projected tree shadows, not the fixed canopy", () => {
  const d = {
    origin: { lat: 25.756, lng: -80.374 },
    buildings: [],
    trees: [{ point: [0, 0], radius: 4, height: 10 }],
  };
  const s = shadowShapes(d, new Date("2026-09-26T09:00:00-04:00"));
  const p = s.treeShadows[0].reduce(
    (p, v) => [
      p[0] + v[0] / s.treeShadows[0].length,
      p[1] + v[1] / s.treeShadows[0].length,
    ],
    [0, 0],
  );
  assert.equal(sampleShade([p[0] - 0.5, p[1]], [p[0] + 0.5, p[1]], s), 1);
  assert.equal(sampleShade([49, 50], [50, 50], s), 0);
});
test("time of day changes demo exposure and route geometry", () => {
  const d = demoData();
  const a = routes(
    d,
    scoreGraph(d, new Date("2026-09-26T09:00:00-04:00")),
    0,
    48,
    0.5,
  );
  const b = routes(
    d,
    scoreGraph(d, new Date("2026-09-26T17:00:00-04:00")),
    0,
    48,
    0.5,
  );
  assert.notEqual(a.shadiest.exposed, b.shadiest.exposed);
  assert.notDeepEqual(a.shadiest.path, b.shadiest.path);
});

test("pin drops split a path at the nearest point, preserving length and direction", () => {
  const data = {
    nodes: [{ point: [0, 0] }, { point: [100, 0] }],
    edges: [{ a: 0, b: 1, oneway: true, name: "Walk" }],
  };
  const snap = snapToPath(data, [40, 7]);
  assert.equal(snap.distance, 7);
  assert.deepEqual(snap.point, [40, 0]);
  assert.equal(snap.data.edges.length, 2);
  const edges = snap.data.edges.map((e) => ({
    ...e,
    length: Math.abs(
      snap.data.nodes[e.a].point[0] - snap.data.nodes[e.b].point[0],
    ),
    shade: 0,
  }));
  assert.equal(shortestPath(snap.data.nodes, edges, 0, 1).length, 100);
  assert.equal(shortestPath(snap.data.nodes, edges, 1, snap.id), null);
  assert.equal(data.nodes.length, 2);
  assert.equal(snapToPath(data, [40, 100]), null);
  assert.equal(snapToPath(data, [0, 1]).id, 0);
});
test("tree silhouettes are stable and irregular", () => {
  const tree = { point: [3, 7], radius: 8 };
  const p = canopyOutline(tree);
  assert.deepEqual(p, canopyOutline(tree));
  const radii = p.map((v) => Math.hypot(v[0] - 3, v[1] - 7));
  assert.ok(Math.max(...radii) - Math.min(...radii) > 1);
});
test("building wall sweeps preserve an unshaded concave notch", () => {
  const d = {
    origin: { lat: 25.756, lng: -80.374 },
    trees: [],
    buildings: [
      {
        height: 3,
        points: [
          [0, 0],
          [100, 0],
          [100, 20],
          [20, 20],
          [20, 100],
          [0, 100],
        ],
      },
    ],
  };
  const s = shadowShapes(d, new Date("2026-09-26T13:00:00-04:00"));
  assert.ok(!s.polygons.some((p) => inside([70, 70], p)));
  assert.ok(s.polygons.some((p) => inside([10, 10], p)));
});

test("nearby-shape filtering preserves full shade sampling", () => {
  const data = demoData();
  for (const hour of [9, 13, 17]) {
    const scored = scoreGraph(data, new Date('2026-09-26T' + String(hour).padStart(2, '0') + ':00:00-04:00'));
    for (const edge of scored.edges) {
      assert.equal(edge.shade, sampleShade(data.nodes[edge.a].point, data.nodes[edge.b].point, scored.shapes, edge.covered));
    }
  }
});

const footprint = [[4,-1],[6,-1],[6,1],[4,1],[4,-1]];
test("building collisions include thin footprints and interior endpoints but allow wall contact", () => {
  assert.equal(crossesBuilding([0,0],[10,0],footprint),true);
  assert.equal(crossesBuilding([5,0],[10,0],footprint),true);
  assert.equal(crossesBuilding([4.5,0],[5.5,0],footprint),true);
  assert.equal(crossesBuilding([0,-1],[10,-1],footprint),false);
  assert.equal(crossesBuilding([0,0],[4,-1],footprint),false);
  assert.equal(crossesBuilding([0,0],[10,0],[[4.01,-1],[4.02,-1],[4.02,1],[4.01,1]]),true);
  const concave=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]];
  assert.equal(crossesBuilding([2,2],[3,3],concave),false);
  assert.equal(crossesBuilding([-1,2],[3,2],concave),true);
});
test("both route choices and pin snapping avoid buildings, including at night", () => {
  const d={origin:{lat:25.756,lng:-80.374},trees:[],buildings:[{points:footprint,height:9}],
    nodes:[[0,0],[10,0],[0,3],[10,3]].map(point=>({point})),
    edges:[{a:0,b:1},{a:0,b:2},{a:2,b:3},{a:3,b:1}]};
  for(const when of [date,new Date('2026-09-26T01:00:00-04:00')]) {
    const scored=scoreGraph(d,when);assert.equal(scored.edges.length,3);
    const pair=routes(d,scored,0,1);
    assert.deepEqual(pair.shortest.path,[0,2,3,1]);
    assert.deepEqual(pair.shadiest.path,[0,2,3,1]);
  }
  assert.equal(snapToPath(d,[5,0],1),null);
  const passage={...d,edges:[{a:0,b:1,buildingPassage:true,covered:true}]};
  assert.equal(scoreGraph(passage,date).edges.length,0);
  const roofOnly={...d,edges:[{a:0,b:1,covered:true}]};
  assert.equal(scoreGraph(roofOnly,date).edges.length,0);
});


test("building avoidance never invents a detour or reverses a one-way path", () => {
  const d = {
    origin: {lat:25.756, lng:-80.374}, trees: [],
    buildings: [{points:footprint,height:9}],
    nodes: [[0,0],[10,0],[0,3],[10,3]].map(point=>({point})),
    edges: [{a:0,b:1},{a:0,b:2,oneway:true},{a:2,b:3,oneway:true},{a:3,b:1,oneway:true}],
  };
  const scored = scoreGraph(d,date);
  assert.deepEqual(routes(d,scored,0,1,0).shortest.path,[0,2,3,1]);
  assert.throws(()=>routes(d,scored,1,0),/avoid buildings/);
  const isolated = {...d,edges:[d.edges[0]]};
  assert.throws(()=>routes(isolated,scoreGraph(isolated,date),0,1),/avoid buildings/);
  const snapped = snapToPath(d,[5,2]);
  assert.deepEqual(snapped.point,[5,3]);
  for (const edge of scoreGraph(snapped.data,date).edges) {
    assert.equal(crossesBuilding(snapped.data.nodes[edge.a].point,snapped.data.nodes[edge.b].point,footprint),false);
  }
});


test("live relation buildings join reversed outer ways and block passages", () => {
  const center={lat:25,lng:-80};
  const geo=footprint.map(p=>{const q=unproject(p,center);return {lat:q.lat,lon:q.lng}});
  const raw={elements:[
    {type:"node",id:1,...(()=>{const p=unproject([0,0],center);return {lat:p.lat,lon:p.lng}})()},
    {type:"node",id:2,...(()=>{const p=unproject([10,0],center);return {lat:p.lat,lon:p.lng}})()},
    {type:"way",id:3,nodes:[1,2],tags:{highway:"footway",tunnel:"building_passage"}},
    {type:"relation",id:4,tags:{type:"multipolygon",building:"yes"},members:[
      {type:"way",ref:10,role:"outer",geometry:geo.slice(0,3)},
      {type:"way",ref:11,role:"outer",geometry:geo.slice(2).reverse()},
    ]},
  ]};
  const data=parseOSM(raw,center);
  assert.equal(data.buildings.length,1);
  assert.equal(scoreGraph(data,date).edges.length,0);
  assert.equal(snapToPath(data,[5,0]),null);
  raw.elements[3].members.pop();
  assert.throws(()=>parseOSM(raw,center),/Incomplete building/);
});

test("building parts are obstacles and indoor corridors are excluded", () => {
  const center={lat:25,lng:-80};
  const data=parseOSM({elements:[{type:"way",id:1,tags:{"building:part":"yes"},geometry:footprint.map(p=>{const q=unproject(p,center);return {lat:q.lat,lon:q.lng}})}]},center);
  assert.equal(data.buildings.length,1);
  assert.equal(walkable({highway:"corridor"}),false);
  assert.equal(walkable({highway:"footway",indoor:"yes"}),false);
});

import { routesThrough } from "../src/engine.js";
test("three-location routes visit the stop in order and combine distance and exposure", () => {
  const data = {nodes:[{point:[0,0]},{point:[80,0]},{point:[160,0]}]};
  const scored = {edges:[{a:0,b:1,length:80,shade:0.5},{a:1,b:2,length:80,shade:1}]};
  const pair = routesThrough(data,scored,[0,1,2]);
  assert.deepEqual(pair.shortest.path,[0,1,2]);
  assert.equal(pair.shortest.length,160);
  assert.equal(pair.shortest.minutes,2);
  assert.equal(pair.shortest.exposed,40);
  assert.equal(pair.shortest.shade,0.75);
  assert.throws(()=>routesThrough(data,{edges:[scored.edges[0]]},[0,1,2]),/not connected/);
});
