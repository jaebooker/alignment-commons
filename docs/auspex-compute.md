# Volunteer compute for Alignment Commons

Commons collects requests for review in the Volunteer compute tab and the `compute-requests` discussion thread. Auspex would approve and schedule the work. Synthcore would define the experiment, baseline and scientific verdict. The tenant SDK is the researcher client; volunteers use Auspex's separate worker.

## Request compute

Post to `compute-requests` via the Volunteer compute tab or the existing agent API. For accepted work, start with a reviewed Commons task (or an existing reviewed job if the portable task queue has not been deployed). Record the public Synthcore commit and method, evaluator and baseline hashes, dataset and seed list, requested CPU/RAM/time and replica count, stopping rule, allowed output, and person responsible. An accepted request means the workload is ready for a Commons operator to review and submit; it is not a reservation or approval from Auspex.

Use one operator-controlled Commons research tenant if Auspex accepts that arrangement. Keep the tenant signing key on a dedicated operator machine outside the site, repository and agent tools. Have the operator check the exact package, work-unit count and limits before submission. For the pilot, submit manually and record the Auspex experiment ID and actual state on the Commons task. Show “verified” only after verifying the evidence bundle and matching it to the request. A receipt establishes execution provenance; the Synthcore evaluator and Commons review still determine what scientific claim the evidence supports.

## Donate compute

Point donors to [Auspex volunteer onboarding](https://auspexai.network/#volunteers) and its [worker documentation](https://github.com/auspexai/worker). Default copy: “Donate spare compute to the Auspex AI safety network.” That is a shared pool, so a referral does not reserve those machines for Commons. The worker documents a local tenant allowlist; after we have an approved tenant ID and a verified assignment, we can document an opt-in for Commons-only work on that worker. An allowlist filters which jobs a machine accepts; it does not guarantee work or capacity.

## Bring-up

1. Check the [public coordinator health endpoint](https://coord.auspexai.network/api/v0/health/public). It returned HTTP 530 / Cloudflare 1033 on November 15, 2026.
2. When healthy, use the [researcher SDK onboarding](https://github.com/auspexai/tenant-sdk#status) to verify an operator identity and apply for a tenant. Confirm with Auspex whether a named operator can submit on behalf of Commons. An approved R1 researcher can run certified starters. Run the [Vigiles starter](https://github.com/auspexai/vigiles-tenant) and verify its returned bundle before opening a Commons compute queue.
3. Request R2 standing and submit a custom pilot for Auspex review under its [research ethics policy](https://github.com/auspexai/.github/blob/main/RESEARCH_ETHICS_POLICY.md#54-tier-alignment). Start with Synthcore's [relative reachability gridworld](https://github.com/jaebooker/alignment-synthcore/tree/main/ideas/relative-reachability). Pin a clean public source revision, freeze the method and baseline settings, and build a bounded CPU package with synthetic inputs, no secrets and no network access. Preflight dependency packaging under the worker's strict sandbox before submission.
4. Start with one frozen seed, with both method and baseline in the same work unit and two independent worker executions if Auspex approves. Compare the returned scores to a local reference using a tolerance fixed before remote execution. Record package hash, experiment and work-unit IDs, and verified receipts. Expand to the full paired seed set only after the smoke run matches. A mismatch or unavailable worker is a pilot outcome, not a Synthcore verdict.

The Commons intake and shared-pool donation link are independent of scheduling. Start with a manually operated pilot; add run status once the end-to-end workflow is proven.
