const assert=require('node:assert/strict'),D=require('./dist/data.json'),E=require('./dist/encounter.js'),Q=require('./dist/sequence.js');
const id=n=>D.skills.find(s=>s.name===n).id;
const ids=['암습','사격','쇠뇌 사격','이중 사격','주먹 지르기','내려찍기','삼단 찌르기','찌르기'].map(id),baseSlots=Q.fit(D,ids),data={...D,baseSlots};
const common={approach:false,attack:1,hp:1e9,movement:false,scenario:{playerSpeed:0,monsterSpeed:0}};
const miss=E.run(data,ids,'185547',180,{...common,points:[{x:1000,y:0}]}),planned=E.run(data,ids,'185547',180,{...common,points:[{x:1000,y:0}],coupled:false});
assert.equal(miss.impacts.filter(x=>x.targets.length).length,0);assert(!miss.schedule.procs.some(p=>p.family==='절명'));assert(planned.schedule.procs.some(p=>p.name==='형상 최대치 추가 획득'));
assert(miss.schedule.events.filter(e=>e.id===ids[0]).length<planned.schedule.events.filter(e=>e.id===ids[0]).length,'Missed attacks no longer accelerate ultimate');
const hit=E.run(data,ids,'185547',180,{...common,points:[{x:1,y:0}]});
assert(hit.schedule.procs.some(p=>p.name==='형상 획득'));assert(hit.schedule.procs.filter(p=>p.name==='형상 획득').every(p=>hit.impacts.some(i=>i.targets.length&&Math.abs(i.time-p.time)<.001)));
assert.deepEqual(hit.schedule,E.run(data,ids,'185547',180,{...common,points:[{x:1,y:0}]}).schedule);
// Delayed ground attack remains alive across casts; gain belongs to its actual tick, once per cast.
const delayed=structuredClone(data),s=delayed.skills.find(s=>s.id===id('찌르기'));s.basic.cooldown=30;s.usage={charges:1};s.aim={...s.aim,mode:'지면 지정'};s.hitTiming={kind:'persistent',offsets:[5,6,7]};s.referenceNumbers.dc=[{basic_coefficient:100,hits:3}];
const only=[s.id,id('삼단 찌르기'),id('내려찍기'),id('암습')];delayed.baseSlots=only.slice(0,3);delayed.executionPolicy={disabled:only.slice(1)};
const late=E.run(delayed,only,'185547',20,{...common,points:[{x:1,y:0}]});const first=late.schedule.events[0],gains=late.schedule.procs.filter(p=>p.name==='형상 획득');assert.equal(gains[0].time,first.start+5);assert.equal(gains.filter(p=>p.time>=5&&p.time<=7).length,1);
// A dead target cannot grant repeated hit feedback from the remainder of a cast.
const killed=E.run(data,ids,'185547',20,{...common,attack:1e9,hp:1,points:[{x:1,y:0}],scenario:{respawn:1000,playerSpeed:0,monsterSpeed:0}});assert.equal(killed.encounter.kills,1);assert(killed.schedule.procs.filter(p=>p.name==='형상 획득').length<=1);
// Cast-triggered energy still works on misses; do not impose an invented hit requirement.
const dash=['연속 쇄도','쌍검 가르기','도약 찌르기','휩쓸어 베기','사격','쇠뇌 사격','이중 사격'].map(id),gd={...D,baseSlots:Q.fit(D,dash)};
const g=E.run(gd,dash,'185547',180,{...common,points:[{x:1000,y:0}]});assert(g.schedule.procs.some(p=>p.name==='연쇄 발동'));
console.log('Coupled events: misses, confirmed first-hit timing, delayed ticks, death, deterministic cooldown feedback and cast-trigger independence passed.');

const approach=E.run(data,ids,'185547',20,{attack:1,hp:1e9,points:[{x:20,y:0}],scenario:{monsterSpeed:0,homeRadius:100}});
assert(approach.encounter.walkMetres>0);assert(approach.schedule.events[0].start>0,'Out-of-range initial attack waits for approach');
const absent=E.run(data,ids,'185547',20,{...common,approach:true,points:[{x:1000,y:0}]});assert.equal(absent.schedule.casts,0);assert.equal(absent.schedule.wait,20);
