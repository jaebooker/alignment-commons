# Experiment 3: architecture sweep

Status: done (26 Oct 2026). CPU (2 cores, PyTorch), about 2 hours. Code: `arch_sweep.py`, `run_arch.py`, `figures_arch.py`, `diag_none.py`. Results: `results_arch_eps01.json`, `results_arch_eps0.json`. Figures: `figures/fig6_arch_spillover.png`, `fig7_arch_never.png`, `fig8_arch_drift_by_density.png`.

## Bottom line

The anchor's failure modes are universal across architectures; how far drift spreads is not. Every network trained with KL in the reward settled near the exact KL optimum on the layouts RL trained on, as the tilting law predicts. What changes with architecture is spillover. The more an architecture generalizes, the more of its RL-induced drift shows up on layouts RL never touched: 10% of it for a 16-unit MLP, 45% for a 1024-unit MLP, 66% for a CNN, 82% for a transformer.

The off-distribution prediction that failed in experiment 2 holds once parameters are shared. Under the KL anchor, per-state behaviour change was 1.4x to 3.6x larger on unseen longer layouts than on the states RL visits most, rising with architecture (6.5x for the transformer when humans never used the door). Without KL, drift is spread evenly or concentrated in frequent states. The anchor does not stop change; it pins the states it sees and pushes change to the states it does not.

Applying the anchor on held-out layouts too stopped spillover there, but only there. Layouts outside the anchor's coverage still drifted.

## Setup

- A family of forbidden-shortcut gridworlds (experiment 2): height H, wall column c, door row r. Step cost 0.1; the door saves 4 to 12 steps depending on layout. Policies see the whole grid (wall/out-of-bounds, door, goal, agent channels).
- Three layout sets. T (12 layouts, H 4 to 6): RL trains here. B (6 layouts, H 4 to 6): in the human data, never in RL. O (6 layouts, H = 7): in neither.
- Reference: behaviour cloning of 300 noisy human demos per layout on T and B, fraction ε using the door (ε = 1% or 0).
- Architectures: tabular (smoothed counts, no sharing), linear, MLP with 2 hidden layers of 16, 64, 256 or 1024 units, CNN (two 3x3 conv layers + MLP head), transformer (49 cell tokens, 2 layers, d = 32, 4 heads).
- RL on T only, starting from the reference, β = 0.3, 1500 updates of 64 episodes, 3 seeds. Methods: k1 in reward (PPO-RLHF style), GRPO (normalized advantages + k3 loss), no KL, and k1 + anchor on B (exact KL on B states weighted by the reference's visitation).
- Door use is measured exactly from each policy table (300-step horizon). Drift per state is TV(π, π_ref), grouped by how often the reference visits the state.

## Results (ε = 1% unless stated; means of 3 seeds)

1. The tilting law survives function approximation. With k1 in the reward, door use on T after RL was 0.11 (exact 0.12) for MLP-256, 0.11 (0.12) for MLP-1024, 0.12 (0.11) for CNN, 0.09 (0.13) for the transformer. Small MLPs undershot (MLP-16 0.04 vs 0.08). Linear could not fit the human policy at all (reference door use 0.13 vs 0.01 in the data), so it is reported but not interpreted.
2. Spillover scales with generalization. Held-out door use rose from about 0.010 to 0.014 (MLP-16), 0.022 (MLP-64), 0.048 (MLP-256), 0.057 (MLP-1024), 0.080 (CNN) and 0.076 (transformer). As a share of the drift on T: 0.10, 0.23, 0.39, 0.45, 0.66, 0.82. Tabular: zero, as in experiment 1.
3. GRPO-style training spreads drift almost fully. Held-out door use 0.26 to 0.34 for small MLPs and 0.76 to 0.91 for MLP-256 and up, CNN and transformer, against an exact optimum of about 0.12 on the trained layouts.
4. Anchoring the held-out layouts works locally. k1 + anchor on B kept B at 0.010 to 0.018 for every network, with T unchanged. It did not protect O: MLP-256 0.21 (reference 0.09), MLP-1024 0.18 (0.05), CNN 0.04 (0.005), transformer 0.22 (0.17).
5. Drift goes where the anchor is weak. Final TV on O layouts divided by TV on frequent T states, k1 in reward: MLP-16 1.4, MLP-64 1.5, MLP-256 2.1, MLP-1024 2.8, CNN 2.7, transformer 3.6. With ε = 0: 1.9, 1.8, 2.4, 3.4, 4.4, 6.5. Uncommon T states also drifted 1.2x to 2.0x more than frequent ones. With no KL the same ratios were 0.6 to 1.15.
6. "Never" depends on the architecture. With ε = 0, reference door use on T ranged from 0.0003 (MLP-1024) to 0.005 (MLP-16), and on unseen longer layouts from 0.0002 (MLP-1024) to 0.20 (MLP-16). Small networks' human prior simply does not extend to new layouts. k1 in the reward kept every network near its reference everywhere (T at most 0.005). GRPO took the door on T at 0.17 to 0.74 and on unseen layouts at 0.07 to 0.73.
7. Without KL, runs are erratic rather than uniformly worse. Most went to 0.86 to 1.0 door use. Others froze into deterministic policies that use the door on some layouts and not others (final rates of 3, 7 or 9 out of 12 layouts), and 3 of 6 transformer runs ended at zero. A rerun with goal-reach logging showed two different causes: one transformer collapsed into a loop that reaches the goal 0.03% of the time (no learning signal left), and another settled on the compliant route at 100% goal-reach before ever finding the door. Removing the anchor removes the exploration it maintained as well as the constraint.

## What this says about the hypothesis

- Supported, and now across architectures: the KL anchor sets a price, and the optimizer pays it where the payoff is high. Every architecture tested follows the law where it trains.
- Supported in the shared-parameter setting: drift concentrates off-distribution. The states an RLHF anchor actually covers stay put; the change it permits is exported to inputs the anchor rarely or never saw. Bigger and more structured models export more of it.
- Partly supported: extending the anchor's coverage helps, but only on what it covers. A finite set of anchored inputs cannot pin a model that generalizes beyond them.
- Practical: with GRPO-style training, drift on untouched inputs was nearly as large as on trained ones for every architecture larger than MLP-64.

## Limits

One task family, small grids, one β, 3 seeds, 1500 updates; seed variance for no-KL runs is large. "Exact optimum" is the tabular optimum given each network's reference, which a network may not be able to represent. TV measures any behaviour change, not only door use. Transformer is small (d = 32). CPU only; no GPU-scale models.
