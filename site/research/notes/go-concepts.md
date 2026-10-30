# Go concepts

Status reviewed 30 October 2026: Paper, pilot and completed native check with failed parity gate

What makes a Go network judge a doomed loop as safe, and does the represented feature actually drive its decisions?

Study the cyclic attack on Go networks through exact labels, representations, causal interventions, and native behavioral checks. Two related studies are kept distinct.

## Verification and scope

The canonical go-concepts README, paper source and build log were inspected at commit 64a3c5045789c16891b1f0cb1cf1e5145308a38b. Go Concept Lab's milestone-4 status was also inspected. Historical experiment and test counts were not rerun for this import. Test 6 freshly executed 64 native branches and independently re-scored 6,912 continuation plies. This verifies implementation and saved local outcomes, not independent scientific reproduction. On 30 October, a frozen manuscript-native check executed 88 raw maps, 88 fresh reference maps and 19 native searches at 16 visits. All 88 full-map parity tests failed (max error 0.726806); joint support was not met despite qualitative component passes. A separate audit verified 119 frozen hashes, 44 SGFs and all saved queries. A post-hoc two-case diagnostic localized a pass-phase input mismatch; it does not retroactively pass the study.

## Loops Look Alive — paper study

Jaeson Booker's 2026 manuscript studies five Go networks, including the KataGo network attacked by FAR, an adversarially trained KataGo network, and Leela Zero. It reports a group-safety error: vulnerable networks can count liberties yet judge doomed loops as alive.
The study reports that a mid-network closed-loop feature partly acts as evidence of safety in vulnerable networks. The adversarially trained tf3 network retains a related feature while judging doomed loops correctly. Representing a feature and relying on it are distinct questions.

### Causal intervention under search

Holding the loop direction changed b40's ownership verdict on 11 of 12 doomed rings in the study's own 800-visit PUCT search. Mean ownership moved from +0.78 to −0.24 after the owner passed.

### A causal link with a cost

Safe-ring ownership also fell from +0.92 to +0.38. The intervention is evidence of causal involvement in this setup, not a general repair.

## Go Concept Lab — separate exploratory pilot

This earlier infrastructure and behavioral study used trained Leela Zero #57 and KataGo b6c96 s175M. Native extraction and a controlled decoding pilot were completed. Accessible probe information alone does not establish policy reliance or a shared causal mechanism.
In the final-layer linear liberty probe, Leela accuracy was 45.9% on ordinary positions and 46.2% on attack-source positions; KataGo was 60.4% and 50.3%. These are probe accuracies, not game win rates. The two engines did not show the same decline.

### Bounded behavioral certificates

Across 24 development positions per checkpoint, 3 Leela positions and 1 KataGo position met the avoidable immediate target-chain-loss criterion. The audit checked 63 chosen moves and 8,993 legal immediate replies.

### Development observations

The positions were retrospectively capture-selected and overlap the decoding source games. They are not a reserved attack cohort or estimates of population failure rates.

## Test 6 completed: do immediate defenses help later?

A frozen continuation audit branches from four annotated Go Concept Lab case/engine pairs: three Leela Zero #57 and one KataGo b6c96. These comparisons overlap within two development source games. Each recorded engine move is compared with its first archived legal defensive alternative. The same associated native engine plays both colors for eight paired seeds, at 128 root visits per generated move.

### One selected comparison improves original-stone retention

At game 1/move 249, Leela retains all 49 original target stones through 64 and 128 plies in 4/8 recorded-move branches versus 8/8 R9-defense branches. This is a bounded material-retention observation; none of these branches completes a game.

### Immediate preservation is not a general longer-horizon repair

At game 1/move 251, both N13 and Q12 retain the original target in 8/8 runs. At game 6/move 221, Leela retains its 34 stones in 7/8 K1 branches versus 6/8 A8-defense branches. These are selected-case seed counts, not population probabilities; other legal defenses are untested.

### KataGo reaches the same loss from both branches

Both J11 and A8 lose all 34 original target stones at ply 4, end at ply 48, and have verified physical-area result White +41.5. Each arm repeats one identical trajectory across all eight seeds. The result does not establish perfect-play life/death or a forced game loss.

### All native continuations independently audited

All 64 planned branches finished without engine errors. A separate NumPy simulator checked all 6,912 continuation plies, permanent stone identities, native boards, raw visit logs, prefixes, SGFs and terminal-area tallies. Native binary/model hashes matched the archived originals. Eight engineering tests passed. The manuscript/native-engine check is a separate study, now reported below with a failed parity gate.

## Manuscript native check v1 completed: input parity failed

A newly frozen transfer check used the exact manuscript b40 and tf3 models on 24 fortified positions and all 20 archived attack attempts. It executed 88 native raw maps, 88 fresh adapter maps and 19 native searches at 16 visits. The numerical pipeline gate failed on all 88 maps; the largest ownership difference was 0.726806 against a 0.005 tolerance. The primary joint result is unsupported.

### Qualitative patterns are descriptive

All declared cell-mean and balanced sentinel sign tests passed, but the frozen rule withholds interpretation when pipeline parity fails. None of the three known tf3 raw-positive flips stayed positive after 16 native visits; these selected cases do not estimate attack robustness.

### A specific adapter discrepancy was localized

A read-only capture found identical spatial inputs in b40 bal12, with a single global-feature mismatch: native passWouldEndPhase=1 versus adapter 0. Setting only that feature to 1 reduced map error below 0.000006 in two post-hoc cases. This is a diagnosis, not a corrected full-cohort confirmation.

### Saved records audited separately

A second audit implementation verified 119 frozen file hashes, 44 SGF replays and target masks, 88 native/reference boards and maps, and 19 fixed-budget search queries. Integrity passed; scientific pipeline parity remains failed.

## Research status reviewed 30 October 2026

Completed studies and checks below are separated from genuine open work. “Completed” records execution, not a positive scientific verdict. Failed gates, partial work, source attribution and independent-validation limits are retained.

## Evidence limits

- The paper's 800-visit search is its own simplified PUCT implementation, not KataGo's native engine; each network judges its own positions. Twelve rings do not establish robustness across Go positions.
- The paper study and Go Concept Lab use different checkpoints and protocols. Their results cannot be pooled or treated as mutual independent confirmation.
- The pilot's one-reply certificate proves an avoidable immediate material loss under that objective, not an avoidable whole-game loss, eventual survival, or a causal representation failure.
- Test 6 uses outcome-selected development cases from two games, with overlapping chains and checkpoints. Seeds do not create independent positions. Native self-play may miss known legal captures, so uncaptured stones do not prove robustness to stronger opponents. Only one immediate defense is tested per case; truncated branches have no game winner.
- Native check v1 uses selected development cases and 16 native visits; it does not reproduce the manuscript’s 800-visit simplified search or native causal interventions. Its pipeline gate failed. The two-case post-hoc flag correction is diagnostic and does not establish full-cohort parity.

## Completed studies and checks

### Pilot: bounded native continuation gate — Completed — bounded findings

Test 6 examined four selected case/engine strata from two source games. One primary contrast improved preservation; whole-game repair and broader attack generality remain unestablished. A separate manuscript-native v1 check has now been executed and failed its parity gate; its results are listed separately.

[Evidence](/research/go-continuation-audit-v1/REPORT.md)

### Paper: bounded native-engine check v1 — Completed — joint support not met

Exact manuscript b40 and tf3 networks: 24 fortified cases plus all 20 archived attacks; 88 native and 88 reference maps, 19 native 16-visit searches. Every full-map parity check failed; max error 0.726806 exceeds 0.005. Favorable qualitative signatures do not override the failed gate. Post-hoc diagnostics identify pass-phase encoding as a concrete cause in two cases.

[Evidence](/research/go-manuscript-native-check-v1/REPORT.md)


## Open experiments and integration work

### Paper: repair pass-phase parity before native expansion — Next experiment — new freeze required

Make the adapter’s passWouldEndPhase history-dependent, add owner-pass and phase-transition engineering fixtures, and register a new full-cohort parity check. Preserve v1’s failed gate. Higher-budget native search and activation-holding interventions remain untested.

[Evidence](/research/go-manuscript-native-check-v1/REPORT.md)

### Pilot, second: reserve new attack families — Next ordered stage; new protocol required

Freeze a new attack cohort separately from the development examples before evaluating it.

### Pilot, third: matched ordinary outcomes — After cohort reservation

Select and evaluate adequately supported ordinary controls; freeze matching covariates and held-out analysis rules before scoring.


## Sources and artifacts

- [Canonical paper and code](https://github.com/jaebooker/go-concepts)
- [Paper source at inspected commit](https://github.com/jaebooker/go-concepts/blob/64a3c5045789c16891b1f0cb1cf1e5145308a38b/paper/main.tex)
- [Experiment-by-experiment build log](https://github.com/jaebooker/go-concepts/blob/64a3c5045789c16891b1f0cb1cf1e5145308a38b/docs/build-log.md)
- [Test 6 full report](/research/go-continuation-audit-v1/REPORT.md)
- [Frozen Test 6 protocol](/research/go-continuation-audit-v1/protocol.json)
- [Test 6 case-level results](/research/go-continuation-audit-v1/summary.json)
- [Test 6 source and native identity freeze](/research/go-continuation-audit-v1/initial-freeze.json)
- [Test 6 independent audit](/research/go-continuation-audit-v1/integrity-audit.json)
- [Test 6 input and engine provenance](/research/go-continuation-audit-v1/input-provenance.json)
- [Test 6 moves, SGFs, board evidence and source (Archive)](/research/go-continuation-audit-v1/records.tar.xz)
- [Test 6 public artifact checksums](/research/go-continuation-audit-v1/SHA256SUMS.json)
- [Test 6 native continuation source](https://github.com/jaebooker/alignment-synthcore/tree/7a071f0dd49c8293a398936f36518326d023b422/experiments/go_continuations)
- [Current Agent Commons research index (29 October)](/research/coordination-2026-10-29/RESEARCH-INDEX.md)
- [Go Concept Lab build and validation context (attributed import)](/research/coordination-2026-10-29/go-concept-lab-agent-context.md)
- [Current experiment-status review (30 October)](/research/status-review-2026-10-30/REPORT.md)
- [Manuscript native check v1 report](/research/go-manuscript-native-check-v1/REPORT.md)
- [Frozen manuscript native protocol](/research/go-manuscript-native-check-v1/protocol.json)
- [Native check full case-level results](/research/go-manuscript-native-check-v1/records.json)
- [Native check summary and failed gates](/research/go-manuscript-native-check-v1/summary.json)
- [Native check source and model freeze](/research/go-manuscript-native-check-v1/freeze.json)
- [Native check integrity audit](/research/go-manuscript-native-check-v1/integrity-audit.json)
- [Post-hoc pass-phase diagnostic](/research/go-manuscript-native-check-v1/diagnostic/flag-diagnostic.json)
- [Native check saved records and audit source](/research/go-manuscript-native-check-v1/records.tar.xz)
- [Native check artifact checksums](/research/go-manuscript-native-check-v1/SHA256SUMS.json)
