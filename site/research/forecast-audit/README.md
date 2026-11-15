# Forecast audit: can language models predict which alignment ideas survive a ground-truth test?

AI-written by Claude for Jaeson Booker, 13 to 15 November 2026, at the Apart Research AI x Epistemics Sprint. Five hypotheses and their item set were frozen with file hashes before the main run; a second item set was added by a dated amendment before any forecast on it. Every model call is cached, and every number recomputes from the cache with no new calls. Draft report, not yet reviewed by judges. Not independently reproduced.

## Question

If models are to help decide which alignment ideas deserve effort, they need to know how likely an idea is to work. Alignment SynthCore gives a test with known answers: 45 methods were each run on a testbed with planted ground truth, and the verdicts postdate every forecaster's training data. Can models forecast those verdicts, and do they know when they cannot?

## Setup

- Catalogue set: 114 binary questions about 45 tested ideas in 11 testbed families. Gate (did the mechanism gate pass, 53% yes), win (did it beat the tuned baseline, 29% yes; the primary question) and sign (was the safety effect positive, 79% yes).
- Sub-claim set (Amendment 1): 74 claims that SynthCore's confirmatory studies registered before their confirmation runs, from 19 reports in 7 families; 65% were met.
- Forecasters: six open models hosted by Adaption (GLM 5.3 Flash, Qwen 3.5 397B, Qwen 3.8 27B, DeepSeek V4 Flash, Gemma 4 31B, Gemma 4 26B). GLM 5.2 was dropped for empty answers. No tools or retrieval. Three samples per cell at temperature 1.
- Conditions: blind; base rate given (the yes-rate on other testbed families); citation removed.
- Intervals are 95% and resample testbed families. A leakage probe found no model that recognised the repository or could recall its verdicts.

## Results

| Finding | Evidence |
|---|---|
| Every model overpredicts wins | True win rate 0.29; pooled mean forecast 0.64; bias +0.35 [+0.21, +0.52]; per model +0.22 to +0.51 |
| Models rank better than chance | Pooled AUROC 0.66 [0.57, 0.89]; 4 of 6 models individually |
| No model reliably beats the base rate | Pooled Brier skill -0.30 [-1.59, +0.18]; significantly negative for both Gemma models. Registered as "skill at or below zero", which the interval does not establish |
| The forecast is close to a constant | Three models with complete data average 0.70 on the win question (29% true) and 0.69 on the sub-claims (65% true). Across families with true rates from 0% to 100%, mean forecasts stay between 0.41 and 0.81 |
| A reference class moves the level, not the ranking | With the base rate given, mean win forecasts fall to 0.33 to 0.46 and the pooled Brier score improves by 0.08 [0.00, 0.17]; AUROC falls to 0.37 to 0.58 |
| A citation alone adds confidence | Removing the source line lowers the pooled win forecast by 0.05 [0.03, 0.07] |

The apparent optimism about alignment methods is a fixed prior near 0.7 meeting a low base rate. On the sub-claim set the same prior looks like calibration.

## Limits

- About 34 independent ideas in 11 families, and 7 sub-claim families. Intervals are wide.
- One research programme, mostly toy scale; many methods are simplified implementations. The 29% win rate is specific to this catalogue.
- The sub-claim descriptions were written by an AI assistant with the outcomes in view; only 13 of 74 outcomes were checked against a machine-readable summary.
- On the sub-claim set three of six models exceeded the failed-call cutoff, so its claims rest on three models.
- The base-rate condition is confounded: a leave-one-family-out rate is anti-correlated with each family's own rate.
- Mid-sized open models only. Nothing here shows frontier models behave the same way.
- The freezes rest on local hashes followed by a public commit, not a third-party timestamp. One hypothesis was written before a 10-item pilot that agreed with it.

## Files

Code, items, cached model outputs and analysis: `experiments/epistemics_sprint/` in github.com/jaebooker/alignment-synthcore. Pre-registration, amendment, deviations log, draft report and figures are in this folder.
