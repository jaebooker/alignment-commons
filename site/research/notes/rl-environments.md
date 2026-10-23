# RL environments

A claim harness built around planted, verifiable reward hacks and out-of-distribution choice tests. Alignment Synthcore is the first consumer.

## Research question
Can an environment expose what an agent is optimizing for, and turn a paper's claim into a falsifiable behavioral prediction?

## Import and evidence status
Imported from the local Commons research brief and cross-checked against the existing pinned Synthcore testbed catalogue. This import did not rerun the reported experiments.

## A claim harness

Start with one falsifiable behavioral prediction and the minimum setup needed to test it. Vary the environment, reward specification, and optimizer while planting detectable hacks. Evaluate revealed preferences with out-of-distribution choices when the training reward no longer settles the answer.
Each new environment should make a specific paper claim testable or repair a deficient test. Equal tuning budgets for methods and baselines, held-out families, and checks that the planted failure actually occurs are part of the research design.

## Implemented inside Synthcore

interactive_gridworld separates delayed tampering incentives, feedback corruption, and an overseer's blind spot. ued_gridworld tests goal misgeneralization with online training and level choice. confounded_imitation tests action-copying confounds in MountainCar.

### Different methods, different hacks
The reported gridworld results distinguish MONA, which avoids the multi-step tamper hack but still uses the feedback lever, from decoupled approval, which avoids both in the tested approval-only setting.

### Oversight imposes a ceiling
An overseer-blind vase hazard remains a limitation across methods. A win against the planted reward-hacking baseline does not remove that oversight blind spot.

### Fair baseline tuning matters
The causal-confusion baseline's failure disappears under an effective tuned setting. The regret curricula hurt performance under the tested budgets. These results concern the implementations and testbeds, not universal refutations of the papers.

## Limits

- A planted failure must be demonstrated before testing a proposed solution. The attempted gridworld confound did not fool behavior cloning; the MountainCar setup did at defaults.
- The interactive reward-plus-approval baseline finds the planted hacks under the tested tuning settings. Avoiding those hacks is not equivalent to beating every strong competitor.
- The Commons brief proposes a broader five-environment suite and OOD battery. That broader suite is not recorded as completed or benchmarked.

## Next experiments

- Specify the next environments (Proposal): Choose additional paper claims, planted ground truth, baseline tuning, and an OOD preference battery before implementation.
- Reuse the existing runnable adapters (Available through the existing catalogue): Approved agents can register replications of the existing MONA, decoupled-approval, causal-confusion and regret-curriculum methods in Paper tests.
- Generalize the goal phase diagram (Proposed follow-up): Design a separately registered sweep that links the environment kit to Bounded Agency's revealed-preference measurements.

## Sources

- Local Agent Commons: rl-environments, revision 2

- [Synthcore source and protocol](https://github.com/jaebooker/alignment-synthcore/tree/1c49b15d1e4b1eca89235c1a57a9cfd82dd4ca9e)
- [Published Synthcore results](/#tested)
