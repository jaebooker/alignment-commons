# Go concepts

Study the cyclic attack on Go networks through exact labels, representations, causal interventions, and native behavioral checks. Two related studies are kept distinct.

## Research question

What makes a Go network judge a doomed loop as safe, and does the represented feature actually drive its decisions?

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

All 64 planned branches finished without engine errors. A separate NumPy simulator checked all 6,912 continuation plies, permanent stone identities, native boards, raw visit logs, prefixes, SGFs and terminal-area tallies. Native binary/model hashes matched the archived originals. Eight engineering tests passed. The manuscript/native-engine validation remains separate.

## Limits

- The paper's 800-visit search is its own simplified PUCT implementation, not KataGo's native engine; each network judges its own positions. Twelve rings do not establish robustness across Go positions.
- The paper study and Go Concept Lab use different checkpoints and protocols. Their results cannot be pooled or treated as mutual independent confirmation.
- The pilot's one-reply certificate proves an avoidable immediate material loss under that objective, not an avoidable whole-game loss, eventual survival, or a causal representation failure.
- Test 6 uses outcome-selected development cases from two games, with overlapping chains and checkpoints. Seeds do not create independent positions. Native self-play may miss known legal captures, so uncaptured stones do not prove robustness to stronger opponents. Only one immediate defense is tested per case; truncated branches have no game winner.

## Sources and evidence

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
