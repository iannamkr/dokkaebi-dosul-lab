#!/usr/bin/env node
'use strict';
// Writes dist/kkaebi-gg/hunting.js (window.DOSUL_HUNTING) from hunting.json for the build optimizer.
// Spawn coordinates (% of the map image) are kept: the optimizer turns them into monster density around the player.
const fs=require('node:fs'),path=require('node:path');
const DIR=path.resolve(__dirname,'../dist/kkaebi-gg');
function compact(h){
 return {source:h.source,fetchedAt:h.fetchedAt,zones:h.zones.map(z=>({id:z.id,name:z.name,region:z.region,recommendedPower:z.recommendedPower,subZones:z.subZones,levels:z.levels,coins:z.coins,map:z.map?{width:z.map.width,height:z.map.height}:null,
  monsters:z.monsters.map(m=>({name:m.name,level:m.level,hp:m.hp,attack:m.attack,defense:m.defense,spawns:m.spawn?.count||0,points:m.spawn?.points||[]}))}))};
}
function script(h){return 'window.DOSUL_HUNTING = '+JSON.stringify(compact(h))+';\n';}
module.exports={compact,script};
if(require.main===module){
 const h=JSON.parse(fs.readFileSync(path.join(DIR,'hunting.json'),'utf8'));
 fs.writeFileSync(path.join(DIR,'hunting.js'),script(h));
 console.log(`사냥터 ${h.zones.length}곳 · 몬스터 ${h.zones.reduce((a,z)=>a+z.monsters.length,0)}종 → dist/kkaebi-gg/hunting.js`);
}
