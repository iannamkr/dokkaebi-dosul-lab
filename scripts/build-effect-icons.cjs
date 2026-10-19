const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'dist/data.json'), 'utf8'));
const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'dist/kkaebigg/buffs.json'), 'utf8'));
const names = new Set();
const kindHint = new Map();
const add = (name, kind) => {
  if (typeof name !== 'string' || !name.trim()) return;
  name = name.trim();
  names.add(name);
  if (kind && !kindHint.has(name)) kindHint.set(name, kind);
};

for (const skill of data.skills || []) {
  for (const name of skill.buffs || []) add(name, 'buff');
  for (const name of skill.debuffs || []) add(name, 'debuff');
  for (const row of skill.referenceDetail?.buffs || []) add(row.name, 'buff');
  for (const row of skill.referenceDetail?.debuffs || []) add(row.name, 'debuff');
  for (const row of skill.conditions || []) {
    add(row.effect, row.scope === 'enemy' ? 'debuff' : 'buff');
    add(row.result, row.resultScope === 'enemy' ? 'debuff' : 'buff');
  }
}

const aliases = {
  '강화 제거': ['모든 강화 효과 해제', 'icon_buff_unstoppable.webp', 'debuff'],
  '공격력 증가': ['풀 차지 시 공격력 증가', 'icon_buff_attack.webp', 'buff'],
  '기존 타격 피해 증가': ['피해 증가', 'icon_buff_sword_master.webp', 'buff'],
  '대상 체력 25% 이하': ['피해 증가 (척살)', 'icon_buff_hp_below_50.webp', 'etc'],
  '대상 체력 50% 이하': ['피해 증가 (척살)', 'icon_buff_hp_below_50.webp', 'etc'],
  '대상 체력 50% 이상': ['피해 증가 (척살)', 'icon_buff_hp_above_50.webp', 'etc'],
  '대상 체력 75% 이상': ['피해 증가 (척살)', 'icon_buff_hp_above_50.webp', 'etc'],
  '도술 재사용 대기시간 감소': ['도술 재사용 대기시간 감소', 'icon_buff_skill_cooldown.webp', 'buff'],
  '매 타격 추가 피해': ['추가 피해', 'icon_buff_additional_damage_stun.webp', 'buff'],
  '면역': ['면역', 'icon_buff_superarmor.webp', 'buff'],
  '모든 약화 효과 해제': ['모든 약화 효과 해제', 'icon_buff_unstoppable.webp', 'buff'],
  '보호막 제거 및 추가 피해': ['파쇄 (보호막 제거/추가 피해)', 'icon_buff_mark_crush.webp', 'buff'],
  '상태 이상 면역': ['면역', 'icon_buff_superarmor.webp', 'buff'],
  '자신에게 면역': ['면역', 'icon_buff_superarmor.webp', 'buff'],
  '상태별 피해 증가': ['피해 증가 (상태이상)', 'icon_buff_damage_increase_status_effect.webp', 'buff'],
  '시전 회복량 감소': ['회복량 감소', 'icon_buff_taunt.webp', 'debuff'],
  '약화 해제': ['모든 약화 효과 해제', 'icon_buff_unstoppable.webp', 'buff'],
  '은신 탐지': ['탐지 (은신)', 'icon_buff_revealing_eye.webp', 'buff'],
  '재사용 대기시간 감소': ['도술 재사용 대기시간 감소', 'icon_buff_skill_cooldown.webp', 'buff'],
  '즉시 회복': ['체력 회복', 'icon_buff_hp.webp', 'buff'],
  '지속 회복': ['체력 지속 회복', 'icon_buff_hp.webp', 'buff'],
  '최대 차지': ['풀 차지 시 공격력 증가', 'icon_buff_attack.webp', 'etc'],
  '추가 피해': ['추가 피해', 'icon_buff_additional_damage_stun.webp', 'buff'],
  '추가 피해 (속박)': ['추가 피해 (속박)', 'icon_buff_additional_damage_stun.webp', 'buff'],
  '추가 피해 (출혈)': ['추가 피해 (출혈)', 'icon_buff_damage_increase_bleeding.webp', 'buff'],
  '피해 증가 (마비)': ['피해 증가 (마비)', 'icon_buff_damage_increase_status_effect.webp', 'buff'],
};

function normalizedKind(group, fallback) {
  if (group?.k === 'mark') return 'mark';
  if (group?.k === 'cc' || group?.t === 'CC') return 'cc';
  if (group?.k === 'debuff' || group?.t === 'DEBUFF') return 'debuff';
  if (group?.k === 'buff' || group?.t === 'BUFF') return 'buff';
  return fallback || 'etc';
}

const entries = {};
for (const name of [...names].sort((a, b) => a.localeCompare(b, 'ko'))) {
  let group = dictionary.groups.find(g => g.n === name && g.ic);
  let icon = group?.ic;
  let kind = normalizedKind(group, kindHint.get(name));
  let sourceName = group?.n || name;
  if (!icon && aliases[name]) {
    [sourceName, icon, kind] = aliases[name];
  }
  if (!icon) {
    const candidates = dictionary.groups.filter(g => g.ic && typeof g.n === 'string' && (g.n.includes(name) || name.includes(g.n)));
    group = candidates[0];
    icon = group?.ic;
    sourceName = group?.n || name;
    kind = normalizedKind(group, kind);
  }
  if (icon) entries[name] = { file: icon, kind, sourceName };
}

const assetDir = path.join(root, 'dist/assets/effects');
fs.mkdirSync(assetDir, { recursive: true });
function download(file) {
  const dest = path.join(assetDir, file);
  if (fs.existsSync(dest)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    https.get('https://kkaebigg.com/assets/buffs/' + encodeURIComponent(file), res => {
      if (res.statusCode !== 200) {
        out.close();
        fs.rmSync(dest, { force: true });
        reject(new Error(`${file}: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
    }).on('error', error => { out.close(); fs.rmSync(dest, { force: true }); reject(error); });
  });
}

Promise.all([...new Set(Object.values(entries).map(x => x.file))].map(download)).then(() => {
  const output = {
    source: 'https://kkaebigg.com/buffs/',
    generatedFrom: 'dist/kkaebigg/buffs.json',
    icons: Object.fromEntries(Object.entries(entries).map(([name, x]) => [name, {
      src: `assets/effects/${x.file}`,
      kind: x.kind,
      sourceName: x.sourceName,
    }])),
    unmapped: [...names].filter(name => !entries[name]),
  };
  const api=`\nwindow.DosulEffectIcons={\n  entry(name){const value=window.DOSUL_EFFECT_ICONS?.icons?.[name];if(!value)return null;return typeof value==='string'?{src:value,kind:'etc',sourceName:name}:value;},\n  src(name){return this.entry(name)?.src||'';},\n  kind(name,fallback='etc'){return this.entry(name)?.kind||fallback;},\n  sourceName(name){return this.entry(name)?.sourceName||name;},\n  names(){return Object.keys(window.DOSUL_EFFECT_ICONS?.icons||{});}\n};\n`;
  fs.writeFileSync(path.join(root, 'dist/effect-icons.js'), 'window.DOSUL_EFFECT_ICONS=' + JSON.stringify(output, null, 2) + ';\n' + api);
  console.log(`mapped=${Object.keys(entries).length} unmapped=${output.unmapped.length} assets=${new Set(Object.values(entries).map(x => x.file)).size}`);
  if (output.unmapped.length) console.log(output.unmapped.join('\n'));
}).catch(error => { console.error(error); process.exitCode = 1; });
