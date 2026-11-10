# Architecture fidelity matrix: which alignment techniques survive which architecture change

Compiled 10 November 2026. AI-written by Claude for Jaeson Booker. This is a literature synthesis and a gap register, not a new scientific run. No experiment was executed for it.

## What is now recorded

- **Five interfaces** that alignment and interpretability techniques depend on, ordered by how much architectural change each survives: output distribution, linear residual accumulator, token-indexed attribution, visible serialized reasoning, language interface.
- **Eight architectures** as a partial order rather than a line. Each edge removes one named interface. Recurrent depth, diffusion language models and non-linguistic agents are siblings of the transformer, not successors of the state-space models, because they remove different interfaces.
- **Twelve techniques** keyed to the interfaces they require.
- **Nine cells carrying published evidence**, out of roughly 96 technique-architecture pairs. Each cell holds two numbers where both exist: the naive port and a best-effort adaptation.
- **A within-architecture floor**: how much a frozen activation monitor loses to quantization, LoRA and QLoRA updates of the same model, as the baseline every cross-architecture number must be read against.

## The two-number rule

A cell with one number conflates a real limit with an unsolved engineering problem. Attention-edge attribution scores zero on a state-space model trivially, because there are no attention edges. That tells you nothing about whether the function is recoverable. In the same architecture, activation steering loses response on a naive port and is recovered by state steering, which computes the vector from the compressed recurrent state and has no transformer analogue. Naive and adapted differ, and the gap is the quantity of interest.

## What this synthesis produces that no single paper states

Reading the ported-monitor result against the staleness benchmark gives a testable inference. A frozen monitor loses a median 0.037 AUC to a LoRA finetune of the same model, with a 43% big-drop rate. A monitor ported across models through a fitted adapter reports 0.959 against a native reference of 0.963, a gap of 0.004. Porting to a different model therefore appears to cost an order of magnitude less than staying on the same model through a light finetune, which is the wrong way round. The most likely explanation is the compatibility screen that admitted only models passing an unreported pass-rate filter. That inference is the matrix's first product and it needs direct testing.

## Known limits of this record

- Most cells inherit whatever capability matching their source paper used, and most used parameter matching rather than held-out performance matching. Cross-architecture fidelity and relative competence are confounded in those cells. The match field records which.
- Several cells report qualitative findings with no scalar. They are marked rather than filled with a guess.
- The sparse dictionary cells sit on a basis whose reliability is itself contested, so their portability numbers are hard to read.
- Nine evidenced cells is not coverage. Do not compute a mean fidelity, fit a decay curve across the ladder, or treat the empty cells as zeros.

## How this connects to Synthcore

The empty cells are the input to the learning edge. Four of them are written as Synthcore ideas with `testbed: null`, a `needs` list and an untestable reason, so each reopens automatically when a testbed supplies the missing capability. Five capabilities were added to the Synthcore vocabulary to express them: activation writes, capability-matched models, the architecture ladder, latent reasoning states and an adapter fitting corpus.

The cheapest and highest-leverage of those is activation writes. It is one capability away from the existing planted interpretability testbed, and adding it would let every recovery claim already in the catalogue be checked causally rather than by probe confidence alone.
