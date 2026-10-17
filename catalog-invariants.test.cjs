const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('./dist/data.json'),Q=require('./dist/sequence.js'),C=require('./dist/combat.js'),Sim=require('./dist/simulation.js'),R=require('./dist/simulation-report.js');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync('dist/data.js','utf8'),ctx);assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.DOSUL_DATA)),data,'Browser and Node data must agree');
const html=fs.readFileSync('dist/index.html','utf8');for(const [,asset] of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)){assert(fs.existsSync('dist/'+asset),asset);if(asset.endsWith('.js'))new vm.Script(fs.readFileSync('dist/'+asset,'utf8'),{filename:asset});}
const finite=(x,label)=>{if(typeof x==='number')assert(Number.isFinite(x),label);else if(x&&typeof x==='object')for(const [k,v] of Object.entries(x))finite(v,label+'.'+k);};
let runs=0;
for(const s of data.skills){
 assert.match(s.icon,/^icons\//);assert(fs.existsSync('dist/'+s.icon),s.name+' local icon');assert.equal(fs.readFileSync('dist/'+s.icon).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const family=data.skills.filter(x=>x.family===s.family&&!x.ultimate).slice(0,3).map(x=>x.id),ids=s.ultimate?[...family,s.id]:[s.id],d={...data,baseSlots:s.ultimate?family:[s.id]};
 assert.equal(Q.validate(d,ids).issues.length,0);
 for(const p of Sim.profiles){const r=Sim.run(d,ids,p.id,20);finite(r,s.name);if(s.id==='s009'){assert.deepEqual(r.schedule.missing,['은신 모션 시간']);assert.equal(r.frames.length,0);assert.equal(R.create(d,ids,r).calculation.status,'blocked');runs++;continue;}assert.equal(r.schedule.missing.length,0,s.name);assert.equal(r.frames.at(-1).time,20);assert(r.metrics.unique<=r.metrics.opportunities);assert(r.metrics.coverage>=0&&r.metrics.coverage<=100);assert(Math.abs(r.schedule.busy+r.schedule.wait-20)<.02);assert(r.rows.every(row=>row.targetHits<=row.hitChecks*row.geometry.cap));
  const report=R.create(d,ids,r);finite(report,s.name+' report');assert.equal(report.segments.reduce((n,x)=>n+x.hitChecks,0),r.impacts.length);assert.equal(report.segments.reduce((n,x)=>n+x.conditionPass+x.conditionFail+x.conditionUnknown,0),r.conditions.length);runs++;
 }
 for(const horizon of [20,60,180]){const r=C.run(d,ids,horizon);if(r.missing.length){assert.equal(s.id,'s009');continue;}for(let i=1;i<r.events.length;i++)assert(r.events[i].start>=r.events[i-1].end-1e-6,s.name+' no overlapping casts');assert(Math.abs(r.busy+r.wait-horizon)<.02,s.name+' conservation');}
}
for(const bad of [NaN,1.1,Infinity,-1,'0',null,undefined])assert(Q.place(data,[],bad,'s001').error,'Reject non-slot index');
assert(Q.place(data,[],0,'s001','invalid').error);
for(const bad of [null,{},'bad',['s001','s001']]){const d={...data,baseSlots:bad},r=Sim.run(d,['s001']);assert.equal(R.create(d,['s001'],r).calculation.status,'blocked');}
console.log(`Catalog invariants: ${runs} spatial runs (105 skills × 4 environments), 315 timing runs, assets, finite numbers, slot boundaries and report conservation passed`);
