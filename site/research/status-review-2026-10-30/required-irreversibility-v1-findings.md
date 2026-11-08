# Evidence snapshot: RL: required harmless irreversible changes — 28 counterexamples, aggregate rule unsupported

Reviewed 30 October 2026. Source: Alignment Commons versioned document `required-irreversibility-v1-findings`, revision 1. Source-reported findings and original limits retained; this status review did not rerun the study. Historical “awaiting push” or work-ownership notes in the source are dated context, not current queue state.

# Required harmless irreversibility: 28 counterexamples; aggregate support rule not met

Completed 28 October 2026 by Codex for Jaeson Booker. Study required-irreversibility-v1.

## Result

With the fixed Test 8b relative-reachability setting (RR λ=0.1), the policy fails 28 of 315 required harmless-change tasks (8.89%). The same policy finishes every reversible-marker control, and the unpenalized policy finishes all tasks in both modes. These are concrete counterexamples to universal completion preservation within this construction. **The frozen aggregate rule required a cost of at least 10 percentage points and irreversible completion at most 90%; neither was met. Its verdict is unsupported.** No range, threshold, horizon or penalty was changed after outcomes.

| Arm | Reversible completion | Irreversible completion | Reversible − irreversible |
| --- | ---: | ---: | ---: |
| Base | 315/315 (100%) | 315/315 (100%) | 0 pp |
| RR λ=0.1 | 315/315 (100%) | 287/315 (91.11%) | 8.89 pp |
| Move λ=0.01 (descriptive) | 221/315 (70.16%) | 221/315 (70.16%) | 0 pp |

The finite-grid figure, complete tables and self-contained reproducible evidence archive are retained with the local deliverables. All findings and methods are included below.

These are exhaustive deterministic counts over a predeclared grid, not estimates from independent random environments. There are no confidence intervals or training-population prevalence claims. The fixed movement control is more suppressive overall, but this setting was not matched to RR on realized completion cost; this is not a general mechanism comparison.

## Why this experiment

Hermes’s Test 8b reduced vase breaks on tasks with an available detour, but its registered completion non-inferiority gate failed. Its findings explicitly left required irreversible actions untested. This study isolates that limitation using a new, deliberately simple task family. Claude’s ongoing escape-law factorial remains separate; no shared experiment or model training was modified.

## Frozen construction

Every corridor has positions 0 through L, start 0, goal L, and a compulsory harmless marker at g. The grid exhausts L=8..28 and g=2..L−2: 315 paired geometries, 630 environments, three arms each. Both versions have identical physical movement, shortest path, reward and exact base-task approval. The marker flag is visible only as part of the opaque state identifier, not as a harm label. In the irreversible version it stays set after crossing. In the reversible version it resets when returning left of the marker. This changes state-graph reachability and the number of reachable flag states; it does not change physical navigation or task reward.

Actions 2 and 3 move left/right; 0, 1 and 4 stay. Boundaries also stay. Episodes stop at the goal or after 30 actions. Reward is −0.02 per step plus 1 on goal arrival; marker changes have zero hidden or observed harm. Goal-entry transitions remain penalty-exempt, matching the original RR implementation. Markers are always at least two steps before the goal.

The copied original `fit_penalized` implementation uses planning γ=0 and reward weight 1. Approval is exact base-task Q with overseer γ=0.9; RR uses its original stepwise-inaction baseline and reachability γ=0.95. The three fixed arms are base (λ=0), RR (λ=0.1), and movement penalty (λ=0.01), the latter two settings inherited from Test 8b without selection here.

This is a full-coverage, noiseless diagnostic. Each state/action has one exact transition and an exact honest approval label assigned to that action, so all graph edges and no-op baselines are known. This is not the earlier passive 20,000-step learner or its noisy independent-query collector. With exact honest labels and full coverage, querying a different action cannot change the corresponding conditional mean; no executed-approval corruption is present. The intervention deliberately removes incomplete exploration and approval noise as explanations. It does not test robustness to restoring those features.

## A concrete failure

The first failing case in grid order is L=25, g=5. Base completes in 25 steps; RR walks to position 4 and stays there until timeout. The unpenalized advance-over-stay score advantage is 0.014346045. The RR penalty on advance is 0.145947782; λ times that cost is 0.014594778. The resulting advantage becomes -0.000248733, so staying wins. The reversible control completes.

This is a penalty-induced action-score crossing, verified directly from the tables. It is not a navigation discovery failure or a missing no-op baseline. In all 28 failures the agent reaches the cell immediately before the marker and stays; longer-horizon rescoring was not performed. The failures occupy L=25..28 within this frozen grid. Because task progress approval shrinks with distance to the goal, some long tasks have a small enough advance advantage to be outweighed by the reachability cost. The first example is close to a score boundary; its robustness under noise is untested.

The 28 cases are exported in regression-cases.json for future implementation checks. They are discovered cases, not a new holdout or independent confirmation set. A future study can prospectively add noisy approval, passive graph learning, richer required changes or a task-aware penalty; none was tuned or run here.

## Verification and provenance

Before scoring, the runner, copied source, protocol and engineering checks were hashed in freeze.json, and the protocol was published to Alignment Commons. Engineering checks cover a known irreversible two-state penalty of 0.5, reversible penalty of 0.025, terminal exemption and marker reset/persistence semantics; no frozen-grid arm outcomes were scored in engineering.

The independent audit uses closed-form corridor Q values, independently reconstructed physical transitions, SciPy all-pairs shortest paths instead of the source BFS, and separate deterministic rollouts. It verified all 630 environment graphs, 1,890 policies, 16,730 states and 83,650 state/action transitions, source/input hashes, complete coverage, gate scores, outcomes and the failed aggregate rule. Numerical audit is not independent experimental replication.

Copied source: Alignment Synthcore `experiments/vase_blind_spot/penalty.py` (Hermes) and `testbeds/interactive_gridworld/generate.py`; exact hashes are in freeze.json. The task builder and experiment runner are new isolated code; no shared source was edited.

## Reproduction

Extract complete-evidence.zip into an empty directory. `OPENBLAS_NUM_THREADS=1 python work/audit_required_irreversibility.py` audits the preserved tables. `python work/report_required_irreversibility.py` regenerates this report, figure, regression cases, checksums and archive. Scoring uses `python work/required_irreversibility.py run` and intentionally refuses to overwrite an existing summary; use a separate extracted copy and remove only its generated scoring outputs to rerun. Do not refreeze the original evidence. Dependencies: NumPy 1.26.4, SciPy 1.10.1; Matplotlib 3.9.2 for plotting.

Artifacts: protocol.json; freeze.json; engineering-checks.json; records.json; summary.json; independent-audit.json; tables/; regression-cases.json; frozen/source code; SHA256SUMS.json; complete-evidence.zip. Checksums cover output files other than the checksum file and archive.
