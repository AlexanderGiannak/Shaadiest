import test from "node:test";
import assert from "node:assert/strict";
import {createAreaLoader} from "../lib/area-loader.js";
const data = {elements:[{type:"node", id:1}]};
const ok = () => ({ok:true, json:async()=>data});

test("identical loads share a request while other areas load independently", async () => {
  const releases = [];
  const load = createAreaLoader({hosts:["one"], fetchImpl:()=>new Promise(resolve=>releases.push(()=>resolve(ok())))});
  const first = load(25,-80,2), duplicate = load(25,-80,2), other = load(26,-80,2);
  assert.equal(releases.length,2);
  releases.forEach(release=>release());
  assert.deepEqual(await Promise.all([first, duplicate, other]),[data,data,data]);
  await load(25,-80,2);
  assert.equal(releases.length,2);
});

test("fails over on provider errors and incomplete responses", async () => {
  for (const failure of [()=>{throw Error("network");}, ()=>({ok:false}), ()=>({ok:true,json:async()=>({remark:"timeout",elements:data.elements})})]) {
    const calls = [];
    const load = createAreaLoader({hosts:["one","two"], fetchImpl:async host=>{calls.push(host); return host === "one" ? failure() : ok();}});
    assert.deepEqual(await load(25,-80,2),data);
    assert.deepEqual(calls,["one","two"]);
  }
});

test("failed loads release pending state so retry can succeed", async () => {
  let fail = true;
  const load = createAreaLoader({hosts:["one"], fetchImpl:async()=>fail ? {ok:false} : ok()});
  await assert.rejects(load(25,-80,2),/providers are busy/);
  fail = false;
  assert.deepEqual(await load(25,-80,2),data);
});

test("recent cached data survives provider outages, but expired data does not", async () => {
  let time = 0, fail = false;
  const load = createAreaLoader({now:()=>time, hosts:["one"], fetchImpl:async()=>fail ? {ok:false} : ok()});
  await load(25,-80,2);
  time = 3600001; fail = true;
  assert.equal((await load(25,-80,2)).stale,true);
  await assert.rejects(load(25,-80,1));
  time = 86400001;
  await assert.rejects(load(25,-80,2));
});

test("a timed out provider yields to the next provider", async () => {
  const load = createAreaLoader({timeoutMs:10, hosts:["one","two"], fetchImpl:(host,{signal})=>host === "two" ? Promise.resolve(ok()) : new Promise((resolve,reject)=>signal.addEventListener("abort",()=>reject(signal.reason)))});
  const keepAlive = setInterval(()=>{},100);
  try { assert.deepEqual(await load(25,-80,2),data); }
  finally { clearInterval(keepAlive); }
});
