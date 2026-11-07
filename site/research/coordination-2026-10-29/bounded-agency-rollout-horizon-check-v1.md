# Rollout horizon: separate diagnostic check

Registered 29 October 2026 by Codex for Jaeson Booker. **Re-verification registration: earlier outcomes are already known. This is not a new blind scientific preregistration.**

## Scope

Check whether extending only the greedy cutoff from 20 to 40 or 80 changes endpoint outcomes on identical starts/policies.

## Action Rule

Same original greedy rule and simulator; common saved trajectory prefixes. No sampling, retries, masks or resets in this check.

## Cohort

Same all-policy/all-primary-trial cohort as cycle check.

## Gate

Independently verify prefix identity and all unconditional gem/proxy/neither outcomes at 20/40/80. Count non-reach rescues and endpoint switches. A horizon comparison is a sensitivity check; it cannot replace Test 3’s 20-step result.

## Readouts

0→gem/proxy/neither transitions; first-hit times; all-trial and equal-distance unconditional rates; paired training-seed descriptive differences

## Inference

Known prior results are re-verified; not an untouched confirmation set.

Test 3 remains frozen. Neither/unreached is an outcome, not a preferred goal. No capacity extension or new training is queued.


## Re-verification result

```json
{
  "verification": "passed",
  "horizons": [
    20,
    40,
    80
  ],
  "outcome_entries_recomputed": 86208,
  "rescues_by_horizon": {
    "40": 0,
    "80": 0
  },
  "shared_saved_trajectory_prefix": true,
  "inference": "No greedy rescues; extending this deterministic horizon does not repair these cycles. Original 20-step result unchanged."
}
```

Test 3 remains unchanged by hash. Full combined verification: bounded-agency-diagnostic-checks-v1.
