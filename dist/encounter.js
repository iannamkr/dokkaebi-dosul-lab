(function(root){
'use strict';
const S=typeof module!=='undefined'?require('./simulation.js'):root.DosulSimulation;
const H=typeof module!=='undefined'?require('./hit-timing.js'):root.DosulHits;
const A=typeof module!=='undefined'?require('./timing-auto.js'):root.DosulAuto;
const F=typeof module!=='undefined'?require('./shinsik.js'):root.DosulShinsik;
const C=typeof module!=='undefined'?require('./combat.js'):root.DosulCombat;
const model='encounter-coupled-v2',defaults={playerSpeed:3,monsterSpeed:1.5,respawn:8,homeRadius:10,leash:20,attackRange:1.6,retreatDistance:2,spacing:.45,persistentDuration:8,step:.2};
const evidence={source:'화면 녹화 중 2026-10-18 155256.mp4',duration:123.466633,review:'2초 간격 전체, 26–34초 0.5초 간격 추가 확인',observations:[{interval:[28,30],finding:'캐릭터와 지형이 거의 정지한 동안 뒤쪽 3마리가 대각선 대열로 접근; 순간 집결 아님'},{interval:[30,34],finding:'근접 무리와 외곽 추적 몹이 공존; 소용돌이는 설치 위치에 남음'},{interval:[72,94],finding:'이동 후 군집이 늘어졌다가 다시 수렴; 외곽 몹 전부가 동시에 참여하지 않음'}],uncertain:['정확한 m/s·이동 충돌 반경·장판 틱 간격·리젠 시간','화면 밖 이동과 사망 구분','근처 다른 캐릭터와 일부 효과의 소유자'],applied:['개별 추적','밀집 시 간격 유지','지면 장판 위치 고정','군집 반경·밀집 비율 계측']};
evidence.speedEstimate={metresPerSecond:1.5,observedSampleRange:[1.21,1.50],sensitivity:[.9,2],effectivePixelsPerMetre:56.45,samples:3,interval:[28,30],basis:'대상 거리 정수 표기 + 수동 발 위치 · 비경 사마귀 마인의 해당 장면 유효속도, 투영/감속 오차 포함',record:'evidence/movement-155256.json'};
const sensitivity=[{name:'추적 느림',scenario:{monsterSpeed:.9}},{name:'추적 빠름',scenario:{monsterSpeed:2}},{name:'리젠 빠름 가정',scenario:{respawn:4}},{name:'리젠 느림 가정',scenario:{respawn:12}}];
const limitations=['지속 장판은 실험상 8초에 자료의 타격 수를 분배: 영상 26–34초의 잔존을 참고한 가정, 실측 틱 아님','몹 추적 1.5m/s는 28–30초 3표본 투영 근사; 플레이어 속도·리젠·복귀 반경은 실험 가정','실제 적중의 절명 형상·궁극기 쿨 감소를 다음 시전에 연결; 사거리 밖 사거리 밖에서는 접근 후 시전하는 우선순위 AI 가정','평타·회피·기동 가속 미반영 · 처치 자원 반영 · 피격/귀보는 관측 이벤트 제공 필요','피해 보정 0.14는 기존 모델 값: 이동 비용과 중복될 수 있어 새 모델 실측 보정 필요','회복·보호막은 실제 적중 조건을 쓰지만 평균 피격량 기준, 과잉 회복·HP 사망 판정 제외'];
const round=n=>Math.round(n*100)/100,dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function movement(s){
 if(s.simulationMovement)return {...s.simulationMovement,basis:s.simulationMovement.basis||'사용자 지정 비교 가정'};
 const text=[s.notes,s.referenceDetail?.description,s.targetAudit?.previous?.note].filter(Boolean).join(' ');
 let kind=s.simulationGeometry?.dash||/돌진|도약 접근/.test(text)?'dash':/후방 이동/.test(text)?'retreat':/순간이동/.test(text)?'teleport':null;
 return {kind,basis:kind?'도술 설명의 이동 유형 · 이동거리/시점은 비교 가정':'이동 근거 없음 · 자동 이동 미적용'};
}
function run(data,ids,profile,horizon,options={}){
 const out=S.run(data,ids,profile,horizon);if(out.issues.length&&out.schedule.missing.length)return out;
 const cfg={...defaults,...options.scenario},attack=Number(options.attack)||0,hp=Number(options.hp)||45000,rate=options.damageRate??.14;
 for(const [k,v] of Object.entries(cfg))if(!Number.isFinite(v)||v<0||(['step','respawn','leash','homeRadius'].includes(k)&&v===0))throw Error('Invalid encounter setting: '+k);
 const experimental=data.skills.map(s=>s.hitTiming?.kind==='persistent'&&s.aim?.mode==='지면 지정'&&!s.hitTiming?.offsets?{...s,hitTiming:{...s.hitTiming,offsets:Array.from({length:(s.referenceNumbers?.dc||[]).reduce((n,d)=>n+d.hits,0)},(_,i)=>.5+i*Math.max(0,cfg.persistentDuration-.5)/Math.max(1,(s.referenceNumbers?.dc||[]).reduce((n,d)=>n+d.hits,0)-1)),confidence:'video-informed-assumption'}}:s);
 const by=Object.fromEntries(experimental.map(s=>[s.id,s])),geo=Object.fromEntries(ids.map(id=>[id,S.geometry(by[id])])),motion=Object.fromEntries(ids.map(id=>[id,movement(by[id])])),initialSchedule=out.schedule;let schedule=initialSchedule;
 // Zone coordinates are translated to a local arena around a fixed spawn, never chosen for a particular build.
 const points=options.points?.length?options.points:[{x:1.5,y:0},...Array.from({length:11},(_,i)=>({x:Math.cos(i*2*Math.PI/11)*(5+i%3),y:Math.sin(i*2*Math.PI/11)*(5+i%3)}))];
 const mobs=points.map((p,id)=>({id,x:p.x,y:p.y,home:{x:p.x,y:p.y},hp:p.hp||hp,maxHp:p.hp||hp,active:false,effects:{},generation:0,respawnAt:Infinity,firstHit:null,beneficialBuffs:(p.beneficialBuffs||[]).map(b=>({...b}))}));
 out.impacts=[];out.conditions=[];out.effectApplications=[];out.frames=[];out.rage=null;
 for(const r of out.rows){r.casts=0;r.hitCasts=0;r.targets=0;r.hitChecks=0;r.targetHits=0;r.whiffs=0;r.coefficient=0;r.conditions=[];}
 const rows=Object.fromEntries(out.rows.map(r=>[r.id,r])),actions=[],casts=new Map(),self={},landed=[];let fx=F.prepare(out,data.shinsikEffects!==false),confirmHit=null,notifyCombat=null;fx.rage={points:[]};
 let serial=0;function enqueue(ev){const key=serial++;actions.push({time:ev.start,type:'start',ev,key},{time:ev.end,type:'end',ev,key});for(const hit of H.schedule(by[ev.id],ev,horizon).hits)actions.push({time:hit.time,type:'hit',ev,key,hit});}
 function sortActions(){actions.sort((a,b)=>a.time-b.time||a.key-b.key||({start:0,hit:1,end:2}[a.type]-{start:0,hit:1,end:2}[b.type]));}
 if(options.coupled===false){for(const ev of schedule.events)enqueue(ev);sortActions();}
 let player={x:0,y:0},time=0,ai=0,busyUntil=0,dash=null,exposure=0,engagedTime=0,walk=0,travel=0,returns=0,returning=false,kills=0,respawns=0,pulled=0,overkill=0,dealt=0,checks=0,hitCount=0,ttk=0,whiffs=0;
 let spreadTime=0,clusterSeconds=0,compactTime=0,maxTrail=0;
 const events=[],living=()=>mobs.filter(m=>m.hp>0),nearest=()=>living().sort((a,b)=>Number(b.active)-Number(a.active)||dist(a,player)-dist(b,player)||a.id-b.id)[0];
 function separation(){const live=living().filter(m=>m.active);for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){const a=live[i],b=live[j],d=dist(a,b);if(d<cfg.spacing){const angle=d>1e-7?Math.atan2(b.y-a.y,b.x-a.x):(a.id+1)*2.39996,step=(cfg.spacing-d)*.25;a.x-=Math.cos(angle)*step;a.y-=Math.sin(angle)*step;b.x+=Math.cos(angle)*step;b.y+=Math.sin(angle)*step;}}}
 function translate(p,to,max){const d=dist(p,to),v=Math.min(d,max);if(d>0){p.x+=(to.x-p.x)*v/d;p.y+=(to.y-p.y)*v/d;}return v;}
 function apply(bag,s,effect,t,target=null){const d=A.duration(s,effect),e={source:s.id,effect,appliedAt:t,duration:d.value,expiresAt:d.value===null?null:t+d.value,confirmed:true,target,wave:1};(bag[effect]??=[]).push(e);out.effectApplications.push(e);}
 function applySelf(s,t,when){for(const ef of s.buffs||[]){const scope=s.effectScopes?.find(x=>x.effect===ef)?.scope;if(scope&&scope!=='self'&&scope!=='self-and-allies')continue;if(A.duration(s,ef).application===when)apply(self,s,ef,t);}}
 function advanceWorld(until){while(time<until-1e-7||actions[ai]?.time<=until&&actions[ai]?.time<=time+1e-7){
  const next=Math.min(until,time+cfg.step,actions[ai]?.time??Infinity),dt=Math.max(0,next-time);
  exposure+=living().filter(m=>m.active&&dist(m,player)<=cfg.attackRange).length*dt;engagedTime+=living().filter(m=>m.active).length*dt;
  if(options.movement!==false){
   if(dash){const p=Math.min(1,(next-dash.start)/Math.max(.001,dash.end-dash.start)),to={x:dash.from.x+(dash.to.x-dash.from.x)*p,y:dash.from.y+(dash.to.y-dash.from.y)*p};travel+=dist(player,to);player=to;if(p>=1)dash=null;}
   else if(time>=busyUntil-1e-7){if(dist(player,{x:0,y:0})>cfg.homeRadius&&!returning){returning=true;returns++;}const target=returning?{x:0,y:0}:nearest();if(target){const d=dist(player,target),step=returning?cfg.playerSpeed*dt:Math.min(cfg.playerSpeed*dt,Math.max(0,d-1));walk+=translate(player,target,step);if(returning&&dist(player,target)<.1)returning=false;}}
  }
  for(const m of mobs){if(m.hp<=0){if(next>=m.respawnAt){Object.assign(m,{x:m.home.x,y:m.home.y,hp:m.maxHp,active:false,effects:{},blueChainStacks:0,blueChainUntil:0,rootUntil:0,blueChainPct:0,illusions:0,illusionTriggered:false,firstHit:null,respawnAt:Infinity});m.generation++;respawns++;}continue;}
   if(m.active&&dist(m,m.home)>cfg.leash){m.active=false;m.hp=m.maxHp;m.effects={};m.firstHit=null;events.push({type:'leash',time:round(next),target:m.id});}
   const target=m.active?player:m.home,stop=m.active?.8+(m.id%3)*.15:0;if(!(time<(m.rootUntil||0)))translate(m,target,Math.min(cfg.monsterSpeed*dt,Math.max(0,dist(m,target)-stop)));
  }
  separation();const cluster=living().filter(m=>m.active);if(cluster.length){const x=cluster.reduce((n,m)=>n+m.x,0)/cluster.length,y=cluster.reduce((n,m)=>n+m.y,0)/cluster.length;spreadTime+=Math.sqrt(cluster.reduce((n,m)=>n+(m.x-x)**2+(m.y-y)**2,0)/cluster.length)*dt;clusterSeconds+=dt;compactTime+=cluster.filter(m=>dist(m,player)<=2).length/cluster.length*dt;maxTrail=Math.max(maxTrail,...cluster.map(m=>dist(m,player)));}
  time=next;
  while(ai<actions.length&&actions[ai].time<=time+1e-7){const a=actions[ai++],s=by[a.ev.id],g=geo[s.id],row=rows[s.id];
   if(a.type==='start'){const target=nearest();row.casts++;busyUntil=a.ev.end;const cast={targetId:target?.id,generation:target?.generation,angle:target?Math.atan2(target.y-player.y,target.x-player.x):0,targets:new Map(),origin:{...player},ground:s.aim?.mode==='지면 지정'&&target?{x:target.x,y:target.y}:null,groundValid:!!target&&g.range!==null&&dist(player,target)<=g.range};casts.set(a.key,cast);applySelf(s,time,'start');
    const m=motion[s.id],first=H.schedule(s,a.ev,horizon).hits[0];if(options.movement!==false&&m.kind&&target&&g.range!==null&&dist(player,target)<=g.range&&first){let to={x:target.x,y:target.y};if(m.kind==='retreat'){const d=Math.max(.001,dist(player,target));to={x:player.x+(player.x-target.x)/d*(m.distance??cfg.retreatDistance),y:player.y+(player.y-target.y)/d*(m.distance??cfg.retreatDistance)};}else{const delta=dist(player,target);if(delta>0){to.x-=(target.x-player.x)/delta*.8;to.y-=(target.y-player.y)/delta*.8;}}
     if(m.kind==='teleport'||first.time<=time){travel+=dist(player,to);player=to;}else dash={start:time,end:first.time,from:{...player},to};events.push({type:'skill-move',id:s.id,time:round(time),kind:m.kind});}
   }
   if(a.type==='hit'){const cast=casts.get(a.key),target=mobs.find(m=>m.id===cast?.targetId&&m.generation===cast.generation&&m.hp>0),targets=cast?.ground?(cast.groundValid?living().filter(m=>dist(m,cast.ground)<=g.radius).sort((a,b)=>dist(a,cast.ground)-dist(b,cast.ground)||a.id-b.id).slice(0,g.cap):[]):S.pickTargets(g,living(),target,cast?.angle||0,player),coef=S.coefficient(s,a.hit.hitIndex);checks++;hitCount+=targets.length;row.hitChecks++;row.targetHits+=targets.length;if(!targets.length){whiffs++;row.whiffs++;}
    for(const [n,m] of targets.entries()){for(const c of s.conditions||[]){if(c.scope==='self'&&n>0)continue;out.conditions.push({time,id:s.id,target:m.id+1,wave:1,scope:c.scope,effect:c.effect,result:c.result,...S.conditionState(s,a.ev,c,c.scope==='self'?self:m.effects,time)});}
     if(!m.active){pulled++;m.active=true;}if(m.firstHit===null)m.firstHit=time;cast.targets.set(m.id,m.generation);if(coef!==null){row.coefficient+=coef;const damage=attack*rate*coef/100*(1+F.bonus(fx,s,a.ev,time))*(1+(time<(m.blueChainUntil||0)?m.blueChainPct||0:0));dealt+=Math.min(m.hp,damage);overkill+=Math.max(0,damage-m.hp);m.hp-=damage;if(m.hp<=0){notifyCombat?.('kill',time);kills++;ttk+=time-m.firstHit;m.active=false;m.respawnAt=time+cfg.respawn;events.push({type:'kill',time:round(time),id:s.id,target:m.id});}}}
    for(const m of targets)if(m.hp>0)notifyCombat?.('skill-hit',time,{target:m,skill:s,event:a.ev});
    if(cast?.ground&&time>a.ev.end)for(const ef of s.debuffs||[])for(const m of targets)if(m.hp>0)apply(m.effects,s,ef,time,m.id+1);
    out.impacts.push({ground:cast?.ground?{...cast.ground}:null,time,id:s.id,castCycle:a.ev.cycle,hitIndex:a.hit.hitIndex,wave:1,kind:g.kind,geometry:g,targets:targets.map(m=>m.id),origin:{...player},positions:targets.map(m=>({x:m.x,y:m.y}))});
    if(targets.length){confirmHit?.(a.ev,time);landed.push(a.hit);const prev=fx.rage.points.at(-1);fx.rage.points.push({time,stacks:Math.min(50,prev&&time-prev.time<3?prev.stacks+1:1)});}
   }
   if(a.type==='end'){const cast=casts.get(a.key);if(!cast)continue;row.targets+=cast.targets.size;if(cast.targets.size)row.hitCasts++;applySelf(s,time,'end');for(const ef of s.debuffs||[])for(const m of mobs)if(m.hp>0&&cast.targets.get(m.id)===m.generation)apply(m.effects,s,ef,time,m.id+1);}
  }
 }
 }
 if(options.coupled===false)advanceWorld(horizon);
 else {
  schedule=C.run(data,ids,horizon,data.shinsikTiming!==false,{
   init(live,hit,notify){notifyCombat=notify;schedule=live;out.schedule=live;fx=F.prepare(out,data.shinsikEffects!==false);fx.rage={points:[]};confirmHit=hit;},
   start(ev){if(ai){actions.splice(0,ai);ai=0;}enqueue(ev);sortActions();},
   advance:advanceWorld,
   available(skills,charges){if(options.approach===false)return charges;const target=nearest();return Object.fromEntries(skills.map(s=>{const g=geo[s.id],support=s.damage===false||s.referenceNumbers?.nd||g.kind==='support',inRange=!!target&&(g.range===null||dist(player,target)<=g.range+1e-7);return [s.id,support||inRange?charges[s.id]:0];}));},
   next(now){return Math.min(options.approach===false?Infinity:now+cfg.step,actions.slice(ai).find(a=>a.time>now+1e-7)?.time??Infinity);}
  });
  out.schedule=schedule;
 }
 if(schedule.active.includes('연타')){out.rage=H.rage(landed,horizon);schedule.rage=out.rage;
  if(options.coupled!==false){schedule.windows=schedule.windows.filter(w=>w.family!=='연타'&&w.name!=='격노').concat(out.rage.windows);schedule.procs=schedule.procs.filter(p=>p.family!=='연타');for(const p of out.rage.points)schedule.procs.push({family:'연타',name:'격노 '+p.stacks+'중첩',time:p.time,description:'실제 공간 적중',changes:[]});schedule.procs.sort((a,b)=>a.time-b.time);for(const g of schedule.gauges){const p=out.rage.points.filter(p=>p.time<=g.time).at(-1);g.values.연타=p&&g.time-p.time<3?p.stacks:0;}}
 }
 if(options.coupled!==false){schedule.plannedHits=schedule.hits;schedule.hits=landed;}
 schedule.hitFeedback=options.coupled===false?'planned':'actual-first-hit';
 out.metrics={...out.metrics,coefficient:round(out.rows.reduce((n,r)=>n+r.coefficient,0)),perHit:checks?round(hitCount/checks):0,whiff:checks?round(100*whiffs/checks):0,exposure:round(exposure/horizon)};
 out.encounter={model,coupled:options.coupled!==false,experimental:true,evidence,clusterRadiusMean:clusterSeconds?round(spreadTime/clusterSeconds):0,compactPct:clusterSeconds?round(100*compactTime/clusterSeconds):0,maxTrail:round(maxTrail),assumptions:cfg,limitations,movement:ids.map(id=>({id,...motion[id]})),kills,killsPerMin:round(kills*60/horizon),attackers:round(exposure/horizon),engaged:round(engagedTime/horizon),pulledPerMin:round(pulled*60/horizon),monsterHp:hp,respawns,overkill:round(overkill),damage:round(dealt),overkillPct:dealt+overkill?round(100*overkill/(dealt+overkill)):0,meanTimeToKill:kills?round(ttk/kills):null,walkMetres:round(walk),skillMoveMetres:round(travel),returns,whiffPct:out.metrics.whiff,targetsPerHit:out.metrics.perHit,events:options.trace?events:undefined};
 out.model=model;return out;
}
const api={run,movement,model,defaults,limitations,evidence,sensitivity};if(typeof module!=='undefined')module.exports=api;else root.DosulEncounter=api;
})(typeof window==='undefined'?globalThis:window);
