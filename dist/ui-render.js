(function(root){
'use strict';
const previous=new WeakMap(),lists=new WeakMap();let imageInstance=0;
function imageKey(img){return [img.getAttribute('src'),img.className,img.getAttribute('width'),img.getAttribute('height')].join('|');}
function reconcile(host,nodes){const wanted=new Set(nodes);for(const child of [...host.children])if(!wanted.has(child))child.remove();let cursor=host.firstChild;for(const node of nodes){if(node!==cursor)host.insertBefore(node,cursor);cursor=node.nextSibling;}}
function update(host,html){
 if(previous.get(host)===html)return false;
 const template=document.createElement('template');template.innerHTML=html;
 if(host.id==='skill-list'){
  let cache=lists.get(host);if(!cache){cache=new Map();lists.set(host,cache);}
  const nodes=[...template.content.children].map(fresh=>{
   const id=fresh.dataset.select;if(!id)return fresh;
   let node=cache.get(id);if(node&&!!node.querySelector('.list-heading')!==!!fresh.querySelector('.list-heading'))node=null;
   if(!node){node=fresh;cache.set(id,node);return node;}
   node.className=fresh.className;
   const before=node.querySelector('.in-build'),after=fresh.querySelector('.in-build');
   if(before&&after){if(before.textContent!==after.textContent)before.textContent=after.textContent;}
   else if(before)before.remove();else if(after)node.querySelector('.list-heading').append(after);
   return node;
  });
  reconcile(host,nodes);
 }else if(host.id==='candidate-nodes'){
  let cache=lists.get(host);if(!cache){cache=new Map();lists.set(host,cache);}
  const nodes=[...template.content.children].map(fresh=>{
   if(!fresh.id)return fresh;
   let node=cache.get(fresh.id);
   if(!node){node=fresh;cache.set(fresh.id,node);previous.set(node,fresh.innerHTML);}
   else{node.className=fresh.className;update(node,fresh.innerHTML);}
   return node;
  });reconcile(host,nodes);
 }else{
  const images=new Map();for(const img of host.querySelectorAll('img')){const key=imageKey(img);if(!images.has(key))images.set(key,[]);images.get(key).push(img);}
  for(const img of template.content.querySelectorAll('img')){const old=images.get(imageKey(img))?.shift();if(old)img.replaceWith(old);}
  host.replaceChildren(template.content);
 }
 for(const img of host.querySelectorAll('img'))if(!img.dataset.iconInstance)img.dataset.iconInstance=String(++imageInstance);
 previous.set(host,html);return true;
}
root.DosulRender={update};
})(window);
