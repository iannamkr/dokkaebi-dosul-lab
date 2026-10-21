'use strict';
const assert=require('node:assert/strict'),audit=require('./scripts/audit-numeric-execution.cjs'),S=require('./dist/simulation.js'),raw=require('./dist/kkaebigg/skills.json');
const before=audit.run();assert.equal(before.summary.skills,105);assert.equal(before.summary.skipped,0);
const expectedLevels=raw.skills.filter(s=>!s.num.nd).reduce((n,s)=>n+(s.num.lv?.length||0),0);
const expectedEffectLevels=raw.skills.reduce((n,s)=>n+(s.ef||[]).reduce((m,e)=>m+(e.fl?.length||0),0),0);
assert.equal(before.cases.filter(c=>c.category==='level').length,expectedLevels);
assert.equal(before.cases.filter(c=>c.category==='effect-level').length,expectedEffectLevels);
assert.equal(before.summary.total,before.summary.passed+before.summary.failed);
const original=S.coefficient;try{S.coefficient=()=>0;const broken=audit.run();assert(broken.byCategory['hit-coefficient'].failed>before.byCategory['hit-coefficient'].failed,'Must detect a deliberately broken real damage consumer');}finally{S.coefficient=original;}
try{raw.skills[0].num.futureUnknownNumeric=10;const extended=audit.run();assert(extended.cases.some(c=>c.id.endsWith('num.futureUnknownNumeric')&&c.status==='fail'),'New source fields cannot disappear silently');}finally{delete raw.skills[0].num.futureUnknownNumeric;}
console.log('Numeric audit harness: all skills/levels enumerated, injected consumer bug detected, unknown numeric field fails closed.');
