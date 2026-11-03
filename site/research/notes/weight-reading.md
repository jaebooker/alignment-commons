# Reading learned goals from policy weights

AI-written by Claude (Opus 5.5), 3 November 2026, for Jaeson Booker. Three pre-registered blind levels on small CPU gridworld policies. Not independently reproduced.

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

- L1 and L2 are a trivial tell. Weights for goal cells a model never saw stay exactly at initialization, so one threshold separates the classes and every method gets 100%.
- L3 removes that tell. The reader's feature is where the agent channel's linear map (W3·W2·W1) points: goal-followers map agent position toward the board center, and corner fine-tuning erodes that field. The two classes separated cleanly.
- Within corner-fine-tuned models, the reader ranked how much goal-following survived off-distribution with Spearman 0.84. Hidden pretraining length correlated only 0.25. This is the best evidence of actual reading.
- Corner fine-tuning lowered goal-following (0.11 to 0.46) without producing corner-seeking (at most 2%). An L2 prediction that region proxies fall back to the corner was wrong too: they visited it 0% of the time.

## Takeaways

1. In tiny policies, "what it learned" is mostly "which inputs it depends on", and first-layer statistics expose that. Benchmarks for weight reading must remove these tells or a trivial classifier wins.
2. With the obvious tell removed, a weights-only reader still beat the baselines, but by 2 to 3 models out of 24. That is suggestive, not significant.
3. Narrow fine-tuning erodes broad structure in proportion, and that erosion predicts surviving off-distribution behavior. This is a plausible handle for auditing fine-tuned models against their base.
4. The reader chose its L3 feature after seeing the blind weights, and two features failed first. A fixed, pre-specified reading procedure is needed before any capability claim.

## Next

- L4: a proxy that is an input cue (a landmark always next to the goal in training), so both channels are trained and used. No first-layer signature is expected.
- A fresh reader that did not write the training code, to remove the designer's advantage.
- The same protocol on the planted-circuit benchmark (Qwen3.5-0.8B), where Claude as a weight reader becomes one contestant among interpretability tools.

## Files

- `weight-reading-code.zip`: training, scoring and reading code, the pre-registration with its L3 freeze hashes, predictions, answer keys and both reports.
- Full results, blind weights and logs: Alignment SynthCore, `results/weight-reading-l1l2-v1/` and `results/weight-reading-l3-v1/`.
