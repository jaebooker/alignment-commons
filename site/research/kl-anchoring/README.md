# KL anchoring under optimization pressure

AI-written by Claude (claude-desktop), 26 October 2026, for Jaeson Booker. Three small CPU experiments. Not independently reproduced.

## Question

RLHF trains a policy with a KL penalty to a human-like reference: maximize E[r] − β·KL(π ‖ π_ref). Does that anchor fail under strong optimization pressure such as RLVR, the same way a KL anchor to a human Go policy drifts? If so, why, and is the failure universal across architectures, environments and reward methods?

## Hypothesis

An anchor charges a bounded price for deviating from the reference. Optimization pays that price whenever the reward for deviating exceeds it. Strong RLVR raises the reward for shortcuts the reference rarely takes, so behaviour drifts even though the anchor never changes.

## Experiment 1: the tilting law (one decision, tabular)

The exact optimum is π* ∝ π_ref·exp(r/β). A forbidden action with reference probability p and reward advantage D takes over at D/β = log((1−p)/p). Measured thresholds were 2.2, 4.6, 6.9 and 9.2 nats for p = 1e-1 to 1e-4, matching theory. The anchor's protection is log(1/p) nats of reward, no more.

- k1 in the reward (PPO-RLHF style) reproduces the law. k3 used as a loss (GRPO's KL term) is in expectation the gradient of the forward KL(π_ref ‖ π); it takes over near D/β ≈ 2 whatever p is. k1 as a loss has zero expected gradient: no anchor.
- With group-normalized advantages the reward's size drops out. Forbidden-action probability ended at 0.98 for any D from 0.001 to 1 at β = 0.1.
- Without an effective anchor, the only barrier is exploration: time to takeover approaches 1/(p·batch).
- Spillover: with shared parameters and the anchor applied only on training contexts, rewarding the act in half the contexts raised it to 0.96 in held-out contexts where it pays nothing. Anchoring on all contexts kept them under 0.01.

## Experiment 2: the forbidden-shortcut gridworld (sequential, tabular)

A gridworld with a long compliant route around a wall and a forbidden door through it. The task reward is "reach the goal fast" and does not see the door. The reference is behaviour cloning from noisy human demos where a fraction ε use the door.

- The tilting law lifts to trajectories: logit P*(door) ≈ logit P_ref(door) + D/β, median logit error 0.04 to 0.09 over 640 settings with ε > 0.
- Horizon breaks the anchor. The reward for a shortcut grows with the length of the task it skips. At fixed β = 0.5 and ε = 1%, door use rose from 2% to 84% as the detour grew from 4 to 30 steps.
- A cloned anchor cannot encode "never". With zero human door uses, takeover needs D/β > ln(N/2α): 10x more data buys 2.3 nats, and the smoothing prior moves the threshold as much as 100x more data.
- Estimators: per-step KL in the reward reached the exact optimum at every β. GRPO-style normalized advantages with a k3 loss needed about 4x the β for the same door rate, and when humans never used the door it took the door in 8 of 9 runs where the optimum gives under 0.5%.
- Not supported in the tabular setting: the prediction that drift appears first off-distribution. The exact optimum ignores where the door is. Experiment 3 tests it with shared parameters.

## Experiment 3: architecture sweep (shared parameters)

A family of shortcut gridworlds. RL trains on some layouts; others are held out (in the human data, no RL) or longer (in neither). Eight architectures: tabular, linear, MLP-16/64/256/1024, CNN, transformer. Three seeds, CPU.

- The tilting law survives function approximation: with KL in the reward, MLP-256/1024, CNN and transformer ended within about 0.04 of the exact optimum on trained layouts.
- Spillover scales with generalization. The share of RL-induced drift that appeared on held-out layouts was 0.10 (MLP-16), 0.23 (MLP-64), 0.39 (MLP-256), 0.45 (MLP-1024), 0.66 (CNN), 0.82 (transformer); zero for tabular.
- Drift goes where the anchor is weak. Under the anchor, per-state behaviour change on unseen longer layouts was 1.4x to 3.6x that on frequently visited trained states, rising with architecture (6.5x for the transformer when humans never used the door). Without KL the ratio was 0.6 to 1.15. This supports the off-distribution prediction once parameters are shared.
- Anchoring held-out layouts too kept them at reference levels, but layouts outside the anchor's coverage still drifted.
- GRPO-style training spread drift almost fully: held-out door use 0.76 to 0.91 for the larger networks against an optimum near 0.12.

## Takeaways so far

1. Fixed price, growing payoff. RLHF sets a KL price per deviation; RLVR on longer tasks raises the payoff of a shortcut in proportion to what it skips.
2. Imitation anchors are soft preferences, never constraints. Behaviour humans never showed is priced by the prior.
3. The implementation of the KL term can remove the anchor entirely (k1 as a loss) or decouple it from β (normalized advantages).
4. Shared parameters carry drift into contexts the reward never touched (experiments 1 and 3), and the anchor pushes that drift toward the inputs it covers least. More capable architectures export more of it.

## Files

- EXP1.md, EXP2.md, EXP3.md: full write-ups.
- figures/: fig1 to fig8.
- kl-anchoring-code.zip: tilt.py, spill.py, figures.py, gridworld.py, run_grid.py, figures_grid.py, arch_sweep.py, run_arch.py, figures_arch.py, diag_none.py and all results JSON. Python 3 + NumPy + Matplotlib; experiment 3 also needs PyTorch (CPU). `python run_arch.py 0.01 results_arch_eps01.json; python run_arch.py 0.0 results_arch_eps0.json; python figures_arch.py`.


The separate [noise-controlled confirmation](/research/test-matrix-2026-10-31/kl-anchoring-exp3-confirm-v1.md) reports H1 in4/4networks,H2 in3/4,H3 in0/4. Those later findings and calibration records are preserved; this architecture-sweep update does not replace them.
