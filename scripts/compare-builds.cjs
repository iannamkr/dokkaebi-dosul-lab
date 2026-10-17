#!/usr/bin/env node
'use strict';

// Uses the browser's engine without a server, browser state, or external packages.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const Sim = require('../dist/simulation.js');
const Sequence = require('../dist/sequence.js');
const DATA = require('../dist/data.json');
const DEFAULT_CONFIG = path.join(ROOT, 'comparisons/single-defense.json');
const LIMITATIONS = [
  '조건 성립률은 적중 시 선행 효과 유무이며 실제 효과 발동 횟수·보호막 유지율이 아닙니다.',
  '실제 HP·피해·방어력 공식·보호막 흡수/중첩·회복량·처치량·생존 시간은 계산하지 않습니다.',
  '수호 지속시간과 방어력 증가 지속시간은 다릅니다. 방어력 증가 유지율로 해석하지 마세요.',
  '직접 공격계수 합계는 실전 DPS가 아닙니다. 출혈·조건부 피해·방어력 감소·궁극기 증폭 등이 빠져 있습니다.',
  '영상 프리셋은 추정 배치이며 시작부터 3/8마리가 활성화됩니다. 20초마다 가상 재배치하며 순수 1대1 환경이 아닙니다.',
  '방패 밀기 넉백과 도약 찌르기 접근 등 일반 이동/추격은 반영되지 않아 주변 어그로 안전성을 보장하지 않습니다.',
  '단일 대상 분류와 수치에는 비공식 참고값이 있습니다. 실제 레벨·돌파·현행 인게임 수치와 다를 수 있습니다.',
  '사용 순서는 준비된 도술 중 앞쪽 우선입니다. 1→9를 한 번씩 사용하는 고정 순환이 아닙니다.',
  '빌드나 출력 지표에 생존 최적 점수 또는 자동 우승자를 부여하지 않습니다.'
];
const round = n => Math.round(n * 100) / 100;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const check = (condition, message) => { if (!condition) throw Error(message); };
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function safeId(id) { return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id); }
function uniqueArray(value, label, min = 1) {
  check(Array.isArray(value) && value.length >= min && new Set(value).size === value.length, `${label}: 중복 없는 배열이 필요합니다.`);
}
function normalize(config, baseDir = ROOT) {
  check(config?.schema === 'dosul-comparison-v1', 'schema는 dosul-comparison-v1이어야 합니다.');
  const c = structuredClone(config);
  c.profiles ??= Sim.profiles.map(p => p.id);
  c.horizons ??= [60, 120, 180];
  uniqueArray(c.profiles, 'profiles'); uniqueArray(c.horizons, 'horizons');
  check(c.profiles.every(id => Sim.profiles.some(p => p.id === id)), '알 수 없는 profile입니다.');
  check(c.horizons.every(n => Number.isInteger(n) && n >= 20 && n <= 180), 'horizons는 20~180 사이 정수여야 합니다.');
  c.targetRestriction ??= 'any';
  check(['any', 'single'].includes(c.targetRestriction), 'targetRestriction은 any 또는 single입니다.');
  check(Array.isArray(c.builds) && c.builds.length > 0 && c.builds.length <= 50, 'builds는 1~50개 필요합니다.');
  uniqueArray(c.builds.map(b => b.id), 'build id');
  c.builds = c.builds.map(item => {
    check(safeId(item.id), 'build id는 영문/숫자/-/_로 된 안전한 파일명이어야 합니다.');
    check(!(item.file && (item.skills || item.baseSlots)), `${item.id}: file과 직접 skills/baseSlots를 혼용할 수 없습니다.`);
    const v = item.file ? readJSON(path.resolve(baseDir, item.file)) : item;
    check(Array.isArray(v.skills) && v.skills.length > 0, `${item.id}: skills가 비어 있습니다.`);
    // Never silently infer a different equipment set or enable a different shinsik.
    check(Array.isArray(v.baseSlots), `${item.id}: baseSlots를 명시해야 합니다.`);
    const saved = { ...v, schema: v.schema || 'dosul-build-v3' };
    const restored = Sequence.restore(DATA, saved);
    const validation = Sequence.validate({ ...DATA, baseSlots: restored.baseSlots }, restored.ids);
    check(!validation.issues.length, `${item.id}: ${validation.issues.join(' / ')}`);
    if (c.targetRestriction === 'single') {
      check(restored.ids.every(id => DATA.skills.find(s => s.id === id).targeting?.kind === 'single'), `${item.id}: 단일 대상이 아닌 도술이 있습니다.`);
    }
    return { id: item.id, name: item.name || v.name || item.id, schema: 'dosul-build-v3', skills: restored.ids,
      baseSlots: restored.baseSlots, skillNames: restored.ids.map(id => DATA.skills.find(s => s.id === id).name), validation };
  });
  c.conditionProbes ??= []; c.castProbes ??= []; c.opportunityGroups ??= [];
  for (const key of ['conditionProbes', 'castProbes', 'opportunityGroups']) {
    uniqueArray(c[key].map(p => p.id), key, 0);
    check(c[key].every(p => safeId(p.id)), `${key}: 안전한 id가 필요합니다.`);
  }
  for (const p of c.conditionProbes) {
    const s = DATA.skills.find(s => s.id === p.skillId);
    check(s?.conditions.some(x => x.effect === p.effect && x.result === p.result && x.scope === p.scope), `${p.id}: skillId/effect/result/scope와 일치하는 조건이 없습니다.`);
  }
  for (const p of c.castProbes) check(DATA.skills.some(s => s.id === p.skillId), `${p.id}: 알 수 없는 skillId입니다.`);
  for (const p of c.opportunityGroups) {
    uniqueArray(p.conditionProbes || [], p.id + '.conditionProbes', 0);
    uniqueArray(p.castProbes || [], p.id + '.castProbes', 0);
    check((p.conditionProbes?.length || 0) + (p.castProbes?.length || 0) > 0, `${p.id}: 빈 opportunity group입니다.`);
    check((p.conditionProbes || []).every(id => c.conditionProbes.some(x => x.id === id)) && (p.castProbes || []).every(id => c.castProbes.some(x => x.id === id)), `${p.id}: 알 수 없는 probe입니다.`);
  }
  return c;
}
function maxGap(times, horizon) {
  const ordered = [0, ...new Set(times.filter(t => t >= 0 && t <= horizon))].sort((a, b) => a - b);
  ordered.push(horizon);
  return round(Math.max(...ordered.slice(1).map((t, i) => t - ordered[i])));
}
function matchingConditions(run, probe) {
  return run.conditions.filter(c => c.id === probe.skillId && c.effect === probe.effect && c.result === probe.result && c.scope === probe.scope);
}
function conditionStats(run, probe, skills) {
  const present = skills.includes(probe.skillId), checks = matchingConditions(run, probe);
  const yes = checks.filter(c => c.status === 'yes');
  return { present, checks: checks.length, pass: yes.length, fail: checks.filter(c => c.status === 'no').length,
    unknown: checks.filter(c => c.status === 'unknown').length,
    rate: checks.length ? round(100 * yes.length / checks.length) : null,
    maxEligibleHitGap: present ? maxGap(yes.map(c => c.time), run.horizon) : null,
    failureReasons: checks.filter(c => c.status !== 'yes').reduce((a, c) => { a[c.reason] = (a[c.reason] || 0) + 1; return a; }, {}) };
}
function summarize(run, build, config) {
  const conditions = Object.fromEntries(config.conditionProbes.map(p => [p.id, conditionStats(run, p, build.skills)]));
  const castTimes = p => run.schedule.events.filter(e => e.id === p.skillId && e.completed).map(e => e.end);
  const casts = Object.fromEntries(config.castProbes.map(p => [p.id, { present: build.skills.includes(p.skillId), completedCasts: castTimes(p).length }]));
  const opportunities = Object.fromEntries(config.opportunityGroups.map(p => {
    const cps = config.conditionProbes.filter(x => (p.conditionProbes || []).includes(x.id));
    const dps = config.castProbes.filter(x => (p.castProbes || []).includes(x.id));
    const present = [...cps, ...dps].some(x => build.skills.includes(x.skillId));
    const times = cps.flatMap(x => matchingConditions(run, x).filter(c => c.status === 'yes').map(c => c.time)).concat(dps.flatMap(castTimes));
    return [p.id, { present, maxGapIncludingEdges: present ? maxGap(times, run.horizon) : null }];
  }));
  return { profile: run.profile, horizon: run.horizon, metrics: run.metrics, conditions, casts, opportunities,
    completedCasts: run.schedule.casts, waitSeconds: round(run.schedule.wait), activeShinsik: run.schedule.active,
    bySkill: run.rows.map(x => ({ id: x.id, name: x.name, casts: x.casts, hitChecks: x.hitChecks, targetHits: x.targetHits, referenceCoefficient: x.coefficient, unknown: x.unknown })),
    excluded: run.excluded, issues: run.issues };
}
function provenance(config) {
  let gitCommit = null;
  try { gitCommit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  const files = ['dist/simulation.js', 'dist/combat.js', 'dist/hit-timing.js', 'dist/timing-auto.js', 'dist/sequence.js', 'dist/data.json', 'scripts/compare-builds.cjs'];
  return { nodeVersion: process.version, gitCommit, configSha256: hash(JSON.stringify(config)),
    fileSha256: Object.fromEntries(files.map(f => [f, hash(fs.readFileSync(path.join(ROOT, f)))])) };
}
function compare(config, { baseDir = ROOT, verify = false, traces = 'max' } = {}) {
  check(['none', 'max', 'all'].includes(traces), 'traces는 none/max/all입니다.');
  const c = normalize(config, baseDir), records = [];
  const report = { schema: 'dosul-comparison-result-v1', createdAt: new Date().toISOString(), model: Sim.model,
    provenance: provenance(c), config: c, limitations: LIMITATIONS, recommendation: null,
    verification: { runs: 0, deterministicReruns: 0, importRoundTrips: 0, singleTargetImpactChecks: 0 }, builds: [] };
  for (const build of c.builds) {
    const data = { ...DATA, baseSlots: build.baseSlots }, runs = [];
    const imported = Sequence.restore(DATA, build);
    assert.deepEqual(imported.ids, build.skills); assert.deepEqual(imported.baseSlots, build.baseSlots);
    report.verification.importRoundTrips++;
    for (const horizon of c.horizons) for (const profile of c.profiles) {
      const run = Sim.run(data, build.skills, profile, horizon);
      check(!run.validation.issues.length && !run.schedule.missing.length, `${build.id}/${profile}/${horizon}: ${[...run.validation.issues, ...run.schedule.missing].join(' / ')}`);
      if (c.targetRestriction === 'single') {
        assert(run.impacts.every(i => i.targets.length <= 1), '단일 공격의 대상 수가 1을 초과합니다.');
        report.verification.singleTargetImpactChecks += run.impacts.length;
      }
      const summary = summarize(run, build, c);
      if (verify) {
        const again = Sim.run(data, build.skills, profile, horizon);
        assert.deepEqual(summarize(again, build, c), summary, '동일 입력의 결과가 다릅니다.');
        assert.deepEqual(again.conditions, run.conditions); assert.deepEqual(again.schedule, run.schedule);
        report.verification.deterministicReruns++;
      }
      runs.push(summary); report.verification.runs++;
      if (traces === 'all' || (traces === 'max' && horizon === Math.max(...c.horizons))) {
        records.push({ filename: `${build.id}-${profile}-${horizon}-trace.json`, value: { model: Sim.model, build, profile, horizon,
          schedule: run.schedule, conditions: run.conditions, effectApplications: run.effectApplications, impacts: run.impacts,
          metrics: run.metrics, excluded: run.excluded, issues: run.issues } });
      }
    }
    report.builds.push({ ...build, runs });
  }
  return { report, traces: records };
}
function csv(report) {
  const rows = [['build', 'name', 'profile', 'seconds', 'category', 'probe', 'metric', 'value']];
  for (const b of report.builds) for (const r of b.runs) {
    for (const [category, probes] of Object.entries({ conditions: r.conditions, casts: r.casts, opportunities: r.opportunities })) {
      for (const [id, metrics] of Object.entries(probes)) for (const [key, value] of Object.entries(metrics)) {
        if (value !== null && typeof value === 'object') continue;
        rows.push([b.id, b.name, r.profile, r.horizon, category, id, key, value ?? '']);
      }
    }
    for (const [key, value] of Object.entries(r.metrics)) rows.push([b.id, b.name, r.profile, r.horizon, 'engine', '', key, value ?? '']);
  }
  // Spreadsheet formula injection prevention for custom human-supplied names.
  const cell = value => { let s = String(value); if (/^[=+@-]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
function summaryText(report) {
  const lines = [report.config.name || '도술 구성 비교', '', `모델: ${report.model}`, `실행 ${report.verification.runs}회 / 결정성 재검증 ${report.verification.deterministicReruns}회`,
    '자동 우승자 없음. 조건 성립률을 보호막 유지율/생존율로 해석하지 마세요.', ''];
  for (const b of report.builds) {
    lines.push(`${b.id}: ${b.name}`, b.skillNames.join(' → '));
    for (const p of report.config.conditionProbes) {
      const rates = b.runs.map(r => r.conditions[p.id].rate).filter(v => v !== null);
      lines.push(`  ${p.label || p.id}: ${rates.length ? `${Math.min(...rates)}~${Math.max(...rates)}%` : '판정 없음'} (전체 환경/시간 범위)`);
    }
    lines.push('');
  }
  lines.push('해석 한계', ...report.limitations.map(x => '- ' + x));
  return lines.join('\n') + '\n';
}
function writeResults(result, destination) {
  const out = path.resolve(destination);
  // No destructive overwrite and no partial success before all calculations validate.
  check(!fs.existsSync(out) || (fs.statSync(out).isDirectory() && fs.readdirSync(out).length === 0), '출력 경로는 없거나 비어 있는 폴더여야 합니다. 새 --out 경로를 지정하세요.');
  fs.mkdirSync(out, { recursive: true });
  const json = (file, value) => fs.writeFileSync(path.join(out, file), JSON.stringify(value, null, 2) + '\n');
  json('comparison.json', result.report);
  fs.writeFileSync(path.join(out, 'comparison.csv'), csv(result.report));
  fs.writeFileSync(path.join(out, 'summary.txt'), summaryText(result.report));
  for (const b of result.report.builds) { const { runs, ...build } = b; json(`${b.id}-build.json`, build); }
  for (const t of result.traces) json(t.filename, t.value);
  return out;
}
function parseArgs(args) {
  const o = { config: DEFAULT_CONFIG, traces: 'max', verify: false };
  const values = ['--config', '--out', '--profiles', '--horizons', '--traces'];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--verify') o.verify = true;
    else if (values.includes(a)) { check(args[i + 1] && !args[i + 1].startsWith('--'), `${a}: 값이 필요합니다.`); o[a.slice(2)] = args[++i]; }
    else throw Error(`알 수 없는 옵션: ${a}`);
  }
  return o;
}
function main(args = process.argv.slice(2)) {
  const opts = parseArgs(args);
  if (opts.help) { console.log('node scripts/compare-builds.cjs [--config FILE] [--out NEW_DIR] [--profiles 185547,190057] [--horizons 60,120,180] [--traces none|max|all] [--verify]\n기본값: comparisons/single-defense.json, 모든 프리셋, 60/120/180초. 서버/설치 불필요.'); return; }
  const file = path.resolve(opts.config), config = readJSON(file);
  if (opts.profiles) config.profiles = opts.profiles.split(',');
  if (opts.horizons) config.horizons = opts.horizons.split(',').map(Number);
  const result = compare(config, { baseDir: path.dirname(file), verify: opts.verify, traces: opts.traces });
  const defaultOut = path.join(ROOT, 'reports', `comparison-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  const out = writeResults(result, opts.out || defaultOut);
  console.log(summaryText(result.report)); console.log(`결과: ${out}`);
}
if (require.main === module) { try { main(); } catch (e) { console.error('비교 실패: ' + e.message); process.exitCode = 1; } }
module.exports = { normalize, compare, summarize, conditionStats, maxGap, csv, writeResults, parseArgs, main };
