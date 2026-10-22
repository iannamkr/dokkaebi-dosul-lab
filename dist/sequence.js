(function(root){
'use strict';
const index=data=>new Map(data.skills.map(s=>[s.id,s]));
function clean(data,ids){const by=index(data),out=[];let normal=0,ultimate=0;for(const id of Array.isArray(ids)?ids:[]){const s=by.get(id);if(!s||out.includes(id)||out.length===9)continue;if(s.ultimate?ultimate===1:normal===8)continue;out.push(id);s.ultimate?ultimate++:normal++;}return out;}
function counts(data,ids){const by=index(data),families={};for(const id of new Set(ids)){const s=by.get(id);if(s&&!s.ultimate)families[s.family]=(families[s.family]||0)+1;}return families;}
function base(data,ids,preferred=data.baseSlots){const by=index(data),normal=ids.filter(id=>by.get(id)&&!by.get(id).ultimate),kept=[...new Set((Array.isArray(preferred)?preferred:[]).filter(id=>normal.includes(id)))].slice(0,5);return preferred===undefined?normal.slice(0,5):kept;}
// The ultimate only works with 3 same-family skills equipped, so keep the player's choices and swap in family skills only when needed.
function fit(data,ids,preferred=data.baseSlots){
 const by=index(data),out=base(data,ids,preferred),ult=ids.map(id=>by.get(id)).find(s=>s?.ultimate);if(!ult)return out;
 const family=ids.filter(id=>{const s=by.get(id);return s&&!s.ultimate&&s.family===ult.family;});if(family.length<3)return out;
 let have=out.filter(id=>family.includes(id)).length;
 for(const id of family){if(have>=3)break;if(out.includes(id))continue;if(out.length>=5){const drop=out.map((x,i)=>[x,i]).reverse().find(([x])=>!family.includes(x));if(!drop)break;out.splice(drop[1],1);}out.push(id);have++;}
 return out;
}
function baseCounts(data,ids){return counts(data,base(data,ids));}
function unlocked(data,ids){const c=baseCounts(data,ids);return data.skills.filter(s=>s.ultimate&&(c[s.family]||0)>=3);}
function validate(data,ids){const by=index(data),skills=ids.map(id=>by.get(id)).filter(Boolean),normal=skills.filter(s=>!s.ultimate),ults=skills.filter(s=>s.ultimate),c=baseCounts(data,ids),issues=[];
 if(new Set(ids).size!==ids.length||skills.length!==ids.length)issues.push('중복되거나 존재하지 않는 도술이 있습니다.');
 if(normal.length>8||ults.length>1||ids.length>9)issues.push('일반 도술 8개와 궁극기 1개까지만 배치할 수 있습니다.');
 for(const s of ults)if((c[s.family]||0)<3)issues.push(`${s.name}: ${s.family} 도술 ${3-(c[s.family]||0)}개를 기본 장착 5칸에 더 넣어야 합니다.`);
 return {normal:normal.length,ultimate:ults.length,counts:c,issues,complete:normal.length===8&&ults.length===1&&!issues.length};
}
function place(data,ids,step,id,mode='replace'){const by=index(data),s=by.get(id);if(!s)return {error:'도술을 찾을 수 없습니다.'};if(!Number.isInteger(step)||step<0||step>ids.length||step>8)return {error:'앞 단계부터 선택하세요.'};if(!['insert','replace'].includes(mode))return {error:'올바른 배치 방식을 선택하세요.'};if(mode==='insert'&&ids.length>=9)return {error:'9칸이 모두 찼습니다. 도술을 하나 제거한 뒤 끼워 넣으세요.'};const rest=mode==='insert'?ids:ids.filter((_,i)=>i!==step);
 if(rest.includes(id))return {error:'이미 배치한 도술입니다. 사용 순서는 화살표로 바꿀 수 있습니다.'};
 if(s.ultimate&&rest.some(x=>by.get(x).ultimate))return {error:'궁극기는 1개만 배치할 수 있습니다.'};
 if(!s.ultimate&&rest.filter(x=>!by.get(x).ultimate).length>=8)return {error:'일반 도술 8개를 채웠습니다. 궁극기를 선택하세요.'};
 const next=[...ids];if(mode==='insert')next.splice(step,0,id);else next[step]=id;const baseSlots=base(data,ids).map(x=>mode!=='insert'&&x===ids[step]&&!s.ultimate?id:x).filter(x=>next.includes(x)&&!by.get(x).ultimate);if(!s.ultimate&&baseSlots.length<5&&!baseSlots.includes(id))baseSlots.push(id);const v=validate({...data,baseSlots},next),u=next.map(x=>by.get(x)).find(x=>x.ultimate);
 if(u&&3-(counts(data,next)[u.family]||0)>8-v.normal)return {error:`${u.name}의 ${u.family} 3개 조건을 충족할 일반 도술 칸이 부족합니다.`};
 return {ids:next,baseSlots:fit(data,next,baseSlots)};
}
// Effects are potential prerequisites; unknown duration/consumption is never simulated.
function links(data,edges,ids,step,target){const by=index(data),prefix=ids.slice(0,step),potential={self:new Set(),enemy:new Set()},conditional=new Set(),result=[];
 const family=baseCounts(data,ids);for(const id of prefix){const s=by.get(id);if(!s)continue;
  for(const e of edges.filter(e=>e.source===id&&e.target===target)){
   const missing=(e.requires||[]).filter(x=>e.requirementScope?!potential[e.requirementScope]?.has(x):!potential.self.has(x)&&!potential.enemy.has(x));
   if(e.type==='resource'){missing.length=0;if((family['주술']||0)<3)missing.push('주술 도술 3개 장착');missing.push('구슬 활성화');}
   result.push({...e,missing,conditional:missing.length>0||conditional.has(e.scope+':'+e.effect)});
  }
  for(const b of s.buffs){const scope=s.effectScopes?.find(x=>x.effect===b)?.scope||'self';if(['self','self-and-allies'].includes(scope))potential.self.add(b);}for(const d of s.debuffs)potential.enemy.add(d);
  for(const c of s.conditions)if(['받는 피해 증가','방어력 감소','이동 속도 감소','받는 회복 감소','주는 피해 증가','공격력 증가','방어력 증가','보호막','받는 피해 감소'].includes(c.result)){const outputScope=c.resultScope||(['받는 피해 증가','방어력 감소','이동 속도 감소','받는 회복 감소'].includes(c.result)?'enemy':'self');if(!potential[c.scope].has(c.effect)||conditional.has(c.scope+':'+c.effect))conditional.add(outputScope+':'+c.result);potential[outputScope].add(c.result);}
 }
 return result;
}
function candidates(data,edges,ids,step,types=['explicit','general','resource','conflict'],mode='replace',scope='all'){
 const T=typeof module!=='undefined'?require('./link-timing.js'):root.DosulLinkTiming;
 return data.skills.filter(s=>!place(data,ids,step,s.id,mode).error).map(s=>{
  const plan=place(data,ids,step,s.id,mode),raw=links(data,edges,ids,step,s.id).filter(e=>types.includes(e.type)&&(scope!=='previous'||e.source===ids[step-1]));
  const connections=T.evaluate(data,plan.ids,plan.baseSlots,raw),positive=connections.filter(e=>e.type!=='conflict'&&e.timing.eligible);
  const score=positive.reduce((n,e)=>n+({explicit:10,general:2,resource:1}[e.type]||0)*e.timing.ratio,0);
  return {skill:s,connections,positive,score};
 }).sort((a,b)=>b.score-a.score||a.skill.ultimate-b.skill.ultimate||a.skill.id.localeCompare(b.skill.id));
}
// Explore either side of an anchor using the actual proposed order and hit timing.
function directionalCandidates(data,edges,ids,anchor,direction,types=['explicit','general','resource','conflict']){
 const T=typeof module!=='undefined'?require('./link-timing.js'):root.DosulLinkTiming;
 if(!ids.includes(anchor)||!['before','after'].includes(direction))return [];
 const by=index(data),out=[];
 for(const skill of data.skills){
  if(skill.id===anchor)continue;
  const existing=ids.indexOf(skill.id);let plan;
  if(existing>=0){const next=ids.filter(id=>id!==skill.id),at=next.indexOf(anchor)+(direction==='after'?1:0);next.splice(at,0,skill.id);plan={ids:next,baseSlots:base(data,next)};}
  else {const at=ids.indexOf(anchor)+(direction==='after'?1:0);plan=place(data,ids,at,skill.id,'insert');}
  if(plan.error)continue;
  const source=direction==='before'?skill.id:anchor,target=direction==='before'?anchor:skill.id;
  const raw=links(data,edges,plan.ids,plan.ids.indexOf(target),target).filter(e=>e.source===source&&types.includes(e.type));
  const connections=T.evaluate(data,plan.ids,plan.baseSlots,raw),positive=connections.filter(e=>e.type!=='conflict'&&e.timing.eligible);
  if(!positive.length)continue;
  const score=positive.reduce((n,e)=>n+({explicit:10,general:2,resource:1}[e.type]||0)*e.timing.ratio,0);
  out.push({skill,connections,positive,score,plan,anchor,direction,existing:existing>=0});
 }
 return out.sort((a,b)=>b.score-a.score||a.skill.id.localeCompare(b.skill.id));
}
function predecessors(data,edges,target,types=['explicit','general','resource']){const by=index(data),groups=new Map();for(const e of edges){if(e.target!==target||e.source===target||e.type==='conflict'||!types.includes(e.type))continue;if(!groups.has(e.source))groups.set(e.source,[]);groups.get(e.source).push(e);}return [...groups].map(([id,connections])=>({skill:by.get(id),connections,score:connections.reduce((n,e)=>n+({explicit:10,general:2,resource:1}[e.type]||0),0)})).filter(x=>x.skill).sort((a,b)=>b.score-a.score||a.skill.id.localeCompare(b.skill.id));}
function before(data,ids,target,source){const pos=ids.indexOf(target);if(pos<0)return {error:'선택한 도술을 현재 단계에 먼저 배치하세요.'};if(source===target)return {error:'같은 도술을 선행으로 배치할 수 없습니다.'};const existing=ids.indexOf(source);if(existing===pos-1&&existing>=0)return {error:'이미 바로 앞에 배치되어 있습니다.'};if(existing>=0){const next=ids.filter(id=>id!==source);next.splice(next.indexOf(target),0,source);return {ids:next,moved:true};}return place(data,ids,pos,source,'insert');}
function restore(data,v){if(!v||!['dosul-build-v1','dosul-build-v2','dosul-build-v3'].includes(v.schema)||!Array.isArray(v.skills)||v.skills.length>9||clean(data,v.skills).length!==v.skills.length)throw Error('유효한 도술 조합 파일이 아닙니다.');const by=index(data);if(v.baseSlots!==undefined&&(!Array.isArray(v.baseSlots)||v.baseSlots.length>5||new Set(v.baseSlots).size!==v.baseSlots.length||v.baseSlots.some(id=>!v.skills.includes(id)||by.get(id).ultimate)))throw Error('기본 장착 정보가 올바르지 않습니다.');return {ids:[...v.skills],baseSlots:base({...data,baseSlots:undefined},v.skills,v.baseSlots)};}
const api={restore,clean,counts,base,fit,baseCounts,unlocked,validate,place,links,candidates,directionalCandidates,predecessors,before};if(typeof module!=='undefined')module.exports=api;else root.DosulSequence=api;
})(typeof window==='undefined'?globalThis:window);
