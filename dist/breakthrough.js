(function(root){
'use strict';
const source='https://kkaebigg.com/skills/',checkedAt='2026-10-23';
const rules={
 '은신':{buffs:[{name:'이동 속도 증가',percent:10},{name:'치명타 적중 증가',percent:100,duration:3,trigger:'연계 사용',conditional:true}],criticalGuaranteed:true},
 '집중 연타':{damagePercent:30,conditions:[{effect:'감전',result:'피해 증가',scope:'enemy',percent:10}]},
 '난타':{damagePercent:20,conditions:[{effect:'감전',result:'추가 피해',scope:'enemy',coefficient:14.8}]},
 '대검 강타':{damagePercent:30,targetBonus:{minimum:3,percent:50}},
 '돌풍 강격':{damagePercent:20,conditions:[{effect:'방어력 감소',result:'추가 피해',scope:'enemy',coefficient:17.5}]},
 '묵영점정':{damagePercent:30,conditions:[{effect:'속박',result:'피해 증가',scope:'enemy',percent:20}]},
 '용사비등':{damagePercent:30,conditions:[{effect:'속박',result:'피해 증가',scope:'enemy',percent:20}]},
 '꿰뚫는 저격':{debuffs:[{name:'감전',duration:10,trigger:'마지막 적중',durationBasis:'깨비지지 감전 사전의 유일한 지속시간 10초'}],lastHitExtraPercent:35,lastHitExtraKind:'감전 지속피해',dotInterval:null},
 '요기 폭발':{damagePercent:20,targetBonus:{maximum:1,percent:30}},
 '하늘의 심판':{damagePercent:50,targetCap:20,falloff:{startsAt:5,at:10,minimum:.5,intermediate:null}},
 '전투의 함성':{damagePercent:20,buffs:[{name:'받는 피해 감소',percent:50,trigger:'면역 유지 중',conditional:true}]},
 '월식':{damagePercent:30,buffs:[{name:'이동 속도 증가',percent:50,trigger:'복귀 시',conditional:true}]},
 '일섬':{damagePercent:20,conditions:[{effect:'화상',result:'추가 피해',scope:'enemy',coefficient:6.5}]},
 '용맹의 기운':{damagePercent:30,buffs:[{name:'주는 피해 증가',percent:15,scope:'self-and-allies',duration:10,durationBasis:'기본 도술의 이로운 효과 지속시간'}]},
 '환상술':{damagePercent:30,debuffs:[{name:'주는 치명타 피해 감소',percent:20},{name:'받는 치명타 피해량 증가',percent:20}]},
 '얼어붙은 대지':{damagePercent:30,slowPerStackBonus:10,debuffs:[{name:'침묵',duration:1,trigger:'마지막 적중'}]}
};
const descriptions={"은신":"6단계 이동 속도 10% 증가 연계 시, 3초간 확정 치명타","집중 연타":"6단계 피해량 30% 증가 감전 대상에게 10% 피해 증가","난타":"6단계 피해량 20% 증가 감전 대상에게 14.8% 추가 피해","대검 강타":"6단계 피해량 30% 증가 3인 이상 적중 시 50% 피해 증가","돌풍 강격":"6단계 피해량 20% 증가 방어력 감소 대상에게 17.5% 추가 피해","묵영점정":"6단계 피해량 30% 증가 속박 대상에게 20% 피해 증가","용사비등":"6단계 피해량 30% 증가 속박 대상에게 20% 피해 증가","꿰뚫는 저격":"6단계 감전 마지막 타격의 35% 추가 피해","요기 폭발":"6단계 피해량 20% 증가 1인 대상에게 30% 피해 증가","하늘의 심판":"6단계 피해량 50% 증가 타격 대상 20명으로 변경 5인 이상 타격 시 대상 수에 따라 피해량이 감소하며, 10인 타격 시 50%까지 감소합니다.","전투의 함성":"6단계 도술 피해량 20% 증가 면역 지속 중 받는 피해 50% 감소","월식":"6단계 피해량 30% 증가 복귀 시 이동 속도 50% 증가","일섬":"6단계 피해량 20% 증가 화상 대상에게 6.5% 추가 피해","용맹의 기운":"6단계 도술 피해량 30% 증가 자신과 아군이 주는 피해 15% 증가","환상술":"6단계 피해량 30% 증가 적이 주는 치명타 피해 20% 감소 적이 받는 치명타 피해 20% 증가","얼어붙은 대지":"6단계 피해량 30% 증가 중첩 당 이동 속도 감소량 10% 증가 마지막 타격에 침묵 1 초 추가"};for(const [name,description] of Object.entries(descriptions))rules[name].description=description;
function apply(data,step=6){
 if(!data?.skills)return data;
 for(const s of data.skills){const rule=rules[s.name];if(!rule)continue;
  // Keep the base skill separate so repeated source sync and disabling never duplicate effects.
  const base=s.legendaryBreakthroughBase||(s.legendaryBreakthroughBase={buffs:[...(s.buffs||[])],debuffs:[...(s.debuffs||[])],conditions:JSON.parse(JSON.stringify(s.conditions||[])),effectScopes:JSON.parse(JSON.stringify(s.effectScopes||[])),timingEffects:JSON.parse(JSON.stringify(s.timingEffects||{})),targeting:s.targeting?{...s.targeting}:null});
  s.buffs=[...base.buffs];s.debuffs=[...base.debuffs];s.conditions=JSON.parse(JSON.stringify(base.conditions));s.effectScopes=JSON.parse(JSON.stringify(base.effectScopes));s.timingEffects=JSON.parse(JSON.stringify(base.timingEffects));if(base.targeting)s.targeting={...base.targeting};
  s.legendaryBreakthrough={...rule,step,active:step>=6,source,checkedAt,description:rule.description||'',limitations:[...(rule.conditions?.some(c=>c.coefficient)?['조건부 추가 피해의 적용 횟수가 확인되지 않아 피해 합계에는 아직 포함하지 않습니다.']:[]),...(rule.lastHitExtraPercent?['감전 추가 피해 35%는 등록했으며, 지속피해 적용 횟수는 별도 확인이 필요합니다.']:[]),...(rule.falloff?['5~9인 적중 시 중간 피해 분산율은 미확인입니다. 계산값은 피해 분산 전 상한입니다.']:[])],reference:true};
  if(step<6)continue;
  for(const c of rule.conditions||[])s.conditions.push({...c,source,reference:true,breakthrough:6});
  for(const [key,scope] of [['buffs','self'],['debuffs','enemy']])for(const e of rule[key]||[]){
   if(!s[key].includes(e.name))s[key].push(e.name);
   if(!s.effectScopes.some(x=>x.effect===e.name))s.effectScopes.push({effect:e.name,scope:e.scope||scope,kind:key==='buffs'?'buff':'debuff',breakthrough:6});
   s.timingEffects[e.name]={...s.timingEffects[e.name],duration:e.duration??null,application:'end',source,breakthrough:6,trigger:e.trigger||'적중',conditional:!!e.conditional};
  }
  if(rule.targetCap&&s.targeting)s.targeting={...s.targeting,count:rule.targetCap,reference:true,note:s.targeting.note+' · 전설 6돌파 대상 '+rule.targetCap+'명'};
 }
 data.legendaryBreakthroughStep=step;return data;
}
// Damage per hit uses only confirmed conditions on the same target, never another enemy's mark.
function hitCoefficient(skill,base,context={}){
 const r=skill.legendaryBreakthrough;if(base==null||!r?.active)return base;
 let value=base,extra=0,bonus=0;
 for(const c of r.conditions||[])if(context.condition?.(c)?.status==='yes'){bonus+=c.percent||0;extra+=(c.coefficient||0)*(context.growth||1)*(context.additionalDamageApplications||0);}
 const n=context.targets,t=r.targetBonus;if(t&&Number.isFinite(n)&&(t.minimum==null||n>=t.minimum)&&(t.maximum==null||n<=t.maximum))bonus+=t.percent;
 value=value*(1+bonus/100)+extra;
 if(r.falloff&&n>=r.falloff.at)value*=r.falloff.minimum;
 // Intermediate falloff and DoT tick count are unpublished: expose these as unresolved, never guess.
 return value;
}
const api={rules,apply,hitCoefficient,source,checkedAt};if(typeof module!=='undefined')module.exports=api;else root.DosulBreakthrough=api;
})(typeof window==='undefined'?globalThis:window);
