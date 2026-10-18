(function(root){
'use strict';
const N=typeof module!=='undefined'?require('./numbers.js'):root.DosulNumbers;
const A=typeof module!=='undefined'?require('./timing-auto.js'):root.DosulAuto,Q=typeof module!=='undefined'?require('./sequence.js'):root.DosulSequence,round=n=>Math.round(n*1e6)/1e6,EPS=1e-7;
const RULES={
 절명:{slug:'jeolmyeong',name:'검의 형상',note:'첫 적중으로 형상 획득 · 최대치 추가 획득 시 절명 궁극기 6초 감소'},
 연타:{slug:'yeonta',name:'격노',note:'적중마다 중첩 · 마지막 적중 3초 후 소멸 · 시간 변화 없음'},
 강타:{slug:'gangta',name:'강압',note:'영력 100에서 궁극기 사용 → 일반 도술 초기화 · 10초 차지 생략'},
 척살:{slug:'cheoksal',name:'척살 태세·척결',note:'도술 사용으로 영력 축적 · 태세/척결 유지 · 시간 변화 없음'},
 저격:{slug:'jeogyeok',name:'조준',note:'시간 경과로 화살촉 획득 · 저격 시 소비 · 시간 변화 없음'},
 주술:{slug:'jusul',name:'구슬',note:'주술 사용 시 구슬별 모든 일반 도술 0.3/0.6/0.9초 감소 (다른 계열 포함 · 게임에서 동작 확인)'},
 파멸:{slug:'pamyeol',name:'요기범람',note:'영력 200 → 일반 도술 초기화 · 20초 시전 준비 속도 +50%'},
 강인:{slug:'gangin',name:'강건',note:'영력 100에서 강인 사용 → 10초 강화 · 피격 획득 제외'},
 기동:{slug:'gidong',name:'연쇄',note:'영력 200 → 기동 궁극기 초기화 · 시전 가속 수치 미확인'},
 헌신:{slug:'heonsin',name:'하트 소비',note:'하트 3개에서 헌신 사용 → 강화 발동 · 시간 변화 없음'},
 기만:{slug:'giman',name:'눈물 소비',note:'눈물 2개에서 일반 도술 사용 → 해당 도술 쿨타임 50%'},
 제압:{slug:'jeap',name:'자물쇠',note:'자물쇠 수에 따라 궁극기 쿨타임 3/6/9초 감소'}
};
function active(data,ids){const counts=Q.baseCounts(data,ids);return Object.keys(RULES).filter(f=>counts[f]>=3);}
function hits(s){if(s.damage===false||s.referenceNumbers?.nd)return 0;const dc=s.referenceNumbers?.dc||[];if(!dc.length)return 1;return s.referenceNumbers.cm?dc.at(-1).hits||1:dc.reduce((n,d)=>n+(d.hits||0),0)||1;}
const Policy=typeof module!=='undefined'?require('./execution-policy.js'):root.DosulExecutionPolicy;
function run(data,ids,horizon=60,enabled=true,runtime=null){
 horizon=Math.max(20,Math.min(180,Number(horizon)||60));const skills=ids.map(id=>data.skills.find(s=>s.id===id)),unlocked=active(data,ids),families=enabled?unlocked:[],has=f=>families.includes(f),events=[],idle=[],procs=[],gauges=[],windows=[],missing=[],warnings=[];
 for(const s of skills){if(!s){missing.push('알 수 없는 도술');continue;}if(!A.motion(s))missing.push(s.name+' 모션 시간');if(!(typeof s.basic?.cooldown==='number'&&s.basic.cooldown>=0))missing.push(s.name+' 재사용 대기시간');}
 if(new Set(ids).size!==ids.length)missing.push('중복 도술');
 const policy=Policy?Policy.prepare(data.executionPolicy,ids,horizon):null;
 if(policy)missing.push(...policy.errors);else if(data.executionPolicy)missing.push('실행 정책 모듈을 불러오지 못했습니다.');
 const result={executionPolicy:policy?.summary||null,policyDecisions:policy?.decisions||[],ids,horizon,total:horizon,events,idle,procs,gauges,windows,missing,warnings,active:families,unlocked,enabled,busy:0,wait:0,casts:0,cycles:[]};
 if(missing.length||!ids.length){result.total=null;return result;}
 // Source values are not a certification of execution semantics or video agreement.
 const verificationIssues=[];
 if(has('절명'))verificationIssues.push('절명: 도술당 첫 적중 1회 획득은 모델 가정입니다. 원문의 적중 판정 단위는 미확정입니다.');
 if(has('기동'))verificationIssues.push('기동: 원문에 연쇄 시전속도 증가 배율이 없으므로 미반영입니다.');
 if(has('파멸'))verificationIssues.push('파멸: 상세 설명의 시전당 25를 사용합니다. 요약의 15와 상충하므로 인게임 확정값으로 표시하지 않습니다.');
 for(const s of skills)if(/재사용.{0,8}(가능|할 수)/.test([s.notes,s.referenceDetail?.description].filter(Boolean).join(' ')))verificationIssues.push(s.name+(s.usage?.recasts?': 재사용별 시전·영력·타격 분리 반영. 재사용 유효기간·중단 규칙 및 실제 입력 간격은 미반영입니다.':': 재사용 동작별 시전·영력 획득·타격 분리가 검증되지 않았습니다.'));
 result.verification={status:'unvalidated',issues:verificationIssues,source:'https://kkaebigg.com/skills/',policy:'출처 수치를 사용하되 미확정 규칙은 영상 검증 통과로 취급하지 않음'};
 warnings.push(...verificationIssues);
 if(!runtime&&has('절명'))warnings.push('절명 신식은 공격 도술이 적중한다고 가정하여 계산합니다. 비공격 도술은 형상을 얻지 않으며, 빗나감·실제 적중 시각에 따른 차이는 미반영입니다.');
  if(has('파멸'))warnings.push('파멸 영력은 상세 자료의 사용당 25를 적용합니다. 요약의 15와 상충하며 발동 시간은 참고값입니다.');
 if(has('기동'))warnings.push('기동 연쇄의 시전 가속 수치는 자료가 없어 제외했습니다. 궁극기 초기화는 반영합니다.');
 if(has('주술'))warnings.push('주술 구슬은 다른 계열을 포함한 모든 일반 도술의 대기시간을 줄입니다(2026-10-18 게임에서 동작 확인).');
 if(has('강타'))warnings.push('강타 영력은 상세 설명의 사용당 10을 적용합니다. 같은 자료의 요약에는 5로 적혀 있어 강압 발동 시점은 참고값입니다. 차지 생략 후에도 준비·공격 모션은 남습니다.');
 const capacity=Object.fromEntries(skills.map(s=>[s.id,Math.max(1,s.usage?.charges||1)])),charges={...capacity},ready=Object.fromEntries(ids.map(id=>[id,Infinity])),last={},uses=Object.fromEntries(ids.map(id=>[id,0])),recasts=Object.fromEntries(ids.map(id=>[id,0]));
 let now=0,clock=0,guard=0,pam=0,yogi=0,smash=0,pressure=0,dash=0,chain=0,tears=0,locks=0,forms=0,hex=0,snipe=0,arrows=0,hearts=0,armor=0,sturdy=0,exec=0,execStacks=0,execUntil=0,rage=0,rageUntil=0;
 const proc=(family,name,time,description,changes=[],trigger=null)=>{procs.push({family,name,time:round(time),description,changes,...(trigger?{trigger}:{})});};
 const windowOf=(family,name,start,duration)=>{const w={family,name,start:round(start),end:round(start+duration)};windows.push(w);return w;};
 const change=(time,predicate,operation,reset=false)=>{const changes=[];for(const s of skills){if(!predicate(s)||!Number.isFinite(ready[s.id])||ready[s.id]<=time+EPS)continue;const before=ready[s.id],after=Math.max(time,operation(before,s));if(after>=before-EPS)continue;if(after<=time+EPS){charges[s.id]=reset?capacity[s.id]:Math.min(capacity[s.id],charges[s.id]+1);ready[s.id]=charges[s.id]>=capacity[s.id]?Infinity:round(time+N.cooldown(s));}else ready[s.id]=round(after);for(const ev of events)if(ev.id===s.id&&ev.cooldownEnd>time)ev.cooldownEnd=round(after);changes.push({id:s.id,before:round(before),after:round(after)});}return changes;};
 function advanceClock(time){
  for(const s of skills){while(Number.isFinite(ready[s.id])&&ready[s.id]<=time+EPS&&charges[s.id]<capacity[s.id]){charges[s.id]++;ready[s.id]=charges[s.id]>=capacity[s.id]?Infinity:round(ready[s.id]+N.cooldown(s));}}

  const dt=Math.max(0,time-clock);if(has('주술'))hex=Math.max(0,hex-5*dt);
  if(has('저격')){snipe+=25*dt;while(snipe>=100&&arrows<3){snipe-=100;arrows++;}snipe=Math.min(100,snipe);}
  if(pressure&&time>=pressure-EPS){pressure=0;smash=0;}
  if(sturdy&&time>=sturdy-EPS){sturdy=0;armor=0;}
  if(time>=execUntil)execStacks=0;clock=time;
 }
 const external=(data.combatEvents||[]).map(e=>({...e})).sort((a,b)=>a.time-b.time);let externalIndex=0,nextIncoming=0;
 const eventRules=data.shinsikEventRules||{};
 function applyCombatEvent(type,time,payload={}){ advanceClock(time);
  if(type==='skill-hit'&&payload.target&&payload.skill){
   const {target,skill,event}=payload;
   if(has('기만')&&skill.family==='기만'&&!skill.ultimate){const r=eventRules['기만'];if(r){target.illusions=Math.min(r.illusionCap,(target.illusions||0)+1);if(target.illusions===r.illusionCap&&!target.illusionTriggered){const index=(target.beneficialBuffs||[]).findIndex(b=>b.name!=='호법'&&!b.protected);if(index>=0){target.beneficialBuffs.splice(index,1);proc('기만','허상 버프 제거',time,'실제 대상의 제거 가능한 이로운 효과 1개');}target.illusionTriggered=true;}}}
   if(has('제압')&&skill.ultimate&&(event?.resources?.locks||0)>0){const r=eventRules['제압'];if(r){target.blueChainStacks=Math.min(r.ampCap,(time<(target.blueChainUntil||0)?target.blueChainStacks||0:0)+1);target.blueChainUntil=time+r.ampLife;target.rootUntil=time+r.rootLife;target.blueChainPct=target.blueChainStacks*r.ampPerStack/100;proc('제압','푸른 사슬',time,'대상 '+target.id+' · '+target.blueChainStacks+'중첩');}}
  }
  if(type==='kill'&&has('척살')){const r=eventRules['척살'];if(!r)return;exec+=r.killEnergy;if(exec>=r.maximum){exec%=r.maximum;execStacks=Math.min(r.stackCap,execStacks+1);execUntil=time+r.stackLife;windowOf('척살','척결',time,r.stackLife);proc('척살','척결 '+execStacks+'중첩',time,'실제 처치 영력 획득');}}
  if(type==='incoming-hit'&&has('강인')&&time>=nextIncoming&&!sturdy){const r=eventRules['강인'];if(!r)return;armor=Math.min(r.maximum,armor+r.hitEnergy);nextIncoming=time+r.hitCooldown;proc('강인','피격 영력',time,'실제 피격 +'+r.hitEnergy);}
  if(type==='dodge'){
   if(has('기동')){const r=eventRules['기동'];if(r){dash=Math.min(r.maximum,dash+r.dodgeEnergy);if(dash>=r.maximum){dash=0;chain=time+r.chainLife;const changes=change(time,x=>x.ultimate&&x.family==='기동',()=>time,true);windowOf('기동','연쇄',time,r.chainLife);proc('기동','연쇄 발동',time,'귀보 영력 최대',changes);}}}
   if(has('저격')){const r=eventRules['저격'];if(r){snipe+=r.dodgeEnergy;while(snipe>=r.maximum&&arrows<3){snipe-=r.maximum;arrows++;}snipe=Math.min(r.maximum,snipe);proc('저격','귀보 영력',time,'실제 귀보 +'+r.dodgeEnergy);}}
  }
 }
 function advance(time){while(externalIndex<external.length&&external[externalIndex].time<=time+EPS){const e=external[externalIndex++];if(!Number.isFinite(e.time)||e.time<0)throw Error('전투 이벤트 시각 오류');applyCombatEvent(e.type,e.time,e);}advanceClock(time);}
 function notifyCombat(type,time,payload={}){advance(time);applyCombatEvent(type,time,payload);}
 const confirmedCasts=new Set();
 function confirmHit(ev,time){
  advance(time);if(!has('절명')||ev.ultimate||confirmedCasts.has(ev))return;
  const skill=skills.find(s=>s.id===ev.id);if(skill.ultimate||hits(skill)<=0)return;
  confirmedCasts.add(ev);
  if(forms>=5){const changes=change(time,x=>x.ultimate&&x.family==='절명',t=>t-6);proc('절명','형상 최대치 추가 획득',time,'실제 첫 적중 · 궁극기 대기시간 6초 감소',changes);}
  forms=Math.min(5,forms+1);proc('절명','형상 획득',time,'실제 첫 적중 · 형상 '+forms);
 }
 runtime?.init(result,confirmHit,notifyCombat);
 while(now<horizon-EPS&&guard++<10000){
  runtime?.advance(now);
  advance(now);const usable=Object.fromEntries(ids.map(id=>[id,Math.max(charges[id],recasts[id]>0?1:0)])),available=runtime?.available?runtime.available(skills,usable,now):usable;const slot=policy?policy.choose(skills,available,now):skills.findIndex(s=>available[s.id]>0);
  if(slot<0){const next=Math.min(horizon,external[externalIndex]?.time??Infinity,runtime?.next(now)??Infinity,policy?policy.next(skills,ready,now):Math.min(...Object.values(ready)));if(!(next>now)){missing.push('실행 정책 대기 시간이 진행되지 않습니다.');break;}idle.push({start:now,end:next});result.wait+=next-now;now=next;continue;}
  const s=skills[slot],parts={...A.motion(s)},start=now,modifiers=[],spentArrows=has('저격')&&s.family==='저격'?arrows:0;
  const decision=policy?.record(s.id,start);
  if(spentArrows)arrows=0;
  if(has('파멸')&&start<yogi-EPS)modifiers.push('요기범람 · 도술 피해 +10%');
  if(has('파멸')&&start<yogi-EPS&&parts.prep){parts.prep=round(parts.prep/1.5);modifiers.push('요기범람 · 전개 속도 +50%');}
  if(has('강타')&&start<pressure-EPS&&parts.charge){parts.charge=0;modifiers.push('강압 · 최대 차지 즉시');}
  parts.total=round(parts.prep+parts.charge+parts.action);if(parts.total<=0){missing.push(s.name+' 동작 시간 0');break;}
  let cd=N.cooldown(s);
  if(has('제압')&&s.ultimate&&locks){cd=Math.max(0,cd-3*locks);modifiers.push('자물쇠 · 재사용 '+3*locks+'초 감소');proc('제압','자물쇠 소비',start,locks+'개 기준 궁극기 쿨타임 '+cd+'초');}
  const smashFire=has('강타')&&s.ultimate&&smash>=100&&!pressure,sturdyFire=has('강인')&&s.family==='강인'&&armor>=100&&!sturdy,heartsFire=has('헌신')&&s.family==='헌신'&&hearts>=3;
  const recastCount=s.usage?.recasts||0,isRecast=recasts[s.id]>0,recastStage=isRecast?recastCount-recasts[s.id]+2:1;
  const end=round(start+parts.total),event={policyPhase:decision?.phase||'automatic',hpPercent:decision?.hpPercent??null,id:s.id,slot,cycle:++uses[s.id],start,end,queued:start,wait:0,parts,cooldownEnd:round(start+cd),modifiers,resources:{forms,arrows:spentArrows||arrows,smash,locks,hearts,hex},completed:end<=horizon+EPS};if(recastCount){event.recastStage=recastStage;event.recastTotal=recastCount+1;event.hitIndices=[recastStage];}
  events.push(event);last[s.id]=event;if(isRecast){recasts[s.id]--;}else{recasts[s.id]=recastCount;charges[s.id]--;if(!Number.isFinite(ready[s.id]))ready[s.id]=event.cooldownEnd;}event.cooldownEnd=ready[s.id];
  if(runtime&&has('절명')&&s.ultimate&&forms>=3){proc('절명','검의 형상 소비',start,forms+'개 소비');forms=0;}
  // Source: kkaebigg.com/skills/{pamyeol,gidong}/ — energy is granted on cast,
  // not after the attack animation. Never move this trigger to hit/animation end.
  if(has('파멸')&&start>=yogi-EPS){
   pam=Math.min(200,pam+25);proc('파멸','영력 획득',start,'시전 시 +25 · '+pam+'/200');
   if(pam>=200){pam=0;yogi=start+20;const changes=change(start,x=>!x.ultimate,()=>start,true);windowOf('파멸','요기범람',start,20);proc('파멸','요기범람 발동',start,'일반 도술 초기화 · 20초 시전 준비 속도 +50%',changes,{id:s.id,cycle:event.cycle,phase:'cast'});}
  }
  if(has('기동')){
   dash=Math.min(200,dash+15);proc('기동','영력 획득',start,'시전 시 +15 · '+dash+'/200');
   if(dash>=200){dash=0;chain=start+10;const changes=change(start,x=>x.ultimate&&x.family==='기동',()=>start,true);windowOf('기동','연쇄',start,10);proc('기동','연쇄 발동',start,'기동 궁극기 초기화 · 가속 수치는 미확인',changes,{id:s.id,cycle:event.cycle,phase:'cast'});}
  }
  runtime?.start(event);
  runtime?.advance(Math.min(end,horizon));
  result.busy+=Math.min(end,horizon)-start;now=end;
  if(!event.completed)break;
  result.casts++;advance(end);
  if(smashFire){pressure=end+10;const changes=change(end,x=>!x.ultimate,()=>end,true);windowOf('강타','강압',end,10);proc('강타','강압 발동',end,'일반 도술 초기화 · 10초 차지 생략',changes);}
  if(has('강타')&&!pressure)smash=Math.min(100,smash+10+(s.referenceNumbers?.cm?2*(s.referenceNumbers.dc?.length||0):0));
  if(has('기만')){tears=Math.min(2,tears+1);if(tears>=2&&!s.ultimate){tears=0;const changes=change(end,x=>x.id===s.id,()=>start+cd*.5);event.modifiers.push('기만 · 쿨타임 50%');proc('기만','눈물 소비',end,s.name+' 쿨타임 50%',changes);}}
  if(has('주술')){hex=Math.min(100,hex+10);const orbs=hex>=90?3:hex>=60?2:hex>=30?1:0;if(orbs&&s.family==='주술'){const amount=.3*orbs,changes=change(end,x=>!x.ultimate,t=>t-amount);proc('주술','구슬 '+orbs+'개',end,'일반 도술 대기시간 '+round(amount)+'초 감소 · 버그 무시',changes);}}
  if(!runtime&&has('절명')){if(s.ultimate&&forms>=3){proc('절명','검의 형상 소비',start,forms+'개 소비');forms=0;}else if(!s.ultimate&&hits(s)>0){if(forms>=5){const changes=change(end,x=>x.ultimate&&x.family==='절명',t=>t-6);proc('절명','형상 최대치 추가 획득',end,'절명 궁극기 대기시간 6초 감소',changes);}forms=Math.min(5,forms+1);}}
  if(has('제압')){locks=Math.min(3,locks+1);if(s.ultimate)locks=Math.max(0,locks-1);}
  if(has('척살')){if(s.family==='척살'){windowOf('척살','척살 태세',end,10);proc('척살','척살 태세',end,'10초 강화');}exec+=5;if(exec>=100){exec=0;execStacks=Math.min(10,execStacks+1);execUntil=end+30;windowOf('척살','척결',end,30);proc('척살','척결 '+execStacks+'중첩',end,'30초 유지 · 처치 영력 제외');}}
  if(spentArrows){proc('저격','화살촉 소비',start,spentArrows+'개 소비 · 조준 10초');windowOf('저격','조준',end,10);}
  if(sturdyFire){sturdy=end+10;windowOf('강인','강건',end,10);proc('강인','강건 발동',end,'10초 강화 · 종료 시 영력 초기화');}if(has('강인')&&!sturdy)armor=Math.min(100,armor+10);
  if(heartsFire){hearts=0;proc('헌신','하트 소비',end,'하트 3개 소비 · 헌신 효과 강화');}if(has('헌신'))hearts=Math.min(3,hearts+1);
  gauges.push({time:end,values:{파멸:pam,강타:smash,기동:dash,기만:tears,주술:round(hex),절명:forms,제압:locks,연타:rage,척살:exec,저격:arrows,강인:armor,헌신:hearts}});
 }
 runtime?.advance(horizon);
 const H=typeof module!=='undefined'?require('./hit-timing.js'):root.DosulHits, timeline=H.timeline(data,events,horizon);result.hits=timeline.hits;result.unknownHits=timeline.unknown;
 if(timeline.unknown.length)warnings.push('타격 시점 계산 제외: '+timeline.unknown.join(' / '));
 if(has('연타')){
  result.rage=H.rage(timeline.hits,horizon);
  result.rage.sensitivity=['early','uniform','late'].map(phase=>{const r=H.rage(H.timeline(data,events,horizon,phase).hits,horizon);return {phase,resets:r.resets,uptime:r.uptimePercent,max:r.max,first50:r.first50};});
  windows.push(...result.rage.windows);for(const h of result.rage.points)proc('연타','격노 '+h.stacks+'중첩',h.time,'개별 타격 · 간격 추정 · 대상 1명');for(const g of gauges){const p=result.rage.points.filter(p=>p.time<=g.time).at(-1);g.values.연타=p&&g.time-p.time<3?p.stacks:0;}
 }
 result.busy=round(result.busy);result.wait=round(result.wait);result.procs.sort((a,b)=>a.time-b.time);if(guard>=10000)warnings.push('계산 한도에 도달했습니다.');return result;
}
const api={run,active,rules:RULES};if(typeof module!=='undefined')module.exports=api;else root.DosulCombat=api;
})(typeof window==='undefined'?globalThis:window);
