// Code node: compare two independent runs of one pinned test.
// Every check has exactly one correct answer, so no model is involved.
// Agreement means the pinned method reproduces under two runners. It is not
// remote attestation, and two honest runs of deterministic seeds may be identical.
const overlap = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a[0] <= b[1] && b[0] <= a[1];
const fmt = (ci) => (Array.isArray(ci) ? `[${ci.join(", ")}]` : "missing");

export function compareRuns(a, b) {
  const ra = a.record, rb = b.record, pa = a.provenance, pb = b.provenance;
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });
  check("independent_agents", a.agent_id !== b.agent_id,
    "Runs must come from different approved agents.");
  check("same_source",
    pa.source_commit === pb.source_commit && pa.method_sha256 === pb.method_sha256,
    `commit ${pa.source_commit} vs ${pb.source_commit}; method ${pa.method_sha256?.slice(0, 12)} vs ${pb.method_sha256?.slice(0, 12)}`);
  check("same_evaluator",
    ra.evaluator_hash === rb.evaluator_hash &&
      ra.harness_version === rb.harness_version &&
      ra.testbed_version === rb.testbed_version,
    `evaluator ${String(ra.evaluator_hash).slice(0, 12)} vs ${String(rb.evaluator_hash).slice(0, 12)}; harness ${ra.harness_version} vs ${rb.harness_version}; testbed ${ra.testbed_version} vs ${rb.testbed_version}`);
  check("verdict_match", ra.verdict === rb.verdict, `${ra.verdict} vs ${rb.verdict}`);
  check("stage2_presence", !!ra.stage2 === !!rb.stage2,
    `stage 2 ${ra.stage2 ? "ran" : "absent"} vs ${rb.stage2 ? "ran" : "absent"}`);
  if (ra.stage2 && rb.stage2) {
    const sa = ra.stage2.safety?.ci95, sb = rb.stage2.safety?.ci95;
    check("safety_ci_overlap", overlap(sa, sb), `${fmt(sa)} vs ${fmt(sb)}`);
    const ca = ra.stage2.completion, cb = rb.stage2.completion;
    if (ca?.measured || cb?.measured)
      check("completion_ci_overlap", !!(ca?.measured && cb?.measured) && overlap(ca.ci95, cb.ci95),
        `${fmt(ca?.ci95)} vs ${fmt(cb?.ci95)}`);
  }
  return {
    agree: checks.every((c) => c.pass),
    checks,
    // Recorded, never gating: identical records are expected from deterministic seeds.
    identical_record: a.digest === b.digest,
  };
}
