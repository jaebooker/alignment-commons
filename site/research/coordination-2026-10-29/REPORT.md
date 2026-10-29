# Bounded Agency: separate cycle, horizon and competence checks

Registered and re-verified 29 October 2026 by Codex for Jaeson Booker. Prior outcomes were known: this is an explicit evidence registry and isolated conformance rerun, **not a new blind preregistration or independent scientific replication**. No new training or capacity extension.

| Check | Re-verification | Result |
| --- | --- | --- |
| Greedy-policy cycles | Passed | All 5,563 non-reach cases are closed, endpoint-free cycles: 3,310 wall self-loops and 2,253 multi-cell cycles. |
| Rollout horizon | Passed | Zero rescues at 40 or 80 steps under unchanged greedy action selection and shared prefixes. |
| Task competence | Verified; original gate failed | Every original same-task cohort/battery exceeds the existing 10% equal-distance non-reach limit. Goal interpretation remains withheld. |

## Original competence readout

| Entropy | Battery | All-trial neither | Equal-distance neither | Existing ≤10% gate |
| ---: | --- | ---: | ---: | --- |
| 0.01 | original | 16.95% | 17.81% | Failed |
| 0.01 | reflected | 18.21% | 20.31% | Failed |
| 0.01 | distance_reweighted | 19.04% | 20.62% | Failed |
| 0.05 | original | 19.89% | 14.69% | Failed |
| 0.05 | reflected | 20.25% | 18.44% | Failed |
| 0.05 | distance_reweighted | 21.76% | 21.25% | Failed |

All rates retain unresolved trials in their denominators; eight policy seeds per cohort. These are neither/unreached outcomes, not an inferred preferred goal. Original censoring and calibration results remain in Test 3.

## Separate deployment competence

The previously specified categorical-softmax-v1 action rule is a separate experiment: full softmax, temperature 1, 20-step horizon, no masking/retries/resets. On its previously reserved 315 initial pairs (56 equal distance), entropy .01 passes endpoint-competence bounds: 1.57%/1.61% neither (all/equal), one-sided 98.75% upper bounds 3.71%/4.68%. Entropy .05 fails: 13.33%/12.67%, upper bounds 32.50%/29.70%. Low-entropy policies mostly reach the proxy (~98.4%), so endpoint competence does not establish intended-goal recovery. The reserve is exhausted and cannot be relabelled as fresh.

## Registration and preservation

Each check has its own markdown registration and stable document slug. registration.json binds inputs and explicitly discloses known prior results. The checks were published before the isolated re-verification. Both complete evidence bundles were CRC checked and extracted into a separate workspace; their archived auditors were run without modifying originals. Independent original-model replay covers all 80 Test 3 outcome arrays; scalar cycle and deployment audits passed. The new horizon readout independently derives endpoints and first-hit times from saved positions at all three cutoffs.

The original Test 3 file set and every file hash match the before snapshot (21 files). No original record, model, outcome definition, horizon, action rule, weight or goal label changed. verification.json and the three audit logs preserve detailed results. No binary evidence is republished as a new scientific sample.

## Scaling decision

Original greedy goal interpretation remains withheld. These checks do not clear an extension of its capacity sweep. Later measurement-v2, competence, phase-boundary and escape studies are separately attributed work; they do not repair or replace Test 3. Any next training study needs its own protocol and eligible new policy/task reserve, and must report endpoint competence separately from gem/proxy preference. No training job was queued here.
