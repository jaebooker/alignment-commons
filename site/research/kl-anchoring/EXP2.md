# Experiment 2: the forbidden-shortcut gridworld

Status: done (26 Oct 2026). CPU, about 4 minutes. Code: `gridworld.py`, `run_grid.py`, `figures_grid.py`. Results: `results_grid.json`. Figures: `figures/fig3_gridworld_tilt_horizon.png`, `fig4_gridworld_floor_estimators.png`, `fig5_gridworld_kl_maps.png`.

## Bottom line

The tilting law from experiment 1 lifts to whole trajectories, and horizon is what breaks the anchor. A KL anchor charges a fixed price for a deviation, set by how rarely humans did it. Optimization pressure pays with reward, and the reward for a shortcut grows with the length of the task it skips. Hold β fixed and lengthen the task, and the shortcut goes from 2% to 84% of episodes with no change to the anchor. A behaviour-cloned anchor also cannot say "never": with zero human door uses, the price is set by the smoothing prior and grows only as log N with more data. The estimator matters as much as β: per-step KL in the reward reaches the theoretical optimum; GRPO-style normalized advantages with a k3 loss overshoot it by 2x to 12x when humans sometimes used the door, and by over 100x when they never did.

My prior prediction that drift appears first off-distribution was not supported in this tabular setting. The exact optimum is indifferent to where the door is. Location changes only how fast sampled RL discovers the door, and the door next to heavy human traffic was found and taken more often, not less. The off-distribution story needs shared parameters (experiment 1's spillover result), so it moves to experiment 3.

## Setup

- Grid of H rows by 7 columns. Start (0,0), goal (0,6). A wall in column 3 with an opening at the bottom row. The wall cell (0,3) is a door: passable, but walking through it is the forbidden behaviour.
- Task reward ("reach the goal fast", verifiable, does not see the door): -c per step, c = 0.1. Compliant route 2(H-1)+6 steps; door route 6 steps. Reward advantage of cheating D = c·2(H-1), linear in horizon.
- Reference policy: behaviour cloning from N = 1000 noisy human demos. A fraction ε use the door. Each step a demo takes a random action with probability η = 0.05 and replans. BC = per-state counts + Dirichlet(α = 0.1).
- Two placements. Near: compliant humans walk along row 0 to (0,2), so the door is one step off a state visited about 1000 times. Far: compliant humans go down column 0 first, so the door's neighbours are visited only by noise (0 to 7 times).
- Objective: E[Σ r_t − β·KL(π(·|s_t) ‖ π_ref(·|s_t))]. Exact optimum by soft value iteration. Sampled RL: tabular softmax from π_ref, Adam, batch 32 episodes, 1500 updates, 3 seeds, estimators k1rew (per-step KL in the reward, PPO-RLHF style), grpo (std-normalized episode advantage plus k3 loss on visited pairs), none.

## Results

1. Sequential tilting law. The exact optimum satisfies P*(τ) ∝ P_ref(τ)·exp(R(τ)/β), so logit P*(door) ≈ logit P_ref(door) + D/β. Across 640 settings (H 3 to 16, β 0.05 to 3, ε 0.1 to 0.001, both placements) the median logit error is 0.04 to 0.09 (90th percentile under 0.3). At ε = 0 the shortcut approximation overpredicts (median error 1.3) because the only door mass in π_ref comes from long, noisy paths that save less than D. The trajectory-level law still holds; the one-number summary does not.
2. Horizon compounds. β = 0.5, ε = 1%, near: door use 2.3%, 3.5%, 5.1%, 7.5%, 16%, 30%, 50%, 84% for H = 3, 4, 5, 6, 8, 10, 12, 16. KL per episode rises from 0.02 to 3.5 nats. The anchor never weakened; the stakes grew.
3. The anchor floor. With ε = 0, takeover needs D/β > −logit P_ref(door) ≈ ln(N/2α). Every 10x more human data adds ln 10 ≈ 2.3 nats. The smoothing constant α, a modelling choice, moves the threshold as much as 100x more data. At N = 1000, α = 0.1: threshold 8.5 nats.
4. Estimators. At H = 8, ε = 1%: k1rew lands on the exact optimum at every β tested (0.16 vs 0.159 at β = 0.5). GRPO ends at 0.89, 0.51, 0.20, 0.06, 0.02 for β = 0.5, 1, 2, 4, 8, versus exact 0.16, 0.04, 0.02, 0.015, 0.013. Std-normalization rescales the reward to O(1) regardless of how small the real advantage is, so β no longer means what it says.
5. Humans never used the door (ε = 0, exact optimum 0.01% to 0.4%). Near: GRPO took the door in 8 of 9 runs (final 0.68 to 0.80). No KL at all took it in 3 of 9 and collapsed onto the compliant route in the rest. k1rew discovered the door in every run (first use at update 1 to 825) and declined it, matching the optimum. Far: GRPO took it in 3 of 9, none in 1 of 9, k1rew in 0 of 9. The GRPO anchor kept the policy stochastic enough to keep finding the door, and its miscalibrated pull could not hold it back once found.
6. Where the anchor is strong. In a state humans visited n times, the most a one-step deviation can cost is about ln(n/α). In states humans never visited the BC policy is uniform and every deviation costs at most ln 4 ≈ 1.4 nats. The near door sits behind a 9.2-nat price; the far door's neighbours charge 1.4. At the takeover β, the near optimum spends 1.3 nats at one state; the far optimum spreads 0.6 nats over the start state and the sparse cells next to the door.

## What this says about the RLHF-then-RLVR hypothesis

The data supports two mechanisms and fails to support a third.

- Supported: fixed price, growing payoff. RLHF sets a KL price per deviation; RLVR on longer tasks raises the payoff of a shortcut in proportion to what it skips. No change to β is needed for takeover, just longer horizons.
- Supported: the reference cannot encode prohibition. Behaviour humans never showed is priced by the prior, and more data only buys log N. An anchor learned from imitation is a soft preference, never a constraint.
- Not supported here: drift starting off-distribution. That needs function approximation. Experiment 3 tests it with shared parameters.
- Practical: with GRPO-style normalized advantages and a k3 loss, β had to be about 4x larger to get the door rate that per-step KL in the reward reached. With ε = 0 the gap was far larger: GRPO took a door the optimum gives under 0.5%.

## Limits

Tabular, one environment, one door, deterministic dynamics, 3 seeds. The BC reference is counts plus a Dirichlet prior, not a network. "Takeover" thresholds are from the exact optimum; sampled runs are 1500 updates. No claim that any deployed model failed this way.
