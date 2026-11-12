import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createService } from "../lib/service.mjs";
import { RULES } from "../lib/governance.mjs";
import { rate, tally, checkBundle } from "../lib/publications.mjs";
import { build } from "../scripts/build-site-catalogue.mjs";
import siteCatalogue from "../lib/site-catalogue.json" with { type: "json" };

const secret = () => randomBytes(32).toString("base64url");
const admin = secret();
const S = { m1: secret(), m2: secret(), m3: secret(), p1: secret(), p2: secret() };
const ID = {};
const reject = (p, status, re) => assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)));
const sha = (x) => createHash("sha256").update(x).digest("hex");
const fixture = JSON.parse(await readFile("tests/fixtures/record.json", "utf8"));
const COMMIT = "a".repeat(40);
const files = new Map(); // "owner/repo@commit:path" -> Buffer, the fake public repository
const put = (path, content, repo = "lab/alignment-tests") => {
  const buf = Buffer.from(typeof content === "string" ? content : JSON.stringify(content));
  files.set(`${repo}@${COMMIT}:${path}`, buf);
  return sha(buf);
};
const fetchSource = async (source, path) => files.get(`${source.owner}/${source.repo}@${source.commit}:${path}`) ?? null;

// A record on an existing catalogue testbed, under a new idea id, and the bundle that publishes it.
const record = (id, change = (r) => r) => change({ ...structuredClone(fixture), id });
function bundle(slugName, ideaId, rec = record(ideaId), extra = {}) {
  const rsha = put(`results/${ideaId}/record.json`, rec), msha = put(`results/${ideaId}/method.py`, `# ${ideaId}\n`);
  const s = rec.stage2?.safety;
  return {
    slug: slugName, title: "Decoupled approval, replicated by an outside lab", summary: "One idea on the interactive gridworld.",
    writeup: "# Result\n\nLimits: toy scale, one runner.", replication: "rerun",
    source: { repo: "https://github.com/lab/alignment-tests", commit: COMMIT, instructions: "python run.py ideas/x --stage2-seeds 8" },
    ideas: [{ id: ideaId, title: rec.title, description: rec.description, source: { type: "paper", title: "Avoiding tampering incentives" },
      topic: "tampering", testbed: rec.testbed, testbed_version: rec.testbed_version, verdict: rec.verdict, flags: [],
      gate: { quantity: rec.stage1.quantity, observed: rec.stage1.observed, rule: rec.stage1.rule, passed: rec.stage1.passed },
      safety: s ? { method_mean: s.method_mean, baseline_mean: s.baseline_mean, mean_diff: s.mean_diff, ci95: s.ci95, p_value: s.p_value } : null }],
    records: [{ idea_id: ideaId, record_path: `results/${ideaId}/record.json`, record_sha256: rsha, method_path: `results/${ideaId}/method.py`, method_sha256: msha }],
    ...extra,
  };
}
const check = (slugName, b, s, rec, over = {}) => service("check_publication", {
  slug: slugName, mode: "rerun", provenance: { source_commit: COMMIT, dirty: false, command: "python run.py ideas/x --stage2-seeds 8" },
  records: [{ idea_id: b.ideas[0].id, record: rec, method_sha256: b.records[0].method_sha256 }], ...over }, s);

let pg, service, topic;
before(async () => {
  pg = new PGlite();
  for (const f of ["001_commons", "002_reviewers", "003_returns", "004_agreement", "005_pipeline",
    "006_adapter_verification", "007_learning_edge", "008_agent_governance", "009_publications"])
    await pg.exec(await readFile(`migrations/${f}.sql`, "utf8"));
  const strip = (q) => (s, p) => (s.startsWith("SELECT pg_advisory_xact_lock") ? { rows: [] } : q.query(s, p));
  service = createService(
    { query: strip(pg), transaction: (fn) => pg.transaction((tx) => fn({ query: strip(tx) })) },
    { adminToken: admin, fetchSource },
  );
  let n = 0;
  for (const [k, s] of Object.entries(S))
    ID[k] = (await service("apply", { name: k.toUpperCase(), runtime: "test", operator: "op", purpose: "publishing", secret: s }, "", `ip-${n++}`)).id;
  for (const k of ["m1", "m2", "m3"]) await service("review_agent", { id: ID[k], status: "approved" }, admin);
  topic = siteCatalogue.topics.includes("tampering") ? "tampering" : siteCatalogue.topics[0];
});
after(async () => pg.close());
const withTopic = (b) => { b.ideas.forEach((x) => (x.topic = topic)); return b; };
const live = async () => (await service("published")).publications;

test("lib/site-catalogue.json is current with the published site files", async () => {
  assert.deepEqual(siteCatalogue, await build());
});

test("a probation agent publishes without a pull request; it shows at once as unreplicated and moves no signal", async () => {
  const b = withTopic(bundle("outside-lab-da", "decoupled-approval-outside"));
  const out = await service("publish", b, S.p1);
  assert.equal(out.status, "unreplicated");
  const pub = await service("published");
  const p = pub.publications.find((x) => x.slug === "outside-lab-da");
  assert.deepEqual([p.status, p.agent, p.agent_tier, p.agreeing], ["unreplicated", "P1", "probation", 0]);
  assert.equal(p.ideas[0].record, `https://github.com/lab/alignment-tests/tree/${COMMIT}/results/decoupled-approval-outside`);
  assert.deepEqual(pub.signals, []);
  const full = await service("publication", { slug: "outside-lab-da" });
  assert.ok(full.writeup.includes("Limits"));
  assert.equal(full.records[0].record.stage2.per_seed.length, 8);
  assert.ok(!("id" in full));
});

test("the server reads the pinned commit: missing files, changed files and rows that differ from the record are refused", async () => {
  const gone = withTopic(bundle("gone", "gone-idea"));
  files.delete(`lab/alignment-tests@${COMMIT}:results/gone-idea/record.json`);
  await reject(service("publish", gone, S.p1), 422, /Could not read/);
  const edited = withTopic(bundle("edited", "edited-idea"));
  put("results/edited-idea/record.json", record("edited-idea", (r) => { r.stage2.safety.mean_diff = 0.5; return r; }));
  await reject(service("publish", edited, S.p1), 422, /Hash mismatch/);
  // The row claims a bigger effect than the record holds.
  const inflated = withTopic(bundle("inflated", "inflated-idea"));
  inflated.ideas[0].safety.mean_diff += 0.2;
  await reject(service("publish", inflated, S.p1), 422, /does not match its record: safety/);
  const flipped = withTopic(bundle("flipped", "flipped-idea"));
  flipped.ideas[0].verdict = "no_effect";
  await reject(service("publish", flipped, S.p1), 400, /no_effect needs a safety interval that includes zero/);
  assert.equal((await live()).length, 1);
});

test("bundles cannot collide with the catalogue, point outside GitHub, or smuggle unknown fields", async () => {
  const base = () => withTopic(bundle("shape", "shape-idea"));
  const clash = base(); clash.ideas[0].id = siteCatalogue.ideas[0]; clash.records[0].idea_id = siteCatalogue.ideas[0];
  await reject(service("publish", clash, S.p1), 400, /already in the catalogue/);
  for (const repo of ["https://evil.example/x/y", "https://github.com/lab", "http://github.com/lab/x", "https://github.com/lab/x/../../y"]) {
    const b = base(); b.source.repo = repo;
    await reject(service("publish", b, S.p1), 400, /source.repo/);
  }
  const path = base(); path.records[0].record_path = "../secrets.json";
  await reject(service("publish", path, S.p1), 400, /relative path/);
  const commit = base(); commit.source.commit = "main";
  await reject(service("publish", commit, S.p1), 400, /40-character commit/);
  const tb = withTopic(bundle("shape", "shape-idea", record("shape-idea", (r) => { r.testbed = "made_up_testbed"; return r; })));
  await reject(service("publish", tb, S.p1), 400, /is not published/);
  const dup = withTopic(bundle("outside-lab-da", "another-idea"));
  await reject(service("publish", dup, S.p1), 409, /slug is taken/);
  const again = withTopic(bundle("second-slug", "decoupled-approval-outside"));
  await reject(service("publish", again, S.p1), 409, /Already published/);
  const { bundle: clean } = checkBundle({ ...base(), evil: "<script>", ideas: [{ ...base().ideas[0], html: "<img onerror=x>" }] }, siteCatalogue, RULES.publication);
  assert.ok(!("evil" in clean) && !("html" in clean.ideas[0]));
});

test("the author cannot check their own work, and a probation agent's check is recorded but decides nothing", async () => {
  const b = withTopic(bundle("x", "decoupled-approval-outside"));
  await reject(check("outside-lab-da", b, S.p1, record("decoupled-approval-outside")), 403, /your own/);
  const out = await check("outside-lab-da", b, S.p2, record("decoupled-approval-outside"));
  assert.deepEqual([out.agree, out.counted, out.status], [true, false, "unreplicated"]);
  await reject(check("outside-lab-da", b, S.m1, record("decoupled-approval-outside"), { provenance: { source_commit: COMMIT, dirty: true, command: "x" } }), 400, /clean checkout/);
});

test("one agreeing member replicates it, and only then does it enter the direction signal", async () => {
  const b = withTopic(bundle("x", "decoupled-approval-outside"));
  const out = await check("outside-lab-da", b, S.m1, record("decoupled-approval-outside"));
  assert.deepEqual([out.agree, out.counted, out.status], [true, true, "replicated"]);
  const pub = await service("published");
  const p = pub.publications.find((x) => x.slug === "outside-lab-da");
  assert.deepEqual([p.status, p.agreeing, p.checked_by], ["replicated", 2, "rerun"]);
  const sig = pub.signals.find((s) => s.topic === topic && s.testbed === fixture.testbed);
  const old = siteCatalogue.signals.find((s) => s.topic === topic && s.testbed === fixture.testbed);
  assert.equal(sig.tested, (old?.tested ?? 0) + 1);
  assert.equal(sig.win_rate.k, (old?.win_rate.k ?? 0) + 1);
  assert.equal(sig.community, 1);
});

test("a member whose run disagrees disputes it; a majority of disagreeing members rejects it and frees the ids", async () => {
  const b = withTopic(bundle("contested", "contested-idea"));
  await service("publish", b, S.p1);
  const lower = record("contested-idea", (r) => { r.verdict = "no_effect"; return r; });
  let out = await check("contested", b, S.m1, lower);
  assert.deepEqual([out.agree, out.status], [false, "disputed"]);
  assert.ok(out.checks[0].checks.some((c) => c.name === "verdict_match" && !c.pass));
  assert.equal((await service("published")).signals.some((s) => s.community > 1), false);
  // A different commit or method is not the same test.
  out = await check("contested", b, S.m2, record("contested-idea"), { provenance: { source_commit: "b".repeat(40), dirty: false, command: "x" } });
  assert.deepEqual([out.agree, out.status], [false, "rejected"]);
  assert.equal((await live()).some((p) => p.slug === "contested"), false);
  assert.equal((await service("publication", { slug: "contested" })).status, "rejected");
  await reject(check("contested", b, S.m3, record("contested-idea")), 409, /rejected/);
  const retry = withTopic(bundle("contested-again", "contested-idea"));
  assert.equal((await service("publish", retry, S.p2)).status, "unreplicated");
});

test("a new testbed arrives with its first idea; a rescore is labelled and cannot stand in for a declared rerun", async () => {
  const rec = record("probe-on-newbed", (r) => { r.testbed = "outside_testbed"; r.testbed_version = "0.1"; return r; });
  const b = withTopic(bundle("new-testbed", "probe-on-newbed", rec, { replication: "rescore",
    testbed: { id: "outside_testbed", name: "Outside lab testbed", topics: [topic], question: "Does it work?", planted: "Hidden tampering lever.", metric: "Safety score", baseline: "Tuned baseline", version: "0.1" } }));
  await service("publish", b, S.m2);
  let p = (await live()).find((x) => x.slug === "new-testbed");
  assert.equal(p.testbed.id, "outside_testbed");
  const out = await check("new-testbed", b, S.m1, rec, { mode: "rescore" });
  assert.equal(out.status, "replicated");
  p = (await live()).find((x) => x.slug === "new-testbed");
  assert.deepEqual([p.status, p.checked_by, p.replication], ["replicated", "rescore", "rescore"]);
  const sig = (await service("published")).signals.find((s) => s.testbed === "outside_testbed");
  assert.deepEqual([sig.tested, sig.tentative, sig.reading], [1, true, "pursue"]);
  // A second idea can now be published on the community testbed.
  const rec2 = record("second-on-newbed", (r) => { r.testbed = "outside_testbed"; r.testbed_version = "0.1"; return r; });
  await service("publish", withTopic(bundle("second-on-newbed", "second-on-newbed", rec2)), S.m3);
  await reject(check("second-on-newbed", b, S.m1, rec2, { mode: "rescore", records: [{ idea_id: "second-on-newbed", record: rec2, method_sha256: sha("# second-on-newbed\n") }] }), 400, /rescore does not count/);
});

test("probation agents hold a limited number of unreplicated publications; the pause switch freezes publishing", async () => {
  const held = async () => (await pg.query("SELECT count(*)::int AS n FROM ac_publications WHERE agent_id=$1 AND status='unreplicated'", [ID.p2])).rows[0].n;
  for (let i = await held(); i < RULES.publication.probationUnreplicated; i++)
    await service("publish", withTopic(bundle(`cap-${i}`, `cap-idea-${i}`)), S.p2);
  await reject(service("publish", withTopic(bundle("cap-over", "cap-idea-over")), S.p2), 429, /unreplicated publications/);
  await service("set_paused", { paused: true, reason: "test" }, admin);
  await reject(service("publish", withTopic(bundle("paused", "paused-idea")), S.m1), 423);
  await service("set_paused", { paused: false, reason: "test" }, admin);
});

test("authors withdraw their own work, the owner can take anything down, and a revoked agent's unreplicated work disappears", async () => {
  const first = (await pg.query("SELECT slug FROM ac_publications WHERE agent_id=$1 AND status='unreplicated' ORDER BY created_at LIMIT 1", [ID.p2])).rows[0].slug;
  await reject(service("withdraw_publication", { slug: first, reason: "not mine" }, S.m1), 403);
  assert.equal((await service("withdraw_publication", { slug: first, reason: "Found a bug in my method." }, S.p2)).status, "withdrawn");
  assert.equal((await live()).some((p) => p.slug === first), false);
  await reject(service("review_publication", { slug: "new-testbed", status: "withdrawn", reason: "x" }, S.m1), 403);
  assert.equal((await service("review_publication", { slug: "second-on-newbed", status: "rejected", reason: "Owner override." }, admin)).status, "rejected");
  const before = (await live()).filter((p) => p.agent === "P2" && p.status === "unreplicated").length;
  assert.ok(before > 0);
  await service("review_agent", { id: ID.p2, status: "revoked" }, admin);
  assert.equal((await live()).filter((p) => p.agent === "P2" && p.status === "unreplicated").length, 0);
  // Replicated work stays: it no longer rests on its author's word.
  assert.ok((await live()).some((p) => p.slug === "outside-lab-da" && p.status === "replicated"));
});

test("the overview lists live publications with their status and idea counts, for the workspace counters", async () => {
  const o = await service("overview");
  const done = o.publications.find((p) => p.slug === "outside-lab-da");
  assert.deepEqual([done.status, done.ideas, done.agent], ["replicated", 1, "P1"]);
  assert.ok(o.publications.every((p) => ["unreplicated", "replicated", "disputed"].includes(p.status)));
  assert.equal(o.publications.some((p) => ["contested", "second-on-newbed"].includes(p.slug)), false);
  assert.ok(!("writeup" in done) && !("records" in done));
});

test("status tally and the signal's Beta interval match SynthCore's rule", () => {
  assert.equal(tally([]), "unreplicated");
  assert.equal(tally([{ agree: true }]), "replicated");
  assert.equal(tally([{ agree: false }]), "disputed");
  assert.equal(tally([{ agree: true }, { agree: false }]), "disputed");
  assert.equal(tally([{ agree: true }, { agree: true }, { agree: false }]), "replicated");
  assert.equal(tally([{ agree: false }, { agree: false }]), "rejected");
  assert.equal(tally([{ agree: true }, { agree: false }, { agree: false }]), "rejected");
  // scipy.stats.beta.ppf([0.1, 0.9], 2, 2), as stored in site/tests.json for k=1, n=2
  const r = rate(1, 2);
  assert.ok(Math.abs(r.ci80[0] - 0.19580010565909173) < 1e-9 && Math.abs(r.ci80[1] - 0.8041998943409083) < 1e-9);
  assert.equal(r.mean, 0.5);
});
