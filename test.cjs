const fs=require('fs'),assert=require('assert/strict');
const D=JSON.parse(fs.readFileSync('dist/data.json','utf8')),G=require('./dist/graph.js'),E=G.buildGraph(D);
const id=n=>D.skills.find(s=>s.name===n).id;
const has=(a,b,effect,type='explicit')=>E.find(e=>e.source===id(a)&&e.target===id(b)&&e.effect===effect&&e.type===type);
assert.equal(D.skills.length,105);assert.equal(new Set(D.skills.map(s=>s.id)).size,105);assert.equal(D.skills.filter(s=>s.ultimate).length,12);
for(const s of D.skills){assert(D.sources.some(x=>x.id===s.source));assert(D.families[s.family]);}
assert(has('환영 참격','심장 절단','출혈'));
assert(has('얼음 감옥','폭발하는 화살','빙결'));
assert(has('폭발하는 화살','폭주','화상'));
assert(has('방패 치기','도약 찌르기','수호'));
assert(has('삼단 찌르기','낙뢰','관통'));
assert(!has('찌르기','이중 사격','속공'),'unconfirmed alias must not be silently merged');
assert(has('찌르기','이중 사격','질풍'),'individual current effect names must form the matching link');
assert(!has('용맹의 기운','심장 절단','주는 피해 증가','general'),'ally-only buff must not become unconditional self synergy');
assert(has('천벌','심장 절단','방어력 감소','general').requires.includes('최대 차지'));
assert.equal(has('천벌','심장 절단','방어력 감소','general').requirementScope,'self');
assert(has('도깨비 불','심장 절단','변이','conflict'));
assert(!has('생명의 흐름','심장 절단','지속 회복','general'));
assert(has('부적 던지기','심장 절단','주술 구슬','resource').knownBug);
assert.equal(has('부적 던지기','살 날리기','주술 구슬','resource').knownBug,null);
assert.equal(G.activeUltimate(D,['찌르기','삼단 찌르기','환영 참격'].map(id)).name,'암습');
assert.equal(G.activeUltimate(D,['찌르기','환영 참격','화염구'].map(id)),null);
const reach=G.reachable(E,id('얼음 감옥'),2);assert(reach.has(id('폭주')));assert(reach.has(id('정조준')));
for(const e of E){assert(e.source!==e.target);assert(D.skills.some(s=>s.id===e.source));assert(D.skills.some(s=>s.id===e.target));}
fs.writeFileSync('dist/graph.json',JSON.stringify({meta:D.meta,sources:D.sources,nodes:D.skills,edges:E},null,2));
console.log(JSON.stringify({skills:105,families:12,edges:Object.fromEntries(['explicit','general','resource','conflict'].map(t=>[t,E.filter(e=>e.type===t).length])),checks:'passed'}));
