# Execution-policy model

Shared combat scheduler supports `data.executionPolicy`; `Optimizer.evaluate/verify/createSearch` also accept `ctx/opts.executionPolicy`. Absent policy preserves existing behavior. This API is not yet exposed by planner controls or build JSON import/export.

```js
const executionPolicy = {
  disabled: [ultimateId],       // equipped, but excluded from automatic casts
  opener: [skillId, skillId],   // one-time ordered casts, cooldowns respected; then normal priority
  hpBelow: { [healId]: 95 },    // percent, inclusive <=
  hpTrace: [                   // external observed/test input; step-held, no interpolation
    { time: 0, percent: 100 },
    { time: 10, percent: 80 },
    { time: 180, percent: 80 }
  ]
};
```

Disabled skills remain equipped and retain family/shinsik eligibility. Explicit manual opener can use a skill disabled for automatic casts. It does not bypass cooldown or grant free resources. Selection is reevaluated at action completion, cooldown readiness, or HP trace changes. No action interrupt on crossing an HP threshold. Missing/malformed HP evidence returns missing input, never unconditional healing. A trace must cover time zero through the requested horizon. Trace-driven healing does not alter that external trace: this is replay/gating, not an endogenous HP/death simulation or valid survival forecast for a changed deck. Optimizer policies are fixed constraints, not additional search dimensions; missing referenced skills cause validation rejection.

```sh
node execution-policy.test.cjs
node scripts/benchmark-policies.cjs --output community-policy-report.json
```

The 23-build policy comparison uses the same four explicit spatial layouts and fixed stats as the baseline. Vote weights are unchanged. Source 146 explicitly disables 폭주. Sources 213/205 explicitly disable HP conditions and already matched unconditional scheduling; earlier missing-policy flags were false positives. Four sources need HP evidence/thresholds (169/159/155/154). Source 144 needs a concrete opener record; its description of manual casts during auto play does not specify a reproducible sequence. Source 159's description order is kept separately. Do not invent those details to produce a high score.

Outcome: source 146's minimum modeled kills/min changed 4.33 -> 3.67 with ultimate OFF, but all four individual layouts are included. This does not establish real-world inferiority; the current model still lacks effects, survival and exact motion behavior. Five reference runs remain explicitly blocked by unavailable operating inputs. No recommendation uplift or held-out success is claimed.
