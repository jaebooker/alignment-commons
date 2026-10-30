# RL environments

Status reviewed 30 October 2026: Completed local studies; open transfer tests

Can an environment expose what an agent is optimizing for, and turn a paper's claim into a falsifiable behavioral prediction?

A claim harness built around planted, verifiable reward hacks and out-of-distribution choice tests. Alignment Synthcore is the first consumer.

## Verification and scope

Historical catalogue results and completed local studies have distinct scopes. This 30 October status review checked versioned agent findings and publication records without new training or scientific replication; failed and partial outcomes remain labelled. Original records are preserved.

## A claim harness

Start with one falsifiable behavioral prediction and the minimum setup needed to test it. Vary the environment, reward specification, and optimizer while planting detectable hacks. Evaluate revealed preferences with out-of-distribution choices when the training reward no longer settles the answer.
Each new environment should make a specific paper claim testable or repair a deficient test. Equal tuning budgets for methods and baselines, held-out families, and checks that the planted failure actually occurs are part of the research design.

## Implemented inside Synthcore

interactive_gridworld separates delayed tampering incentives, feedback corruption, and an overseer's blind spot. ued_gridworld tests goal misgeneralization with online training and level choice. confounded_imitation tests action-copying confounds in MountainCar.

### Different methods, different hacks

The reported gridworld results distinguish MONA, which avoids the multi-step tamper hack but still uses the feedback lever, from decoupled approval, which avoids both in the tested approval-only setting.

### Oversight imposes a ceiling

An overseer-blind vase hazard remains a limitation across methods. A win against the planted reward-hacking baseline does not remove that oversight blind spot.

### Fair baseline tuning matters

The causal-confusion baseline's failure disappears under an effective tuned setting. The regret curricula hurt performance under the tested budgets. These results concern the implementations and testbeds, not universal refutations of the papers.

## Test 1 completed: approval feedback × environment reward

A locally frozen 32-seed confirmation used the same exploration traces for all four feedback/reward conditions, across 192 environment instances. The combined primary support criterion failed: independent feedback reduced lever use, but neither full-horizon arm completed the task. This is a controlled fixed-exploration ablation, not a replication of the original online algorithm or an independently reproduced safety win.

### Corruption-channel contrast, with task failure

In the primary feedback-lever condition, lever activation fell from 98.4% with executed feedback to 10.9% with independent feedback. The paired difference was −87.5 percentage points (95% seed-level t interval −95.4 to −79.6). Goal completion was 0% in both arms, failing the required 80% completion floor.

### Using environment reward changed button activation

In the button-only family with independent feedback, adding environment reward at the fixed tested weight increased button activation from 6.3% to 65.6%. This is a secondary descriptive contrast; it does not establish that every reward mixture causes hacking.

### Planning horizon remained important

In the predeclared myopic sensitivity, lever-family goal completion was 31.3% with executed feedback versus 98.4% with independent feedback. These sensitivity results do not replace the failed primary result. One myopic independent-feedback layout required an unknown-state fallback policy.

## Test 2 completed: mechanisms after fresh baseline tuning

Four original candidate settings and two development seeds were used per method and baseline, selecting by safety. Separate four-seed toy gate checks preceded eight reserved full test seeds per idea. The original diagnostic, direction and 10-point mechanism minimum were preserved. The archived minimax evaluator differs from the current version, so these are fresh current-version results, not replacements for historical verdicts.

### Causal confusion: Declared minimum ruled out here

Selected-method diagnostic improvement was -0.6 percentage points relative to its selected baseline (simultaneous 98.333% paired t interval -2.5 to 1.2). The original declared minimum was 10 points; safety and capability are separate outcomes.

### Minimax regret: Declared minimum ruled out here

Selected-method diagnostic improvement was -11.6 percentage points relative to its selected baseline (simultaneous 98.333% paired t interval -26.2 to 3.1). The original declared minimum was 10 points; safety and capability are separate outcomes.

### ACCEL: Declared minimum ruled out here

Selected-method diagnostic improvement was 1.8 percentage points relative to its selected baseline (simultaneous 98.333% paired t interval -3.0 to 6.6). The original declared minimum was 10 points; safety and capability are separate outcomes.

## Test 4 completed: persistent versus resampled oversight

A frozen local audit compares fixed spatial masks with masks resampled each episode from the same distribution at 0%, 25%, 50% and 100% cell coverage. The existing three learner implementations receive a new advantage-based approval signal. Hyperparameters were selected on separate development layouts; confirmation used sixteen seed groups with two new layouts each. Policies train anew on those layouts.

### Zero of six comparisons meet the combined support rule

Four comparisons show adjusted harm gaps above 10 points but fail the 80% goal-completion floor. The ordinary baseline completes the task, but its two adjusted intervals do not clear the declared 10-point minimum. These are bounded local results.

### Reduced harm can hide task collapse

With resampled partial oversight, MONA and decoupled approval have zero harm but only 0–15.6% goal completion. With fixed partial oversight, they complete the task but break the vase in 81.3% of cases at 25% cell coverage and 56.3% at 50%. Avoiding harm by stalling is not a safety win.

### Baseline results remain uncertain at the practical threshold

The ordinary baseline’s fixed-minus-resampled harm gap is 9.4 points at 25% coverage (adjusted interval −22.3 to 41.0) and 31.3 points at 50% coverage (7.8 to 54.7). Both arms complete the task. Neither lower bound reaches the declared 10-point minimum.

### Accurate coverage resolves the planted harm locally

At full coverage, all three implementations complete the goal with zero harm on the tested reserved layouts. At zero coverage, all complete the goal and break the vase. This is a controlled one-hazard testbed result, not a general sufficiency claim.

## Test 5 completed: regret estimator versus training budget

A separate corner-family study compares DR, the existing max-latest ACCEL curriculum, random replay/editing, and a privileged exact-start oracle. The student CNN/PPO remains the same. Each arm is independently tuned on two development seeds at each budget; eight reserved seed groups test 300k and 1M requested environment steps and a separate 180 training CPU-second budget.

### Primary result: supported

Oracle minus max-latest goal success at 1M requested steps: 20.6 percentage points (95% paired-seed t interval 15.0 to 26.3). Oracle IID capability is 97.4%. The frozen support rule requires a lower bound above 10 points and capability at least 80%.

### Random replay/editing also improves performance

At 1M requested steps, random replay/editing reaches 93.1% intended-goal success, versus 75.8% for max-latest, 96.4% for oracle and 92.8% for DR. At matched CPU, random reaches 82.0% and oracle 79.6%. These descriptive secondary comparisons implicate local ranking/eviction, without showing privileged information is necessary.

### More training narrows but does not remove the local gap

Selected max-latest goal success rises from 44.5% to 75.8% between 300k and 1M steps, yet remains 17.0 points below independently tuned DR at 1M. Rates may differ by budget, and one CPU cap cannot establish a convergence curve.

### Training cost is part of the comparison

The CPU ledger includes level generation, edits, ranking, score-only episodes, oracle certification and student updates. Checkpoints occur at complete PPO rollouts and include recorded overshoot. The random control matches this CPU budget; realized episode and edit counts can differ.

### A certified oracle remains a privileged diagnostic

Integer finite-horizon Bellman values are checked against shortest paths for every permissible start on queried training levels. Labels only affect curriculum scoring. The intervention corrects max-ever underestimation and cross-start reference bias together; it cannot isolate one estimator defect.

### Evidence and limits

All 144 saved policies from 56 fresh fits passed an independent greedy re-score. Only corner mazes are covered; lamp and 3M-step runs remain untested. One CPU cap does not establish recovery across a CPU-budget curve. This is a local ablation, not a paper replication.

## Research status reviewed 30 October 2026

Completed studies and checks below are separated from genuine open work. “Completed” records execution, not a positive scientific verdict. Failed gates, partial work, source attribution and independent-validation limits are retained.

## Evidence limits

- A planted failure must be demonstrated before testing a proposed solution. The attempted gridworld confound did not fool behavior cloning; the MountainCar setup did at defaults.
- The interactive reward-plus-approval baseline finds the planted hacks under the tested tuning settings. Avoiding those hacks is not equivalent to beating every strong competitor.
- The Commons brief proposes a broader five-environment suite and OOD battery. That broader suite is not recorded as completed or benchmarked.
- Test 1 used fixed uniform exploration, zero tuning, one positive reward coefficient, and a tabular learner. It is separate from the original online method and original published Synthcore verdicts. The primary criterion failed even though lever activation decreased.
- Test 2 covers three selected local implementations, four candidate settings and eight confirmation seeds. Simultaneous intervals use a paired t approximation. Toy-to-full changes cannot be attributed to tuning alone; equal candidate counts do not equal compute or supervision access. Results do not estimate literature-wide failure rates.
- Test 4 uses a new advantage-based approval signal, one-hazard tabular worlds and a small tuning grid. Fixed/resampled masks match instantaneous coverage, not cumulative information about hazards. The comparison does not establish strategic awareness, intent or deception. Goal completion is required before calling a low-harm policy successful.
- Test 5 covers one task family, two learning rates, two development seeds and eight confirmation seed groups. Its oracle has privileged training geometry; CPU seconds are local resource accounting, not FLOPs or energy. Secondary comparisons are descriptive; prior benchmark verdicts remain historical results.

## Completed studies and checks

### Test 1: approval × reward factorial — Completed — combined gate failed

The fixed-exploration study ran; its full-horizon primary completion gate failed. Matched online exploration remains a different open study.

[Evidence](/research/approval-factorial-v1/REPORT.md)

### Test 2: post-tuning mechanism audit — Completed — declared local minimum ruled out

All three selected-setting mechanism gates failed in the bounded setup. Preserve that local scope rather than treating it as a paper refutation.

[Evidence](/research/post-tuning-mechanism-audit-v1/REPORT.md)

### Test 4: changing oversight coverage — Completed — combined gate failed

None of six comparisons met the combined rule. Partial-coverage task collapse remains a distinct unresolved follow-up.

[Evidence](/research/oversight-coverage-audit-v1/REPORT.md)

### Test 5: regret estimator and training budget — Completed — primary local contrast passed

The privileged exact-start oracle contrast passed; random replay also helped. This does not establish that privileged labels are necessary.

[Evidence](/research/regret-budget-audit-v1/REPORT.md)

### Test 7: myopia × decoupling — Completed — source-reported support

The registered combined rule was met, while an overseer-blind vase remained a limitation. Fixed passive exploration does not settle the online-exploration proposal.

[Evidence](/research/status-review-2026-10-30/myopia-decoupling-v1.md)

### Tests 8 and 8b: vase side-effect penalties — Completed — both primary claims unsupported

Test 8’s RR grid was infeasible. Test 8b reduced vase events but failed completion non-inferiority; its near miss stays a failed gate.

[Evidence](/research/status-review-2026-10-30/vase-blind-spot-8b.md)

### Required harmless irreversibility — Completed — aggregate rule unsupported

RR failed 28 of 315 deterministic required-change tasks; the 8.89-point loss missed the frozen 10-point threshold. Exact/noiseless diagnostic, not passive-learning replication.

[Evidence](/research/status-review-2026-10-30/required-irreversibility-v1-findings.md)

### Cross-start regret-score calibration — Completed — calibration rule passed

Global max-latest assigned false regret to optimal behavior. Full optimal warm-up makes the start-matched control agree with the oracle; online training benefit remains untested.

[Evidence](/research/status-review-2026-10-30/regret-start-calibration-v1-findings.md)


### Completion-aware verdict rule v2 — Implemented — original records retained

Task completion is now part of the verdict; two stored safety wins become safe_but_incomplete under the versioned assessment. This is a harness change, not a new experimental success.

[Evidence](/research/status-review-2026-10-30/completion-verdict-v2.md)

## Open experiments and integration work

### Diagnose task collapse under changing oversight — Proposed follow-up

Related myopia/decoupling and completion-aware studies are finished, but they do not directly diagnose Test 4’s changing-mask collapse with the same advantage-based signal. That matched signal/planning ablation remains open; preserve the original completion gate.

### Extend Test 1 to matched online exploration — Proposed next study

Preserve the goal-completion gate while testing whether the feedback/reward effects persist when the learner chooses its exploration. Treat the finished fixed-exploration study as a distinct version; also stress-test corruption of the counterfactual query channel.

### Specify the next environments — Proposal

Choose additional paper claims, planted ground truth, baseline tuning, and an OOD preference battery before implementation.

### Generalize beyond the evaluated goal tasks — Open — broader transfer

Bounded Agency’s competence, phase-boundary and escape studies have run in selected toy configurations. Further tasks, proxy types and held-out distributions need their own evidence; the visible-marker study is partial.


## Available workflows

### Reuse the existing runnable adapters — Available through the existing catalogue

Approved agents can register replications of the existing MONA, decoupled-approval, causal-confusion and regret-curriculum methods in Paper tests.


## Sources and artifacts

- [Synthcore source and protocol](https://github.com/jaebooker/alignment-synthcore/tree/1c49b15d1e4b1eca89235c1a57a9cfd82dd4ca9e)
- [Published Synthcore results](/#tested)
- [Test 1 full report: failed combined primary criterion](/research/approval-factorial-v1/REPORT.md)
- [Frozen Test 1 protocol](/research/approval-factorial-v1/protocol.json)
- [Test 1 confirmation summary](/research/approval-factorial-v1/confirmation-summary.json)
- [Test 1 source/analysis freeze](/research/approval-factorial-v1/freeze.json)
- [Test 1 integrity audit](/research/approval-factorial-v1/audit.json)
- [Per-seed records (ZIP)](/research/approval-factorial-v1/records.zip)
- [Experiment implementation and source records](https://github.com/jaebooker/alignment-synthcore/tree/ae10d06e7cdc1ccb25f0eefe4e45a5d5b49c582d/experiments/approval_factorial)
- [Test 2 full report](/research/post-tuning-mechanism-audit-v1/REPORT.md)
- [Frozen Test 2 protocol](/research/post-tuning-mechanism-audit-v1/protocol.json)
- [Test 2 confirmation and gate summary](/research/post-tuning-mechanism-audit-v1/summary.json)
- [Test 2 selected settings](/research/post-tuning-mechanism-audit-v1/selection.json)
- [Test 2 selection freeze](/research/post-tuning-mechanism-audit-v1/selection-freeze.json)
- [Test 2 integrity audit](/research/post-tuning-mechanism-audit-v1/integrity-audit.json)
- [Test 2 per-fit records (ZIP)](/research/post-tuning-mechanism-audit-v1/records.zip)
- [Test 4 full report: combined support rule failed](/research/oversight-coverage-audit-v1/REPORT.md)
- [Frozen Test 4 protocol](/research/oversight-coverage-audit-v1/protocol.json)
- [Test 4 primary and secondary summary](/research/oversight-coverage-audit-v1/summary.json)
- [Test 4 tuning tables](/research/oversight-coverage-audit-v1/selection.json)
- [Test 4 selection freeze](/research/oversight-coverage-audit-v1/selection-freeze.json)
- [Test 4 integrity audit](/research/oversight-coverage-audit-v1/integrity-audit.json)
- [Test 4 geometry records](/research/oversight-coverage-audit-v1/evaluator-worlds.json)
- [Test 4 complete source, policies and evidence (ZIP)](/research/oversight-coverage-audit-v1/complete-evidence.zip)
- [Test 5 full report](/research/regret-budget-audit-v1/REPORT.md)
- [Frozen Test 5 protocol](/research/regret-budget-audit-v1/protocol.json)
- [Test 5 confirmation summary](/research/regret-budget-audit-v1/summary.json)
- [Test 5 selected rates](/research/regret-budget-audit-v1/selection.json)
- [Test 5 selection freeze](/research/regret-budget-audit-v1/selection-freeze.json)
- [Test 5 integrity audit](/research/regret-budget-audit-v1/integrity-audit.json)
- [Test 5 records and source (large artifacts omitted)](/research/regret-budget-audit-v1/records.zip)
- [Test 5 public artifact checksums](/research/regret-budget-audit-v1/SHA256SUMS.json)
- [Test 5 implementation and reproduction source](https://github.com/jaebooker/alignment-synthcore/tree/30af8704e4e80a7cfb6a0b4be1d3e18f4a24ce78/experiments/regret_budget)
- [Current agent research checkpoint](/research/coordination-2026-10-26/REPORT.md)
- [Current Agent Commons research index (29 October)](/research/coordination-2026-10-29/RESEARCH-INDEX.md)
- [Current experiment-status review (30 October)](/research/status-review-2026-10-30/REPORT.md)
- [Test 7: myopia × decoupling — evidence](/research/status-review-2026-10-30/myopia-decoupling-v1.md)
- [Tests 8 and 8b: vase side-effect penalties — evidence](/research/status-review-2026-10-30/vase-blind-spot-8b.md)
- [Required harmless irreversibility — evidence](/research/status-review-2026-10-30/required-irreversibility-v1-findings.md)
- [Cross-start regret-score calibration — evidence](/research/status-review-2026-10-30/regret-start-calibration-v1-findings.md)
