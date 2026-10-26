# kl-anchoring, experiment 1: the tilting law (tabular)

One decision, 10 actions. Action 0 is "forbidden": the anchor policy gives it probability p,
the rest share 1 - p. The forbidden action pays reward advantage D. All runs start at the
anchor. Code: `tilt.py` (law and estimators), `spill.py` (GRPO sweep, discovery time,
spillover), `figures.py`. Results: `results_tilt.json`, `results_spill.json`. CPU, ~7 minutes.

## Results

1. The RLHF objective (E[r] - beta KL(pi || pi_ref)) obeys the tilt exactly: logit pi(f) =
   logit p + D/beta. The forbidden action takes over at D/beta = log((1-p)/p): 2.2, 4.6, 6.9,
   9.2 for p = 1e-1 ... 1e-4, measured and predicted alike. The anchor's protection is
   log(1/p) nats of reward, no more.
2. Implementation decides whether that protection exists. k1 in the reward (PPO-style RLHF)
   reproduces the law. k3 used as a loss (GRPO's KL term) is, in expectation, the gradient of
   the forward KL(pi_ref || pi); it takes over at D/beta ~ 2 whatever p is. k1 as a loss has
   zero expected gradient: no anchor at all.
3. With group-normalized advantages (GRPO), the reward's size drops out. Final forbidden
   probability is the same for D = 0.001 and D = 1 (0.98 at beta = 0.1); only beta matters.
   Any positive edge wins unless beta is large (0.49 at beta = 1).
4. Without an effective anchor the only barrier is exploration. Steps to takeover approach
   1/(p x batch) for rare acts: more rollouts find rarer exploits proportionally faster.
5. Spillover. With shared parameters and the anchor applied only where training happens,
   rewarding the act in half the contexts raises it to 0.96 in held-out contexts where it pays
   nothing (any feature dimension up to 64 of 200 contexts; 0.49 at 199; none when tabular).
   Applying the anchor on the held-out contexts too keeps them at <0.01 once the model has
   enough capacity to separate them.
