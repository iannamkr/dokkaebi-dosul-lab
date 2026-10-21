'use strict';
const assert=require('node:assert/strict'),D=structuredClone(require('./dist/data.json')),raw=require('./dist/kkaebigg/skills.json'),buffs=require('./dist/kkaebigg/buffs.json'),K=require('./dist/kkaebigg.js'),N=require('./dist/numbers.js'),E=require('./dist/encounter.js'),O=require('./dist/optimizer.js');
K.apply(D,{skills:raw,buffs});
const near=(a,b)=>assert(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const d=structuredClone(D),skill=d.skills.find(s=>s.name==='연속 찌르기'),source=raw.skills.find(s=>s.n===skill.name);d.baseSlots=[skill.id];
const opts={attack:10000,hp:1e12,points:[{x:1,y:0}],approach:false,movement:false,damageRate:1,scenario:{playerSpeed:0,monsterSpeed:0}};
const base=E.run(d,[skill.id],'185547',20,opts);
for(const level of [1,14,50]){skill.level=level;const out=E.run(d,[skill.id],'185547',20,opts),growth=source.num.lv.find(x=>x.level===level).coefficient;near(out.encounter.damage,base.encounter.damage*(1+growth));assert.equal(out.schedule.casts,base.schedule.casts);}
for(const bad of [-1,51,1.5]){skill.level=bad;assert.throws(()=>E.run(d,[skill.id],'185547',20,opts),/강화 레벨/);}
const shield=d.skills.find(s=>s.name==='강인한 의지'),shieldSource=raw.skills.find(s=>s.n===shield.name);d.baseSlots=[shield.id];
for(const level of [0,1,14,50]){shield.level=level;const out=O.evaluate(d,[shield.id],d.baseSlots,{horizon:20,stats:{attack:10000,maxHp:100000},incoming:null,snapshot:{skills:raw,buffs}});assert(out.valid);const ef=shieldSource.ef[0],amount=ef.v*(1+(level?ef.fl.find(x=>x.level===level).coefficient:0)),shieldRow=out.rows.find(x=>x.kind==='shield'),reduceRow=out.rows.find(x=>x.kind==='reduce');near(shieldRow.each,Math.round(10000*amount)/100);assert.equal(reduceRow.reducePct,20);}
// The source is immutable across runs; selecting a level never compounds a previous enhancement.
assert.deepEqual(skill.referenceNumbers,source.num);assert.deepEqual(shield.referenceProgression.effects,shieldSource.ef);
console.log('Progression integration: source-derived damage reaches world HP; shield growth reaches optimizer; invalid levels rejected; source tables immutable.');

// A data-driven breakthrough cooldown must also apply to charge replenishment.
{const C=require('./dist/combat.js'),d=structuredClone(D),s=d.skills.find(s=>s.name==='연속 찌르기');
s.referenceNumbers.tr={s:[{cd:-1.25}]};s.breakthrough=1;s.usage={charges:2};d.baseSlots=[s.id];
const expected=s.basic.cooldown+s.referenceNumbers.tr.s[0].cd,run=C.run(d,[s.id],60,false);
assert(run.events.length>4);near(run.events[2].start,expected);near(run.events[3].start,2*expected);
}
