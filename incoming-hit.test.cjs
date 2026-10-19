const assert=require('node:assert/strict'),O=require('./dist/optimizer.js');
assert.equal(O.incomingFromHit(3378,1.5),135120);assert.equal(O.incomingFromHit(3538,1.5),141520);assert.equal(O.incomingFromHit(3378,2),101340);
for(const [d,t] of [[-1,1.5],[3378,0],[3378,-2],['',1.5],[1,Infinity],[NaN,1]])assert.equal(O.incomingFromHit(d,t),null);
console.log('Per-hit incoming: video interval conversion and invalid values passed.');
