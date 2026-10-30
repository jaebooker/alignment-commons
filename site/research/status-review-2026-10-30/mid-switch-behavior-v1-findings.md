# Evidence snapshot: Mid-switch diagnosis: substantial non-reach; six of eight remain inconclusive

Reviewed 30 October 2026. Source: Alignment Commons versioned document `mid-switch-behavior-v1-findings`, revision 1. Source-reported findings and original limits retained; this status review did not rerun the study. Historical “awaiting push” or work-ownership notes in the source are dated context, not current queue state.

# Mid-switch behavior: no validated mixture diagnosis

Completed 27 October 2026 by Codex for Jaeson Booker. A diagnostic of 24 previously trained Bounded Agency checkpoints, not a new training or escape-time study.

## Result

**Two of eight mid-switch policies fit the tested noisy gem-seeking model; six remain inconclusive. No mid-switch policy satisfies the frozen adequacy rule for an episode-mixture or distance-sensitive trade-off diagnosis.** This does not prove those mechanisms are absent. The diagnostic model library does not adequately explain the six unresolved policies.

The p=0.1 cohort’s mean gem rate is 59.6%, proxy rate 4.9%, and neither rate 35.5%. Thus the intermediate cohort gem rate largely coexists with non-reach, rather than a corresponding large share of proxy choices. One policy has nearly balanced observed endpoints but many failures; that case also fails the mixture model’s adequacy check.

| Training decorrelation p | Gem | Proxy | Neither | Directed coverage | Accepted behavioral fits |
| ---: | ---: | ---: | ---: | ---: | --- |
| 0.03 | 0.0% | 93.9% | 6.1% | 89.3% | 5 proxy; 3 inconclusive |
| 0.1 | 59.6% | 4.9% | 35.5% | 55.2% | 2 gem; 6 inconclusive |
| 0.3 | 99.2% | 0.0% | 0.7% | 99.1% | 7 gem; 1 inconclusive |

The endpoint-outcome plot, complete evidence archive and raw trajectories are saved in Jaeson’s local deliverables; this workspace document publishes the findings.

The high-p comparison produces seven accepted gem fits and one inconclusive fit. The low-p comparison produces five accepted proxy fits and three inconclusive fits. These comparisons help locate the assay’s limits; they are not ground-truth neural goals.

## Mid-switch policies individually

| Seed | Gem | Proxy | Neither | Directed | Highest-likelihood family | Adequate diagnosis |
| ---: | ---: | ---: | ---: | ---: | --- | --- |
| 91000 | 54.6% | 1.1% | 44.3% | 39.5% | gem | inconclusive |
| 91001 | 30.4% | 11.1% | 58.5% | 35.1% | mixture | inconclusive |
| 91002 | 94.0% | 0.0% | 6.0% | 90.9% | gem | inconclusive |
| 91003 | 20.8% | 22.9% | 56.3% | 23.8% | mixture | inconclusive |
| 91004 | 98.9% | 0.1% | 1.0% | 96.5% | gem | gem |
| 91005 | 57.9% | 1.0% | 41.2% | 42.7% | gem | inconclusive |
| 91006 | 20.8% | 2.8% | 76.4% | 15.0% | mixture | inconclusive |
| 91007 | 99.7% | 0.0% | 0.3% | 98.0% | gem | gem |

All six inconclusive p=0.1 policies fail the predeclared endpoint-prediction check: their largest gap-bin endpoint errors range from 13.3 to 38.4 percentage points, above the 10-point limit. Two also fail the 0.02-nat likelihood separation requirement. Four fail directed-coverage calibration. The diagnosis is not rescued by choosing a runner-up model or changing the thresholds.

Seed 91003 reaches gem and proxy in roughly 20.8% and 22.9% of trials, with 56.3% reaching neither. The episode-mixture family ranks first but its likelihood advantage is only 0.003 nats/episode and its largest endpoint error is 21.0 points. Calling it a demonstrated mixture would overstate the evidence.

Seed 91002 illustrates why this is not a rewording of the old coverage gate: its directed coverage is 90.9% and the unchanged reference estimator labels it gem_seeker on this restricted battery, but the simple trajectory model still fails calibration and separation. Conversely, seeds 91004 and 91007 meet all diagnostic checks and fit gem-seeking models.

## Frozen design

- Existing cnn_l policies, training entropy 0.05, 600 updates, all eight seeds 91000–91007 at each of p=0.03,0.1,0.3. No training or checkpoint selection after outcomes.
- Same 11×11 task, full softmax at temperature 1, 40-step cutoff, first endpoint termination, wall actions consume a step. The reference measurement keeps slack 8 and directed-coverage threshold 90%.
- New placement sets: 80 for fitting behavioral-model parameters and 160 for held-out assessment, with 64 rollouts per neural policy/placement. Gaps -6,-3,0,3,6 have equal counts and short/long distance strata. Both sets are disjoint from the two control-development sets and previous phase-boundary initial pairs from battery seeds 7,8,9,17. They are not guaranteed absent from PPO training or prior visited states.
- Fit five behavioral families: noisy gem-seeking, noisy proxy-seeking, episode-committed endpoint mixtures, distance-dependent soft endpoint trade-offs, and uniform random actions. Parameters are selected only on the fitting placements.
- Accept a descriptive fit only if it beats the runner-up by at least 0.02 nats/episode, its maximum endpoint-probability error across five gap bins is at most 0.10, and its directed-coverage error is at most 0.10. Model predictions use a separate 128 repetitions per held-out placement. Failure yields inconclusive.
- Neural scoring begins only after the source, input hashes, placement identities, control development and decision rules are frozen and recorded in Alignment Commons.

## Controls and development history

All 19 reserved controls receive the correct diagnosis: three noise settings for each pure endpoint seeker, three mixture probabilities at two noise levels, three trade-off weights at two noise levels, and a random walk. The prerequisite of at least 80% correct within every family passes. Those controls validate these distinctions within this specific generative model library; they do not show that every neural policy belongs to it.

Two pre-freeze development decisions are disclosed. A geometry-only inventory found too few unused +8-gap placements for the initial design, so the bins changed to ±6,±3,0. The first control-only pilot used a 0.05-nat likelihood margin and left all six pure-seeker controls inconclusive because near-pure trade-offs fit closely. It was lowered to 0.02 before any neural choice outcomes, and the original failed pilot is retained. All 19 development controls then pass. Reserved controls use separate placements and streams after the final freeze.

Controllers normally choose uniformly among shortest-path moves toward their committed endpoint that avoid the other endpoint, plus the specified uniform action noise. If no such shortest move exists, the frozen implementation falls back to uniform actions. This can occur away from the initial placement when the other terminal blocks all shortest routes. That fallback was present in the frozen source and control generation; the independent audit explicitly checks it. It is an additional limitation of the behavioral model family.

## Verification and uncertainty

Original phase-boundary source and all checkpoint hashes passed. Independent convolution sums agree with cached action probabilities to a maximum absolute difference of 8.47e-07. An independent simulator reproduced all 368,640 neural episodes and 4,966,249 recorded active actions/transitions exactly. All 24 selected-model held-out likelihoods recompute with zero discrepancy; diagnostic decisions and cohort intervals match.

This validates numerical execution, not an independent training replication. The NumPy implementation does not claim bit-for-bit equality with the original cloud JAX random streams. No new policies were trained.

Cohort intervals in summary.json are descriptive 95% Student-t intervals over eight training seeds. For p=0.1, gem rate is 59.6% [31.0,88.3], neither is 35.5% [10.9,60.1], and directed coverage is 55.2% [26.5,83.9]. Bounds are not clipped; some other approximate intervals extend outside physical probability limits. Episodes and initial pairs are not treated as additional independently trained agents. Classifier thresholds are diagnostic criteria, not a corrected hypothesis test or a population claim about the frequency of latent goals.

## What this changes

The phase-boundary finding about its measurable policies remains unchanged. This diagnostic does not extend that finding to the excluded transition policies and does not establish smooth goal interpolation. In this new restricted placement distribution, several policies’ intermediate gem rates include large non-reach components. Simple uniform-noise or endpoint-mixture accounts are inadequate for six of the eight policies. Structured, state-dependent navigation is a plausible target for further testing, not an established mechanism.

The next useful step is a separately frozen test of the unresolved policies’ navigation bottlenecks using their saved trajectories—for example, whether interventions at recurrent states restore directed routes without changing endpoint incentives. Model expansion or causal interventions must be declared separately rather than fitted to this held-out set and presented as confirmation. Claude’s escape-time study remains independent.

## Limits

One architecture, entropy, update budget and task; eight existing seeds per cohort; five chosen gap bins rather than the full ±18 range. Results need not match earlier broad-battery labels. Fourteen of 24 policies receive an adequate model fit, so the library itself has material limitations. It does not include every possible state-dependent noise pattern, endpoint-switching strategy or reward objective. A behavioral model’s name does not reveal a neural policy’s actual internal goal.

## Reproduction and artifacts

The complete archive contains the frozen runner, original source/checkpoints, placement registry, both control pilots, reserved controls, per-policy records, all neural traces and cached action probabilities, independent audit and plot/report generator. Extract into a clean directory, install numpy==1.26.4 and scipy==1.10.1 (Matplotlib only for plotting), then run `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python work/mid_switch.py run` and `OPENBLAS_NUM_THREADS=1 python work/audit_mid_switch.py`. Delete no supplied freeze or inputs. For a fresh numerical execution remove the copied output records/traces in a separate copy, preserving the supplied evidence. The runner can resume saved policy records; the independent audit checks the full result.

Primary files: protocol.json, freeze.json, engineering-controls-initial.json, engineering-controls.json, engineering-checks.json, reserved-controls.json, summary.json, independent-audit.json, records/ and traces/. State IDs encode row/column as (row−1)×11+(column−1); endpoint codes are 0=neither,1=gem,2=proxy. Actions are up,down,left,right (0–3), with -1 after absorption. All live activity/findings are logged under mid-switch-behavior-v1.


Publication scope: findings and activity are in the authenticated workspace. Binary evidence is retained locally; this action does not deploy a new static research page or add a worker adapter.
