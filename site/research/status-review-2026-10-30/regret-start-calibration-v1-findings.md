# Evidence snapshot: Replay-score calibration: optimal policies get false cross-start regret

Reviewed 30 October 2026. Source: Alignment Commons versioned document `regret-start-calibration-v1-findings`, revision 1. Source-reported findings and original limits retained; this status review did not rerun the study. Historical “awaiting push” or work-ownership notes in the source are dated context, not current queue state.

# Replay-score calibration: harder starts mistaken for regret

Completed 29 October 2026 by Codex for Jaeson Booker. Study regret-start-calibration-v1.

## Result

**The frozen calibration rule passed.** On 512 generated levels, an optimal policy receives mean cross-start max-latest score **0.064757 return units** (95% t interval over 32 seed-group means: **0.063448–0.066066**), even though its true regret is zero. On **429/512 levels (83.79%)**, the false score is at least 0.05. The observed same-start reference matches the exact oracle for every saved scoring episode across all three controls (audit discrepancy ≤2.23e−16).

| Known policy | Original max-latest score | Observed start-matched score | Exact start-matched regret |
| --- | ---: | ---: | ---: |
| Optimal shortest path | 0.064757 | 0.000000 | 0.000000 |
| Two wasted steps, then shortest path | 0.117389 | 0.052632 | 0.052632 |
| Timeout without goal | 0.973684 | 0.908927 | 0.908927 |

These are normalized return units, not percentage points of completion. The optimal policy reaches the goal by a shortest path from every permitted start. The two-wasted-step control has genuine regret 2/(2×19)=0.052632; the timeout control receives zero return. No student network was trained or evaluated.

The figure, complete geometry/path/score records and reproducible archive are preserved with the local research deliverables. All numerical findings and methods are included here.

## Frozen support rule

All three components were required and passed: the lower two-sided 95% seed-group t bound on optimal-policy false regret exceeds 0.05; at least half of the levels have mean false score ≥0.05; observed matched scores agree with exact oracle scores within 1e−10 on every saved scoring episode in all controls. No threshold, cohort, schedule or policy was changed after outcomes.

## What was tested

The original local ACCEL implementation uses a single best return per level, minus the mean of the most recent three returns. Resets can choose different start cells. This known-policy diagnostic tests whether starting-distance variation alone can produce a positive score for a fully competent policy. It follows the earlier regret-budget audit, which implicated the local ranking/eviction scheme but did not isolate this effect. It does not establish the cause of the earlier student-performance gap.

The unchanged copied UED generator makes 5×5 rooms with a 19-step horizon. Goal return is 1−steps/(2H), and timeout return is zero. The prospectively fixed 32 groups (88101–88132) each contain 16 levels: corner/lamp × correlated/decorrelated × four levels. Seeds use a new domain-separated SHA-256 derivation. This supplies new generation streams, not guaranteed unseen geometries; 502 of the 512 full geometry hashes are unique, with duplicates retained. No overlap claim about all prior training/evaluation geometries is made.

Every allowed non-goal free cell is used as a start. Known policies are shortest path; exactly two harmless wasted actions followed by shortest path; and timeout without touching the goal. The last two are deliberately suboptimal controls, not trained agents. For each policy/level, one optimal calibration episode per start is first fed to the original score. Three complete control cycles then visit all starts in lexicographic order. Scores after each episode in the third cycle are saved. Averaging this complete cycle removes arbitrary phase effects of the three-return window.

The matched reference retains the observed optimal warm-up return separately for each start, then averages reference-minus-current-return over the same latest three episodes. The oracle substitutes the exact finite-horizon optimal return for the actual episode start. Both use the same return history; the learner or policy is never given hidden regret to optimize. No replay sampling, buffer eviction, edits, PPO, new hyperparameter selection or curriculum-performance measurement is performed.

This is an intentionally favorable calibration control: every start has an observed optimal reference. In ordinary online training that coverage and competence are not guaranteed. A start-matched maximum can still underestimate regret if its historical return is suboptimal. This result does not establish a deployable correction, sample efficiency, or improved student learning.

## Why the bias occurs

After optimal warm-up, let V*(s) denote the optimal return at start s and R(s) the control return. Across a complete balanced cycle:

- Original max-latest mean = max_s V*(s) − mean_s R(s).
- True mean regret = mean_s V*(s) − mean_s R(s).
- Their difference = max_s V*(s) − mean_s V*(s).

Thus the score contains a positive start-difficulty term even when R(s)=V*(s) everywhere. In these rooms, nearest starts have distance one; more distant starts necessarily have smaller optimal returns. The extra score is unrelated to any policy mistake. The same mean additive bias, 0.064757, appears for all three controls after the common warm-up. Under different nonstationary histories the simple identity need not apply.

A constant-return synthetic engineering control produces zero score, while a synthetic varying-return history produces the expected 0.5 score. These are implementation checks, not evidence about policy learning. The generated optimal paths and exact returns provide the substantive known-policy control.

## Uncertainty and claim boundaries

Intervals use 32 seed-group means, each over 16 generated levels; levels, starts, repeated cycles and reused paths are not treated as independent training seeds. The interval quantifies variation under this bounded generator and equal weighting of the four design cells. It is not a general ACCEL claim, a replication of the paper’s strongest estimator, or a statement about other return definitions. The full-control schedule differs from the original online sampling schedule.

A positive calibration finding is not a proof that the old curriculum prioritizes the wrong levels in practice, nor that per-start matching improves its final performance. That causal training comparison remains a separate proposed follow-up. A useful future design would cross global/per-start reference with eviction rule at the same learner and step budget, using newly frozen training seeds and retaining incomplete-reference cases. No such training was run here.

## Correction and provenance

The initial frozen run stopped on the first level while serializing NumPy integer coordinates for a geometry hash. It wrote no cohort records or aggregate summary. The first level was generated and control calculations executed in memory, so the amended freeze is not represented as never-accessed. Only JSON scalar conversion was changed. The original source/freeze are preserved under interrupted-attempt/, and serialization-correction.json records the failure, scope and unchanged scientific design. The correction and amended binding freeze were published before restarting the entire cohort.

All source/protocol hashes were verified at scoring and audit. Original source copies are `ideas/accel-levels/method.py` and `testbeds/ued_gridworld/generate.py` from Alignment Synthcore. They are copied into an isolated directory; shared experiments were not edited. The `public` import is removed only when loading the copied curriculum class, whose score-update method is unchanged. This is a new local diagnostic, not a benchmark verdict replacement.

## Independent audit and reproduction

An independent script reconstructs integer finite-horizon Bellman optimal values without using the runner’s BFS; replays every stored action/path from geometry; computes global and matched scores directly from histories without importing ACCEL; and recalculates all primary intervals and gates. It verifies **512 levels, 33,759 control paths, 314,055 physical actions and 33,759 final-cycle scoring episodes**, plus geometry hashes, seed derivations and freeze integrity. Controls are reused across score-history cycles; these counts are audited stored paths and scoring records, not independent samples.

Extract complete-evidence.zip into an empty folder. `OPENBLAS_NUM_THREADS=1 python work/audit_regret_start.py` audits preserved evidence. `python work/report_regret_start.py` regenerates the report, figure, checksums and archive. The scoring command `python work/regret_start_calibration.py run` refuses to overwrite a summary; rerun only in a separate extracted copy after removing generated scoring files. Do not refreeze preserved evidence. Dependencies: NumPy 1.26.4, SciPy 1.10.1; Matplotlib 3.9.2 for reporting.

The archive includes original and amended freezes, protocol, correction, all geometry/control paths/scores, summary, independent audit, frozen runner and exact source copies. SHA256SUMS.json covers all output files except itself and the archive.
