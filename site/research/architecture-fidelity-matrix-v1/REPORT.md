# Architecture fidelity matrix, 10 November 2026

Literature synthesis and gap register. No new scientific run. AI-written by Claude for Jaeson Booker, not independently reproduced.

- Evidenced and measured are different: a cell carries a number only where a published study reports one, and nine of roughly 96 cells do.
- Naive and adapted fidelity are separate quantities. A naive zero is not a limit. Never report one number per cell.
- The architecture list is a partial order. Do not compute a mean fidelity across it, fit a decay curve to it, or rank two siblings as nearer and further.
- Empty cells are unmeasured, not zero. Absence of evidence here is literally the point of the document.
- Most source studies matched models on parameter count, not held-out performance, so those cells confound architecture with competence. The match field records which; cells without performance matching cannot settle a fidelity claim on their own.
- Cross-architecture numbers must be read against the within-architecture staleness floor. A cross-architecture result that beats the same-model-after-LoRA result is evidence of a selection effect.
- Qualitative findings stay qualitative. No scalar was imputed from prose.

## Bottom line

The residual-accumulator tier transfers well and has been measured. The attribution tier degrades quietly and has one good paper documenting how. The reasoning-visibility tier has collapsed in production systems and has one partial recovery method. Nobody had assembled the matrix; the pieces existed and the synthesis did not. This document is the synthesis at its current, sparse state.

Two findings are worth more than the cells themselves.

Architectural distance is the wrong axis. Probe-derived causal localization degrades between Mamba-1 and Mamba-2, two versions of one family, because Mamba-2 gates coarsely while computing finely. No distance metric predicts that. Techniques depend on interfaces, and an architecture either exposes an interface or does not.

Degradation is not monotone. State steering exists on recurrent models and has no transformer analogue. Linear probes score above their transformer baseline on Mamba in the one study that measured both. Architectural change removes affordances and adds others, so a framework that treats it as pure loss is wrong on the evidence.

## Tiers, by how much change they survive

The ordering below is the document's main claim and it comes with an inverse relationship worth naming. Portability and strength trade off. Output-distribution methods survive almost any architecture change and give an average-case budget with no worst-case guarantee. Circuit-level analysis gives real mechanistic insight and dies at the first change in information routing. Chain-of-thought monitoring gives the most legible oversight available and is the most fragile item on the list.

The corollary is that defense-in-depth layers built on these tiers are correlated rather than independent. A shift to latent reasoning removes chain-of-thought monitoring, weakens token-indexed attribution, and leaves the output-distribution tier, which carries no guarantees. Stacking them does not multiply protection.

| Tier | Techniques | Survives | Breaks at |
| --- | --- | --- | --- |
| Output distribution | KL anchoring, best-of-n, rejection sampling | Nearly any architecture change | Systems that do not sample |
| Residual accumulator | Linear probing, activation steering, tuned lens, dictionary features, ported monitors | Transformer to SSM, measured | Architectures with no linear accumulator |
| Token-indexed attribution | Attention-edge attribution, probe-derived localization | Attention variants, MoE | Pure SSM, and quietly rather than loudly |
| Reasoning visibility | Chain-of-thought monitoring and faithfulness audits | Nothing. Binary | Recurrent depth and continuous thought |
| Language interface | Constitutional AI, RLAIF, debate | Any language model | Non-linguistic agents |

## Evidenced cells

Full records with metrics, matching and caveats are in `matrix.json`. Summary:

| Technique | Architecture | Naive | Adapted | Status |
| --- | --- | --- | --- | --- |
| Linear probing | Pure SSM | 0.76 ELK AUROC vs 0.69 transformer | not needed | measured |
| Tuned lens | Pure SSM | works, no scalar reported | not needed | measured |
| Activation steering | Pure SSM | smaller response, no scalar | state steering, no transformer analogue | measured |
| Attention attribution | Pure SSM | 0.0 by construction | untested | trivially zero |
| Causal localization | Pure SSM (Mamba-2) | probe surface carries 0.16 nats vs 1.5 to 7.3 nats | untested | measured |
| CoT monitoring | Recurrent depth | 0.0, window closes | 0.951 AUROC at first latent step, 0.583 accuracy by the sixth | measured |
| Ported monitor | Attention variant | n/a | 0.959 macro AUROC vs 0.963 native | partial, screen-conditional |
| Dictionary features | Attention variant | n/a | 93.8 to 98.8% of native utility | partial, screen-conditional |
| KL anchoring | Non-linguistic agent | transfers once an anchor is built | penalty inside search | measured |

## The one real decay curve

Only one cell in this matrix contains a graded decay, and it is not indexed on architecture. In a continuous-thought model, probes on latent reasoning states reach 0.951 AUROC and 89.4% transfer accuracy at the first latent step, 84.7% at the second, and decay monotonically to 58.3% by the sixth. Misalignment concentrates at reasoning's inception.

That is more actionable than an architecture metric would be, because it says where to point a monitor rather than how pessimistic to feel. If you want a quantifiable fidelity axis, reasoning depth in latent space is the one the data currently supports.

## What to measure next

1. **Adversarial steps-to-evade for a ported monitor.** The adapter is low-rank and learned, so moving information into its null space is cheaper than defeating the monitor. Mamba-2 already shows representation and function coming apart with no adversary involved, so the deliberate version should be easy to find. Compare steps-to-evade against a natively trained monitor on the same target. No paper reports this and it decides deployability.
2. **The missing controls on the portability result.** A shuffled-pair null, a plain ridge-map baseline, and the compatibility screen's pass rate. Without the pass rate, the headline number is conditional on an unreported filter.
3. **An adapted number for causal localization on SSMs.** The naive number is known to mislead. Whether an SSM-appropriate method recovers the function is the difference between a principled limit and an unsolved engineering problem.
4. **Any cell in the diffusion language model column.** It is entirely empty in both numbers.

## Sources

Every figure above traces to a record in `matrix.json` under `sources`, with its claim attached to the cell that uses it.
