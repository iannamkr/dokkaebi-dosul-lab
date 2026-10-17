#!/usr/bin/env node
'use strict';
// Applies dist/kkaebi-gg/skills-aim.json (range + aiming mode per skill) to dist/data.json and dist/data.js.
// Adds `aim` to every skill and aligns cooldowns that disagree with both kkaebi.gg and kkaebigg.com.
// Idempotent: running it again on unchanged inputs writes identical files.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),DIST=path.join(ROOT,'dist');
const ASSUMED_RADIUS=2;
// Forward attacks whose description says they travel a path are lines; other forward attacks are cones.
const LINE=/경로|직선|관통|꿰뚫|돌진|전진|날려|뿜어/;

function shape(skill,aim,description){
 if(aim.scope==='자신'||skill.damage===false)return {kind:null};
 if(aim.mode==='대상 지정'){
  if(skill.targeting?.kind==='single')return {kind:'single'};
  const extra=/주위 적 (\d+)명/.exec(description);
  return {kind:'target',radius:ASSUMED_RADIUS,radiusAssumed:true,cap:extra?1+Number(extra[1]):null,basis:`대상 지정 범위 · 대상 주변 반경 ${ASSUMED_RADIUS}m 가정`+(extra?` · 설명상 주위 ${extra[1]}명 추가`:'')};
 }
 if(aim.mode==='자신 중심')return {kind:'circle',radius:aim.range,radiusAssumed:false,basis:'자신 중심 · 사거리를 반경으로 사용'};
 if(aim.mode==='방향 지정'){const line=LINE.test(description);return {kind:line?'line':'cone',radius:aim.range,radiusAssumed:!line,basis:`방향 지정 · 사거리를 길이로 사용`+(line?' · 설명상 경로/직선':' · 부채꼴 각도 가정')};}
 if(aim.mode==='지면 지정'||aim.mode==='지면 이동')return {kind:'target',radius:ASSUMED_RADIUS,radiusAssumed:true,basis:`${aim.mode} · 지점 주변 반경 ${ASSUMED_RADIUS}m 가정`};
 return {kind:null};
}
function apply(data,aims,descriptions={}){
 const report={aimed:0,cooldowns:[],missing:[]};
 for(const a of aims.skills){
  const s=data.skills.find(x=>x.name===a.name);if(!s){report.missing.push(a.name);continue;}
  const sh=shape(s,a,descriptions[a.name]||s.notes||'');
  s.aim={source:'kkaebi.gg',checkedAt:aims.fetchedAt,gameId:a.gameId,mode:a.mode,scope:a.scope,range:a.range,...sh};
  report.aimed++;
  if(s.basic&&typeof a.cooldown==='number'&&Math.abs(s.basic.cooldown-a.cooldown)>1e-9){
   report.cooldowns.push({id:s.id,name:s.name,before:s.basic.cooldown,after:a.cooldown});
   s.basic.cooldown=a.cooldown;s.basic.fieldNotes={...s.basic.fieldNotes,cooldown:`kkaebi.gg·kkaebigg.com 게임 자료 ${a.cooldown}초 (${aims.fetchedAt}). 이전 값은 공식 궁극기 안내 표기였습니다.`};
  }
 }
 return report;
}
module.exports={apply,shape};
if(require.main===module){
 const aims=JSON.parse(fs.readFileSync(path.join(DIST,'kkaebi-gg/skills-aim.json'),'utf8'));
 let descriptions={};try{descriptions=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIST,'kkaebigg/skills.json'),'utf8')).skills.map(s=>[s.n,s.d||'']));}catch{}
 const data=JSON.parse(fs.readFileSync(path.join(DIST,'data.json'),'utf8'));
 const report=apply(data,aims,descriptions);
 fs.writeFileSync(path.join(DIST,'data.json'),JSON.stringify(data,null,2)+'\n');
 fs.writeFileSync(path.join(DIST,'data.js'),'window.DOSUL_DATA = '+JSON.stringify(data)+';\n');
 console.log(`조준 정보 ${report.aimed}개 반영 · 재사용 대기시간 변경 ${report.cooldowns.length}개`+(report.cooldowns.length?': '+report.cooldowns.map(c=>`${c.name} ${c.before}→${c.after}`).join(', '):'')+(report.missing.length?` · 찾지 못함: ${report.missing.join(', ')}`:''));
}
