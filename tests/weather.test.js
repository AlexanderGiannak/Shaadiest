import test from "node:test";
import assert from "node:assert/strict";
import {arrivalTime,weatherLabel} from "../src/weather.js";
test("arrival rolls over midnight and preserves departure",()=>{
  const departure = new Date("2026-09-27T23:55:00Z");
  assert.equal(arrivalTime(departure,20).toISOString(),"2026-09-28T00:15:00.000Z");
  assert.equal(departure.toISOString(),"2026-09-27T23:55:00.000Z");
});
test("weather codes distinguish clear nights, rain, snow and unknown conditions",()=>{
  assert.equal(weatherLabel(0,false),"Clear night");
  assert.equal(weatherLabel(63),"Rain");
  assert.equal(weatherLabel(85),"Snow");
  assert.equal(weatherLabel(96),"Thunderstorm");
  assert.equal(weatherLabel(-1),"Conditions");
});

import {forecastAt} from "../src/weather.js";
test("selected departure uses its hourly forecast and rejects dates outside coverage",()=>{
  const hourly = {time:[0,3600],temperature_2m:[20,25],relative_humidity_2m:[70,50],apparent_temperature:[21,27],weather_code:[0,3],is_day:[0,1]};
  assert.equal(forecastAt(hourly,new Date(1800000)).temperature_2m,20);
  assert.equal(forecastAt(hourly,new Date(3600000)).relative_humidity_2m,50);
  assert.equal(forecastAt(hourly,new Date(7200000)),null);
  assert.equal(forecastAt(hourly,new Date(-1)),null);
  assert.equal(forecastAt({...hourly,temperature_2m:[null,25]},new Date(0)),null);
});
