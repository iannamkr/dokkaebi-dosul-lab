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
const api={level,growth,multiplier,components,coefficient,total,effectValue,effectRows,cooldown,awakening};if(typeof module!=='undefined')module.exports=api;else root.DosulNumbers=api;
})(typeof window==='undefined'?globalThis:window);
