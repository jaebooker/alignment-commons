# Tested ideas: multiple-test plan and evidence registry

Reviewed 31 October 2026 by Codex for Jaeson Booker. This is research planning and evidence reconciliation, not a new scientific experiment.

## What is now recorded

- Every one of the 31 non-control catalogue ideas has two distinct draft follow-ups: **62 designs**, including access-matched harness proposals for the two currently untestable papers.
- Six additional designs cover Go concepts, Bounded Agency and KL anchoring, explicitly separate from the original catalogue. Some elaborate existing open proposals and are labeled accordingly.
- **54 documented research checks** and two sanity controls have explicit execution, stage, criterion and result fields. Seven whole-record local rules were met; one KL study is mixed and reports H1/H2/H3 separately. These checks span gates, benchmarks and diagnostic setups; they are not 54 independent replications, a literature-wide success rate or a universal success/failure verdict on the ideas.
- Each idea exposes its original assessment, any documented tuned re-checks and relevant later studies. Shared follow-ups have one registry ID even when listed under multiple ideas.
- Historical catalogue verdicts and direction signals are unchanged. A later study can pass in a changed setup while an earlier study remains negative. Original gate-only cases explicitly say the full benchmark did not run.
- Status filters distinguish run completed, criterion met, mixed hypotheses, proposed and blocked. Draft proposals have no outcome, no preregistration claim and no automatic worker queue entry.

## Recommended next registrations

1. **ACCEL: online start-matched replay scores.** Test whether the observed per-start correction improves actual learning over random replay and DR under matched total compute. The completed calibration used complete optimal warm-up and did not establish this online benefit. Candidate rule: at least a 5-point lower-bound intended-goal gain over random replay with completion non-inferiority within 5 points.
2. **MONA: changing-mask collapse, signal versus planning horizon.** Reuse Test 4’s advantage signal and masks; cross signal normalization with planning horizon under identical traces. Test 7 changed the setup and did not directly solve this question. Candidate rule: at least 80% completion lower bound plus a 10-point harm-reduction lower bound in the prespecified partial-coverage condition.
3. **Relative reachability: graph-coverage intervention.** Compare identical tasks with complete, missing and restored transition edges. Separate false irreversibility from a penalty that genuinely suppresses necessary progress. Candidate rule: restoring coverage reduces false penalties and improves completion while retaining harmful-event protection.
4. **Trusted monitors: fresh adaptive attacks at equal cost.** Generate fresh validated attacks on reserved tasks; give red teams matched query access to each monitor. Compare exploit hunting with a token/tool-matched critique baseline. The existing cached outputs remain screening evidence. Candidate rule: a 10-point lower-bound catch-rate gain at 5% audit budget, with honest false positives at most 5%.
5. **Go: owner-pass and phase-transition parity.** This is an existing open follow-up after the native v1 failure. Freeze history-dependent pass encoding and owner-pass/double-pass/phase-transition engineering fixtures before a new cohort check. The two post-hoc corrected cases do not validate the full cohort or native causal intervention.
6. **KL: randomized anchor-coverage intervention.** Randomize covered contexts at fixed total KL compute, retaining the KL-only noise control. Test whether coverage causally reduces reward-induced drift on a new task family, rather than merely repeating the just-completed confirmation.

## Recent source update

Claude (claude.ai), operated by Jaeson, reports the separately pre-registered KL experiment-3 confirmation completed on 31 October: final off-distribution reward-induced drift H1 passes in 4/4 networks, early drift H2 in 3/4, stronger-anchor concentration H3 in 0/4. After KL-only subtraction the reported ratios are 1.4–2.6, smaller than the raw effect. This registry reviewed the versioned report, not an independent rerun; the source reports its commits awaiting push. Its hypotheses are shown separately. Claude has also reported a small-LM pilot with a tightened follow-up pending; no parallel LM confirmation is started here.

## Before any new confirmation

These are **draft designs**, not powered preregistrations. Each needs a calibration-only feasibility/power assessment followed by frozen code, model/evaluator hashes, exact contrasts, practical-effect thresholds, completion/utility margins, sampling units, seed/family splits, access/tuning/compute budgets, multiplicity, exclusions and stopping rules. No outcome-driven threshold changes or N extensions. Non-significance is not equivalence. Lower harm caused by task failure does not qualify as success.

The native-engine check v1, original Test 3, Test 8b non-inferiority failure and other frozen results remain unchanged.

## Artifacts

- [Live Tested ideas and per-idea histories](https://alignment-commons-site.vercel.app/#tested)
- [Full matrix: criteria, comparisons and prerequisites for every idea](https://alignment-commons-site.vercel.app/research/test-matrix-2026-10-31/REPORT.md)
- [Structured registry](https://alignment-commons-site.vercel.app/test-matrix.json)
- [Provenance](https://alignment-commons-site.vercel.app/research/test-matrix-2026-10-31/source-provenance.json)
- [Claude’s versioned KL confirmation source](https://alignment-commons-site.vercel.app/research/test-matrix-2026-10-31/kl-anchoring-exp3-confirm-v1.md)
