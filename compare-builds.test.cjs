'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const T = require('./scripts/compare-builds.cjs');
const preset = require('./comparisons/single-defense.json');
const clone = x => structuredClone(x);
const small = () => ({ ...clone(preset), builds: [clone(preset.builds[0])], profiles: ['185547'], horizons: [60] });

const result = T.compare(preset, { verify: true, traces: 'max' });
assert.equal(result.report.verification.runs, 84);
assert.equal(result.report.verification.deterministicReruns, 84);
assert.equal(result.report.verification.importRoundTrips, 7);
assert.equal(result.traces.length, 28);
assert.equal(result.report.recommendation, null, 'Never declare a survival winner from a no-HP model');
const c = result.report.builds.find(b => b.id === 'C').runs.find(r => r.profile === '185547' && r.horizon === 180);
assert.deepEqual([c.conditions.heal.pass, c.conditions.heal.fail], [48, 0]);
assert.deepEqual([c.conditions.markShield.pass, c.conditions.markShield.fail], [76, 9]);
assert.deepEqual([c.conditions.guardShield.pass, c.conditions.guardShield.fail], [16, 7]);
assert.equal(c.casts.directShield.completedCasts, 23);
assert.equal(c.opportunities.shield.maxGapIncludingEdges, 8);
assert(result.report.provenance.fileSha256['dist/data.json'].match(/^[a-f0-9]{64}$/));

// Unknown and absent are not a successful condition, zero cooldown, or a real proc count.
const probe = preset.conditionProbes[0];
const synthetic = { horizon: 20, conditions: [
  { id: 's007', effect: '낙인', result: '체력 회복', scope: 'enemy', status: 'yes', time: 4 },
  { id: 's007', effect: '낙인', result: '체력 회복', scope: 'enemy', status: 'no', reason: 'expired', time: 10 },
  { id: 's007', effect: '낙인', result: '체력 회복', scope: 'enemy', status: 'unknown', reason: 'duration-unknown', time: 15 },
  { id: 's007', effect: '다른 조건', result: '체력 회복', scope: 'enemy', status: 'yes', time: 16 }
] };
const stats = T.conditionStats(synthetic, probe, ['s007']);
assert.equal(stats.checks, 3); assert.equal(stats.rate, 33.33);
assert.deepEqual(stats.failureReasons, { expired: 1, 'duration-unknown': 1 });
assert.equal(stats.maxEligibleHitGap, 16);
assert.equal(T.conditionStats({ horizon: 20, conditions: [] }, probe, []).rate, null);
assert.equal(T.conditionStats({ horizon: 20, conditions: [] }, probe, []).maxEligibleHitGap, null);
assert.equal(T.maxGap([], 20), 20);
assert.equal(T.maxGap([4, 4, 10, 18], 20), 8);

function rejects(change, pattern) { const p = small(); change(p); assert.throws(() => T.normalize(p), pattern); }
rejects(p => p.horizons = [181], /20~180/);
rejects(p => p.horizons = [60, 60], /중복/);
rejects(p => p.profiles = ['typo'], /profile/);
rejects(p => p.builds[0].skills[0] = 'missing', /유효/);
rejects(p => p.builds[0].skills[0] = p.builds[0].skills[1], /유효/);
rejects(p => delete p.builds[0].baseSlots, /baseSlots/);
rejects(p => p.builds[0].baseSlots = ['s071', 's069', 's075', 's003', 's007'], /암습/);
rejects(p => { p.builds[0].skills[8] = 's015'; }, /단일/);
rejects(p => p.builds[0].id = '../escape', /id/);
rejects(p => p.conditionProbes[0].scope = 'self', /일치하는 조건/);
rejects(p => p.opportunityGroups[0].castProbes = ['typo'], /알 수 없는 probe/);
assert.throws(() => T.parseArgs(['--typo']), /알 수 없는/);
assert.throws(() => T.parseArgs(['--out']), /값이 필요/);
const none = T.compare(small(), { traces: 'none' }); assert.equal(none.traces.length, 0);
assert.equal(T.compare(small(), { traces: 'all' }).traces.length, 1);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dosul-compare-test-'));
try {
  const out = path.join(tmp, 'output'); T.writeResults(none, out);
  assert(fs.existsSync(path.join(out, 'A-build.json')));
  assert(fs.existsSync(path.join(out, 'summary.txt')));
  assert.throws(() => T.writeResults(none, out), /비어 있는/);
  const saved = JSON.parse(fs.readFileSync(path.join(out, 'A-build.json'), 'utf8'));
  fs.writeFileSync(path.join(tmp, '한글-build.json'), JSON.stringify(saved));
  const fileConfig = { ...small(), builds: [{ id: 'imported', file: '한글-build.json' }] };
  fs.writeFileSync(path.join(tmp, 'config.json'), '\ufeff' + JSON.stringify(fileConfig));
  const cli = path.resolve(__dirname, 'scripts/compare-builds.cjs');
  const invoke = args => spawnSync(process.execPath, [cli, ...args], { cwd: tmp, encoding: 'utf8' });
  const valid = invoke(['--config', 'config.json', '--out', 'relative-output', '--verify', '--traces', 'none']);
  assert.equal(valid.status, 0, valid.stderr);
  const imported = JSON.parse(fs.readFileSync(path.join(tmp, 'relative-output/comparison.json'), 'utf8'));
  assert.deepEqual(imported.builds[0].skills, saved.skills);
  assert.deepEqual(imported.builds[0].baseSlots, saved.baseSlots);
  assert.equal(invoke(['--config', 'config.json', '--horizons', '19', '--out', 'invalid-output']).status, 1);
  assert(!fs.existsSync(path.join(tmp, 'invalid-output')));
  // Default fixture resolves relative to the script, not the invoking agent's cwd.
  const defaultRun = invoke(['--profiles', '185547', '--horizons', '20', '--out', 'defaults', '--traces', 'none']);
  assert.equal(defaultRun.status, 0, defaultRun.stderr);
  const formula = clone(none.report); formula.builds[0].name = '=1+1';
  assert(T.csv(formula).includes('"\'=1+1"'));
} finally {
  assert(path.resolve(tmp).startsWith(path.resolve(os.tmpdir()) + path.sep + 'dosul-compare-test-'));
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log('Build comparison: 84 deterministic runs, fixture regression, strict input/target validation, portable CLI, imports, traces and safe outputs passed');
