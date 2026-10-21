(function(root){
'use strict';

const clean=value=>String(value||'').normalize('NFKC').replace(/[^가-힣A-Za-z0-9]/g,'').toLowerCase();
function distance(a,b){a=clean(a);b=clean(b);if(!a.length)return b.length;if(!b.length)return a.length;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let prior=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const hold=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prior+(a[i-1]===b[j-1]?0:1));prior=hold;}}return row[b.length];}
function similarity(a,b){a=clean(a);b=clean(b);if(!a||!b)return 0;if(a.includes(b)||b.includes(a))return Math.min(a.length,b.length)/Math.max(a.length,b.length);let best=distance(a,b)/Math.max(a.length,b.length);const min=Math.max(1,b.length-2),max=Math.min(a.length,b.length+2);for(let size=min;size<=max;size++)for(let i=0;i+size<=a.length;i++)best=Math.min(best,distance(a.slice(i,i+size),b)/Math.max(size,b.length));return 1-best;}
function matchText(text,skills){const source=clean(text),found=[];for(const skill of skills){const name=clean(skill.name),at=source.indexOf(name);if(at>=0)found.push({id:skill.id,name:skill.name,ultimate:!!skill.ultimate,position:at,score:1,method:'text'});}return found.sort((a,b)=>a.position-b.position);}
function matchWordColumns(words,width,height,skills){
 const rows=(words||[]).map(w=>({text:String(w.text||''),left:w.bbox?.x0??w.left??0,right:w.bbox?.x1??w.right??0,top:w.bbox?.y0??w.top??0,bottom:w.bbox?.y1??w.bottom??0,confidence:Number(w.confidence??100)})).filter(w=>w.confidence>=20&&/[가-힣]/.test(w.text));
 if(!rows.length)return[];
 const headings=rows.filter(w=>/사용|순서|설정/.test(w.text)&&w.top<height*.55),headingBottom=headings.length?Math.max(...headings.map(w=>w.bottom)):null;
 let labels=rows.filter(w=>headingBottom===null||((w.top>headingBottom+3)&&(w.top<headingBottom+Math.max(180,height*.32))));
 if(labels.length<5)labels=rows.filter(w=>w.top>height*.38);
 if(labels.length<5)return matchText(rows.map(w=>w.text).join(' '),skills);
 const centers=labels.map(w=>(w.left+w.right)/2),min=Math.min(...centers),max=Math.max(...centers),step=(max-min)/8||width/9,columns=Array.from({length:9},()=>[]);
 for(const word of labels){const index=Math.max(0,Math.min(8,Math.round(((word.left+word.right)/2-min)/step)));columns[index].push(word);}
 const used=new Set(),matches=[];
 for(let index=0;index<columns.length;index++){
  const wordsInColumn=columns[index].sort((a,b)=>a.top-b.top||a.left-b.left),value=wordsInColumn.map(w=>w.text).join('');if(!clean(value))continue;
  const ranked=skills.filter(s=>!used.has(s.id)&&(index===8?!!s.ultimate:!s.ultimate)).map(s=>({skill:s,score:similarity(value,s.name)})).sort((a,b)=>b.score-a.score);
  if(ranked[0]&&ranked[0].score>=(clean(ranked[0].skill.name).length<=2?.84:.58)){used.add(ranked[0].skill.id);matches.push({id:ranked[0].skill.id,name:ranked[0].skill.name,ultimate:!!ranked[0].skill.ultimate,position:index,score:ranked[0].score,method:'ocr'});}
 }
 return matches;
}
function validBuild(matches){const unique=[...new Map((matches||[]).map(x=>[x.id,x])).values()].sort((a,b)=>a.position-b.position),normal=unique.filter(x=>!x.ultimate),ultimate=unique.filter(x=>x.ultimate);return {complete:normal.length===8&&ultimate.length===1,normal,ultimate,ids:[...normal.map(x=>x.id),...(ultimate[0]?[ultimate[0].id]:[])]};}

const api={clean,distance,similarity,matchText,matchWordColumns,validBuild};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.DosulBuildImageImport=api;
if(typeof document==='undefined')return;

const input=document.querySelector('#build-image-import'),status=document.querySelector('#build-image-import-status'),button=input?.closest('.build-image-import-button');
if(!input||!root.DOSUL_DATA)return;
const skills=root.DOSUL_DATA.skills||[];
const setStatus=value=>{status.textContent=value;};
function canvasFromFile(file){return new Promise(async(resolve,reject)=>{try{const bitmap=await createImageBitmap(file),scale=Math.max(1,Math.min(2.5,1500/bitmap.width)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();resolve(canvas);}catch(error){reject(error);}});}
function isGold(r,g,b){return r>135&&g>55&&g<205&&b<115&&r-g>28&&g-b>12;}
function overlap(a,b){const x=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left)),y=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));return x*y/Math.max(1,Math.min((a.right-a.left)*(a.bottom-a.top),(b.right-b.left)*(b.bottom-b.top)));}
function detectIconBoxes(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),{width,height}=canvas,data=ctx.getImageData(0,0,width,height).data,mask=new Uint8Array(width*height),seen=new Uint8Array(width*height);for(let i=0,p=0;i<data.length;i+=4,p++)if(isGold(data[i],data[i+1],data[i+2]))mask[p]=1;
 const components=[];for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;const stack=[start];seen[start]=1;let left=width,right=0,top=height,bottom=0,count=0;while(stack.length){const p=stack.pop(),x=p%width,y=(p/width)|0;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;for(const n of [p-1,p+1,p-width,p+width])if(n>=0&&n<mask.length&&!seen[n]&&mask[n]&&(Math.abs((n%width)-x)<=1)){seen[n]=1;stack.push(n);}}
  const w=right-left+1,h=bottom-top+1;if(count>35&&w>=24&&h>=24&&w<=150&&h<=150&&w/h>.55&&w/h<1.65)components.push({left,right:right+1,top,bottom:bottom+1,count});
 }
 const ranked=components.sort((a,b)=>b.count-a.count),kept=[];for(const box of ranked){if(kept.some(x=>overlap(x,box)>.35||Math.hypot((x.left+x.right-box.left-box.right)/2,(x.top+x.bottom-box.top-box.bottom)/2)<Math.min(x.right-x.left,box.right-box.left)*.55))continue;kept.push(box);}
 const rows=[];for(const box of kept){let row=rows.find(r=>Math.abs(r.y-(box.top+box.bottom)/2)<Math.max(12,(box.bottom-box.top)*.55));if(!row){row={y:(box.top+box.bottom)/2,boxes:[]};rows.push(row);}row.boxes.push(box);}
 const best=rows.filter(r=>r.boxes.length>=5).sort((a,b)=>Math.abs(9-a.boxes.length)-Math.abs(9-b.boxes.length)||b.boxes.length-a.boxes.length)[0],boxes=(best?.boxes||[]).sort((a,b)=>a.left-b.left).slice(0,9);
 // The ultimate uses a hexagonal frame in-game, so only the eight normal square frames may form gold components.
 if(boxes.length===8){const centers=boxes.map(b=>(b.left+b.right)/2),steps=centers.slice(1).map((x,i)=>x-centers[i]).sort((a,b)=>a-b),step=steps[Math.floor(steps.length/2)],last=boxes.at(-1),size=Math.round(boxes.reduce((n,b)=>n+Math.min(b.right-b.left,b.bottom-b.top),0)/boxes.length),center=centers.at(-1)+step;if(step>size*1.15&&center+size/2<=width+size*.2)boxes.push({left:Math.round(center-size/2),right:Math.round(center+size/2),top:last.top,bottom:last.top+size,count:0,inferred:true});}
 return boxes;
}
function sample(ctx,box,size=20){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const x=box.left,y=box.top,w=box.right-box.left,h=box.bottom-box.top,inset=Math.max(2,Math.round(Math.min(w,h)*.09));canvas.getContext('2d',{willReadFrequently:true}).drawImage(ctx.canvas,x+inset,y+inset,Math.max(1,w-2*inset),Math.max(1,h-2*inset),0,0,size,size);return canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,size,size).data;}
function iconSample(image,size=20){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0,size,size);return canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,size,size).data;}
function pixelScore(a,b,size=20){let sum=0,weight=0;for(let y=1;y<size-1;y++)for(let x=1;x<size-1;x++){if((x>size*.68&&y>size*.5)||(x>size*.7&&y<size*.32))continue;const i=(y*size+x)*4,w=1;for(let c=0;c<3;c++){const d=(a[i+c]-b[i+c])/255;sum+=d*d*w;}weight+=3*w;}return sum/Math.max(1,weight);}
async function iconLibrary(){if(iconLibrary.cache)return iconLibrary.cache;iconLibrary.cache=await Promise.all(skills.map(skill=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({skill,pixels:iconSample(image)});image.onerror=()=>resolve(null);image.src=skill.icon;}))).then(rows=>rows.filter(Boolean));return iconLibrary.cache;}
async function matchIcons(canvas){
 const boxes=detectIconBoxes(canvas);if(boxes.length!==9)return[];const library=await iconLibrary(),ctx=canvas.getContext('2d',{willReadFrequently:true}),pairs=[];
 boxes.forEach((box,index)=>{const pixels=sample(ctx,box),pool=library.filter(x=>index===8?x.skill.ultimate:!x.skill.ultimate);for(const item of pool)pairs.push({index,id:item.skill.id,name:item.skill.name,ultimate:!!item.skill.ultimate,score:pixelScore(pixels,item.pixels),method:'icon'});});
 const usedSkills=new Set(),result=[];for(let index=0;index<boxes.length;index++){const pair=pairs.filter(x=>x.index===index&&!usedSkills.has(x.id)).sort((a,b)=>a.score-b.score)[0];if(!pair||pair.score>.14)continue;usedSkills.add(pair.id);result.push({...pair,score:Math.max(0,1-pair.score),position:index});}return result;
}
function loadOcr(){if(root.Tesseract)return Promise.resolve(root.Tesseract);return new Promise((resolve,reject)=>{const old=document.querySelector('script[data-stat-ocr]');if(old){old.addEventListener('load',()=>resolve(root.Tesseract),{once:true});old.addEventListener('error',()=>reject(Error('OCR 모듈을 불러오지 못했습니다.')),{once:true});if(root.Tesseract)resolve(root.Tesseract);return;}const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.async=true;script.dataset.statOcr='';script.onload=()=>resolve(root.Tesseract);script.onerror=()=>reject(Error('OCR 모듈을 불러오지 못했습니다.'));document.head.append(script);});}
function ocrCanvas(source){const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);const image=ctx.getImageData(0,0,canvas.width,canvas.height),d=image.data;let total=0;for(let i=0;i<d.length;i+=4)total+=d[i]*.299+d[i+1]*.587+d[i+2]*.114;const dark=total/(d.length/4)<135;for(let i=0;i<d.length;i+=4){let v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;if(dark)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.5+128));d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}ctx.putImageData(image,0,0);return canvas;}
async function matchOcr(canvas){const T=await loadOcr(),worker=await T.createWorker('kor+eng',1,{logger:event=>{if(event.status==='recognizing text')setStatus(`이름 확인 중 · ${Math.round((event.progress||0)*100)}%`);}});try{await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:'6'});const result=await worker.recognize(ocrCanvas(canvas)),words=result.data?.words||[];let matches=matchWordColumns(words,canvas.width,canvas.height,skills);if(!validBuild(matches).complete)matches=matchText(result.data?.text||'',skills);return matches;}finally{await worker.terminate();}}
function applyBuild(result){const normal=result.normal.map(x=>x.id),ultimate=result.ultimate[0].id,old=typeof equipmentOrder==='function'?equipmentOrder():[],nextEquipment=[...old.filter(id=>normal.includes(id)),...normal.filter(id=>!old.includes(id))].slice(0,8);remember();builderEquipmentOrder=nextEquipment;commit([...normal,ultimate],0,nextEquipment.slice(0,5));persistEquipment();}
async function recognize(file){if(!file?.type.startsWith('image/'))throw Error('PNG·JPG·WebP 이미지를 선택해 주세요.');if(file.size>12*1024*1024)throw Error('이미지는 12MB 이하만 사용할 수 있습니다.');const canvas=await canvasFromFile(file);setStatus('도술 아이콘 확인 중');let matches=await matchIcons(canvas),result=validBuild(matches);if(!result.complete){setStatus(`아이콘 ${result.normal.length+result.ultimate.length}/9개 확인 · 이름 보강 중`);matches=await matchOcr(canvas);result=validBuild(matches);}if(!result.complete)throw Error(`도술 ${result.normal.length+result.ultimate.length}/9개만 확인했습니다. 사용 순서 전체가 보이게 다시 캡처해 주세요.`);applyBuild(result);setStatus('일반 8개·궁극기 1개 입력 완료');toast('이미지에서 사용 순서 9개를 입력했습니다.');}
input.addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;button.classList.add('is-busy');input.disabled=true;try{await recognize(file);}catch(error){setStatus(error.message);toast(error.message);}finally{button.classList.remove('is-busy');input.disabled=false;input.value='';}});
document.querySelector('#clear')?.addEventListener('click',()=>setStatus(''));
Object.assign(api,{detectIconBoxes,matchIcons,recognize});
})(typeof window==='undefined'?globalThis:window);
