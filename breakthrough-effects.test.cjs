'use strict';
const assert=require('node:assert/strict'),B=require('./dist/breakthrough.js'),D=require('./dist/data.json'),G=require('./dist/graph.js'),Q=require('./dist/sequence.js'),N=require('./dist/numbers.js'),T=require('./dist/timing-auto.js'),C=require('./dist/combat.js'),L=require('./dist/effect-timeline.js');
const d=structuredClone(D),find=n=>d.skills.find(s=>s.name===n);B.apply(d);
assert.equal(d.skills.filter(s=>s.legendaryBreakthrough?.active).length,16);
for(const [name,rule]of Object.entries(B.rules)){const s=find(name);assert.ok(s.legendaryBreakthrough.description.includes('6단계'));assert.equal(s.legendaryBreakthrough.source,'https://kkaebigg.com/skills/');for(const c of rule.conditions||[])assert.ok(s.conditions.some(x=>x.effect===c.effect&&x.breakthrough===6));for(const k of ['buffs','debuffs'])for(const e of rule[k]||[])assert.ok(s[k].includes(e.name));}
const once=JSON.stringify(d);B.apply(d);assert.equal(JSON.stringify(d),once,'idempotent');
const shock=find('꿰뚫는 저격'),flurry=find('난타'),ice=find('얼어붙은 대지');assert.equal(T.duration(shock,'감전').value,10);assert.equal(T.duration(ice,'침묵').value,1);assert.equal(T.duration(ice,'침묵').application,'end');
const edges=G.buildGraph(d);assert.ok(edges.some(e=>e.source===shock.id&&e.target===flurry.id&&e.effect==='감전'));
assert.ok(Q.directionalCandidates(d,edges,[flurry.id],flurry.id,'before',['explicit']).some(x=>x.skill.id===shock.id));
assert.ok(Q.directionalCandidates(d,edges,[shock.id],shock.id,'after',['explicit']).some(x=>x.skill.id===flurry.id));
const base=structuredClone(D.skills.find(s=>s.name==='대검 강타')),smash=find('대검 강타');assert.ok(Math.abs(N.total(smash)/N.total(base)-1.3)<1e-8);
assert.equal(B.hitCoefficient(smash,100,{targets:3}),150);assert.equal(B.hitCoefficient(smash,100,{targets:1}),100);
const focus=find('집중 연타');assert.equal(B.hitCoefficient(focus,100,{condition:()=>({status:'yes'})}),110.00000000000001);assert.equal(B.hitCoefficient(focus,100,{condition:()=>({status:'unknown'})}),100);
assert.equal(find('하늘의 심판').targeting.count,20);assert.equal(B.hitCoefficient(find('하늘의 심판'),100,{targets:10}),50);
const stealth=find('은신');assert.equal(T.duration(stealth,'치명타 적중 증가').conditional,true);assert.ok(!L.model(d,{ids:[stealth.id],events:[{id:stealth.id,start:0,end:1}]}).rows.some(x=>x.effect==='치명타 적중 증가'));
const sim=C.run({...d,baseSlots:[shock.id,flurry.id]},[shock.id,flurry.id],20,false);assert.equal(sim.missing.length,0);
B.apply(d,0);assert.ok(!find('꿰뚫는 저격').debuffs.includes('감전'));assert.equal(N.total(find('대검 강타')),N.total(base));assert.equal(find('얼어붙은 대지').debuffs.includes('침묵'),false);B.apply(d);assert.equal(find('꿰뚫는 저격').debuffs.filter(x=>x==='감전').length,1);
console.log('Legendary breakthrough: all 16 source records, idempotence, base isolation, incoming/outgoing shock links, conditional damage, 20-target cap, last-hit silence, conditional critical timing and rollback passed.');
