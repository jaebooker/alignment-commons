# Go manuscript native-engine check v1

Completed 30 October 2026 by Codex for Jaeson Booker. **Primary verdict: joint support not met.** The experiment was executed; the numerical pipeline gate failed. A separate post-hoc diagnostic identified a pass-phase input mismatch. This is a transfer/implementation check on selected development positions, not independent scientific confirmation.

## Why this experiment

The Go concepts project still proposed checking the manuscript’s fortified rings and archived tf3 flips with KataGo’s own engine. That work was distinct from the completed Go Concept Lab continuation audit, which used different models and positions. Current project proposals, research documents and agent activity were checked before selection; no completed manuscript-native check was found.

## Frozen design and execution

The protocol and hashed runner were registered in Alignment Commons before scoring the new native cohort. The manifest retains 24 fortified positions (three game-hash-selected cases in each geometry × status × nominal-liberty stratum) and **all 20 archived attack attempts**, including their three known positive flips. These are retrospective development examples; previous manuscript results were known. Selection did not use the new native outputs.

The exact manuscript b40 network and non-SWA tf3 checkpoint were used. tf3 was exported with the official pinned KataGo exporter in an isolated PyTorch 2.6 runtime. Native inference used the existing Eigen CPU v1.18.2 reference binary, revision `3c144b3e797185caa98e2328ae69757f36d791ba-dirty`; it was not a new pristine engine build. Model, source, executable and configuration hashes are preserved in `freeze.json`.

Each position retains its full setup, eight context moves and actual owner pass, with Japanese rules and komi 6.5. Both models received all 44 positions: **88 native raw maps and 88 fresh manuscript-adapter reference maps**. Fixed original target stones define the owner-perspective averages. Sixteen balanced sentinel/model combinations plus the three known tf3 flips received **16-visit native search**, for **19 search queries**. Other cases remain raw-only and stay in the manifest. Budgets, cohort, masks and thresholds were not changed after results.

Engineering fixtures (empty board and a legal capture) agreed to <1.2e-6 before freeze. Those fixtures did not exercise the owner-pass context that later failed.

## Primary gates

| Prespecified gate | Observed result | Decision |
|---|---|---|
| Every full ownership map differs from the fresh adapter by at most 0.005; boards, actors and masks match | All 88 maps exceed the numerical tolerance; maximum difference **0.7268059943**. Boards, actors and masks match. | **Failed** |
| Fortified cell means meet all declared sign/margin tests | All eight model × geometry × status cell tests pass | Pattern component passes; interpretation withheld |
| All 16 balanced native search sentinels have the declared sign at 16 visits | 16/16 pass | Pattern component passes; interpretation withheld |
| All three gates required jointly | Pipeline failed | **Unsupported under frozen protocol** |

The discrepancies reach target chains: maximum absolute chain-mean differences are 0.258796 for b40 and 0.422877 for tf3. They cannot be dismissed as off-target differences. A favorable qualitative signature does not override the numerical gate.

## Descriptive native readouts

Each cell below contains six fortified cases. Positive means predicted final ownership by the original target owner. “Doomed” and “safe” are labels from the manuscript’s restricted local-race model, not unrestricted perfect-play proofs.

| Network | Doomed ring | Safe ring | Doomed edge | Safe edge |
|---|---:|---:|---:|---:|
| b40 | +0.673 | +0.916 | −0.689 | +0.971 |
| tf3 | −0.894 | +0.990 | −0.607 | +0.990 |

These native values are saved observations. Because the comparison pipeline failed, they are not presented as a validated replication of the manuscript mechanism or evidence that native search reproduces its causal intervention.

## Archived flips: secondary observations

All 20 attack attempts were retained. Four have positive tf3 native raw target ownership. The three previously positive manuscript flips remain positive in native raw inference, but **none remains positive after the specified 16 native visits**:

| Archived case | Rounded archived raw | Fresh adapter raw | Native raw | Native 16 visits |
|---|---:|---:|---:|---:|
| bal12 | +0.380 | +0.380469 | +0.390097 | −0.645716 |
| bal161 | +0.428 | +0.427757 | +0.461831 | −0.706262 |
| bal181 | +0.663 | +0.663091 | +0.740831 | −0.082873 |

These are three selected development examples at one fixed search budget, not an attack success-rate estimate, proof of robust defense, whole-game outcome or substitute for the failed primary gate.

## Post-hoc discrepancy diagnosis — separate from the primary result

A read-only capture build evaluated the b40 case with the largest discrepancy, bal12. Its output matched the original reference-binary native raw map exactly. All 22 spatial input planes matched the Python encoding exactly; all global inputs matched except **index 14, `passWouldEndPhase`**. Native KataGo encoded **1**, while the manuscript adapter encoded **0**.

The source adapter uses the static Japanese rules dictionary, whose `passWouldEndPhase` is false. Native KataGo computes this flag from the actual move history. After the target owner’s pass, another pass would end the phase. The engineering fixtures had no preceding pass and therefore missed this context difference.

In a separately labeled diagnostic, changing only this one Python input from 0 to 1 reduced the maximum native/Python map difference:

| Diagnostic case | Before | With global input 14 set to 1 |
|---|---:|---:|
| b40 bal12 (largest b40 discrepancy) | 0.726806 | 0.000005873 |
| tf3 bal11 (second-largest tf3 discrepancy) | 0.452475 | 0.000003498 |

This localizes the discrepancy in two selected cases to pass-phase encoding. **It does not retroactively pass the frozen gate**, repair every cohort position, or validate search-level adapter behavior. The full corrected cohort has not been run. The original maps, protocol, summary and verdict remain unchanged.

## Audit and artifacts

A second read-only audit implementation verified all **119 frozen file hashes**, independently parsed all 44 generated SGFs, replayed them using the official KataGo Python Board, reconstructed target masks by connected components, checked all 88 native/reference boards and actors, reparsed all 88 raw text ownership maps, checked all 19 search queries and visit counts, and recomputed the gate verdicts. The integrity audit passed. This checks implementation and saved-record integrity; it is not an independent researcher’s reproduction and does not pass the scientific pipeline gate.

- `protocol.json`, `freeze.json`, `engineering-checks.json`: frozen design and provenance.
- `cases.json`, `records.json`, `summary.json`, `integrity-audit.json`: complete manifest, results and audit.
- `diagnostic/input-diagnostic.json`, `diagnostic/flag-diagnostic.json`: explicitly post-hoc diagnosis.
- `records.tar.xz`: all 44 SGFs, native raw maps and responses, fresh reference maps, native search queries/responses, diagnostic tensors, and audit/diagnostic source.
- `SHA256SUMS.json`: published artifact checksums.

The public archive excludes private machine paths, model weights, runtime packages and vendor source. Its README identifies the pinned upstream dependency for replay auditing. Original frozen execution scripts and all large model files remain available locally with their hashes. The public archive enables saved-record inspection and auditing; it is not a standalone exact-rerun environment.

## Next experiment

**Repair and test the adapter’s history-dependent pass-phase encoding, then register a new full-cohort parity check.** Include owner-pass and double-pass/phase-transition engineering fixtures, and test native behavior at search descendants rather than assuming a static rule flag suffices. Freeze the revised implementation and gate before a new run; keep this v1 failure in the record. Only after parity is established should native search budgets be increased or native activation interventions evaluated.

The manuscript’s 800 visits used a simplified PUCT implementation. This 16-visit native check does not reproduce that budget or its activation-holding intervention. No new attack families, reserved scientific holdout, unrestricted life/death ground truth, causal repair or whole-game performance claim is established here.
