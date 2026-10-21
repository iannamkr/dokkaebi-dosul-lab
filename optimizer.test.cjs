const assert=require('node:assert/strict');
const O=require('./dist/optimizer.js'),D=require('./dist/data.json'),N=require('./dist/numbers.js');
const skill=id=>D.skills.find(s=>s.id===id);

// Amount text forms used by the data.
assert.deepEqual(O.parseAmount('시전자의 공격력의 3.7% + 2,190만큼 보호막을 부여합니다.'),{atkPct:3.7,hpPct:0,flat:2190,times:1});
assert.deepEqual(O.parseAmount('낙인 대상 적중 시 자신의 최대 체력 0.7% 회복'),{atkPct:0,hpPct:0.7,flat:0,times:1});
assert.deepEqual(O.parseAmount('최대 체력의 0.5% + 3,100 보호막 적용'),{atkPct:0,hpPct:0.5,flat:3100,times:1});
assert.deepEqual(O.parseAmount('수호 보유 중 먹 베기 적중 시 자신의 체력 500 회복'),{atkPct:0,hpPct:0,flat:500,times:1});
assert.deepEqual(O.parseAmount('공격력의 0.3% + 400만큼 최대 5회 회복합니다.'),{atkPct:0.3,hpPct:0,flat:400,times:5});
assert.equal(O.parseAmount('받는 피해를 5% 감소시킵니다.'),null);

// Every numeric self heal/shield in the data is parsed; removal and enemy healing reduction are not sustain.
let parsed=0;
for(const s of D.skills)for(const b of N.effectRows(s)?.buffs||[]){
 const text=`${b.name} ${b.description}`;if(!/회복|보호막/.test(text)||/제거|받는 (?:체력 )?(?:치유|회복)/.test(text))continue;
 assert(O.sources(s).sources.some(x=>x.text===b.description),`${s.name}: ${text} must be quantified`);parsed++;
}
assert(parsed>=13,'Sustain sources were found');
assert.equal(O.sources(skill('s007')).sources[0].condition.effect,'낙인','Conditional heals keep their trigger');
assert.equal(O.sources(skill('s069')).sources[0].condition,null,'Unconditional shields count per completed cast');
assert.equal(O.sources(skill('s087'),null).sources[0].reducePct,9.7,'Damage reduction is parsed as its own source');

// Reproduces the 2026-10-18 hunting measurement: Life Flow ticked 542 in the recording.
const stats={attack:20497,maxHp:100029,regen:2744,regenPeriod:5},overrides={'s085:0':542};
const ids=['s071','s069','s003','s008','s075','s007','s012','s085','s010'],base=['s003','s007','s008','s071','s069'];
const measured=O.evaluate(D,ids,base,{stats,overrides,singleOnly:true,profile:'185547',horizon:180});
assert(measured.valid);
// Use the quantified shield effect itself. The live source's generic effect progression can
// describe a different upgrade mechanic and must not be mistaken for this HP coefficient.
const raw=require('./dist/kkaebigg/skills.json'),swingPct=O.sources(skill('s012')).sources[0].hpPct;
const round2=n=>Math.round(n*100)/100;
const expectedFull=round2(round2((stats.attack*.012+1460)*23/3)+round2(1460*16/3)+round2(stats.maxHp*.007*48/3)+round2(stats.maxHp*swingPct/100*69/3)+542*5*18/3);
assert.equal(measured.perMin,expectedFull);
assert.equal(measured.rows.find(r=>r.skillId==='s007').triggers,48);assert.equal(measured.rows.find(r=>r.skillId==='s085').each,2710);
assert.equal(O.regenPerMin(stats),32928);
const fullCalibration=round2(expectedFull+stats.regen*60/stats.regenPeriod-(89632-66606)*60/265);
assert.equal(O.calibrate({sustainPerMin:measured.perMin,stats,hpStart:66606,hpEnd:89632,seconds:265}),fullCalibration);
assert.equal(O.calibrate({sustainPerMin:1,stats,hpStart:1,hpEnd:2,seconds:0}),null);
const noStats=O.evaluate(D,ids,base,{stats:{},overrides:{},singleOnly:true});
assert.equal(noStats.rows.find(r=>r.skillId==='s075').each,1460,'Flat amounts need no stats');

// Single-target mode rejects builds whose attacks hit several monsters.
const area=O.evaluate(D,ids.map(id=>id==='s085'?'s067':id),base,{stats,singleOnly:true});
assert.equal(area.valid,false);assert.match(area.issue,/여러 대상/);
const pool=O.pool(D,ids,{families:['강인','절명','기동','연타','헌신'],singleOnly:true});
assert(!pool.includes('s067')&&!pool.includes('s070'),'Area attacks are excluded');assert(pool.includes('s085'),'Non-attacking heals stay available');
assert(pool.every(id=>!skill(id).ultimate));
assert(!O.pool(D,ids,{families:['절명'],singleOnly:true}).includes('s011'),'Locked families stay out');

// Search keeps the ultimate and slot count, respects the need, and is deterministic.
const need=52805,opts={stats,overrides,families:['강인','절명','기동','연타','헌신'],singleOnly:true,need,iterations:240,seed:3};
const runSearch=()=>{const s=O.createSearch(D,{ids,baseSlots:base},opts);let p;do p=s.step(1e6);while(!p.finished);return {s,r:s.results(3)};};
const a=runSearch(),b=runSearch();
assert.deepEqual(a.r.best.map(x=>x.ids),b.r.best.map(x=>x.ids),'Same seed gives the same result');
assert(a.r.best.length>0);
for(const c of [...a.r.best,a.r.safest].filter(Boolean)){
 assert.equal(c.ids.length,ids.length);assert(c.ids.includes('s010'));assert.equal(new Set(c.ids).size,c.ids.length);
 assert(c.ids.every(id=>id==='s010'||opts.families.includes(skill(id).family)));
 assert(c.verification.margin>=0&&c.verification.minPerMin>=need,'Every preset and horizon meets the need');
 assert.equal(c.verification.runs.length,12);
 const again=O.evaluate(D,c.ids,c.baseSlots,{stats,overrides,singleOnly:true,profile:'190057',horizon:60});assert(again.valid,'Result passes single-target and equipment checks');
}
assert(a.r.best[0].verification.minCoefficient>=measured.coefficient,'The best result is not worse than the starting build');
const keys=a.r.best.map(c=>[...c.ids].sort().join()+c.coefficient+c.perMin);assert.equal(new Set(keys).size,keys.length,'Identical outcomes are listed once');
const impossible=O.createSearch(D,{ids,baseSlots:base},{...opts,need:1e9,iterations:40});while(!impossible.step(1e6).finished);
assert.equal(impossible.results(3).best.length,0,'Unreachable needs return no fake winner');
const dualPrimary=O.conditionSeed(D,{primaryFamilies:['강타','연타']},Object.keys(D.families));
const dualUltimate=D.skills.find(s=>s.id===dualPrimary.ids.find(id=>D.skills.find(x=>x.id===id)?.ultimate));
assert(['강타','연타'].includes(dualUltimate.family),'Two primary families constrain the chosen ultimate to either candidate');
assert.throws(()=>O.conditionSeed(D,{primaryFamilies:['강타','연타','절명']},Object.keys(D.families)),/최대 2개/);
console.log('Optimizer: sustain parsing, measured calibration, single-target pool, constrained deterministic search passed.');

// Buff dictionary snapshot: durations, overwrite rules and the shield/reduction timeline.
const K=require('./dist/kkaebigg.js');
const snapshot={meta:require('./dist/kkaebigg/meta.json'),skills:require('./dist/kkaebigg/skills.json'),buffs:require('./dist/kkaebigg/buffs.json')};
const linked=id=>O.sources(skill(id),snapshot).sources[0];
assert.equal(linked('s069').life,5,'Shield Push shield lasts 5 s');assert.equal(linked('s069').dup,'Replace');
assert.equal(linked('s075').life,10);assert.equal(linked('s012').life,10);assert.equal(linked('s070').life,5,'2.45% in data matches the rounded 2.4% tooltip');
assert.equal(linked('s068').life,null,'Several 5% reductions with different durations stay unresolved');
// Timeline: a 1,000 shield every 10 s that lasts 5 s against 100 damage/s absorbs 500 per cast; a Replace mid-way discards the rest.
const tl=O.timeline(20,100,[{t:0,key:'a',amount:1000,life:5,dup:'Replace'},{t:10,key:'a',amount:1000,life:5,dup:'Replace'}],[]);
assert(Math.abs(tl.absorbed.a-1000)<10,'Expired shields stop absorbing');
const replaced=O.timeline(10,100,[{t:0,key:'a',amount:1000,life:10,dup:'Replace'},{t:1,key:'a',amount:1000,life:10,dup:'Replace'}],[]);
assert(Math.abs(replaced.absorbed.a-1000)<10,'Replace restarts the shield; the unspent 900 is lost');
const stacked=O.timeline(10,100,[{t:0,key:'a',amount:1000,life:10,dup:'Stack'},{t:1,key:'a',amount:1000,life:10,dup:'Stack'}],[]);
assert(Math.abs(stacked.absorbed.a-1000)<10&&stacked.absorbed.a>=990,'Stacked shields still cannot absorb more than the incoming damage');
const cut=O.timeline(10,100,[],[{t:0,key:'r',pct:0.1,life:5}]);assert(Math.abs(cut.prevented.r-50)<1,'A 10% reduction for 5 s prevents 50 of 100/s');
// Real build: the three-hit Swing shield overwrites itself, so far less than the full value is absorbed.
const fullRun=O.evaluate(D,ids,base,{stats,overrides,singleOnly:true,profile:'185547',horizon:180,snapshot,keepRun:true});
const incoming=O.calibrate({sustainAt:fullRun.sustainAt,stats,hpStart:66606,hpEnd:89632,seconds:265});
assert(incoming>70000&&incoming<fullCalibration,'Calibration converges below the full-shield estimate');
const modeled=O.evaluate(D,ids,base,{stats,overrides,singleOnly:true,profile:'185547',horizon:180,snapshot,incoming});
const swing=modeled.rows.find(r=>r.skillId==='s012');assert(swing.perMin<swing.full*0.6,'Replace wastes most of the per-hit Swing shield');
assert.equal(modeled.rows.find(r=>r.skillId==='s007').perMin,modeled.rows.find(r=>r.skillId==='s007').full,'Heals are not reduced');
assert(Math.abs(modeled.perMin+O.regenPerMin(stats)-incoming-(89632-66606)*60/265)<5,'Fixed point reproduces the measured net HP change');
// Snapshot overlay reaches a fixed point; a patched cooldown reaches the timing engine.
const copy=structuredClone(D),firstSync=K.apply(copy,snapshot),same=K.apply(copy,snapshot);
assert(firstSync.changes.length>0,'newer snapshot updates the bundled baseline');
assert.equal(same.changes.length,0,'applying the same snapshot twice is idempotent');
const patched=structuredClone(snapshot);patched.skills.skills.find(s=>s.n==='방패 밀기').num.cd=6;
const copy2=structuredClone(D),rep=K.apply(copy2,patched);
assert.equal(copy2.skills.find(s=>s.id==='s069').basic.cooldown,6);assert(rep.changes.some(c=>c.field==='basic.cooldown'&&c.name==='방패 밀기'));
// Hunting zones: spawn-weighted averages and the attack ratio between zones.
{const vm=require('node:vm'),ctx={window:{}};vm.runInNewContext(require('node:fs').readFileSync('dist/kkaebi-gg/hunting.js','utf8'),ctx);const Z=ctx.window.DOSUL_HUNTING.zones,z=n=>Z.find(x=>x.name===n);
 assert.equal(Z.length,21);const toxic=O.zoneSummary(z('독기 지대'));assert.equal(toxic.attack,8320.84);assert.equal(toxic.maxAttack,8555);assert.equal(toxic.spawns,188);
 assert.equal(O.zoneSummary(z('마을 폐허')).attack,13763);assert.equal(O.zoneScale(z('독기 지대'),z('마을 폐허')).toFixed(3),'1.654');assert.equal(O.zoneScale(null,z('마을 폐허')),1);
 const B=require('./scripts/build-hunting.cjs'),lf=s=>s.replace(/\r\n/g,'\n');assert.equal(lf(B.script(require('./dist/kkaebi-gg/hunting.json'))),lf(require('node:fs').readFileSync('dist/kkaebi-gg/hunting.js','utf8')),'hunting.js is generated from hunting.json');}
console.log('Kkaebigg buffs: durations, Replace/Stack timeline, reduction uptime, measured fixed point and snapshot overlay passed.');
