(function(root){
'use strict';
const Sim=typeof module!=='undefined'?require('./simulation.js'):root.DosulSimulation;
const clone=x=>JSON.parse(JSON.stringify(x)),round=n=>Math.round(n*100)/100;
const LIMITS=[
 '이 결과는 공간 적중 비교 모델이며 실전 사냥 로그가 아닙니다.',
 '처치량·실제 피해/DPS·생존 시간·회복량·보호막 흡수량·물약 소비는 계산하지 않습니다.',
 '12마리·접근 속도 0.9m/s·20초마다 배치 초기화는 가정입니다. 초기화는 처치나 리젠 실측이 아닙니다.',
 '공격 크기·미확인 대상 상한·타격 간격은 가정입니다. 일반 추격 이동·강제 당기기·평타·미확인 장판은 제외합니다.',
 '기본 계수 전달량은 기본 계수 × 적중 대상 수의 합입니다. 강화·돌파·치명타·방어력·조건 추가 피해는 적용하지 않습니다.',
 '효과 조건은 적용 이력으로 만료·미부여·다른 대상 부여를 구분합니다. 최대 차지는 시전 동작 시간/강압으로 판정합니다.',
 '신식의 시전 일정은 공간 적중 실패에 따른 자원 획득 손실을 반영하지 않습니다. 조건부 효과 재부여·복합 조건·소모·해제는 제외합니다.',
 '휩쓸어 베기 돌진은 첫 추정 타격까지 대상의 시전 시작 위치로 직선 이동합니다. 차지 도술은 최대 차지로 계산합니다.',
 '원본 영상 체력 표본은 참고 자료이며 현재 빌드의 예상 체력이 아닙니다.'
];
function fingerprint(value){let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function create(data,ids,result,options={}){
 const snapshotIds=new Set([...ids,...(Array.isArray(data.baseSlots)?data.baseSlots:[]),...(options.baseline?.ids||[]),...(options.baseline?.baseSlots||[])]);
 const snapshot={...data,skills:data.skills.filter(s=>snapshotIds.has(s.id))},map=Object.fromEntries(data.skills.map(s=>[s.id,s]));
 const schedule=result.schedule,valid=ids.length>0&&!schedule.missing.length,profile=Sim.profiles.find(p=>p.id===result.profile),horizon=result.horizon;
 const perSkill=result.rows.map((r,i)=>{const events=schedule.events.filter(e=>e.id===r.id),s=map[r.id];return {
  slot:i+1,id:r.id,name:r.name,family:s.family,ultimate:!!s.ultimate,basic:s.basic,targeting:s.targeting,geometry:r.geometry,
  castsStarted:r.casts,castsCompleted:events.filter(e=>e.completed).length,firstCast:events[0]?.start??null,
  occupiedSeconds:round(events.reduce((n,e)=>n+Math.max(0,Math.min(horizon,e.end)-e.start),0)),
  hitChecks:r.hitChecks,targetHits:r.targetHits,averageTargets:r.hitChecks?round(r.targetHits/r.hitChecks):null,
  whiffChecks:r.whiffs,whiffPercent:r.hitChecks?round(r.whiffs/r.hitChecks*100):null,
  coefficientDelivery:r.hitChecks&&!r.unknown.includes('피해 계수')?r.coefficient:null,
  conditionPass:r.conditions.filter(c=>c.status==='yes').length,conditionFail:r.conditions.filter(c=>c.status==='no').length,conditionUnknown:r.conditions.filter(c=>c.status==='unknown').length,excluded:r.unknown
 };});
 const grouped=new Map();for(const c of result.conditions){const key=JSON.stringify([c.id,c.effect,c.result,c.status,c.reason]);if(!grouped.has(key))grouped.set(key,{id:c.id,name:map[c.id]?.name,effect:c.effect,result:c.result,status:c.status,reason:c.reason,count:0,examples:[]});const g=grouped.get(key);g.count++;if(g.examples.length<3)g.examples.push({time:c.time,target:c.target,wave:c.wave||Math.min(Math.ceil(horizon/20),Math.floor(c.time/20)+1),reason:c.reason,source:c.source,appliedAt:c.appliedAt,expiresAt:c.expiresAt,remaining:c.remaining});}
 const segments=[];if(valid)for(let start=0;start<horizon;start+=20){const end=Math.min(start+20,horizon),inSegment=t=>t>=start&&(t<end||(end===horizon&&t===end)),impacts=result.impacts.filter(h=>inSegment(h.time)),conditions=result.conditions.filter(c=>inSegment(c.time)),intervals=schedule.idle.map(w=>({start:Math.max(start,w.start),end:Math.min(end,w.end)})).filter(w=>w.end>w.start);
  segments.push({start,end,castsStarted:schedule.events.filter(e=>inSegment(e.start)).length,hitChecks:impacts.length,targetHits:impacts.reduce((n,h)=>n+h.targets.length,0),whiffs:impacts.filter(h=>!h.targets.length).length,conditionPass:conditions.filter(c=>c.status==='yes').length,conditionFail:conditions.filter(c=>c.status==='no').length,conditionUnknown:conditions.filter(c=>c.status==='unknown').length,noSkillSeconds:round(intervals.reduce((n,w)=>n+w.end-w.start,0))});
 }
 const findings=[];const add=(code,text,evidence)=>findings.push({code,text,evidence});
 if(!valid)add('blocked','자료 부족 또는 빈 빌드로 계산을 완료하지 못했습니다.',schedule.missing);
 else{
  if(result.metrics.coverage<70&&!result.excluded.length)add('coverage',`무리 접촉률 ${result.metrics.coverage}%: 외곽 유인용 도술을 앞에 둔 순서와 비교하세요.`,{untouched:result.metrics.opportunities-result.metrics.unique});
  for(const r of perSkill){if(r.whiffChecks)add('whiff',`${r.name}: 계산된 타격 ${r.hitChecks}회 중 ${r.whiffChecks}회가 아무 대상에도 닿지 않았습니다. 사거리와 공격 방향을 확인하세요.`,{id:r.id,whiffPercent:r.whiffPercent});if(r.conditionFail)add('condition',`${r.name}: 효과 조건 불충족 ${r.conditionFail}건. 선행 효과와 같은 몹에 적중하는지, 그때까지 효과가 남는지 비교하세요.`,{id:r.id,groups:[...grouped.values()].filter(g=>g.id===r.id&&g.status==='no')});if(!r.castsStarted)add('unused',`${r.name}: 관찰 구간에 한 번도 시전하지 못했습니다. 앞순위 도술의 반복 점유를 확인하세요.`,{id:r.id});}
  if(result.rage?.resets)add('rage',`격노가 ${result.rage.resets}회 소멸합니다. 3초 이상 적중 공백 앞뒤의 배치를 비교하세요.`,{gaps:result.rage.gaps});
  if(schedule.wait>0)add('idle',`도술 미시전 구간 합계 ${round(schedule.wait)}초. 이 시간의 평타·이동·실제 행동은 계산하지 않습니다.`,{intervals:schedule.idle});
 }
 if(result.excluded.length)add('excluded',`계산에서 제외된 정보가 있어 도술 간 우열을 단정할 수 없습니다. 제외: ${result.excluded.join(' / ')}`,result.excluded);
 const comparison=options.baseline&&options.comparison?{build:clone(options.baseline),metrics:clone(options.comparison.metrics),excluded:clone(options.comparison.excluded),missing:clone(options.comparison.schedule.missing),deltas:valid&&!options.comparison.schedule.missing.length?Object.fromEntries(['coverage','perHit','exposure','conditionPass','conditionFail'].map(k=>[k,Number.isFinite(result.metrics[k])&&Number.isFinite(options.comparison.metrics[k])?round(result.metrics[k]-options.comparison.metrics[k]):null])):null}:null;
 return clone({schema:'dosul-simulation-report-v2',createdAt:options.createdAt||new Date().toISOString(),model:{id:result.model||Sim.model,reportVersion:3,dataFingerprint:fingerprint(snapshot),limitations:LIMITS},
  playback:{reachedEnd:!!options.completed,viewedSeconds:Math.min(horizon,options.clock||0),note:'계산은 전체 관찰 구간 기준이며 재생 여부는 시각화 상태입니다.'},calculation:{status:valid?(result.excluded.length?'partial':'complete'):'blocked',validation:result.validation,missing:schedule.missing,warnings:result.issues},
  build:{ids:[...ids],baseSlots:Array.isArray(data.baseSlots)?[...data.baseSlots]:[],order:perSkill.map(r=>({slot:r.slot,id:r.id,name:r.name,family:r.family,ultimate:r.ultimate})),activeShinsik:schedule.active},
  scenario:{profileId:result.profile,title:profile?.title,horizonSeconds:horizon,scale:result.scale??1,mobs:12,waveResetSeconds:20,moveSpeed:.9,targetPolicy:'nearest',movement:'휩쓸어 베기만 첫 추정 타격까지 직선 돌진 · 20초마다 원점 복귀',fixedPlayer:false,initialState:'충전 가득·신식 자원 0',randomness:'없음 · 동일 자료/모델/조건에서 동일 결과'},
  metrics:valid?{...result.metrics,noSkillSeconds:round(schedule.wait),noSkillPercent:round(100*schedule.wait/horizon),occupiedSeconds:round(schedule.busy),kills:null,dps:null,survival:null}:null,
  perSkill,conditionGroups:[...grouped.values()],segments,findings,comparison,rage:result.rage?{...result.rage,assumption:'공간 모델에서 실제 대상에 적중한 타격만 반영 · 평타/지속피해/미확인 장판 제외'}:null,
  excluded:result.excluded,replay:{schedule,impacts:result.impacts,conditions:result.conditions,effectApplications:result.effectApplications},dataSnapshot:snapshot,
  analysisRequest:'동일한 모델과 환경으로 원본 빌드를 재현한 뒤, 순서 변경과 도술 교체를 구분하여 비교해 주세요. 효과 지속시간·동일 대상 적중·쿨타임·신식·공격 범위를 검토하고, 미계산 피해/생존을 사실처럼 단정하지 마세요. 다른 3개 환경에서도 개선이 유지되는지 확인하고 변경 전후 지표와 근거를 제시해 주세요.'});
}
function text(report){
 const r=report,m=r.metrics,lines=['도술 전투 시뮬레이션 요약',`생성: ${r.createdAt}`,`모델: ${r.model.id} · 자료 ${r.model.dataFingerprint}`,`환경: ${r.scenario.title} / ${r.scenario.horizonSeconds}초`,`사용 순서: ${r.build.order.map(s=>s.name).join(' → ')}`,`개방 신식: ${r.build.activeShinsik.join(', ')||'없음'}`,`계산: ${r.calculation.status==='complete'?'완료':r.calculation.status==='partial'?'부분 계산':'보류'} · ${r.playback.reachedEnd?'재생 완료':'재생 완료 전 전체 구간 계산'}`];
 if(m)lines.push(`무리 접촉률 ${m.coverage}% · 평균 적중 ${m.perHit??'미확인'}명/타 · 빗나감 ${m.whiff??'미확인'}%`,`조건 충족 ${m.conditionPass} / 불충족 ${m.conditionFail} / 미확인 ${m.conditionUnknown}건`,`도술 미시전 ${m.noSkillSeconds}초 (${m.noSkillPercent}%) · 평균 근접 몹 ${m.exposure}명`,`처치량·DPS·생존: 계산 안 함`);
 lines.push('','도술별 결과 (기본 계수 전달량은 실제 피해가 아님)',...r.perSkill.map(s=>`${s.slot}. ${s.name}: 시전 ${s.castsStarted}회 / 완료 ${s.castsCompleted}회 · 점유 ${s.occupiedSeconds}초 · 적중 ${s.averageTargets??'미확인'}명/타 · 조건 불충족 ${s.conditionFail}건 · 계수 전달 ${s.coefficientDelivery??'미계산'}${s.excluded.length?' · 제외: '+s.excluded.join(', '):''}`),'','확인할 병목',...r.findings.map(x=>'• '+x.text));
 if(r.rage)lines.push(`격노: 최대 ${r.rage.max}중첩 · 유지 ${round(r.rage.uptimePercent)}% · 소멸 ${r.rage.resets}회`);
 if(r.comparison)lines.push('','고정 빌드 대비 변화',JSON.stringify(r.comparison.deltas),`비교 계산 제외: ${r.comparison.excluded.join(', ')||'없음'}`);
 lines.push('','계산 한계',...r.model.limitations.map(x=>'• '+x),'','분석 요청',r.analysisRequest,'정밀 분석에는 스킬 자료·시전/적중 로그가 담긴 분석용 JSON 파일을 함께 전달해 주세요.');return lines.join('\n');
}
const api={create,text,fingerprint};if(typeof module!=='undefined')module.exports=api;else root.DosulSimulationReport=api;
})(typeof window==='undefined'?globalThis:window);
