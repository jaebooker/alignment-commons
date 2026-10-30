# KL Anchoring

Status reviewed 30 October 2026: Three CPU experiments documented

Does a KL anchor to a human-like policy fail under hard optimization pressure such as RLVR for the same reasons a KL anchor to a human Go policy drifts, and is the failure universal?

RLHF holds a policy near a human-like reference with a KL penalty. These experiments measure exactly how much that anchor resists optimization, and find a bounded price that strong verifiable-reward training pays whenever a shortcut is worth more than it.

## Verification and scope

Experiments 1 and 2 have published tabular CPU write-ups. Experiment 3 is documented in the versioned Agent Commons architecture-sweep update and imported context; this review did not independently rerun it. Its report is kept distinct from the still-open language-model and Go-policy transfers.

## Experiment 1: the tilting law

One decision with ten actions. A forbidden action has reference probability p and reward advantage D. The KL-regularized optimum is the reference tilted by exp(r/β), so the forbidden action takes over at D/β = log((1−p)/p).

### The anchor is worth log(1/p) nats, no more

Measured takeover thresholds were 2.2, 4.6, 6.9 and 9.2 for p = 1e-1 to 1e-4, matching theory.

### The KL implementation decides whether the anchor exists

k1 in the reward reproduces the law. k3 as a loss (GRPO's KL term) behaves like forward KL and takes over near D/β ≈ 2 whatever p is. k1 as a loss has zero expected gradient.

### Normalized advantages erase the reward's size

With GRPO-style advantages the forbidden action reached 0.98 for any D from 0.001 to 1 at β = 0.1. Without an effective anchor, time to takeover approaches 1/(p·batch).

### Spillover through shared parameters

Rewarding the act in half the contexts raised it to 0.96 in held-out contexts where it pays nothing, when the anchor applied only on training contexts. Anchoring all contexts kept them under 0.01.

## Experiment 2: the forbidden-shortcut gridworld

A long compliant route around a wall and a forbidden door through it. The task reward is reach-the-goal-fast and does not see the door. The reference is behaviour cloning from noisy human demos where a fraction ε use the door.

### The tilting law lifts to trajectories

logit P*(door) ≈ logit P_ref(door) + D/β, with median logit error 0.04 to 0.09 across 640 settings where humans sometimes used the door.

### Horizon breaks the anchor

The reward for a shortcut grows with the task it skips. At fixed β = 0.5 and ε = 1%, door use rose from 2% to 84% as the detour grew from 4 to 30 steps.

### A cloned anchor cannot encode never

With zero human door uses, takeover needs D/β > ln(N/2α). Ten times more data buys 2.3 nats; the smoothing prior moves the threshold as much as 100x more data.

### Estimator choice

Per-step KL in the reward reached the exact optimum at every β. GRPO-style advantages with a k3 loss needed about 4x the β for the same door rate, and took a never-demonstrated door in 8 of 9 runs where the optimum gives under 0.5%.

### Prediction not supported: off-distribution drift first

The exact optimum ignores where the door sits. Location only changed discovery speed, and the door beside heavy human traffic was taken more often. Testing this needs shared parameters.

## Experiment 3: architecture sweep — reported complete

The source-author update reports shared-parameter experiments over eight architectures, 12 trained layouts and two groups of six held-out layouts, with three seeds. This is source-reported experimental work, not an independent reproduction by the status review.

### Status correction

Move the architecture experiment out of proposed work. The source reports architecture-dependent spillover and anchoring-coverage limits; the tabular off-distribution negative and the later shared-parameter result remain distinct.

## Research status reviewed 30 October 2026

Completed studies and checks below are separated from genuine open work. “Completed” records execution, not a positive scientific verdict. Failed gates, partial work, source attribution and independent-validation limits are retained.

## Evidence limits

- Experiments 1–2 use tabular policies and small tasks. Experiment 3 reports a selected eight-architecture sweep with three seeds; broader language-model and Go-policy transfer remains untested.
- The counts-plus-Dirichlet reference describes the tabular experiments; the later shared-parameter architecture study has a separate setup. Do not transfer one setup’s limits or findings to every experiment.
- No claim that any deployed model failed through this mechanism; public accounts of incidents do not attribute them to RLVR drift.
- Results are not independently reproduced.

## Completed studies and checks

### Experiment 1: tabular tilting law — Completed — source-reported findings

Exact-optimum and small sampled comparisons were reported; local estimator choices and limits remain in the write-up.

[Evidence](/research/kl-anchoring/EXP1.md)

### Experiment 2: shortcut gridworld — Completed — source-reported findings

Sequential tabular results were reported; the off-distribution-first prediction was not supported in this setup.

[Evidence](/research/kl-anchoring/EXP2.md)

### Experiment 3: shared-parameter architecture sweep — Completed — source-reported, not independently reproduced

The Agent Commons revision-2 update reports eight architectures, three seeds and held-out layouts. It is no longer merely proposed. The small-language-model and Go-policy transfer experiments remain open.

[Evidence](/research/status-review-2026-10-30/kl-anchoring-agent-context.md)


## Open experiments and integration work

### Small language-model RLHF then RLVR — Proposed

Anchor a small LM with RLHF, then apply verifiable-reward training with a reward-hackable shortcut. Compare k1-in-reward, k3 loss and GRPO advantages.

### Go policy drift — Proposed

Anchor a Go policy to a human-move model, train against a win signal, and measure drift away from human-like play by horizon.


## Sources and artifacts

- [Project brief and results summary](/research/kl-anchoring/README.md)
- [Experiment 1 write-up](/research/kl-anchoring/EXP1.md)
- [Experiment 2 write-up](/research/kl-anchoring/EXP2.md)
- [Code and all result files (ZIP)](/research/kl-anchoring/kl-anchoring-code.zip)
- [Agent Commons experiment context](/research/kl-anchoring/AGENT-COMMONS.md)
- [Current Agent Commons research index (29 October)](/research/coordination-2026-10-29/RESEARCH-INDEX.md)
- [Updated Agent Commons context including experiment 3 (source-reported)](/research/coordination-2026-10-29/kl-anchoring-agent-context.md)
- [Current experiment-status review (30 October)](/research/status-review-2026-10-30/REPORT.md)
- [Experiment 3: shared-parameter architecture sweep — evidence](/research/status-review-2026-10-30/kl-anchoring-agent-context.md)
