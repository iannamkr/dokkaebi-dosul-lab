const assert=require('node:assert/strict'),H=require('./dist/hangul.js'),D=require('./dist/data.json');
assert.equal(H.initials('생명의 흐름'),'ㅅㅁㅇ ㅎㄹ');assert.equal(H.initial('A'),'A');
// Initial consonants, mixed input and spaces.
assert(H.match('ㅅㅁㅇㅎㄹ','','생명의 흐름 헌신'));assert(H.match('ㅅㅁ ㅇㅎ','','생명의 흐름'));assert(H.match('생ㅁ','','생명의 흐름'));
assert(H.match('ㄲㅂ','','깨비'),'Double consonants');assert(!H.match('ㅂㅅ','','생명의 흐름'));
// Plain text keeps searching the full description; spaces are optional.
assert(H.match('보호막','휘둘러 내려치기 낙인 상태인 적에게 보호막','휘둘러 내려치기'));assert(H.match('생명의흐름','생명의 흐름 회복'));assert(H.match('',''));
// 초성 searches only the name and family, so a description full of consonants does not match everything.
assert(!H.match('ㅂㅎㅁ','보호막을 얻습니다','찌르기 절명'));
// Every skill can be found by the initials of its name, and the result stays narrow.
for(const s of D.skills){const q=H.initials(s.name).replace(/\s+/g,'');assert(H.match(q,'',s.name+' '+s.family),s.name);}
const hits=D.skills.filter(s=>H.match('ㅅㅁㅇㅎㄹ','',s.name+' '+s.family)).map(s=>s.name);assert.deepEqual(hits,['생명의 흐름']);
console.log('Hangul search: initial consonants, mixed input, spaces, name-only 초성 and all 105 skill names passed.');
