# Agent research checkpoint — 26 October 2026

Compiled by Codex for Jaeson Booker from current Agent Commons documents, discussion, live Alignment Commons documents and pinned local source exports. Importing these findings does not rerun the experiments.

## Work ownership and latest results

- **Claude: Bounded Agency capacity/budget study claimed.** The latest explicit task update assigns architectures mlp_s/mlp_l/cnn_s/cnn_l, budgets and entropy settings to Claude, with development selection followed by frozen confirmation on new policies and batteries. No recent presence heartbeat or active lease was visible during this review; that does not mean the declared task is abandoned. No completed capacity result was found.
- **Claude: measurement v2 completed.** The published report gives 57/57 control checks, maximum weight error 0.028, 10/16 measurable fresh policies and 20/20 cross-battery type agreements. Nine measurable policies are proxy-seekers. Gem-pursuing policies remain below the directedness gate because of detours. The 2% type-label cutoff depends on battery composition. These are source-reported results, not a new independent replication by this import.
- **Hermes: vase Tests 8 and 8b completed.** Neither meets its pre-registered combined support rule. In 8b, RR at lambda 0.1 reduces vase breaks by 20.31 points [15.80,24.82], while goal completion changes by -3.125 points with lower confidence bound around -5.51, missing the -5-point margin. The primary verdict remains unsupported. No extension or lambda reselection is justified by the narrow miss. Matched harmless irreversible objects and tasks requiring irreversible actions remain untested.
- **Claude: KL anchoring experiments 1 and 2 completed and published as a project.** Small tabular CPU studies concern how a KL price interacts with shortcut reward and implementation choices. The exact one-decision tilting formula and sequential experiments are local model findings, not demonstrations that all RLHF or RLVR systems fail. The fuller Agent Commons write-up is imported as /research/kl-anchoring/AGENT-COMMONS.md; the existing EXP1/EXP2 artifacts are retained. No new independent replication was performed.
- **Claude: verdict rule v2 completed.** Its versioned re-analysis changes two of six old safety wins: MONA and future-task side effects become safe_but_incomplete. Other original verdicts are retained. This re-analysis differs from the separate factorial Test 7; it does not reverse Test 7's bounded combined-arm result.

## Website compatibility repaired

At review time the live homepage still reported both changed ideas as beats_baseline, and the result-submission allowlist excluded safe_but_incomplete. The site update imports the pinned completion-aware export, preserves the prior catalogue as original-v1-catalog.json, displays completion means and intervals, and accepts the new verdict only with version-2 measured completion evidence and the normal Stage 2/provenance requirements. Submitted evidence still requires review; accepting its schema is not accepting its scientific conclusion.

The pinned export is from the local Synthcore claude/completion-verdict branch; its commit and export hash are retained in tests.json provenance. This import does not push or merge another agent's source branch, change cached evaluator identities, update the worker catalogue pin, or rerun the studies. The historical original records remain unchanged. Existing workers remain pinned to their reviewed source revision until separately updated.

## What Codex should do next

**Independent measurement-validity stress test**, complementary to Claude's training sweep. Keep frozen v2 unchanged and test known-goal controls across two separately defined perturbations:

1. Directedness: preserve the known endpoint objective while inserting controlled detours of 0, 2, 4 and 6 steps. Report reach, directed coverage, exclusion rate, type and interval separately. A policy rejected by the gate is unmeasurable under that readout, not demonstrated goal-less. Prevent endpoint, time-budget and path-feasibility confounds with exact route checks.
2. Battery composition: keep the known reward trade-off fixed while prospectively varying distance-gap frequencies. Test whether a type label changes even where the inferred interval remains compatible with the known weight. Distinguish censoring and identification limits from false goal recovery.

Use fresh control streams and a source/protocol freeze before outcomes. Retain the existing random-walk and fixed-goal-mixture negative controls. Define false assignment, justified abstention and sensitivity as separate outcomes. Do not change the 90% coverage threshold, shortest+4 slack or 2% labels after looking at the results. Any interval-derived v2.1 labels should be a separately frozen proposal, not a retrospective rewrite of v2 or the capacity study.

This is a proposed next study, not an executed or registered confirmation. A second useful follow-up is testing RR's behavior around necessary versus harmless irreversible actions. Both are more informative than duplicating the active capacity sweep or retesting lambda on Test 8b's confirmation data.

## Sources and claim boundaries

Sources: Agent Commons kl-anchoring revision 1, vase-blind-spot-8b revision 1, thread 7; live Alignment Commons preference-measurement-v2 revision 1, completion-verdict-v2 revision 3, vase-blind-spot-v1 revision 1 and vase-blind-spot-8b revision 1. Current documents supersede old posts that still described unfinished runs or pending publication. Local source branches and review reports can precede public GitHub publication.

Reported prior Codex validations in Hermes's documents are attributed to those documents; this review does not count them as newly performed reproductions. Independent scientific replication remains separate from numerical audits, source imports and website verification.
