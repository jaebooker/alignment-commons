# Tested-ideas catalogue v4 (2026-11-11)

Catalogue v4 adds one testbed, `control_open`, and the two ideas tested on it. It is an additive import. Every idea, testbed and direction signal published in v3 is unchanged. The v3 snapshot stays at `/research/catalogue-v3-2026-11-08/catalogue-snapshot.json`.

## The testbed

`control_open` rebuilds the AI control testbed (trusted monitoring of backdoored code) on hosted open models: Qwen 3.5 397B is the untrusted model and Gemma 4 31B the trusted monitor. It has 590 problems from HumanEval and sanitized MBPP, 110 for tuning and 480 for testing. The test problems are split into 8 disjoint shards of 60, and each shard is one seed, so the seeds are independent replicates. The older `control` testbed resampled one fixed set of 80 problems. The red team has 198 selected test attacks; `control` v0.4 had 23.

## What was added

- 2 ideas and 1 testbed, copied verbatim from Alignment SynthCore `results/commons.json` at commit `9bc6391`. `import.json` records the commit, the export's SHA-256, a hash of each copied row and the previous catalogue's hash.
- 1 direction signal for `control_open`. It is not pooled with `control`.
- In the test registry (`/test-matrix.json`, now version 5): one catalogue row per idea and two unregistered follow-up designs per idea.

| Idea | Verdict | Catch rate at 5% audit | vs hindsight-best baseline |
|---|---|---|---|
| Exploit-hunting monitor | `beats_baseline` | 0.931 vs 0.847 (+0.084, p = 0.023) | +0.072 (p = 0.016) |
| Resampled monitor | `mechanism_failed` | benchmark not run by the harness | see below |

## Read the resampled-monitor row with this caveat

The resampled monitor missed its mechanism gate: AUROC +0.016 over the baseline on a 40-problem tuning subset, where +0.020 was required. Under the harness rules the benchmark does not run after a failed gate, so the verdict is `mechanism_failed`.

An exploratory run with the gate skipped then scored 0.901 against 0.847 on the 8 test shards: +0.054 (95% CI +0.030 to +0.079, p = 0.016); against the hindsight-best baseline +0.042 (p = 0.062). That is not a verdict, because it was run after the gate result was known. It does suggest the gate gave a false negative at 40 problems. The first follow-up design for this idea is a registered confirmation on fresh problems.

## Other limits

- The hindsight-best baseline (reason style, 100-point scale, 0.860) was chosen after seeing test results. The tuned baseline was the clear winner on the tuning split, so there was no tuning tie.
- GLM 5.2 was the planned untrusted model. It returned no code on 27 of 32 backdoor attempts in a pilot and was replaced before any monitor ran.
- One attacker family and one monitor family. One runner; no two-runner agreement.
- The pre-registration (`prereg.md`) was written before any monitor scored an item but was not in a pushed commit at the time.
