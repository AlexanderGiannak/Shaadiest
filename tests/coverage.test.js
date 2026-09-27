import test from 'node:test';
import assert from 'node:assert/strict';
import {coversPosition, areaForPositions} from '../src/coverage.js';
import {parseOSM, snapToPath, unproject} from '../src/engine.js';

const center = {lat:25.756,lng:-80.374};
test('pin coverage requires loaded data and the full snapping neighborhood',()=>{
  assert.equal(coversPosition(undefined,center),false);
  const coverage={center,radius:1};
  assert.equal(coversPosition(coverage,center),true);
  assert.equal(coversPosition(coverage,unproject([1550,0],center)),false);
  assert.equal(coversPosition(coverage,unproject([1500,0],center)),true);
  assert.equal(coversPosition(coverage,unproject([0,1700],center)),false);
});
test('automatic area loading includes existing pins and obeys the five-mile limit',()=>{
  const positions=[unproject([-2000,-1500],center),unproject([2000,1500],center)];
  const area=areaForPositions(positions);
  assert.equal(area.radius,2);
  positions.forEach(p=>assert.equal(coversPosition(area,p),true));
  assert.equal(areaForPositions([center],3).radius,3);
  assert.equal(areaForPositions([unproject([-9000,0],center),unproject([9000,0],center)]),null);
});
test('live paths snap within 80 meters of the segment, even far from its nodes',()=>{
  const coordinates=([-500,500]).map(x=>{const p=unproject([x,0],center);return {lat:p.lat,lon:p.lng};});
  const data=parseOSM({elements:[
    ...coordinates.map((p,i)=>({type:'node',id:i+1,...p})),
    {type:'way',id:3,nodes:[1,2],tags:{highway:'footway',name:'Outdoor path'}},
  ]},center);
  assert.ok(snapToPath(data,[0,79.9]));
  assert.equal(snapToPath(data,[0,80.1]),null);
  const first=snapToPath(data,[-100,5]);
  const second=snapToPath(first.data,[100,5]);
  assert.ok(second);
  assert.notEqual(first.id,second.id);
});
