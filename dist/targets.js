(function(root){
'use strict';
function get(skill){
 if(skill.targeting)return skill.targeting;
 const text=skill.basic?.target||'',count=text.match(/(\d+)인/);
 const kind=/단일/.test(text)?'single':/범위|다중/.test(text)?'area':/자신/.test(text)?'self':'unknown';
 return {kind,label:kind==='single'?'단일':kind==='area'?'범위':kind==='self'?'자신':'대상 미확인',count:count?Number(count[1]):null,reference:false,note:skill.basic?.fieldNotes?.target||skill.basic?.note||'대상 종류를 확인하지 못했습니다.'};
}
function matches(skill,filter){return !filter||filter==='all'||get(skill).kind===filter;}
function distance(skill){const range=skill.aim?.range??skill.basic?.range;if(get(skill).kind==='self'||(skill.aim?.scope&&!skill.aim.scope.includes('적'))||!Number.isFinite(range)||range<=0)return 'unknown';return range<=3?'melee':'ranged';}
function matchesDistance(skill,filter){return !filter||filter==='all'||distance(skill)===filter;}
function summary(skills){const out={single:0,area:0,self:0,unknown:0};for(const s of skills)out[get(s).kind]++;return out;}
const api={get,matches,summary,distance,matchesDistance};if(typeof module!=='undefined')module.exports=api;else root.DosulTargets=api;
})(typeof window==='undefined'?globalThis:window);
