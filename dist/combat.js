(function(root){
'use strict';
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
function run(data,ids,horizon=60,enabled=true){
 horizon=Math.max(20,Math.min(180,Number(horizon)||60));const skills=ids.map(id=>data.skills.find(s=>s.id===id)),unlocked=active(data,ids),families=enabled?unlocked:[],has=f=>families.includes(f),events=[],idle=[],procs=[],gauges=[],windows=[],missing=[],warnings=[];
 for(const s of skills){if(!s){missing.push('알 수 없는 도술');continue;}if(!A.motion(s))missing.push(s.name+' 모션 시간');if(!(typeof s.basic?.cooldown==='number'&&s.basic.cooldown>=0))missing.push(s.name+' 재사용 대기시간');}
 if(new Set(ids).size!==ids.length)missing.push('중복 도술');
 const result={ids,horizon,total:horizon,events,idle,procs,gauges,windows,missing,warnings,active:families,unlocked,enabled,busy:0,wait:0,casts:0,cycles:[]};
 if(missing.length||!ids.length){result.total=null;return result;}
 if(has('절명'))warnings.push('절명 신식은 공격 도술이 적중한다고 가정하여 계산합니다. 비공격 도술은 형상을 얻지 않으며, 빗나감·실제 적중 시각에 따른 차이는 미반영입니다.');
  if(has('파멸'))warnings.push('파멸 영력은 상세 자료의 사용당 25를 적용합니다. 요약의 15와 상충하며 발동 시간은 참고값입니다.');
 if(has('기동'))warnings.push('기동 연쇄의 시전 가속 수치는 자료가 없어 제외했습니다. 궁극기 초기화는 반영합니다.');
 if(has('주술'))warnings.push('주술 구슬은 다른 계열을 포함한 모든 일반 도술의 대기시간을 줄입니다(2026-10-18 게임에서 동작 확인).');
 if(has('강타'))warnings.push('강타 영력은 상세 설명의 사용당 10을 적용합니다. 같은 자료의 요약에는 5로 적혀 있어 강압 발동 시점은 참고값입니다. 차지 생략 후에도 준비·공격 모션은 남습니다.');
 const capacity=Object.fromEntries(skills.map(s=>[s.id,Math.max(1,s.usage?.charges||1)])),charges={...capacity},ready=Object.fromEntries(ids.map(id=>[id,Infinity])),last={},uses=Object.fromEntries(ids.map(id=>[id,0]));
 let now=0,clock=0,guard=0,pam=0,yogi=0,smash=0,pressure=0,dash=0,chain=0,tears=0,locks=0,forms=0,hex=0,snipe=0,arrows=0,hearts=0,armor=0,sturdy=0,exec=0,execStacks=0,execUntil=0,rage=0,rageUntil=0;
 const proc=(family,name,time,description,changes=[])=>{procs.push({family,name,time:round(time),description,changes});};
 const windowOf=(family,name,start,duration)=>{const w={family,name,start:round(start),end:round(start+duration)};windows.push(w);return w;};
 const change=(time,predicate,operation,reset=false)=>{const changes=[];for(const s of skills){if(!predicate(s)||!Number.isFinite(ready[s.id])||ready[s.id]<=time+EPS)continue;const before=ready[s.id],after=Math.max(time,operation(before,s));if(after>=before-EPS)continue;if(after<=time+EPS){charges[s.id]=reset?capacity[s.id]:Math.min(capacity[s.id],charges[s.id]+1);ready[s.id]=charges[s.id]>=capacity[s.id]?Infinity:round(time+s.basic.cooldown);}else ready[s.id]=round(after);for(const ev of events)if(ev.id===s.id&&ev.cooldownEnd>time)ev.cooldownEnd=round(after);changes.push({id:s.id,before:round(before),after:round(after)});}return changes;};
 function advance(time){
  for(const s of skills){while(Number.isFinite(ready[s.id])&&ready[s.id]<=time+EPS&&charges[s.id]<capacity[s.id]){charges[s.id]++;ready[s.id]=charges[s.id]>=capacity[s.id]?Infinity:round(ready[s.id]+s.basic.cooldown);}}

  const dt=Math.max(0,time-clock);if(has('주술'))hex=Math.max(0,hex-5*dt);
  if(has('저격')){snipe+=25*dt;while(snipe>=100&&arrows<3){snipe-=100;arrows++;}snipe=Math.min(100,snipe);}
  if(pressure&&time>=pressure-EPS){pressure=0;smash=0;}
  if(sturdy&&time>=sturdy-EPS){sturdy=0;armor=0;}
  if(time>=execUntil)execStacks=0;clock=time;
 }
 while(now<horizon-EPS&&guard++<10000){
  advance(now);const slot=skills.findIndex(s=>charges[s.id]>0);
  if(slot<0){const next=Math.min(horizon,...Object.values(ready));idle.push({start:now,end:next});result.wait+=next-now;now=next;continue;}
  const s=skills[slot],parts={...A.motion(s)},start=now,modifiers=[],spentArrows=has('저격')&&s.family==='저격'?arrows:0;
  if(spentArrows)arrows=0;
  if(has('파멸')&&start<yogi-EPS)modifiers.push('요기범람 · 도술 피해 +10%');
  if(has('파멸')&&start<yogi-EPS&&parts.prep){parts.prep=round(parts.prep/1.5);modifiers.push('요기범람 · 전개 속도 +50%');}
  if(has('강타')&&start<pressure-EPS&&parts.charge){parts.charge=0;modifiers.push('강압 · 최대 차지 즉시');}
  parts.total=round(parts.prep+parts.charge+parts.action);if(parts.total<=0){missing.push(s.name+' 동작 시간 0');break;}
  let cd=s.basic.cooldown;
  if(has('제압')&&s.ultimate&&locks){cd=Math.max(0,cd-3*locks);modifiers.push('자물쇠 · 재사용 '+3*locks+'초 감소');proc('제압','자물쇠 소비',start,locks+'개 기준 궁극기 쿨타임 '+cd+'초');}
  const smashFire=has('강타')&&s.ultimate&&smash>=100&&!pressure,sturdyFire=has('강인')&&s.family==='강인'&&armor>=100&&!sturdy,heartsFire=has('헌신')&&s.family==='헌신'&&hearts>=3;
  const end=round(start+parts.total),event={id:s.id,slot,cycle:++uses[s.id],start,end,queued:start,wait:0,parts,cooldownEnd:round(start+cd),modifiers,completed:end<=horizon+EPS};events.push(event);last[s.id]=event;charges[s.id]--;if(!Number.isFinite(ready[s.id]))ready[s.id]=event.cooldownEnd;event.cooldownEnd=ready[s.id];
  result.busy+=Math.min(end,horizon)-start;now=end;
  if(!event.completed)break;
  result.casts++;advance(end);
  if(smashFire){pressure=end+10;const changes=change(end,x=>!x.ultimate,()=>end,true);windowOf('강타','강압',end,10);proc('강타','강압 발동',end,'일반 도술 초기화 · 10초 차지 생략',changes);}
  if(has('파멸')&&end>=yogi-EPS){pam+=25;if(pam>=200){pam=0;yogi=end+20;const changes=change(end,x=>!x.ultimate,()=>end,true);windowOf('파멸','요기범람',end,20);proc('파멸','요기범람 발동',end,'일반 도술 초기화 · 20초 시전 준비 속도 +50%',changes);}}
  if(has('강타')&&!pressure)smash=Math.min(100,smash+10+(s.referenceNumbers?.cm?2*(s.referenceNumbers.dc?.length||0):0));
  if(has('기동')){dash+=15;if(dash>=200){dash=0;chain=end+10;const changes=change(end,x=>x.ultimate&&x.family==='기동',()=>end,true);windowOf('기동','연쇄',end,10);proc('기동','연쇄 발동',end,'기동 궁극기 초기화 · 가속 수치는 미확인',changes);}}
  if(has('기만')){tears=Math.min(2,tears+1);if(tears>=2&&!s.ultimate){tears=0;const changes=change(end,x=>x.id===s.id,()=>start+cd*.5);event.modifiers.push('기만 · 쿨타임 50%');proc('기만','눈물 소비',end,s.name+' 쿨타임 50%',changes);}}
  if(has('주술')){hex=Math.min(100,hex+10);const orbs=hex>=90?3:hex>=60?2:hex>=30?1:0;if(orbs&&s.family==='주술'){const amount=.3*orbs,changes=change(end,x=>!x.ultimate,t=>t-amount);proc('주술','구슬 '+orbs+'개',end,'일반 도술 대기시간 '+round(amount)+'초 감소 · 버그 무시',changes);}}
  if(has('절명')){if(s.ultimate&&forms>=3){proc('절명','검의 형상 소비',start,forms+'개 소비');forms=0;}else if(!s.ultimate&&hits(s)>0){if(forms>=5){const changes=change(end,x=>x.ultimate&&x.family==='절명',t=>t-6);proc('절명','형상 최대치 추가 획득',end,'절명 궁극기 대기시간 6초 감소',changes);}forms=Math.min(5,forms+1);}}
  if(has('제압')){locks=Math.min(3,locks+1);if(s.ultimate)locks=Math.max(0,locks-1);}
  if(has('척살')){if(s.family==='척살'){windowOf('척살','척살 태세',end,10);proc('척살','척살 태세',end,'10초 강화');}exec+=5;if(exec>=100){exec=0;execStacks=Math.min(10,execStacks+1);execUntil=end+30;windowOf('척살','척결',end,30);proc('척살','척결 '+execStacks+'중첩',end,'30초 유지 · 처치 영력 제외');}}
  if(spentArrows){proc('저격','화살촉 소비',start,spentArrows+'개 소비 · 조준 10초');windowOf('저격','조준',end,10);}
  if(sturdyFire){sturdy=end+10;windowOf('강인','강건',end,10);proc('강인','강건 발동',end,'10초 강화 · 종료 시 영력 초기화');}if(has('강인')&&!sturdy)armor=Math.min(100,armor+10);
  if(heartsFire){hearts=0;proc('헌신','하트 소비',end,'하트 3개 소비 · 헌신 효과 강화');}if(has('헌신'))hearts=Math.min(3,hearts+1);
  gauges.push({time:end,values:{파멸:pam,강타:smash,기동:dash,기만:tears,주술:round(hex),절명:forms,제압:locks,연타:rage,척살:exec,저격:arrows,강인:armor,헌신:hearts}});
 }
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
