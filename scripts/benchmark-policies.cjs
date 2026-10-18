#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),D=require(path.join(root,'dist/data.json')),Q=require(path.join(root,'dist/sequence.js')),E=require(path.join(root,'dist/encounter.js')),O=require(path.join(root,'dist/optimizer.js'));
const fixture=require(path.join(root,'benchmarks/community-20.json')),args=process.argv.slice(2),output=path.resolve(args.includes('--output')?args[args.indexOf('--output')+1]:'community-policy-report.json');
const id=n=>{const s=D.skills.find(s=>s.name===n);if(!s)throw Error(n);return s.id;};
function score(ids,base,group,policy){return O.profiles.map((profile,pi)=>{
 const points=group==='single'?[{x:1.5,y:0}]:Array.from({length:12},(_,i)=>pi===0?{x:1.5+i*.6,y:(i%3-1)*.5}:pi===1?{x:1.5+(i%4)*.8,y:(Math.floor(i/4)-1)*.8}:pi===2?{x:Math.cos(i*Math.PI/6)*5,y:Math.sin(i*Math.PI/6)*5}:{x:Math.cos(i*2.39996)*(2+i*.7),y:Math.sin(i*2.39996)*(2+i*.7)});
 const r=E.run({...D,baseSlots:base,executionPolicy:policy},ids,profile,180,{attack:20532,hp:45000,points,coupled:!args.includes('--planned')});return {profile,issues:r.schedule.missing,power:r.encounter?.killsPerMin??null,casts:r.schedule.casts,ultimateCasts:r.schedule.events.filter(e=>D.skills.find(s=>s.id===e.id)?.ultimate).length,active:r.schedule.active,policy:r.schedule.executionPolicy};});}
const rows=fixture.builds.map(b=>{
 const ids=b.names.map(id),base=Q.fit(D,ids),group=/단일|저격\+절명/.test(b.title)?'single':'area',before=score(ids,base,group);let policy,order=ids,status='no-explicit-policy',note='기록된 실행 조건 없음; 모든 효과를 재현한다는 뜻은 아님',hypotheses;
 if(b.id==='146'){policy={disabled:[id('폭주')]};status='reproduced-off';note='본문 폭주 OFF 반영; 장착과 연타 신식 유지';}
 if(['213','205'].includes(b.id)){status='already-unconditional';note='작성자가 힐 HP 조건을 끄라고 명시: 기존 무조건 사용과 일치. 이전 미반영 분류를 정정.';}
 if(b.id==='169'){policy={hpBelow:{[id('생명의 축복')]:95,[id('생명의 흐름')]:90}};status='needs-hp-trace';note='95% / 90% 명시. 실제 HP 기록 없어서 원본 결과 계산 보류.';}
 if(b.id==='159'){order=['암습','사격','쇠뇌 사격','이중 사격','삼단 찌르기','연속 찌르기','내려찍기','생명의 흐름','생명의 축복'].map(id);status='needs-hp-trace-and-threshold';note='본문 실제 순서 반영. 축복 95–98%, 흐름 85–90% 범위만 명시. 단일 임계값과 HP 기록 필요.';}
 if(['155','154'].includes(b.id)){status='needs-hp-trace-and-threshold';note='보조 도술 HP 조건 권장, 임계값과 HP 기록 없음.';}
 if(b.id==='144'){status='needs-opener-record';note='자동 전투 중 부적 수동 사용으로 첫 궁 3중첩 권장. 정확한 순서·시점 미명시, 임의로 3회 시전하지 않음.';}
 if(b.id==='169')hypotheses=[80,100].map(percent=>({assumption:`HP ${percent}% 고정 외부 입력; 회복 피드백 없는 판정 테스트`,runs:score(order,base,group,{...policy,hpTrace:[{time:0,percent},{time:180,percent}]})}));
 const after=status.startsWith('needs-')?null:score(order,base,group,policy);
 const blocked=policy&&status==='needs-hp-trace'?score(order,base,group,policy):null;
 return {id:b.id,title:b.title,votes:b.votes,status,note,policy,order:order.map(i=>D.skills.find(s=>s.id===i).name),before,after,blocked,hypotheses};
});
const report={schema:'dosul-community-policy-v1',hitFeedback:args.includes('--planned')?'planned':'actual',source:fixture.source,capturedAt:fixture.capturedAt,settings:{attack:20532,monsterHp:45000,horizon:180},limitations:['운용 정책만 비교, 추천 가중치·스킬 수치 조정 없음','HP 기록 판정은 외부 입력 재생이며 생존 폐루프 시뮬레이션 아님','조건 미상은 임의로 채우지 않고 결과 보류','원본 장착 미확인: 궁극기 계열 3개 기본 장착 가정','23개 공개 사례를 모두 진단에 사용; 독립 검증 표본 아님'],rows};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify(rows.map(r=>({id:r.id,status:r.status,before:Math.min(...r.before.map(x=>x.power)),after:r.after?Math.min(...r.after.map(x=>x.power)):null})),null,2));
