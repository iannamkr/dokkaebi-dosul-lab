(function(root){
'use strict';
// Formulas verified against https://kkaebigg.com/static/js/skill-numbers.js .
// Source tables remain immutable; selected level 0 means unenhanced.
function level(s){const n=s.level??0;if(!Number.isInteger(n)||n<0||n>50)throw Error('강화 레벨 범위: 0~50');return n;}
function growth(table,n){if(n===0)return 0;const row=(table||[]).find(r=>r.level===n);if(!row)throw Error('강화 레벨 수치 누락: '+n);return row.coefficient;}
function multiplier(s){return 1+growth(s.referenceNumbers?.lv,level(s));}
function components(s){const n=s.referenceNumbers||{},dc=n.dc||[];let parts=dc;if(n.cm){const stage=s.chargeStage??dc.length;if(!Number.isInteger(stage)||stage<1||stage>dc.length)throw Error('차지 단계 범위 오류');parts=[dc[stage-1]];}const factor=multiplier(s);return parts.map(p=>({...p,basic_coefficient:p.basic_coefficient*factor}));}
function coefficient(s,index){for(const p of components(s)){if(index<=p.hits)return p.basic_coefficient;index-=p.hits;}return null;}
function total(s,event){const dc=components(s);if(event?.hitIndices)return event.hitIndices.reduce((a,i)=>a+(coefficient(s,i)||0),0);return dc.reduce((a,p)=>a+p.basic_coefficient*p.hits,0);}
function effectValue(effect,s){if(!effect)return null;return effect.m==='factor'?effect.v*(1+growth(effect.fl,level(s))):effect.v;}
function effectRows(s){const source=s.referenceProgression?.hit;if(!source)return s.referenceDetail;const effects=s.referenceProgression.effects||[];const buffs=[],debuffs=[];source.forEach((h,hi)=>{if(!h.n||!['강화','약화'].includes(h.t))return;const lines=h.l.map((text,li)=>{let index=0;return text.replace(/[+-]?\d[\d,]*(?:\.\d+)?/g,value=>{const key=hi+':'+li+':'+(2*(index++)+1),effect=effects.find(e=>e.k===key);return effect?String(effectValue(effect,s)):value;});});const prior=(h.t==='강화'?s.referenceDetail?.buffs:s.referenceDetail?.debuffs)?.find(b=>b.name===h.n);(h.t==='강화'?buffs:debuffs).push({...prior,name:h.n,description:lines.join(' ')});});return {...s.referenceDetail,buffs,debuffs};}
function cooldown(s){const step=s.breakthrough??0;if(!Number.isInteger(step)||step<0)throw Error('돌파 단계 오류');if(!step)return s.basic?.cooldown;const row=s.referenceNumbers?.tr?.s?.[step-1];if(!row||row.cd==null)throw Error('선택한 돌파 단계의 원본 수치 없음');return Math.max(0,Math.round((s.basic.cooldown+row.cd)*1000)/1000);}
// Owned awakening bonuses are character stats. Final in-game stats already include them.
function awakening(table,owned){const result={};for(const item of owned||[]){if(!item.rank)continue;const rows=table[item.category],row=rows?.[item.rank-1];if(!row)throw Error('각성 단계 수치 누락');for(const [name,value]of row[2])result[name]=(result[name]||0)+value;}return result;}
// Published constants, not a complete defence/hit probability formula.
const combatRules=Object.freeze({source:'https://kkaebigg.com/guide/combat/',checkedAt:'2026-10-19',normalDamageMin:.8,otherDamageMin:.5,criticalMin:1.1,blockReductionMin:.2,blockReductionMax:.9,penetrationMax:.9999,pvpMultiplier:.7,combatSeconds:3,pvpCombatSeconds:10,regenCombatSeconds:5,regenOutsideSeconds:1,statusMinimumSeconds:.5,flinchSeconds:.3,flinchCooldownSeconds:3,buffLimit:20,immunityTriggerSeconds:6,immunitySeconds:3,immunityCooldownSeconds:60});
function finite(n,label){if(!Number.isFinite(n))throw Error(label+' must be finite');return n;}
function regenInterval(inCombat=true){return inCombat?combatRules.regenCombatSeconds:combatRules.regenOutsideSeconds;}
function damageFactor(options={}){
 const o=options;if(!['skill','basic','other'].includes(o.kind||'skill'))throw Error('Unknown damage kind');
 const lo=o.kind==='other'?combatRules.otherDamageMin:combatRules.normalDamageMin;
 // Bounds do not imply a uniform distribution or a default mean of 0.9.
 const variation=o.variation===undefined?1:finite(o.variation,'variation');if(variation<lo||variation>1)throw Error('Damage variation outside source bounds');
 const critical=o.critical?Math.max(combatRules.criticalMin,finite(o.criticalMultiplier??combatRules.criticalMin,'criticalMultiplier')):1;
 if(o.blocked&&o.blockReduction===undefined)throw Error('Blocked hit needs blockReduction; no guessed block amount');
 const block=o.blocked?Math.max(combatRules.blockReductionMin,Math.min(combatRules.blockReductionMax,finite(o.blockReduction,'blockReduction'))):0;
 return variation*critical*(1-block)*(o.pvp?combatRules.pvpMultiplier:1);
}
function damageRange(base,options={}){finite(base,'base damage');if(base<0)throw Error('Negative damage');const min=options.kind==='other'?combatRules.otherDamageMin:combatRules.normalDamageMin;return {min:base*damageFactor({...options,variation:min}),max:base*damageFactor({...options,variation:1}),expected:null,source:combatRules.source};}
function penetration(value){return Math.max(0,Math.min(combatRules.penetrationMax,finite(value,'penetration')));}
const api={combatRules,regenInterval,damageFactor,damageRange,penetration,level,growth,multiplier,components,coefficient,total,effectValue,effectRows,cooldown,awakening};if(typeof module!=='undefined')module.exports=api;else root.DosulNumbers=api;
})(typeof window==='undefined'?globalThis:window);
