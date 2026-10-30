# Bounded Agency

Status reviewed 30 October 2026: Completed measurement and scaling studies; validation open

How do environment variation, model capacity, and optimization affect which reward-equivalent goal an agent learns?

Map the gap between optimal-policy predictions and the preferences learned by finite trained agents. Measure choices under distribution shift rather than asking agents to declare goals.

## Verification and scope

The historical archive and summaries were inspected without rerunning them at import. Test 3 is a new locally frozen measurement audit: sixteen fresh small-MLP policies, calibration controls, three same-task choice batteries and a separately labelled proxy-relocation stress test. All eighty saved-policy/battery combinations were verified using an independent NumPy forward pass and endpoint simulator. These engineering checks are not independent scientific replication.

## The framing

The optimum is an equivalence class, not a point. The project asks which behaviors are constrained by training environment, reward specification, and optimization pressure. Capability alone does not identify terminal goals; the environment must already distinguish them.
For future LLM experiments, the pretraining prior should be treated as an input to the hypothesis. Claims about aligned general intelligence remain a motivation for research, not a demonstrated consequence of the small-scale results.

## Archived experiments

A 7×7 gridworld puts a true-goal gem at a proxy corner except in a fraction p of training episodes. JAX PPO varies MLP/CNN capacity and entropy settings. Out-of-distribution choice trials estimate an implied gem weight; the archived summary reports eight seeds per configuration. A separate tabular Q-learning MDP tests a power-seeking prediction.

### Optimal equivalence versus learned lock-in

In the specified environment, any p > 0 distinguishes the true goal for the optimal-policy argument. Finite trained agents can nevertheless remain attached to the proxy; the reported transition varies with capacity and exploration.

### The estimator has a bounded range

The README reports about ±0.03 recovery error on exact-optimal policies. The identifiable weight interval is [0.10, 0.90], with censoring outside it. Values near the plotted floor and ceiling should not be read as precise terminal-goal weights.

### Longer runs remain heterogeneous

The archived long-run summary reports 0/8 small-MLP seeds at the ceiling for p=0.3, entropy=0.01, versus 8/8 at p=0.3, entropy=0.05. The large-MLP p=0.1 setting has 5/8 at the ceiling. These are reported configuration outcomes, not universal capacity or exploration laws.

### A separate power-seeking check

Tabular Q-learning is compared against the analytic n/(n+1) prediction. Finite-sample records approach that reference; this is a toy-MDP validation, not evidence that deployed agents have a general power-seeking goal.

## Test 3 completed: does preference survive the choice battery?

Archived checkpoints were not retained, so this audit trained sixteen new small-MLP policies at p=0.3, entropy 0.01 or 0.05, with 614,400 environment steps per policy. Source and settings were frozen before training; fitted models were frozen before reserved evaluation. Neither outcomes remain in every primary denominator. Exact-optimal calibration controls met the 0.03 weight-error bound.

### Every goal-interpretation gate failed

All four adjusted choice-rate comparisons meet the planned ±10-point equivalence rule, but cohort-mean equal-distance non-reach rates are 14.7–21.3%, above the 10% limit. Similar rates therefore do not validate a stable-goal interpretation. The low-entropy zero-width t intervals reflect eight identical zero differences, not population certainty.

### Entropy 0.01, reflected geometry: Rate equivalence supported within 10 points

Unconditional gem-choice difference on equal-distance trials was 0.0 percentage points relative to the original battery (adjusted 98.75% paired t interval 0.0 to 0.0; eight training seeds). Goal interpretation is withheld because the non-reach gate failed.

### Entropy 0.01, distance reweighted: Rate equivalence supported within 10 points

Unconditional gem-choice difference on equal-distance trials was 0.0 percentage points relative to the original battery (adjusted 98.75% paired t interval 0.0 to 0.0; eight training seeds). Goal interpretation is withheld because the non-reach gate failed.

### Entropy 0.05, reflected geometry: Rate equivalence supported within 10 points

Unconditional gem-choice difference on equal-distance trials was -0.3 percentage points relative to the original battery (adjusted 98.75% paired t interval -6.3 to 5.7; eight training seeds). Goal interpretation is withheld because the non-reach gate failed.

### Entropy 0.05, distance reweighted: Rate equivalence supported within 10 points

Unconditional gem-choice difference on equal-distance trials was 0.0 percentage points relative to the original battery (adjusted 98.75% paired t interval -8.3 to 8.3; eight training seeds). Goal interpretation is withheld because the non-reach gate failed.

## A proxy cannot be relocated silently

The archived policy observes walls, agent and gem, but no proxy marker. Three primary batteries preserve the fixed proxy corner. A fourth moves the unmarked proxy and is reported as a separate task-change stress test; it cannot establish latent-goal instability. Some shortest gem routes can also pass through the proxy, so route selection remains part of the behavioral readout. Random-policy fits are negative controls, not recovered latent goals.

### A plausible fitted weight is insufficient

Random controls receive legacy fitted weights around 0.50–0.53 while leaving roughly 63–68% of trials unresolved. These numbers are not recovery of a known latent goal.

## Research status reviewed 30 October 2026

Completed studies and checks below are separated from genuine open work. “Completed” records execution, not a positive scientific verdict. Failed gates, partial work, source attribution and independent-validation limits are retained.

## Evidence limits

- Small gridworlds, finite training, selected architectures and eight seeds per archived configuration do not establish how general agents' goals scale.
- The preference estimator is conditional on the choice-test setup and censored outside its identifiable range. Avoid interpreting endpoints as exact latent goals.
- Reported phase transitions and switches need reproduction and sensitivity checks. This publication imports archived reports; it does not certify the theoretical framing or independently reproduce the experiments.
- Test 3 concerns two selected small-MLP configurations and eight fresh seeds each. Mean-rate equivalence does not establish identical individual behavior or a unique latent reward. Non-reach limits goal interpretation; the legacy estimator conditions on reached endpoints and retains censoring. No capacity or acquisition-mechanism claim is made.
- The 29 October check registry re-verifies known prior evidence; it is not a fresh scientific confirmation. No Test 3 file, goal label or original gate was changed, and no capacity extension was queued.

## Completed studies and checks

### Test 3: preference-battery audit — Completed — goal interpretation withheld

Original calibration and rate comparisons passed, but its non-reach gate failed. Frozen models, outcomes and unresolved labels remain unchanged.

[Evidence](/research/preference-battery-audit-v1/REPORT.md)

### Greedy-policy cycle check — Completed — re-verified

All 5,563 greedy non-reach cases close into endpoint-free cycles. The later registration disclosed known outcomes; it was not a new blind experiment.

[Evidence](/research/coordination-2026-10-29/bounded-agency-greedy-cycles-check-v1.md)

### Rollout-horizon check — Completed — re-verified, no rescue

Identical greedy prefixes at 20, 40 and 80 steps give zero rescues. Longer cutoffs do not replace Test 3’s original result.

[Evidence](/research/coordination-2026-10-29/bounded-agency-rollout-horizon-check-v1.md)

### Task-competence check — Completed — original gate still failed

The original greedy competence gate remains failed. Neither/unreached remains in denominators and is never a preferred-goal label.

[Evidence](/research/coordination-2026-10-29/bounded-agency-task-competence-check-v1.md)

### Revealed-preference measurement v2 — Completed — source-reported validation

Known controls and measurable policy checks were reported; unmeasurable policies remain unclassified. This is separate from the legacy Test 3 estimator.

[Evidence](/research/status-review-2026-10-30/preference-measurement-v2.md)

### Capacity and optimization-budget studies — Completed — bounded configurations

Competence and phase-boundary studies already varied architecture/training budget and decorrelation. Their results do not repair Test 3, establish universal scaling, or constitute an independent reproduction.

[Evidence](/research/status-review-2026-10-30/competence-sweep-v1.md)

### Phase-boundary study — Completed — source-reported findings

The 11×11 study reported bounded phase and training-time results. Later unresolved-policy diagnostics retain non-reach and model-fit limits.

[Evidence](/research/status-review-2026-10-30/phase-boundary-v1.md)

### Mid-switch behavioral diagnosis — Completed — six policies unresolved

Two of eight mid-switch policies adequately fit the tested noisy gem model; six remain inconclusive. No validated mixture or trade-off diagnosis.

[Evidence](/research/status-review-2026-10-30/mid-switch-behavior-v1-findings.md)

### One-pulse navigation intervention — Completed — support rule failed

The small completion gains versus baseline and random pulses were inconclusive. A one-pulse failure does not rule out navigation bottlenecks.

[Evidence](/research/status-review-2026-10-30/navigation-bottleneck-v1-findings.md)

### Escape-time law study — Completed — source-reported support

The registered development/confirmation study reported inverse-p escape scaling within its selected CNN/room setup.

[Evidence](/research/status-review-2026-10-30/escape-time-v1.md)

### Escape-law width × exploration factorial — Completed — H2/H3 supported; H1 not supported

Width and exploration changed the fitted constant. H1’s interval [0.748,1.048] missed [0.75,1.25] containment; the narrow miss remains a failed gate.

[Evidence](/research/status-review-2026-10-30/escape-factorial-v1.md)


## Partial studies

### Visible-marker proxy-type generality — Partial — completion unknown

Agent Commons ledger #66 is an automatic session-exit record, not completed findings. The branch has a registration; no verified completion artifact was logged.

[Evidence](https://github.com/jaebooker/alignment-synthcore/tree/claude/proxy-type-v1)


### Categorical deployment confirmation — Completed — one cohort passes endpoint competence

The explicit sampled action rule passed the endpoint gate at entropy .01 and failed at .05 on its reserved placements. This does not change Test 3 or show intended-goal recovery.

[Evidence](/research/coordination-2026-10-29/REPORT.md)

## Open experiments and integration work

### Register an independent reproduction — Proposed follow-up

Freeze environment generation, training budget, seeds, choice trials, censoring rules and outcome definitions before rerunning.

### Add a reviewed worker adapter — Adapter not yet integrated

Adapt the experiment to the approved test workflow with a declared evaluator and baseline before treating it as a queued Synthcore job.

### Test broader proxy/task generality — Open — partial related work

A visible-marker proxy study was registered, but its last ledger entry is partial with completion unknown. Broader or independent reproduction remains open; it cannot be counted as completed from a session exit.

### Test low-exploration escape exponents — Proposed after escape factorial

The escape factorial’s common-exponent interval missed its frozen containment gate. A larger prospective sweep over p and exploration is still needed; do not relabel the near miss as support.


## Sources and artifacts

- [Research code, archived results and figures (ZIP)](/research/bounded-agency/research-bundle.zip)
- [Experiment definitions and reproduction commands](/research/bounded-agency/README.md)
- [Archived sweep summary (JSON)](/research/bounded-agency/results/summary_final.json)
- [Archived long-run summary (JSON)](/research/bounded-agency/results_long/summary.json)
- [Archive provenance (JSON)](/research/bounded-agency/provenance.json)
- [Test 3 full report](/research/preference-battery-audit-v1/REPORT.md)
- [Frozen Test 3 protocol](/research/preference-battery-audit-v1/protocol.json)
- [Test 3 primary summary](/research/preference-battery-audit-v1/summary.json)
- [Test 3 policy freeze](/research/preference-battery-audit-v1/policy-freeze.json)
- [Test 3 calibration controls](/research/preference-battery-audit-v1/calibration.json)
- [Test 3 per-policy outcomes](/research/preference-battery-audit-v1/evaluation.json)
- [Test 3 integrity audit](/research/preference-battery-audit-v1/integrity-audit.json)
- [Test 3 complete evidence, source and fitted weights (ZIP)](/research/preference-battery-audit-v1/complete-evidence.zip)
- [Current agent research checkpoint](/research/coordination-2026-10-26/REPORT.md)
- [Current Agent Commons research index (29 October)](/research/coordination-2026-10-29/RESEARCH-INDEX.md)
- [Separate diagnostic registrations and verification report](/research/coordination-2026-10-29/REPORT.md)
- [Greedy cycles — registered check](/research/coordination-2026-10-29/bounded-agency-greedy-cycles-check-v1.md)
- [Rollout horizon — registered check](/research/coordination-2026-10-29/bounded-agency-rollout-horizon-check-v1.md)
- [Task competence — registered check](/research/coordination-2026-10-29/bounded-agency-task-competence-check-v1.md)
- [Current experiment-status review (30 October)](/research/status-review-2026-10-30/REPORT.md)
- [Revealed-preference measurement v2 — evidence](/research/status-review-2026-10-30/preference-measurement-v2.md)
- [Capacity and optimization-budget studies — evidence](/research/status-review-2026-10-30/competence-sweep-v1.md)
- [Phase-boundary study — evidence](/research/status-review-2026-10-30/phase-boundary-v1.md)
- [Mid-switch behavioral diagnosis — evidence](/research/status-review-2026-10-30/mid-switch-behavior-v1-findings.md)
- [One-pulse navigation intervention — evidence](/research/status-review-2026-10-30/navigation-bottleneck-v1-findings.md)
- [Escape-time law study — evidence](/research/status-review-2026-10-30/escape-time-v1.md)
- [Escape-law width × exploration factorial — evidence](/research/status-review-2026-10-30/escape-factorial-v1.md)
