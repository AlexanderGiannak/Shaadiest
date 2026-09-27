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
