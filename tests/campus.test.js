import test from "node:test";
import assert from "node:assert/strict";
import {campusPlaces,searchCampus} from "../src/campus.js";
test("campus search excludes outside places and matches names and abbreviations",()=>{
  const places=campusPlaces({elements:[
    {type:"node",lat:25.756,lon:-80.374,tags:{name:"Green Library",ref:"GL"}},
    {type:"node",lat:26,lon:-80.374,tags:{name:"Outside Library"}},
    {type:"node",lat:25.756,lon:-80.374,tags:{name:"Green Library"}},
    {type:"way",tags:{name:"Campus Café"},geometry:[{lat:25.756,lon:-80.374},{lat:25.757,lon:-80.374},{lat:25.756,lon:-80.373}]},
  ]});
  assert.equal(places.length,2);
  assert.equal(searchCampus(places,"gl")[0].name,"Green Library");
  assert.equal(searchCampus(places,"library green")[0].name,"Green Library");
  assert.equal(searchCampus(places,"cafe")[0].name,"Campus Café");
  assert.deepEqual(searchCampus(places,"outside"),[]);
  assert.deepEqual(searchCampus(places,""),[]);
});

import { snapCampusPlace } from "../src/campus.js";
import { snapToPath, unproject } from "../src/engine.js";

test("large search places connect at the perimeter when their center is too far away", () => {
  const origin = {lat:25.756, lng:-80.374};
  const data = {
    origin,
    nodes: [{point:[-20, 0]}, {point:[20, 0]}],
    edges: [{a:0, b:1, name:"Stadium walkway"}],
  };
  const geometry = [[-150,20],[150,20],[150,300],[-150,300],[-150,20]].map(p => {
    const ll = unproject(p, origin);
    return {lat:ll.lat, lon:ll.lng};
  });
  const [place] = campusPlaces({elements:[{type:"way", tags:{name:"Stadium"}, geometry}]});
  assert.equal(snapToPath(data, [0,150]), null);
  const snap = snapCampusPlace(data, place);
  assert.ok(snap);
  assert.ok(snap.distance < 21);
  assert.equal(snap.point[1], 0);
  assert.equal(data.nodes.length, 2);
  assert.equal(snapCampusPlace({...data, nodes:[{point:[0,-500]}, {point:[50,-500]}]}, place), null);
});

test("point search results retain the manual pin distance limit", () => {
  const origin = {lat:25.756, lng:-80.374};
  const data = {origin, nodes:[{point:[0,0]}, {point:[100,0]}], edges:[{a:0,b:1}]};
  assert.ok(snapCampusPlace(data, unproject([40,10], origin)));
  assert.equal(snapCampusPlace(data, unproject([40,100], origin)), null);
});
