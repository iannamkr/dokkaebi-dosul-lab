(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./combat.js'):root.DosulCombat;
const H=typeof module!=='undefined'?require('./hit-timing.js'):root.DosulHits;
const A=typeof module!=='undefined'?require('./timing-auto.js'):root.DosulAuto;
const Q=typeof module!=='undefined'?require('./sequence.js'):root.DosulSequence;
const MODEL='spatial-no-hp-v4';
const round=n=>Math.round(n*100)/100,exact=n=>Math.round(n*1e6)/1e6,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// These are scenario assumptions, not coordinates, radii or AI extracted from the recordings.
const PROFILES=[
 {id:'183432',title:'벽가 · 체력 하락',length:63.47,review:2,layout:'wall',engaged:3,hpMax:99003,hp:[[0,96384],[30,75351],[60,69808]],observation:'벽 쪽 무리와 떨어진 외곽 몹이 함께 보입니다. 표본 체력은 60초 동안 하락합니다.',focus:'원거리 유인 없이 가까운 무리만 반복 타격하는지 확인',samples:[0,30,60]},
 {id:'184555',title:'보호막 · 회복 구간',length:105.03,review:3,layout:'wall',engaged:3,hpMax:99056,hp:[[0,89099],[30,83231],[60,81214],[90,95765]],observation:'보호막이 보이며, 60초보다 90초 표본의 체력이 높습니다. 사용자는 강인한 의지 추가 후 물약 소비가 없었다고 보고했습니다.',focus:'공격 기회를 보존하면서 방어 도술이 반복 사용되는지 확인',samples:[0,30,60,90]},
 {id:'185547',title:'원형 · 외곽 산개',length:154.5,review:4,layout:'ring',engaged:3,hpMax:99056,hp:[[0,97268],[30,90162],[60,86333],[150,81369]],observation:'중앙 근처를 공격하는 동안 외곽에 몹이 남습니다. 60초·150초 장면에서도 주변 무리가 분산되어 있습니다.',focus:'전방 공격의 사각과 원거리 첫 적중으로 유인하는 효과 비교',samples:[0,30,60,150]},
 {id:'190057',title:'중앙 밀집 · 체력 하락',length:64.81,review:5,layout:'packed',engaged:8,hpMax:99056,hp:[[0,68176],[30,51290],[60,23650]],observation:'중앙에 적이 밀집한 장면이 반복됩니다. 체력 표본은 68,176 → 51,290 → 23,650으로 하락합니다.',focus:'광역 대상 상한과 근접 노출 증가를 함께 확인',samples:[0,30,60]}
];
// Shape families use descriptions already audited in data.json. Dimensions remain hypotheses.
const SHAPES={s015:['circle',2,'주변 원형 · 사용자 툴팁'],s017:['cone',3,'전방 · 개별 설명'],s018:['cone',3,'전방 · 개별 설명'],s022:['cone',3,'전방 · 공식 설명'],s025:['line',4,'검기 경로 · 모델 가정'],s026:['circle',3,'주변 폭발 · 영상 관찰'],s027:['line',4,'직선 · 사용자 관찰'],s028:['line',3,'전진 공격 · 설명; 이동 미반영'],s029:['circle',3,'주변 타격 · 영상 관찰'],s035:['circle',2,'회전 · 설명'],s054:['target',2,'대상 및 주변 · 설명'],s059:['target',2,'대상 및 주변 · 설명'],s060:['chain',3,'여러 대상 전이 · 설명'],s063:['target',2,'대상 및 주변 · 설명'],s067:['circle',2,'주변 공격 · 설명'],s070:['circle',2,'주변 공격 · 설명'],s083:['circle',3,'주변 적 공격 · 설명'],s096:['circle',3,'주변 적 공격 · 설명'],s103:['circle',3,'주변 공격 · 설명']};
const LABELS={circle:'주변 원형',cone:'전방 부채꼴',line:'직선',target:'대상 중심',chain:'전이',single:'단일',support:'지원',unknown:'형상 미확인'};
function geometry(s,scale=1){
 // Audited shapes first; otherwise the aiming mode from kkaebi.gg (self-centred, forward, ground or target point).
 const aim=s.aim?.kind&&s.aim.kind!=='single'&&s.targeting?.kind!=='single'?s.aim:null;
 const spec=s.simulationGeometry,item=spec?[spec.kind,spec.radius,spec.basis]:SHAPES[s.id]||(aim?[aim.kind,aim.radius,aim.basis]:null),kind=s.damage===false||s.referenceNumbers?.nd?'support':item?.[0]||(s.targeting?.kind==='single'?'single':'unknown');
 const fromAim=!spec&&!SHAPES[s.id]&&!!aim,cap=s.targeting?.count||(fromAim&&aim.cap)||(kind==='single'?1:5);
 return {kind,label:LABELS[kind],radius:(item?.[1]||0)*scale,width:1.3*scale,angle:Math.PI*2/3,cap,capAssumed:kind!=='single'&&!s.targeting?.count&&!(fromAim&&aim.cap),range:Number.isFinite(s.basic?.range)?s.basic.range:null,basis:item?.[2]||(kind==='single'?'도감 단일 분류':'공간 계산 제외'),sizeAssumed:fromAim?!!aim.radiusAssumed:!!item,kindAssumed:!!spec?.kindAssumed,dash:!!spec?.dash,source:spec?.source||(fromAim?'kkaebi.gg':null)};
}
function effectState(bag,effect,time){
 const entries=(bag[effect]||[]).filter(e=>e.appliedAt<=time+1e-7),live=entries.filter(e=>e.duration===null||e.expiresAt>time+1e-6),known=live.filter(e=>e.confirmed&&e.duration!==null).at(-1),uncertain=live.at(-1);
 const e=known||uncertain||entries.at(-1);
 return {status:known?'yes':uncertain?'unknown':'no',reason:known?'active':uncertain?(uncertain.confirmed?'duration-unknown':'hit-unknown'):entries.length?'expired':'not-applied',source:e?.source??null,appliedAt:e?.appliedAt??null,expiresAt:e?.expiresAt??null,remaining:e?.expiresAt==null?null:round(e.expiresAt-time)};
}
function conditionState(s,event,condition,bag,time){
 if(condition.effect==='최대 차지'){
  const charge=A.motion(s)?.charge,pressure=(event.modifiers||[]).some(x=>x.includes('강압 · 최대 차지 즉시'));
  return {status:pressure?'yes':charge>0?(event.parts.charge>=charge-1e-7?'yes':'no'):'unknown',reason:pressure?'pressure-max-charge':charge>0?(event.parts.charge>=charge-1e-7?'max-charge':'partial-charge'):'charge-unknown',chargeSeconds:event.parts.charge,requiredChargeSeconds:charge??null};
 }
 return ['self','enemy'].includes(condition.scope)?effectState(bag,condition.effect,time):{status:'unknown',reason:'scope-unknown'};
}
function initial(profile){
 return Array.from({length:12},(_,i)=>{const angle=i*Math.PI*2/12+.24;let radius=profile.layout==='packed'?(i<8?1.5+i%3*.45:5.4):i<3?1.4+i*.4:4.5+(i%3)*.65;let x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;if(profile.layout==='wall')x=-Math.abs(x)+.4;
 return {id:i,x,y,active:i<profile.engaged,effects:{},hitAt:-100,touched:false};});
}
function pickTargets(g,mobs,target,angle,player={x:0,y:0}){
 if(['unknown','support'].includes(g.kind)||!target||g.range===null||dist(player,target)>g.range+.001)return [];
 let pool=[];
 if(g.kind==='single')pool=[target];
 else if(g.kind==='chain'){
  pool=[target];while(pool.length<g.cap){let next=mobs.filter(m=>!pool.includes(m)).map(m=>({m,d:Math.min(...pool.map(p=>dist(p,m)))})).filter(x=>x.d<=g.radius).sort((a,b)=>a.d-b.d||a.m.id-b.m.id)[0];if(!next)break;pool.push(next.m);}return pool;
 }else pool=mobs.filter(m=>{
  const x=(m.x-player.x)*Math.cos(angle)+(m.y-player.y)*Math.sin(angle),y=-(m.x-player.x)*Math.sin(angle)+(m.y-player.y)*Math.cos(angle);
  if(g.kind==='circle')return dist(player,m)<=g.radius;
  if(g.kind==='target')return dist(target,m)<=g.radius;
  if(g.kind==='line')return x>=0&&x<=g.radius&&Math.abs(y)<=g.width/2;
  return dist(player,m)<=g.radius&&Math.abs(Math.atan2(y,x))<=g.angle/2;
 });
 return pool.sort((a,b)=>dist(player,a)-dist(player,b)||a.id-b.id).slice(0,g.cap);
}
function coefficient(s,hitIndex){const n=s.referenceNumbers||{},ds=n.cm?[n.dc?.at(-1)].filter(Boolean):n.dc||[];let i=hitIndex;for(const d of ds){if(i<=d.hits)return Number.isFinite(d.basic_coefficient)?d.basic_coefficient:null;i-=d.hits;}return null;}
function run(data,ids,profileId='185547',horizon=60,scale=1){
 const validation=Q.validate({...data,baseSlots:Array.isArray(data.baseSlots)?data.baseSlots:undefined},ids);
 if(data.baseSlots!==undefined&&(!Array.isArray(data.baseSlots)||data.baseSlots.length>5||new Set(data.baseSlots).size!==data.baseSlots.length||data.baseSlots.some(id=>!ids.includes(id)||data.skills.find(s=>s.id===id)?.ultimate)))validation.issues.push('기본 장착은 사용 중인 일반 도술 중 중복 없이 최대 5개여야 합니다.');
 const profile=PROFILES.find(p=>p.id===profileId)||PROFILES[2],schedule=C.run(data,validation.issues.length?[]:ids,horizon,true),byId=Object.fromEntries(data.skills.map(s=>[s.id,s])),rows=ids.filter(id=>byId[id]).map(id=>({id,name:byId[id].name,geometry:geometry(byId[id],scale),casts:0,hitCasts:0,targets:0,hitChecks:0,targetHits:0,whiffs:0,coefficient:0,conditions:[],unknown:[]}));
 schedule.missing.push(...validation.issues);
 const result={model:MODEL,validation,scale,profile:profile.id,horizon:schedule.horizon,schedule,rows,frames:[],impacts:[],conditions:[],effectApplications:[],excluded:[],issues:[],metrics:{},rage:null};
 if(!ids.length||schedule.missing.length){result.issues=schedule.missing;return result;}
 const rowById=Object.fromEntries(rows.map(r=>[r.id,r])),actions=[],casts=new Map(),unique=new Set(),landed=[];let serial=0;
 for(const ev of schedule.events){
  const s=byId[ev.id],row=rowById[s.id],key=serial++,hitPlan=H.schedule(s,ev,schedule.horizon);row.casts++;
  if(row.geometry.kind==='unknown')row.unknown.push('공격 형상');if(row.geometry.range===null&&s.damage)row.unknown.push('사거리');if(hitPlan.unknown)row.unknown.push('지속 타격 시점');
  if(s.damage&&coefficient(s,1)===null)row.unknown.push('피해 계수');
  actions.push({time:ev.start,type:'start',ev,key});
  actions.push({time:ev.end,type:'end',ev,key});
  if(!row.unknown.includes('공격 형상')&&!row.unknown.includes('사거리'))for(const hit of hitPlan.hits)actions.push({time:hit.time,type:'hit',ev,key,hit});
 }
 // At the same instant an earlier cast finishes (last hit, end) before the next cast starts.
 const priority={start:0,hit:1,end:2};actions.sort((a,b)=>a.time-b.time||a.key-b.key||priority[a.type]-priority[b.type]);
 const self={};
 // Effect times keep engine precision so a hit at the same instant is judged against the true value.
 function apply(bag,s,ef,t,confirmed=true,target=null){const d=A.duration(s,ef),entry={source:s.id,effect:ef,appliedAt:exact(t),duration:d.value,expiresAt:d.value===null?null:exact(t+d.value),confirmed,target,wave:wave+1};(bag[ef]??=[]).push(entry);result.effectApplications.push(entry);}
 function applySelf(s,t,application){for(const ef of s.buffs||[]){const scope=s.effectScopes?.find(x=>x.effect===ef)?.scope;if(scope&&scope!=='self'&&scope!=='self-and-allies')continue;if(A.duration(s,ef).application===application)apply(self,s,ef,t);}}
 let mobs=initial(profile),player={x:0,y:0},dash=null,time=0,ai=0,wave=0,exposure=0,nearSeconds=0,peak=0,frameTime=0;
 function move(dt,next){if(dash){const p=Math.min(1,(next-dash.start)/(dash.end-dash.start));player={x:dash.from.x+(dash.to.x-dash.from.x)*p,y:dash.from.y+(dash.to.y-dash.from.y)*p};if(p>=1)dash=null;}for(const m of mobs){const d=dist(m,player),stop=.8+(m.id%3)*.18;if(d<=1.8)m.active=true;if(m.active&&d>stop){const step=Math.min(d-stop,.9*dt);m.x+=(player.x-m.x)*step/d;m.y+=(player.y-m.y)*step/d;}}
 const close=mobs.filter(m=>dist(m,player)<1.6).length;exposure+=close*dt;nearSeconds+=close>0?dt:0;peak=Math.max(peak,close);}
 while(time<schedule.horizon-1e-7){
  const next=Math.min(schedule.horizon,time+.05,actions[ai]?.time??Infinity,(wave+1)*20);move(Math.max(0,next-time),next);time=next;
  // Repeated test waves have no simulated HP/deaths. Never label these resets as observed respawn.
  if(time>0&&time>=((wave+1)*20)-1e-7&&time<schedule.horizon-1e-7){wave++;mobs=initial(profile);player={x:0,y:0};dash=null;}
  while(ai<actions.length&&actions[ai].time<=time+1e-7){const a=actions[ai++],s=byId[a.ev.id],row=rowById[s.id],g=row.geometry;
   if(a.type==='start'){const target=[...mobs].sort((a,b)=>dist(a,player)-dist(b,player)||a.id-b.id)[0];casts.set(a.key,{targetId:target?.id,angle:Math.atan2((target?.y||0)-player.y,(target?.x||0)-player.x),targets:new Set(),wave});applySelf(s,time,'start');if(g.dash&&target&&dist(target,player)<=g.range){const first=H.schedule(s,a.ev,schedule.horizon).hits[0];if(first&&first.time>time)dash={start:time,end:first.time,from:{...player},to:{x:target.x,y:target.y}};}}
   if(a.type==='hit'){const cast=casts.get(a.key);
    // Test waves reset every 20 s; a cast that straddles the reset aims at the new wave instead of hitting nothing.
    if(cast.wave!==wave){const t=[...mobs].sort((a,b)=>dist(a,player)-dist(b,player)||a.id-b.id)[0];Object.assign(cast,{wave,targetId:t?.id,angle:Math.atan2((t?.y||0)-player.y,(t?.x||0)-player.x)});}
    const target=mobs.find(m=>m.id===cast.targetId),hitTargets=pickTargets(g,mobs,target,cast.angle,player);row.hitChecks++;row.targetHits+=hitTargets.length;if(!hitTargets.length)row.whiffs++;
    if(hitTargets.length)landed.push(a.hit);const coeff=coefficient(s,a.hit.hitIndex);
    for(const [n,m] of hitTargets.entries()){
     // Check conditions against the same enemy BEFORE applying this skill's output. Self conditions count once per hit.
     for(const condition of s.conditions||[]){if(condition.scope==='self'&&n>0)continue;const state=conditionState(s,a.ev,condition,condition.scope==='self'?self:m.effects,time);if(state.reason==='not-applied'&&condition.scope==='enemy'&&result.effectApplications.some(e=>e.wave===wave+1&&e.effect===condition.effect&&e.target!==null&&e.target!==m.id+1))state.reason='other-target';result.conditions.push({time:exact(time),id:s.id,target:m.id+1,wave:wave+1,scope:condition.scope,effect:condition.effect,result:condition.result,...state});}
     m.active=true;m.touched=true;m.hitAt=time;cast.targets.add(wave+':'+m.id);unique.add(wave+':'+m.id);if(coeff!==null)row.coefficient+=coeff;
     // End-applied enemy effects are written below; earlier hits do not get a free debuff window.
    }
    result.impacts.push({time:exact(time),id:s.id,wave:wave+1,kind:g.kind,geometry:g,angle:cast.angle,origin:{...player},center:g.kind==='target'&&target?{x:target.x,y:target.y}:{...player},targets:hitTargets.map(m=>m.id),positions:hitTargets.map(m=>({x:m.x,y:m.y}))});
   }
   if(a.type==='end'){const cast=casts.get(a.key);if(!cast)continue;row.targets+=cast.targets.size;if(cast.targets.size)row.hitCasts++;applySelf(s,time,'end');for(const ef of s.debuffs||[]){for(const m of mobs){if(cast.targets.has(wave+':'+m.id))apply(m.effects,s,ef,time,true,m.id+1);else if(cast.wave===wave&&row.unknown.some(x=>['공격 형상','사거리','지속 타격 시점'].includes(x)))apply(m.effects,s,ef,time,false,m.id+1);}}}
  }
  if(time>=frameTime-1e-7||time===schedule.horizon){result.frames.push({time:round(time),wave,player:{x:round(player.x),y:round(player.y)},near:mobs.filter(m=>dist(m,player)<1.6).length,mobs:mobs.map(m=>({id:m.id,x:round(m.x),y:round(m.y),active:m.active,touched:m.touched,hitAt:m.hitAt,effects:Object.keys(m.effects).filter(e=>effectState(m.effects,e,time).status==='yes')}))});frameTime+=.1;}
 }
 for(const row of rows){row.unknown=[...new Set(row.unknown)];row.coefficient=round(row.coefficient);row.conditions=result.conditions.filter(c=>c.id===row.id);if(row.unknown.length)result.excluded.push(row.name+' · '+row.unknown.join(', '));}
 const known=rows.filter(r=>!r.unknown.includes('공격 형상')&&!r.unknown.includes('지속 타격 시점')&&r.geometry.kind!=='support'),nchecks=known.reduce((n,r)=>n+r.hitChecks,0),nhits=known.reduce((n,r)=>n+r.targetHits,0),whiffs=known.reduce((n,r)=>n+r.whiffs,0);
 result.metrics={unique:unique.size,opportunities:Math.ceil(schedule.horizon/20)*12,coverage:round(100*unique.size/(Math.ceil(schedule.horizon/20)*12)),perHit:nchecks?round(nhits/nchecks):null,whiff:nchecks?round(100*whiffs/nchecks):null,exposure:round(exposure/schedule.horizon),nearSeconds:round(nearSeconds),peak,coefficient:round(rows.reduce((n,r)=>n+r.coefficient,0)),conditionPass:result.conditions.filter(c=>c.status==='yes').length,conditionFail:result.conditions.filter(c=>c.status==='no').length,conditionUnknown:result.conditions.filter(c=>c.status==='unknown').length};
 if(schedule.active.includes('연타'))result.rage=H.rage(landed,schedule.horizon);
 result.issues=[...schedule.warnings];return result;
}
const api={model:MODEL,profiles:PROFILES,geometry,pickTargets,initial,coefficient,effectState,conditionState,run};if(typeof module!=='undefined')module.exports=api;else root.DosulSimulation=api;
})(typeof window==='undefined'?globalThis:window);
