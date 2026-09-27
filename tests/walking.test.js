import test from "node:test";
import assert from "node:assert/strict";
import { walkingProgress } from "../src/walking.js";
const nodes = [[0,0],[100,0],[100,100]].map(point=>({point}));
const route = {length:200,segments:[{from:0,to:1,name:"First"},{from:1,to:2,name:"Second"}]};
test("walking progress follows the route bends rather than straight-line distance",()=>{
  assert.deepEqual(walkingProgress(nodes,route,[40,3]),{offset:3,remaining:160,name:"First",bearing:90});
  assert.deepEqual(walkingProgress(nodes,route,[100,60]),{offset:0,remaining:40,name:"Second",bearing:0});
  assert.equal(walkingProgress(nodes,route,[100,100]).remaining,0);
  assert.equal(walkingProgress(nodes,route,[-20,0]).remaining,200);
  assert.equal(walkingProgress(nodes,route,[150,60]).offset,50);
});
test("walking progress respects reversed routes and empty routes",()=>{
  assert.equal(walkingProgress(nodes,{length:100,segments:[{from:1,to:0}]},[40,0]).remaining,40);
  assert.equal(walkingProgress(nodes,{length:0,segments:[]},[0,0]),null);
});


import {travelHeading,directionGuidance} from "../src/walking.js";
test("GPS direction is withheld for stationary, inaccurate, missing and stale fixes",()=>{
  const fix = {timestamp:1000,coords:{heading:90,speed:1,accuracy:5}};
  assert.equal(travelHeading(fix,2000),90);
  for (const changes of [{heading:null},{speed:0},{accuracy:60}])
    assert.equal(travelHeading({...fix,coords:{...fix.coords,...changes}},2000),null);
  assert.equal(travelHeading(fix,22000),null);
});
test("route direction handles reversed travel and north wraparound",()=>{
  assert.equal(directionGuidance(355,5),"Heading the right way");
  assert.equal(directionGuidance(270,90),"Heading away — turn around");
  assert.equal(directionGuidance(null,90),"Walk a little to detect your direction");
  assert.equal(walkingProgress(nodes,{length:100,segments:[{from:1,to:0}]},[40,0]).bearing,270);
});
