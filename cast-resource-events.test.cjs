const assert=require('node:assert/strict'),D=require('./dist/data.json'),C=require('./dist/combat.js');
function fixture(family){const d=structuredClone(D),skills=d.skills.filter(s=>s.family===family&&!s.ultimate).slice(0,3);for(const s of skills){s.basic.cooldown=0;s.referenceNumbers.m=1000;s.referenceNumbers.pm=0;s.referenceNumbers.cm=0;s.usage={charges:1};}d.baseSlots=skills.map(s=>s.id);return {d,ids:d.baseSlots};}
for(const [family,needed] of [['기동',14],['파멸',8]]){const {d,ids}=fixture(family),r=C.run(d,ids,40),p=r.procs.find(p=>p.name.endsWith('발동'));assert.equal(p.time,r.events[needed-1].start);assert.notEqual(p.time,r.events[needed-1].end);const gain=r.procs.filter(p=>p.name==='영력 획득');assert(gain.every(p=>r.events.some(e=>e.start===p.time)));assert.equal(r.windows[0].start,p.time);assert.equal(r.windows[0].end-p.time,family==='기동'?10:20);}
// A cast crossing the horizon still grants cast-triggered energy, without a fictitious completion.
{const {d,ids}=fixture('기동');d.skills.find(s=>s.id===ids[0]).referenceNumbers.m=30000;const r=C.run(d,ids,20);assert.equal(r.events[0].completed,false);assert.equal(r.procs.find(p=>p.name==='영력 획득').time,0);}
// A cast begun during overflow does not retroactively earn energy when its animation ends after expiry.
{const {d,ids}=fixture('파멸');d.skills.find(s=>s.id===ids[0]).referenceNumbers.m=3000;const r=C.run(d,ids,80);const w=r.windows[0],cross=r.events.find(e=>e.start<w.end&&e.end>w.end&&e.start>=w.start);assert(cross);assert(!r.procs.some(p=>p.name==='영력 획득'&&p.time===cross.start));}
console.log('Cast-resource events: start-time trigger, expiry crossing, exact source durations, partial cast.');

