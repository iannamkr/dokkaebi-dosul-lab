'use strict';
(function(){
const symbols={'질풍':'≋','수호':'⬡','기세':'↑','파쇄':'✹','낙인':'◎','충격':'ϟ','관통':'➶','출혈':'滴','정밀':'⊙','한기':'❄','파열':'✴','보호막':'⬡'};
function design(effect){let hash=0;for(const ch of effect)hash=(hash*31+ch.codePointAt(0))>>>0;return {color:`hsl(${hash%360} 48% 37%)`,symbol:symbols[effect]||effect.slice(0,1)};}
function block(effect,scope,role,status='pass'){const src=window.DosulEffectIcons?.src(effect);return src?`<span class="effect-block ${status}" title="${esc(effect)}" aria-label="${esc(effect)}"><img class="game-status-icon" src="${esc(src)}" alt="${esc(effect)}" width="28" height="28"></span>`:'';}

function render(){
let ribbon=document.querySelector('#effect-connections');if(!ribbon){ribbon=document.createElement('div');ribbon.id='effect-connections';document.querySelector('#slots').after(ribbon);}
const plan=timingPlan(timingTarget),sim=timingSimulation(plan.ids,true,plan.baseSlots),preview=plan.preview,target=preview?timingTarget:build[step],pos=preview?step:build.indexOf(target);
const edges=target?Q.links(D,E,build,Math.max(0,pos),target).filter(e=>e.type==='explicit'||e.type==='general'):[];
const assessed=edges.map(edge=>({edge,result:DosulAuto.assess(D,sim,edge)}));
ribbon.innerHTML=assessed.length?assessed.map(({edge:e,result:r})=>{const status=r.first==='pass'?'pass':r.first==='fail'||r.first==='absent'?'fail':'unknown';return `<div class="block-connection ${status}"><span class="block-skill">${icon(byId(e.source))}<small>${esc(byId(e.source).name)}</small></span>${block(e.effect,e.scope,'plug',status)}<span class="connection-arrow" aria-hidden="true">→</span><span class="block-skill ${preview?'preview':''}">${icon(byId(target))}<small>${esc(byId(target).name)}${preview?' · 미리보기':''}</small></span><span class="block-output ${status}" title="${esc(r.first==='pass'?'효과 유지 중 적중':r.first==='fail'?'효과 만료':'판정 확인 필요')}">${status==='pass'?'✓':status==='fail'?'×':'?'} ${esc(e.result)}</span></div>`;}).join(''):'';
ribbon.hidden=!assessed.length;if(preview&&assessed.length)ribbon.insertAdjacentHTML('beforeend','<button type="button" data-block-clear>미리보기 닫기</button>');
document.querySelectorAll('.candidate-node').forEach(card=>{const id=card.id.slice(3),x=shown.find(x=>x.skill.id===id);if(!x)return;const connections=x.connections.filter(e=>e.type==='explicit'||e.type==='general');if(!connections.length){card.querySelector('.candidate-blocks')?.remove();return;}const signature=JSON.stringify(connections.map(e=>[e.effect,e.scope,e.timing?.status,e.timing?.eligible]));if(card.querySelector('.candidate-blocks')?.dataset.signature===signature)return;card.querySelector('.candidate-blocks')?.remove();const el=document.createElement('div');el.className='candidate-blocks';el.dataset.signature=signature;el.innerHTML=connections.map(e=>`<button type="button" class="effect-preview-text" data-block-preview="${id}" aria-label="${esc(x.skill.name)} · ${esc(e.effect)} 연계 미리보기">${block(e.effect,e.scope,'socket',e.timing?.eligible?'pass':['fail','absent'].includes(e.timing?.status)?'fail':'unknown')}</button>`).join('');card.append(el);});
const model=DosulEffectTimeline.model(D,sim),rows=[...document.querySelectorAll('#effect-timeline .effect-row')].slice(2);let index=0;
for(const scope of ['self','enemy'])for(const r of model.rows.filter(r=>r.scope===scope)){
const row=rows[index++];if(!row)continue;const d=design(r.effect);row.querySelectorAll('.effect-span').forEach(b=>{b.style.background=d.color;b.style.color='white';b.classList.add('puzzle-duration');});

}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-block-preview]');if(b){focusTiming(b.dataset.blockPreview);syncTiming();}if(e.target.closest('[data-block-clear]')){timingTarget=null;syncTiming();}});
window.renderEffectBlocks=render;render();
})();
