const D=require('./dist/data.json'),O=require('./dist/optimizer.js'),H=require('./dist/kkaebi-gg/hunting.json');
const dok=H.zones.find(z=>z.id==='101011'),ruin=H.zones.find(z=>z.id==='101014');
console.log('density',O.density(dok).toFixed(4),'per screen',(O.density(dok)*876).toFixed(1),'pull2m',O.pull(dok,2).toFixed(2),'pull5m',O.pull(dok,5).toFixed(2),'| ruin per screen',(O.density(ruin)*876).toFixed(1));
const id=n=>D.skills.find(s=>s.name===n).id;
const cur=["s071","s003","s012","s069","s010","s085","s007","s001","s075"],curBase=["s071","s003","s012","s007","s001"];
const rec=['불굴','방패 밀기','얼음화살','내려찍기','암습','연속 찌르기','방패 충격파','찌르기','강인한 의지'].map(id),recBase=['얼음화살','내려찍기','강인한 의지','찌르기','연속 찌르기'].map(id);
const stats={attack:20532,maxHp:101115,regen:2751,regenPeriod:5},overrides={'s085:0':'542'},regen=O.regenPerMin(stats);
// measurement with the single build: 90540 -> 96787 in 120 s
const base=O.evaluate(D,cur,curBase,{stats,overrides,profile:'185547',horizon:180,zone:dok,keepRun:true});
const I=O.calibrate({sustainAt:base.sustainAt,stats,hpStart:90540,hpEnd:96787,seconds:120}),perMob=I/base.attackers;
console.log('measured incoming',Math.round(I),'attackers',base.attackers,'per monster',Math.round(perMob),'kills/min',base.power);
for(const [n,i,b] of [['current',cur,curBase],['recommended',rec,recBase]]){
 const r=O.evaluate(D,i,b,{stats,overrides,profile:'185547',horizon:180,zone:dok,perMob,regenPerMin:regen,margin:0});
 console.log(n,'attackers',r.attackers,'kills/min',r.power,'incoming',Math.round(r.incoming),'sustain',Math.round(r.perMin),'need',Math.round(r.need),'net HP/min',Math.round(r.perMin-r.need));
}
