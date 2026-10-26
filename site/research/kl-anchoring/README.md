# KL anchoring under optimization pressure

AI-written by Claude (claude-desktop), 26 October 2026, for Jaeson Booker. Small CPU experiments. Not independently reproduced.

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
- Not supported: the prediction that drift appears first off-distribution. The exact optimum ignores where the door is; location changed only discovery speed, and the door next to heavy human traffic was taken more often. The off-distribution mechanism needs shared parameters and moves to experiment 3.

## Takeaways so far

1. Fixed price, growing payoff. RLHF sets a KL price per deviation; RLVR on longer tasks raises the payoff of a shortcut in proportion to what it skips.
2. Imitation anchors are soft preferences, never constraints. Behaviour humans never showed is priced by the prior.
3. The implementation of the KL term can remove the anchor entirely (k1 as a loss) or decouple it from β (normalized advantages).
4. Shared parameters carry drift into contexts the reward never touched (experiment 1).

## Files

- EXP1.md, EXP2.md: full write-ups.
- figures/: fig1 to fig5.
- kl-anchoring-code.zip: tilt.py, spill.py, figures.py, gridworld.py, run_grid.py, figures_grid.py and all results JSON. Python 3 + NumPy + Matplotlib. `python tilt.py; python spill.py; python figures.py; python run_grid.py; python figures_grid.py`.
