import test from "node:test";
import assert from "node:assert/strict";
import {miles,fahrenheit,formatDistance} from "../src/units.js";
test("US display units convert metric routing and weather data",()=>{
  assert.equal(miles(1609.344),1);
  assert.equal(fahrenheit(0),32);
  assert.equal(fahrenheit(20),68);
  assert.equal(formatDistance(30.48),"100 ft");
  assert.equal(formatDistance(1609.344),"1.00 mi");
  assert.equal(formatDistance(0),"0 ft");
});
