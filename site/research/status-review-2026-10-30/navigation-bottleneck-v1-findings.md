# Evidence snapshot: Bounded Agency: one-pulse navigation intervention findings

Reviewed 30 October 2026. Source: Alignment Commons versioned document `navigation-bottleneck-v1-findings`, revision 1. Source-reported findings and original limits retained; this status review did not rerun the study. Historical “awaiting push” or work-ownership notes in the source are dated context, not current queue state.

# Navigation bottleneck intervention: registered support rule not met

Completed 27 October 2026 by Codex for Jaeson Booker. Study: navigation-bottleneck-v1.

A single recurrence-triggered, position-history-based action did not reliably repair these policies. Completion improved by 0.93 percentage points over baseline and 0.80 points over a matched random move; both policy-level 95% intervals include zero. This tests one intervention, not the general existence of navigation bottlenecks.

| Registered endpoint | Mean change (pp) | Two-sided 95% interval (pp) | One-sided 95% lower (pp) | Frozen support requirement | Pass |
| --- | ---: | --- | ---: | --- | --- |
| Novelty − baseline completion | 0.93 | [-0.77, 2.63] | -0.401 | Mean ≥10 pp; lower >0 | False |
| Novelty − random completion | 0.80 | [-0.43, 2.03] | -0.163 | Mean ≥5 pp; lower >0 | False |
| Novelty − baseline gem | 0.14 | [-0.04, 0.32] | -0.001 | Lower ≥−5 pp | True |

All three gates were required. P1 and P2 failed; P3 passed. No outcome-dependent retuning was performed. Intervals use six paired policy-level values (Student t, df=5), conditional on this selected cohort. The large rollout count does not create more independent policies.

| Arm | Gem | Proxy | Neither | Completion |
| --- | ---: | ---: | ---: | ---: |
| baseline | 44.890% | 7.597% | 47.513% | 52.487% |
| sham | 44.890% | 7.597% | 47.513% | 52.487% |
| random | 44.768% | 7.849% | 47.383% | 52.617% |
| novelty | 45.028% | 8.390% | 46.581% | 53.419% |

Most of the net completion increase was proxy completion (+0.79 pp); gem completion increased only +0.14 pp. Endpoint recovery is not evidence of alignment recovery.

Figure and complete binary evidence are preserved in the local research deliverables; this public document contains the full findings and methods.

## Design and frozen scope

The primary cohort is the six unresolved p=0.1, entropy=0.05 CNN-L checkpoints (600 training updates) selected by the preceding mid-switch diagnostic: seeds 91000, 91001, 91002, 91003, 91005, 91006. Seeds 91004 and 91007 are descriptive competent comparisons, excluded from the primary rule. No new training or escape-time estimation was performed. Claude’s separate escape-time work was not modified.

Each episode has an 11×11 interior, the original 13×13×3 observation, a gem, and fixed proxy at (1,11). Full-softmax temperature-1 actions run for at most 40 steps. The first endpoint terminates; attempted wall moves stay in place and consume a step. Rewards, observations, and termination are unchanged.

Before acting, the first third visit to a position within the last 24 positions triggers at most one pulse. Baseline supplies the trigger; all branches share the exact prefix and random-number arrays. Sham changes no action. Random chooses uniformly among in-bounds cardinal moves. Novelty chooses uniformly among legal moves whose next position has the fewest visits in that prefix window. The pulse consults position history and board boundaries only, not endpoint locations, reward, values, or shortest paths. The original policy resumes immediately. The original policy still receives its original observation including the gem; “goal-blind” describes only the pulse.

The 160 confirmation placements balance five distance-difference bins (−6,−3,0,3,6) and short/long strata, with 128 repetitions each. They are disjoint initial agent/gem pairs from the 40 engineering placements, four preceding mid-switch sets, and phase batteries seeded 7,8,9,17. This is initial-pair disjointness, not unseen training states or unseen trajectory states. Common policy and kick uniforms are seeded 202610500 + policy index.

Protocol, engineering checks, placements, runner, and model/input hashes were frozen before neural scoring. Scoring ran from 2026-10-27T22:27:25.834224+00:00 to 2026-10-27T22:27:45.167864+00:00. The synthetic two-cell trap completed 0% at baseline, 100% with novelty, and 74.61% with random (4096 repetitions). A no-recurrence shortest-path control left every arm identical. These validate implementation on constructed cases, not efficacy on neural policies.

## Policy-level completion changes

| Primary seed | Novelty − baseline (pp) | Random − baseline (pp) |
| ---: | ---: | ---: |
| 91000 | 0.249 | -0.176 |
| 91001 | 0.073 | -0.010 |
| 91002 | -0.034 | -0.044 |
| 91003 | 4.199 | 1.060 |
| 91005 | 0.459 | -0.205 |
| 91006 | 0.645 | 0.156 |

Seed 91003 accounts for the largest improvement (+4.20 pp); this remains descriptive and does not rescue the joint rule.

## Additional descriptive checks

Across the six primary policies, 58,014 of 58,384 baseline failures triggered (99.37%). Thus the small improvement is not simply explained by failure to flag those episodes. Novelty rescued 3,455 baseline failures but lost 2,310 baseline completions, a net 1,145 of 122,880 episodes. These paired counts are descriptive, not additional policy-level replicates.

Post hoc, among primary triggered episodes, the novelty branch returned to the trigger position within five subsequent steps in 40.88% and within ten in 51.63%. These were not registered endpoints and do not identify an internal mechanism.

The result is compatible with navigation failures requiring several coordinated actions, a different intervention, or other behavioral limitations. It does not identify latent goals or prove that a stronger navigation repair would fail. Capacity expansion remains a separate decision.

## Independent verification and reproduction

The independent audit passed: 655,360 episode branches replayed; 14,092,228 active actions/transitions checked; all branch prefixes, recurrence triggers, action budget (at most one pulse), source/input hashes, sham identity, primary intervals and verdict verified. Initial-pair exclusions were also independently reconstructed. This is numerical/implementation verification, not independent training replication.

The complete-evidence.zip archive preserves the output folder, frozen runner, audit, report generator, original model/source dependencies, and prior cached probability traces. Extract into an empty directory; with Python, NumPy 1.26.4, SciPy 1.10.1 and Matplotlib 3.9.2, run `OPENBLAS_NUM_THREADS=1 python work/audit_navigation.py` to audit existing evidence. The frozen scoring command is `OPENBLAS_NUM_THREADS=1 python work/navigation_bottleneck.py run`; this replaces preserved scoring outputs. Do not rerun the `freeze` command on the completed evidence. `python work/report_navigation.py` regenerates report/figure/package. SHA256SUMS.json covers files within this output directory except the archive and checksum file itself.

Full inputs: protocol.json, freeze.json, placements.json, engineering-checks.json. Full results: summary.json, records/, traces/, independent-audit.json.
