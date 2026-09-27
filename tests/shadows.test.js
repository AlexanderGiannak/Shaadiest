import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeShadows} from '../src/shadow-union.js';
import {shadowPolygons} from '../src/shadow-geometry.js';
import {inside} from '../src/engine.js';
const square=(x=0,y=0)=>[[x,y],[x+2,y],[x+2,y+2],[x,y+2]];
const covers=(polygons,p)=>polygons.some(([outer,...holes])=>inside(p,outer)&&!holes.some(h=>inside(p,h)));

test('large shadow sets use a single multipolygon argument',()=>{
  const shapes=Array.from({length:150000},()=>square());
  let calls=0;
  const result=mergeShadows(shapes,[],(...args)=>{calls++;assert.equal(args.length,1);assert.equal(args[0].length,shapes.length);return [args[0][0]];});
  assert.equal(calls,1);
  assert.equal(result.fallback,false);
});
test('shadow union retains coverage, disjoint trees, and courtyard holes',()=>{
  const shapes=[[[0,0],[6,0],[6,1],[0,1]],[[0,5],[6,5],[6,6],[0,6]],[[0,1],[1,1],[1,5],[0,5]],[[5,1],[6,1],[6,5],[5,5]]];
  const result=mergeShadows(shapes,[square(10,10)]);
  assert.equal(result.fallback,false);
  assert.equal(covers(result.polygons,[3,3]),false);
  for(const p of [[0.5,3],[3,0.5],[11,11]]) assert.equal(covers(result.polygons,p),true);
});
test('render cleanup ignores invalid and collapsed rings without mutating geometry',()=>{
  const source=[...square(),[0,0],[0,0]];const original=structuredClone(source);
  const polygons=shadowPolygons([source,[],[[0,0],[1,0],[2,0]],[[0,0],[NaN,1],[1,0]],[[0,0],[Infinity,1],[1,0]]]);
  assert.equal(polygons.length,1);
  assert.equal(polygons[0][0].length,5);
  assert.deepEqual(source,original);
});
test('topology errors retry once at reduced display precision',()=>{
  let calls=0;
  const result=mergeShadows([square(0.001,0)],[],geometry=>{if(++calls===1)throw Error('Unable to complete output ring');assert.equal(geometry[0][0][0][0],0);return geometry;});
  assert.equal(calls,2);assert.equal(result.fallback,false);
});
test('persistent union errors preserve every shadow with consistent fallback winding',()=>{
  const result=mergeShadows([square(),square(1,0).reverse()],[],()=>{throw Error('Geometry failure');});
  assert.equal(result.fallback,true);assert.equal(result.polygons.length,2);
  for(const [ring] of result.polygons){const area=ring.slice(1).reduce((sum,p,i)=>sum+ring[i][0]*p[1]-p[0]*ring[i][1],0);assert.ok(area>0);}
  assert.equal(covers(result.polygons,[1.5,1]),true);
});
test('nighttime and empty shadows skip the union entirely',()=>{
  assert.deepEqual(mergeShadows([],[],()=>{throw Error('Must not run');}),{polygons:[],fallback:false});
});
