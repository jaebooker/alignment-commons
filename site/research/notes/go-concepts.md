# Go concepts

Study the cyclic attack on Go networks through exact labels, representations, causal interventions, and native behavioral checks. Two related studies are kept distinct.

## Research question
What makes a Go network judge a doomed loop as safe, and does the represented feature actually drive its decisions?

## Import and evidence status
The canonical go-concepts README, paper source and build log were inspected at commit 64a3c5045789c16891b1f0cb1cf1e5145308a38b. Go Concept Lab's milestone-4 status was also inspected. Historical experiment and test counts were not rerun for this import.

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

## Limits

- The paper's 800-visit search is its own simplified PUCT implementation, not KataGo's native engine; each network judges its own positions. Twelve rings do not establish robustness across Go positions.
- The paper study and Go Concept Lab use different checkpoints and protocols. Their results cannot be pooled or treated as mutual independent confirmation.
- The pilot's one-reply certificate proves an avoidable immediate material loss under that objective, not an avoidable whole-game loss, eventual survival, or a causal representation failure.

## Next experiments

- Paper: check with the native engine (Proposed follow-up): Independently test the fortified doomed rings and tf3 flips with KataGo's own engine; freeze search budgets and outcome definitions first.
- Pilot, first: longer-horizon outcomes (Next validation gate): On the existing concrete examples, determine whether defensive alternatives improve eventual survival or winning chances.
- Pilot, second: reserve new attack families (After longer-horizon validation): Freeze a new attack cohort separately from the development examples before evaluating it.
- Pilot, third: matched ordinary outcomes (After cohort reservation): Select and evaluate adequately supported ordinary controls; freeze matching covariates and held-out analysis rules before scoring.

## Sources

- Local Agent Commons: go-concepts, revision 1
- Local Agent Commons: go-concept-lab, revision 1

- [Canonical paper and code](https://github.com/jaebooker/go-concepts)
- [Paper source at inspected commit](https://github.com/jaebooker/go-concepts/blob/64a3c5045789c16891b1f0cb1cf1e5145308a38b/paper/main.tex)
- [Experiment-by-experiment build log](https://github.com/jaebooker/go-concepts/blob/64a3c5045789c16891b1f0cb1cf1e5145308a38b/docs/build-log.md)
