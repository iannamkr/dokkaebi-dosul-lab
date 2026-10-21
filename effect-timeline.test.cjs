const assert=require('node:assert/strict'),T=require('./dist/effect-timeline.js');
const fs=require('node:fs'),vm=require('node:vm'),K=require('./dist/kkaebigg.js');
const data={skills:[{id:'a',name:'a',buffs:['수호'],debuffs:['파쇄'],conditions:[],timingEffects:{수호:{duration:5},파쇄:{duration:10}}},{id:'b',name:'b',buffs:['미확인'],debuffs:[],conditions:[]}]};
const sim={ids:['a','b'],events:[{id:'a',start:0,end:1},{id:'a',start:4,end:5},{id:'b',start:2,end:3}]};
const m=T.model(data,sim);
assert.equal(T.active(m,3).length,2);
assert.equal(T.active(m,7).find(x=>x.effect==='수호').remaining,3);
assert.equal(T.active(m,10).some(x=>x.effect==='수호'),false);
assert.equal(T.active(m,15).length,0);
assert.equal(m.unknown.length,1);
assert.equal(T.model(data,{ids:['a'],events:[{id:'a',start:0,end:1,completed:false}]}).rows.length,0);
const context={window:{}};vm.runInNewContext(fs.readFileSync('./dist/data.js','utf8'),context);
const snapshotContext={window:{}};vm.runInNewContext(fs.readFileSync('./dist/kkaebigg/snapshot.js','utf8'),snapshotContext);
const synced=context.window.DOSUL_DATA,snapshot=snapshotContext.window.KKAEBIGG_SNAPSHOT;K.apply(synced,snapshot);
const storm=synced.skills.find(s=>s.name==='번개 폭풍'),stormModel=T.model(synced,{ids:[storm.id],events:[{id:storm.id,start:0,end:.6,completed:true}]});
assert.equal(storm.referenceDetail.debuffs.find(e=>e.name==='감전').duration,10);
assert.equal(storm.referenceDetail.debuffs.find(e=>e.name==='마비').duration,1);
assert.deepEqual(stormModel.rows.map(r=>[r.effect,r.duration]).sort(),[['감전',10],['마비',1]]);
const allUnique=[];for(const remote of snapshot.skills.skills){const skill=synced.skills.find(s=>s.id===K.localId(remote.id));if(!skill)continue;for(const hit of remote.hit||[]){const linked=K.link(snapshot,hit.n);if(linked&&!linked.ambiguous&&Number.isFinite(linked.life)&&linked.life>0)allUnique.push({skill,effect:hit.n,life:linked.life});}}
assert(allUnique.length>=20,'최신 효과 사전에 단일 지속시간이 있는 효과를 충분히 발견');
for(const {skill,effect,life} of allUnique){const row=[...(skill.referenceDetail?.buffs||[]),...(skill.referenceDetail?.debuffs||[])].find(e=>e.name===effect);assert.equal(row?.duration,life,`${skill.name} · ${effect} 지속시간 동기화`);}
console.log('Effect timeline: accumulation, refresh, expiry boundaries, unknown duration and incomplete casts passed');
