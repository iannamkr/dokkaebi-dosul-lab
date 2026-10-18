(function(root){
'use strict';
// Korean initial-consonant (초성) search: "ㅅㅁㅇㅎㄹ" finds 생명의 흐름, and mixed input such as "생ㅁ" works too.
// Initial-consonant queries match the short text (name and family) because almost any long description contains
// every consonant; ordinary queries keep matching the full text.
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const strip=s=>String(s??'').replace(/\s+/g,'');
function initial(ch){const c=ch.charCodeAt(0)-0xAC00;return c>=0&&c<11172?CHO[Math.floor(c/588)]:ch;}
function initials(text){return [...String(text??'')].map(initial).join('');}
const hasInitial=q=>[...q].some(ch=>CHO.includes(ch));
// Every query character must equal the text character, or be the initial consonant of that syllable.
function contains(text,query){
 const t=[...strip(text)],q=[...strip(query)];if(!q.length)return true;
 for(let i=0;i+q.length<=t.length;i++){let ok=true;for(let j=0;j<q.length&&ok;j++)ok=t[i+j]===q[j]||(CHO.includes(q[j])&&initial(t[i+j])===q[j]);if(ok)return true;}
 return false;
}
function match(query,full,short=full){
 const q=String(query??'').trim();if(!q)return true;
 return hasInitial(q)?contains(short,q):String(full??'').includes(q)||strip(full).includes(strip(q));
}
const api={initial,initials,contains,match};
if(typeof module!=='undefined')module.exports=api;else root.DosulHangul=api;
})(typeof window!=='undefined'?window:globalThis);
