(function(root){
'use strict';
function buildGraph(data){
 const skills=data.skills,edges=[];
 const enemyResults=new Set(['받는 피해 증가','방어력 감소','이동 속도 감소','받는 회복 감소']);
 const persistentResults=new Set([...enemyResults,'주는 피해 증가','공격력 증가','방어력 증가','보호막','받는 피해 감소']);
 const add=(a,b,effect,result,type,requires=[],scope='enemy',knownBug=null)=>{if(a.id!==b.id)edges.push({id:`e${edges.length+1}`,source:a.id,target:b.id,effect,result,type,requires,scope,knownBug,evidence:[a.source,b.source],confidence:type==='explicit'?'공개 설명의 조건 일치':type==='resource'?'신식 활성 조건의 의도된 효과':type==='conflict'?'공개 해제 조건에 따른 주의':'효과에 근거한 범용 추론'});};
 for(const a of skills){
  const outputs=[...a.buffs.map(effect=>{const scope=a.effectScopes?.find(x=>x.effect===effect)?.scope||'self';return {effect,scope:scope==='self-and-allies'?'self':scope,requires:[]};}),...a.debuffs.map(effect=>({effect,scope:'enemy',requires:[]})),...a.conditions.filter(c=>persistentResults.has(c.result)).map(c=>({effect:c.result,scope:c.resultScope||(enemyResults.has(c.result)?'enemy':'self'),requires:[c.effect],requirementScope:c.scope}))];
  for(const b of skills){
   if(a.family==='주술'&&!a.ultimate&&!b.ultimate)add(a,b,'주술 구슬','재사용 대기시간 감소','resource',['주술 신식 개방','구슬 활성화'],'self',b.family!=='주술'?{status:'알려진 버그 있음',description:'타 계열 재사용 대기시간 감소 미작동 안내. 의도된 효과대로 연결 유지.',source:'bugs',asOf:'2026-10-16'}:null);
   for(const c of b.conditions)for(const p of outputs)if(p.effect===c.effect&&p.scope===c.scope){add(a,b,c.effect,c.result,'explicit',p.requires,c.scope);if(a.id!==b.id){const edge=edges[edges.length-1];edge.requirementScope=p.requirementScope;if(c.reference){edge.reference=true;edge.evidence.push(c.source);edge.confidence='비공식 개별 효과 설명 대조';}}}
   for(const p of outputs){
    if(b.damage&&['self','enemy'].includes(p.scope)&&['받는 피해 증가','방어력 감소','주는 피해 증가','공격력 증가'].includes(p.effect)){add(a,b,p.effect,'후속 공격 강화 가능','general',p.requires,p.scope);if(a.id!==b.id)edges[edges.length-1].requirementScope=p.requirementScope;}
    if(b.damage&&['수면','변이'].includes(p.effect))add(a,b,p.effect,'후속 피해로 제어 해제','conflict',[], 'enemy');
   }
  }
 }
 return edges;
}
function activeUltimate(data,ids){const count={};ids.forEach(id=>{const s=data.skills.find(s=>s.id===id);if(s&&!s.ultimate)count[s.family]=(count[s.family]||0)+1;});const family=Object.keys(count).find(k=>count[k]>=3);return data.skills.find(s=>s.ultimate&&s.family===family)||null;}
function reachable(edges,start,depth=2,types=['explicit']){const nodes=new Set([start]);let frontier=new Set([start]);for(let i=0;i<depth;i++){const next=new Set();for(const e of edges)if(types.includes(e.type)&&frontier.has(e.source)&&!nodes.has(e.target)){next.add(e.target);nodes.add(e.target);}frontier=next;}return nodes;}
const api={buildGraph,activeUltimate,reachable};if(typeof module!=='undefined')module.exports=api;else root.DosulGraph=api;
})(typeof window==='undefined'?globalThis:window);
