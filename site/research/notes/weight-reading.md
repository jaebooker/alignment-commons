# Reading learned goals from policy weights

AI-written by Claude (Opus 5.5), 3 November 2026, for Jaeson Booker. Four pre-registered blind levels on small CPU gridworld policies. Not independently reproduced.

## Question

Given only the weights of a small policy, can a reader tell whether it learned to reach the goal or a proxy that coincided with the goal in training, and predict how it behaves off-distribution? The motivation is MIT's weight-space programming work, which reported that a strong model could read and edit small networks' weights directly. This asks a narrower, testable version for goal misgeneralization.

## Setup

- 9x9 gridworld. Observation: agent one-hot then goal one-hot. +1 at the goal, -0.01 per step, 40 steps.
- Policy: MLP 162 -> 64 -> 64 -> 4, tanh, 14,852 parameters, PPO on CPU.
- Pairs of conditions that behave the same in training: `goal` (goal anywhere) against a proxy where the goal always sat in the top-right corner (or region).
- Blind protocol: models get random IDs, the answer key is sealed, predictions are hashed and the hash shared before the reveal. Ground truth is behavior: greedy rollouts with goals at least 4 cells from the corner, goal-follower if P(reach goal) > 0.5.
- Reader rules: weights only, linear algebra allowed, no nonlinearities, no forward passes, no environment. Forced choice between the two hypotheses, which is easier than MIT's open-ended setting.
- Baselines: B-flat (logistic regression on per-tensor statistics, blind to input layout) and B-chan (adds first-layer norms per input channel). Success bar: above 80% per level.

## Results

| Level | What separates proxy from goal | Reader | B-flat | B-chan |
|---|---|---|---|---|
| L1: goal vs corner | Proxy trained on the corner goal only | 24/24 | 24/24 | 24/24 |
| L2: goal vs top-right 3x3 | Proxy trained on 9 goal cells | 24/24 | 24/24 | 24/24 |
| L3: shared warm start, then goal vs corner fine-tune | Every goal cell trained in both | 24/24 | 21/24 | 22/24 |
| L4: goal vs landmark (a cue always left of the goal) | Both channels trained and used; reader fixed in advance | 24/24 | 24/24 | 24/24 |

- L1 and L2 are a trivial tell. Weights for goal cells a model never saw stay exactly at initialization, so one threshold separates the classes and every method gets 100%.
- L3 removes that tell. The reader's feature is where the agent channel's linear map (W3·W2·W1) points: goal-followers map agent position toward the board center, and corner fine-tuning erodes that field. The two classes separated cleanly.
- Within corner-fine-tuned models, the reader ranked how much goal-following survived off-distribution with Spearman 0.84. Hidden pretraining length correlated only 0.25. This is the best evidence of actual reading.
- L4 makes the proxy an input cue and freezes the reader's procedure before training. The frozen reader scored 24/24, but so did both baselines: the channel a policy steers by gets a first-layer block about three times larger (goal block 12.4 vs 4.4), which shifts the whole layer's norm by about 7 standard deviations.
- Corner fine-tuning lowered goal-following (0.11 to 0.46) without producing corner-seeking (at most 2%). An L2 prediction that region proxies fall back to the corner was wrong too: they visited it 0% of the time.

## Takeaways

1. In tiny policies, "what it learned" is mostly "which inputs it depends on", and first-layer statistics expose that. Benchmarks for weight reading must remove these tells or a trivial classifier wins.
2. Across four levels the weights-only reader never beat trivial baselines by a meaningful margin. Each design that removed one tell exposed another: unused inputs (L1, L2), training budget (L3), first-layer block size (L4).
3. Narrow fine-tuning erodes broad structure in proportion, and that erosion predicts surviving off-distribution behavior. This is a plausible handle for auditing fine-tuned models against their base.
4. The reader chose its L3 feature after seeing the blind weights. L4 fixed the procedure in advance; it worked, but there was nothing left for it to win.

## Next

- L5: L4 with each first-layer input block projected to a fixed norm after every update, so block size carries no information and only weight direction and structure remain.
- A fresh reader that did not write the training code, to remove the designer's advantage.
- The same protocol on the planted-circuit benchmark (Qwen3.5-0.8B), where Claude as a weight reader becomes one contestant among interpretability tools.

## Files

- `weight-reading-code.zip`: training, scoring and reading code, the pre-registration with its L3 freeze hashes, predictions, answer keys and both reports.
- Full results, blind weights and logs: Alignment SynthCore, `results/weight-reading-l1l2-v1/` and `results/weight-reading-l3-v1/`.


Integration review (4November2026): see [audit and provenance](/research/weight-reading/INTEGRATION.md). L1/L2 were not repository-frozen before training; L4 saved hashes match but its snapshot was uncommitted at import. No independent training/behavior replication is claimed.
