const assert=require('node:assert/strict'),fs=require('node:fs');
const D=require('./dist/data.json'),Sim=require('./dist/simulation.js'),{apply,shape}=require('./scripts/apply-kkaebi-gg.cjs');
const aims=JSON.parse(fs.readFileSync('dist/kkaebi-gg/skills-aim.json','utf8'));
const by=name=>D.skills.find(s=>s.name===name);

// Snapshot: every skill, with range and aiming mode, and the data files agree with it.
assert.equal(aims.skills.length,105);assert(aims.skills.every(a=>a.range>0&&a.mode&&a.scope));
for(const a of aims.skills){const s=by(a.name);assert(s,a.name);assert.equal(s.aim.mode,a.mode);assert.equal(s.aim.range,a.range);assert.equal(s.basic.range,a.range,a.name+' range');assert.equal(s.usage?.charges||1,a.charges,a.name+' charges');}
// Applying again changes nothing (idempotent).
const descriptions=Object.fromEntries(require('./dist/kkaebigg/skills.json').skills.map(x=>[x.n,x.d||'']));
const copy=structuredClone(D),again=apply(copy,aims,descriptions);assert.equal(again.cooldowns.length,0);assert.deepEqual(copy,D);
// Ultimate cooldowns follow the two game-data sites rather than the 2026-10-10 notice.
for(const [name,cd] of [['신내림',76.4],['대폭발',138],['방패 낙하',50],['회전하는 칼날',61],['개전의 가호',85]]){assert.equal(by(name).basic.cooldown,cd);assert.match(by(name).basic.fieldNotes.cooldown,/kkaebi\.gg/);}

// Shape rules.
const fake=(targeting,damage=true)=>({targeting:{kind:targeting},damage});
assert.equal(shape(fake('single'),{mode:'대상 지정',scope:'적',range:1.6},'').kind,'single');
assert.deepEqual([shape(fake('area'),{mode:'자신 중심',scope:'적',range:2.4},'').kind,shape(fake('area'),{mode:'자신 중심',scope:'적',range:2.4},'').radius],['circle',2.4]);
assert.equal(shape(fake('area'),{mode:'방향 지정',scope:'적',range:7.5},'경로상의 모든 대상').kind,'line');
assert.equal(shape(fake('area'),{mode:'방향 지정',scope:'적',range:4},'전방을 벤다').kind,'cone');
assert.equal(shape(fake('area'),{mode:'지면 지정',scope:'적',range:6},'').radiusAssumed,true);
assert.equal(shape(fake('area'),{mode:'대상 지정',scope:'적',range:6},'주위 적 1명에게').cap,2);
assert.equal(shape(fake('area'),{mode:'자신 중심',scope:'자신',range:1},'').kind,null,'Self buffs have no attack shape');
assert.equal(shape(fake('area',false),{mode:'자신 중심',scope:'아군·자신',range:5},'').kind,null,'Heals have no attack shape');

// Engine: no attack skill is left without a shape; audited shapes keep priority.
assert.deepEqual(D.skills.filter(s=>Sim.geometry(s).kind==='unknown').map(s=>s.name),[]);
const ilseom=Sim.geometry(by('일섬'));assert.equal(ilseom.kind,'line');assert.equal(ilseom.radius,7.5);assert.equal(ilseom.source,'kkaebi.gg');
const talisman=Sim.geometry(by('부적 던지기'));assert.equal(talisman.cap,2);assert.equal(talisman.capAssumed,false);
assert.equal(Sim.geometry(by('회전 난격')).basis,'주변 원형 · 사용자 툴팁','Audited shape wins over the aiming mode');
// The 2026-10-18 hunting deck (기동 광역) is now computed except for the persistent-timing skill.
const deck=['s051','s084','s087','s080','s079','s076','s078','s081','s048'],run=Sim.run({...D,baseSlots:['s051','s076','s078','s079','s080']},deck,'190057',60);
assert.deepEqual(run.excluded,['영혼 소용돌이 · 지속 타격 시점']);assert(run.metrics.perHit>1,'Area skills hit several enemies');
console.log('kkaebi.gg aim: 105 ranges/modes, idempotent apply, ultimate cooldowns, shape rules and full engine coverage passed.');
