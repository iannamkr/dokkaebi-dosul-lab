const assert=require('node:assert/strict'),Sim=require('./dist/simulation.js'),raw=require('./dist/data.json'),fs=require('node:fs');
const d=structuredClone(raw),b=require('./dist/builds/04-yeonta-area.json');d.baseSlots=b.baseSlots;
const a=Sim.run(d,b.skills,'185547',60),again=Sim.run(d,b.skills,'185547',60);
assert.deepEqual(a.metrics,again.metrics,'Same build/environment must be deterministic');
assert.equal(a.frames.length,601);assert.equal(a.frames.at(-1).time,60);assert.equal(a.metrics.opportunities,36);assert(a.metrics.coverage>=0&&a.metrics.coverage<=100);
assert.equal(a.rows.find(r=>r.id==='s051').targetHits,0,'Unknown persistent ticks must not become instant hits');assert(a.excluded.some(x=>x.includes('영혼 소용돌이')));
assert.equal(Sim.run(d,[]).frames.length,0,'Empty build stays empty');
const mob=(id,x,y)=>({id,x,y}),mobs=[mob(0,1,0),mob(1,-1,0),mob(2,1,1),mob(3,0,1),mob(4,0,-1),mob(5,.7,-.7)],circle={kind:'circle',range:2,radius:2,cap:5};
assert.equal(Sim.pickTargets(circle,mobs,mobs[0],0).length,5,'Known target caps applied per hit');
assert(!Sim.pickTargets({...circle,kind:'cone',angle:Math.PI/2},mobs,mobs[0],0).some(m=>m.id===1),'Frontal attacks must not hit behind');
assert.equal(Sim.pickTargets({...circle,range:.5},mobs,mobs[0],0).length,0,'Out of range means no hit');
assert.equal(Sim.pickTargets({...circle,kind:'single'},mobs,mobs[0],0).length,1);
assert.equal(Sim.pickTargets({...circle,kind:'unknown'},mobs,mobs[0],0).length,0);
assert.equal(Sim.geometry(d.skills.find(s=>s.id==='s015')).range,2);assert.equal(Sim.geometry(d.skills.find(s=>s.id==='s063')).radius,2,'AoE radius must not equal a ranged casting range');
const packed=Sim.run(d,b.skills,'190057',60);assert(packed.metrics.exposure>a.metrics.exposure,'Dense pack causes greater contact exposure');
assert(a.frames.find(f=>f.time===20).wave===1,'New wave clears enemy effects');
const charge={referenceNumbers:{cm:300,dc:[{hits:1,basic_coefficient:10},{hits:2,basic_coefficient:50}]}};assert.equal(Sim.coefficient(charge,2),50);assert.equal(Sim.coefficient(charge,3),null);
const sampleSkills=d.skills.filter(s=>['s019','s020','s021','s029','s067'].includes(s.id));for(const p of Sim.profiles){for(const t of p.samples){assert(fs.existsSync(`dist/simulation-evidence/${p.id}-${t}.jpg`));assert(fs.existsSync(`dist/simulation-evidence/${p.id}-${t}-hp.jpg`));}const sim=Sim.run({...d,baseSlots:sampleSkills.filter(s=>!s.ultimate).map(s=>s.id)},sampleSkills.map(s=>s.id),p.id,120);assert.equal(sim.frames.at(-1).time,120);assert(sim.metrics.unique<=sim.metrics.opportunities);}
// A condition cannot read its own output before the hit, nor read an enemy effect from a different enemy.
const skill={id:'x',name:'test',family:'연타',ultimate:false,basic:{cooldown:10,range:2},targeting:{kind:'single'},damage:true,referenceNumbers:{m:1000,dc:[{hits:1,basic_coefficient:100}]},buffs:[],debuffs:['파쇄'],conditions:[{effect:'파쇄',scope:'enemy',result:'추가 피해'}],timingEffects:{파쇄:{duration:5,application:'end'}}};
const synthetic=Sim.run({skills:[skill],baseSlots:['x']},['x'],'185547',20);assert.equal(synthetic.conditions[0].status,'no','No self-fulfilling output condition');
assert(!Object.hasOwn(a.metrics,'kills'));assert(!Object.hasOwn(a.metrics,'dps'));assert(!Object.hasOwn(a.metrics,'survival'),'Do not invent video-calibrated combat outcomes');
console.log('Simulation: deterministic geometry, target caps, timing, uncertainty, 4 video fixtures, empty state and no invented combat outcomes passed');
