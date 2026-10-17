const assert=require('node:assert/strict');
const H=require('./dist/kkaebi-gg/hunting.json'),maps=require('./dist/kkaebigg/maps.json');
assert.equal(H.zones.length,21);const M=H.zones.flatMap(z=>z.monsters);assert.equal(M.length,385);
// Checksums taken from the kkaebi.gg page at collection time (2026-10-18).
assert.deepEqual({hp:M.reduce((a,m)=>a+m.hp,0),attack:M.reduce((a,m)=>a+m.attack,0),level:M.reduce((a,m)=>a+m.level,0)},{hp:20121738,attack:3375340,level:31181});
for(const z of H.zones){
 assert(z.recommendedPower>0&&z.monsters.length>0,z.name);assert(z.map,z.name+' joins the kkaebigg map by zone id');
 assert(maps.zones.some(m=>String(m.id)===z.id));
 for(const m of z.monsters){assert(m.hp>0&&m.attack>0&&m.level>0,m.name);assert(m.spawn?.count>0&&m.spawn.points.length===m.spawn.count,m.name+' spawn points');}
}
const power=H.zones.map(z=>z.recommendedPower);assert.deepEqual(power,[...power].sort((a,b)=>a-b),'Listed in recommended-power order');
const toxic=H.zones.find(z=>z.name==='독기 지대');assert.deepEqual([...new Set(toxic.monsters.map(m=>m.attack))],[7888,8555]);
console.log('Hunting data: 21 zones, 385 monsters with stats, checksums, spawn join and ordering passed.');
