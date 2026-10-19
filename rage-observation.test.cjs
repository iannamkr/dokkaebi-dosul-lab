const assert=require('node:assert/strict'),H=require('./dist/hit-timing');
const r=H.rage([{time:4},{time:1}],10);
assert.deepEqual(r.resetTimes,[4,7]);assert.equal(r.meanStacks,.6);assert.equal(r.meanReductionPct,.24);assert.equal(r.maxStackSeconds,0);
const capped=H.rage(Array.from({length:50},()=>({time:0})),10);
assert.equal(capped.maxStackSeconds,3);assert.equal(capped.maxStackPercent,30);assert.equal(capped.meanReductionPct,6);
assert.deepEqual(capped.resetTimes,[3]);assert.equal(H.rage([],10).meanReductionPct,0);
assert.throws(()=>H.rage([],0));
console.log('Rage: expiry timestamps, unordered input, time-weighted reduction, maximum-stack duration and empty intervals passed.');
