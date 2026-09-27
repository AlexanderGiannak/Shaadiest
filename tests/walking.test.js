import test from "node:test";
import assert from "node:assert/strict";
import { walkingProgress } from "../src/walking.js";
const nodes = [[0,0],[100,0],[100,100]].map(point=>({point}));
const route = {length:200,segments:[{from:0,to:1,name:"First"},{from:1,to:2,name:"Second"}]};
test("walking progress follows the route bends rather than straight-line distance",()=>{
  assert.deepEqual(walkingProgress(nodes,route,[40,3]),{offset:3,remaining:160,name:"First"});
  assert.deepEqual(walkingProgress(nodes,route,[100,60]),{offset:0,remaining:40,name:"Second"});
  assert.equal(walkingProgress(nodes,route,[100,100]).remaining,0);
  assert.equal(walkingProgress(nodes,route,[-20,0]).remaining,200);
  assert.equal(walkingProgress(nodes,route,[150,60]).offset,50);
});
test("walking progress respects reversed routes and empty routes",()=>{
  assert.equal(walkingProgress(nodes,{length:100,segments:[{from:1,to:0}]},[40,0]).remaining,40);
  assert.equal(walkingProgress(nodes,{length:0,segments:[]},[0,0]),null);
});
