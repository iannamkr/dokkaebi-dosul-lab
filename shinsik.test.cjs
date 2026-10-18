const assert=require('node:assert/strict');
const D=require('./dist/data.json'),F=require('./dist/shinsik.js'),O=require('./dist/optimizer.js'),S=require('./dist/simulation.js'),Q=require('./dist/sequence.js');
const ctx=(family,windows=[])=>({active:[family],windows,procs:[],horizon:180});
const ev={start:10,end:11,resources:{forms:5,arrows:3,smash:100,locks:3}};
// Independent arithmetic and boundary expectations, not snapshots of implementation.
assert.equal(F.bonus(ctx('기동',[{name:'연쇄',start:10,end:20}]),{family:'기동',ultimate:true},ev,11),.5);
assert.equal(F.bonus(ctx('기동',[{name:'연쇄',start:10,end:20}]),{family:'기동',ultimate:true},ev,20),0);
assert.equal(F.bonus(ctx('기동',[{name:'연쇄',start:11,end:21}]),{family:'기동',ultimate:true},ev,11),0,'Own final hit cannot use a new proc');
assert.equal(F.bonus(ctx('기동',[{name:'연쇄',start:0,end:20}]),{family:'강타',ultimate:true},ev,11),0);
assert.equal(F.bonus(ctx('절명'),{ultimate:true},ev,11),1.25);
assert.equal(F.bonus(ctx('절명'),{ultimate:false},ev,11),0);
assert(Math.abs(F.bonus(ctx('저격'),{family:'저격'},ev,11)-.45)<1e-10);
assert(Math.abs(F.bonus(ctx('저격'),{family:'강타'},ev,11)-.045)<1e-10);
const rage={...ctx('연타'),rage:{points:[{time:1,stacks:1},{time:2,stacks:50}]}};
assert.equal(F.bonus(rage,{},ev,1),0);assert.equal(F.bonus(rage,{},ev,2),.004);
assert.equal(F.bonus(rage,{},ev,4.99),.2);assert.equal(F.bonus(rage,{},ev,5),0);
const defense=F.defense(ctx('강인',[{name:'강건',start:10,end:20}]),D,{maxHp:100000});
assert.equal(defense.shields[0].amount,4320);assert.equal(defense.reductions[0].pct,.25);
const t=O.timeline(30,1000,defense.shields,defense.reductions);
assert(Math.abs(Object.values(t.prevented)[0]-2500)<1);assert(Math.abs(Object.values(t.absorbed)[0]-4320)<1);
const names=['연속 쇄도','쌍검 가르기','영혼 소용돌이','방패 치기','휩쓸어 베기','도약 찌르기','반동 사격','대검 찍기','부적 던지기'];
const ids=names.map(n=>D.skills.find(s=>s.name===n).id),base=Q.fit(D,ids),input={stats:{attack:20000,maxHp:100000},incoming:60000,horizon:180};
const on=O.evaluate(D,ids,base,input),off=O.evaluate({...D,shinsikEffects:false},ids,base,input);
assert(on.valid&&off.valid);assert(on.power>off.power,'Gidong burst gains must change ranking');assert(on.shinsik.extraCoefficient>0);
assert.equal(on.casts,off.casts,'Ablation isolates strength from resets');assert.equal(off.shinsik.extraCoefficient,0);
assert(on.shinsik.rules.find(r=>r.family==='기동').limitations.some(x=>x.includes('가속')));
for(const family of ['연타','강인','파멸']){
 const skills=D.skills.filter(s=>s.family===family),ids=[skills.find(s=>s.ultimate).id,...skills.filter(s=>!s.ultimate).slice(0,5).map(s=>s.id)],base=ids.slice(1);
 const a=O.evaluate(D,ids,base,input),b=O.evaluate({...D,shinsikEffects:false},ids,base,input);
 assert(a.valid);assert(a.perMin>b.perMin,family+' defensive shinsik must affect sustain');
 assert(a.rows.some(x=>x.shinsik&&x.perMin>0));
}
// The allowed ultimate pool includes all twelve families.
const search=O.createSearch(D,{ids,baseSlots:base},{...input,families:Object.keys(D.families),iterations:1,polish:0});
assert.equal(search.ultimates.length,12);
console.log('Shinsik: PvE gains, expiry, no retroactive buffs, shield absorption, family gating and optimizer ablation passed.');

const windows=F.timeline({active:['기동'],horizon:20,procs:[{family:'기동',time:2}],windows:[{family:'기동',start:2,end:12},{family:'기동',start:8,end:25}]});
assert.equal(windows[0].seconds,18);assert.equal(windows[0].uptimePct,90);assert.equal(windows[0].first,2);
assert.equal(F.timeline({active:['기동'],horizon:20,windows:[],procs:[]})[0].first,null);
