'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const D=require('./dist/data.json'),Q=require('./dist/sequence.js'),fixture=require('./benchmarks/community-20.json');
assert.equal(new Set(fixture.builds.map(b=>b.id)).size,fixture.builds.length);
for(const b of fixture.builds){assert(b.votes>=20);const ids=b.names.map(n=>{const s=D.skills.find(s=>s.name===n);assert(s,n);return s.id;});assert.equal(new Set(ids).size,ids.length);assert.equal(Q.validate({...D,baseSlots:Q.fit(D,ids)},ids).issues.length,0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dosul-benchmark-')),out=path.join(dir,'report.json');
try{
 const result=spawnSync(process.execPath,['scripts/benchmark-community.cjs','--controls','2','--iterations','1','--output',out],{cwd:__dirname,encoding:'utf8',timeout:180000});assert.equal(result.status,0,result.stderr);
 const report=JSON.parse(fs.readFileSync(out,'utf8'));assert.equal(report.references.length,fixture.builds.length);
 for(const r of report.references){assert(r.evaluation.valid);assert.equal(r.evaluation.runs.length,4);assert.equal(r.orderVariants.length,8);assert(r.controlComparison.midrankPercentile>=0&&r.controlComparison.midrankPercentile<=100);}
 assert(report.references.find(r=>r.id==='146').flags.includes('ultimate-disabled-not-represented'));
 assert(report.references.find(r=>r.id==='159').descriptionOrder);
 assert.deepEqual(report.references.find(r=>r.group==='area').evaluation.runs.map(r=>r.layout),['corridor','packed','ring','scattered']);
 assert(report.searches.every(s=>s.probes.every(p=>p.injected===false)));
 console.log('Community benchmark: threshold, identities, policy flags, independent layouts, counterfactual orders and non-injected search probes passed.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
