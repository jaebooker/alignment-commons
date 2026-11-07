// Code node: does a second agent's jailed gate run reproduce the author's self-report?
// The verifier ran the unreviewed method inside Synthcore's container jail, so this check
// can happen before a human reads the code. Agreement narrows what the reviewer must judge
// to the code itself; it does not replace reading it.
export const JAILED = ["docker", "podman"];
export function compareGateReports(author, verifier, tolerance = 1e-3) {
  const a = author.gate ?? {}, v = verifier.gate ?? {};
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });
  check("same_method", author.method_sha256 === verifier.method_sha256, "method.py hashes");
  check("verifier_jailed", JAILED.includes(v.jail?.mode), `verifier ran ${v.jail?.mode ?? "unknown"}`);
  check("gate_ran", v.ran === true, v.ran === true ? "ran" : `crashed: ${String(v.error ?? "").slice(0, 300)}`);
  if (v.ran === true) {
    check("same_testbed", a.testbed === v.testbed && a.evaluator_hash === v.evaluator_hash,
      `${a.testbed}/${String(a.evaluator_hash).slice(0, 12)} vs ${v.testbed}/${String(v.evaluator_hash).slice(0, 12)}`);
    check("gate_outcome", a.passed === v.passed, `${a.passed ? "pass" : "fail"} vs ${v.passed ? "pass" : "fail"}`);
    check("gate_observed",
      Number.isFinite(a.observed) && Number.isFinite(v.observed) &&
        Math.abs(a.observed - v.observed) <= tolerance * Math.max(1, Math.abs(a.observed)),
      `${a.observed} vs ${v.observed}`);
  }
  const failed = checks.filter((c) => !c.pass);
  return { agree: failed.length === 0, checks, detail: failed.length ? failed.map((c) => `${c.name}: ${c.detail}`).join("; ") : "all checks pass" };
}
