import test from 'node:test';
import assert from 'node:assert/strict';
import {validLocationFix} from '../src/location.js';
import {areaForPositions} from '../src/coverage.js';
test('location fixes must be finite and renderable',()=>{
 const fix={timestamp:Date.now(),coords:{latitude:25.76,longitude:-80.37,accuracy:12}};
 assert.equal(validLocationFix(fix),true);
 for(const patch of [{latitude:NaN},{longitude:Infinity},{latitude:90},{accuracy:-1},{accuracy:Infinity}])
   assert.equal(validLocationFix({...fix,coords:{...fix.coords,...patch}}),false);
 assert.equal(validLocationFix(null),false);
});
test('automatic GPS area stays small but includes retained destinations',()=>{
 const start={lat:25.76,lng:-80.37};
 assert.equal(areaForPositions([start],1).radius,1);
 const area=areaForPositions([start,{lat:25.80,lng:-80.37}],1);
 assert.equal(area.radius,2);
});
