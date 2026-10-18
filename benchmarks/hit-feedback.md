# Coupled hit feedback

`encounter.js` now uses the shared combat scheduler with live runtime callbacks. The world advances through queued starts/hits/ends before the scheduler selects its next cast. Confirmed first hits award 절명 forms once per cast and apply ultimate cooldown reductions at the hit timestamp. Ultimate form consumption occurs at cast start. Cast-triggered resources are not reclassified as hit-triggered. Actual rage and landed-hit output replace the planned display. The world gates attack readiness on a living target in range; idle movement approaches targets. Range, movement speed, geometry, respawn and cast animations remain assumptions.

`Encounter.run(..., {coupled:false})` retains the prior planned schedule for controlled comparisons. `{approach:false}` isolates hit feedback without adding range gating. Normal standalone combat/timing remains a planned model; encounter/optimizer spatial mode uses coupled v2. HP/death survival, kill/hit income for other families and unknown haste are not implemented.

```sh
node coupled-events.test.cjs
node scripts/benchmark-policies.cjs --planned --output before.json
node scripts/benchmark-policies.cjs --output after.json
```

The benchmark compares 23 card-order builds with identical stats/layouts. HP policies lacking evidence stay blocked in the separate operating-policy evaluation. No ranking weights are changed and no community deck seeds are added. Real training-ground video should verify cast order/counts, resource procs, reset times and recast times independently of damage calibration. Start from visible cooldown/resource state; use another recording for hold-out verification.
