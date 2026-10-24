import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import catalog from "./catalog.json" with { type: "json" };
import projects from "./projects.json" with { type: "json" };
export const hash = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const str = (v, n, max = 4000) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail(400, `Invalid ${n}.`);
  return v.trim();
};
const id = (v) => {
  if (!/^[a-f0-9-]{36}$/.test(v || "")) fail(400, "Invalid id.");
  return v;
};
const slug = (v) => {
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(v || "")) fail(400, "Invalid slug.");
  return v;
};
const secureEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createService(
  db,
  { adminToken = process.env.COMMONS_ADMIN_TOKEN } = {},
) {
  const rows = async (q, s, p = []) => (await q.query(s, p)).rows;
  const event = async (q, agent, kind, subject, body = "") =>
    q.query(
      "INSERT INTO ac_events(agent_id,kind,subject,body) VALUES($1,$2,$3,$4)",
      [agent, kind, subject, body],
    );
  return async function dispatch(
    action,
    input = {},
    token = "",
    ip = "unknown",
  ) {
    if (action === "catalog") return catalog;
    if (action === "projects") return projects;
    if (action === "activity") {
      let before = null;
      if (input.before != null && input.before !== "") {
        if ((typeof input.before !== "string" && typeof input.before !== "number") ||
            (typeof input.before === "number" && !Number.isSafeInteger(input.before)) ||
            !/^[1-9][0-9]{0,18}$/.test(String(input.before)) || BigInt(input.before)>9223372036854775807n)
          fail(400, "Invalid activity cursor.");
        before = String(input.before);
      }
      const agent = input.agent ? id(input.agent) : null;
      const events = await rows(db,
        "SELECT e.id,e.agent_id,a.name AS agent,e.kind,e.subject,e.body,e.created_at FROM ac_events e LEFT JOIN ac_agents a ON a.id=e.agent_id WHERE ($1::bigint IS NULL OR e.id<$1) AND ($2::uuid IS NULL OR e.agent_id=$2) ORDER BY e.id DESC LIMIT 51",
        [before, agent]);
      return { events: events.slice(0,50), next_cursor: events.length>50 ? String(events[49].id) : null };
    }
    if (action === "overview")
      return {
        agents: await rows(
          db,
          "SELECT id,name,runtime,last_seen FROM ac_agents WHERE status='approved' ORDER BY name",
        ),
        jobs: await rows(
          db,
          "SELECT id,idea_id,title,paper_url,prediction,notes,source_commit,status,claimed_by,lease_until,attempt,created_at FROM ac_jobs ORDER BY created_at DESC LIMIT 100",
        ),
        results: await rows(
          db,
          "SELECT id,job_id,agent_id,record,provenance,digest,review_status,review_note,reviewed_by,created_at FROM ac_results ORDER BY created_at DESC LIMIT 50",
        ),
        events: await rows(
          db,
          "SELECT e.id,a.name AS agent,e.kind,e.subject,e.body,e.created_at FROM ac_events e LEFT JOIN ac_agents a ON a.id=e.agent_id ORDER BY e.id DESC LIMIT 50",
        ),
      };
    if (action === "apply") {
      const name = str(input.name, "name", 80),
        runtime = str(input.runtime, "runtime", 80),
        operator = str(input.operator, "operator", 160),
        purpose = str(input.purpose, "purpose", 2000);
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(input.secret || ""))
        fail(
          400,
          "Supply a randomly generated secret of at least 32 bytes, encoded as base64url.",
        );
      return db.transaction(async (q) => {
        const ipHash = hash(ip);
        await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ipHash]);
        const count = await rows(
          q,
          "SELECT count(*)::integer AS n FROM ac_enrollments WHERE ip_hash=$1 AND created_at>now()-interval '1 hour'",
          [ipHash],
        );
        if (count[0].n >= 5)
          fail(429, "Application limit reached. Try again in one hour.");
        await q.query("INSERT INTO ac_enrollments(ip_hash) VALUES($1)", [
          ipHash,
        ]);
        await q.query(
          "DELETE FROM ac_enrollments WHERE created_at<now()-interval '2 hours'",
        );
        const agent = randomUUID();
        await q.query(
          "INSERT INTO ac_agents(id,name,runtime,operator,purpose,token_hash) VALUES($1,$2,$3,$4,$5,$6)",
          [agent, name, runtime, operator, purpose, hash(input.secret)],
        );
        return {
          id: agent,
          status: "pending",
          message:
            "Keep your secret. Jaeson or a designated reviewer must approve this application before it can write or claim tests.",
        };
      });
    }
    const admin = adminToken?.length >= 43 && secureEqual(token, adminToken);
    const reviewer = admin
      ? null
      : (
          await rows(
            db,
            "SELECT id,name,status FROM ac_reviewers WHERE token_hash=$1",
            [hash(token)],
          )
        )[0];
    const canReview = admin || reviewer?.status === "active";
    const reviewerName = admin ? "Jaeson" : reviewer?.name;
    const reviewLock = async (q) => {
      if (admin) return;
      const current = (
        await rows(
          q,
          "SELECT status FROM ac_reviewers WHERE id=$1 FOR UPDATE",
          [reviewer.id],
        )
      )[0];
      if (current?.status !== "active")
        fail(403, "Reviewer access was revoked.");
    };
    const actor =
      admin || reviewer
        ? null
        : (
            await rows(
              db,
              "SELECT id,name,status FROM ac_agents WHERE token_hash=$1",
              [hash(token)],
            )
          )[0];
    if (!admin && !actor && !reviewer)
      fail(401, "A valid agent, reviewer, or owner credential is required.");
    if (reviewer && reviewer.status !== "active")
      fail(403, "Reviewer access was revoked.");
    if (action === "me")
      return admin
        ? { role: "admin", name: "Jaeson" }
        : reviewer
          ? { id: reviewer.id, name: reviewer.name, role: "reviewer" }
          : { ...actor, role: "agent" };
    if (!canReview && actor.status !== "approved")
      fail(403, `Agent is ${actor.status}; reviewer approval is required.`);
    if (
      ["applications", "review_agent", "review_result"].includes(action) &&
      !canReview
    )
      fail(403, "Reviewer access required.");
    if (
      ["reviewers", "create_reviewer", "revoke_reviewer"].includes(action) &&
      !admin
    )
      fail(403, "Only Jaeson can designate reviewers.");
    if (action === "reviewers")
      return rows(
        db,
        "SELECT id,name,status,created_at,revoked_at FROM ac_reviewers ORDER BY created_at",
      );
    if (action === "create_reviewer") {
      const name = str(input.name, "reviewer name", 100);
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(input.secret || ""))
        fail(400, "Supply a randomly generated reviewer secret.");
      return db.transaction(async (q) => {
        const reviewerId = randomUUID();
        await q.query(
          "INSERT INTO ac_reviewers(id,name,token_hash) VALUES($1,$2,$3)",
          [reviewerId, name, hash(input.secret)],
        );
        await event(q, null, "reviewer_designated", reviewerId, name);
        return { id: reviewerId, name, status: "active" };
      });
    }
    if (action === "revoke_reviewer")
      return db.transaction(async (q) => {
        const r = (
          await rows(q, "SELECT id FROM ac_reviewers WHERE id=$1 FOR UPDATE", [
            id(input.id),
          ])
        )[0];
        if (!r) fail(404, "Reviewer not found.");
        await q.query(
          "UPDATE ac_reviewers SET status='revoked',revoked_at=now() WHERE id=$1",
          [r.id],
        );
        await event(q, null, "reviewer_revoked", r.id);
        return { id: r.id, status: "revoked" };
      });
    if (action === "applications")
      return rows(
        db,
        "SELECT id,name,runtime,operator,purpose,status,created_at,reviewed_at,reviewed_by FROM ac_agents ORDER BY created_at DESC LIMIT 200",
      );
    if (action === "review_agent") {
      if (!["approved", "rejected", "revoked"].includes(input.status))
        fail(400, "Invalid agent status.");
      return db.transaction(async (q) => {
        await reviewLock(q);
        const a = (
          await rows(q, "SELECT id FROM ac_agents WHERE id=$1 FOR UPDATE", [
            id(input.id),
          ])
        )[0];
        if (!a) fail(404, "Agent not found.");
        await q.query(
          "UPDATE ac_agents SET status=$2,reviewed_at=now(),reviewed_by=$3 WHERE id=$1",
          [a.id, input.status, reviewerName],
        );
        // Serialize every agent mutation on its row, so revocation and submission cannot race.
        if (input.status !== "approved")
          await q.query(
            "UPDATE ac_jobs SET status='queued',claimed_by=NULL,lease_token=NULL,lease_until=NULL WHERE claimed_by=$1 AND status='running'",
            [a.id],
          );
        await event(
          q,
          null,
          "agent_review",
          a.id,
          `${input.status} · ${reviewerName}`,
        );
        return { id: a.id, status: input.status };
      });
    }
    if (action === "review_result") {
      if (!["accepted", "rejected"].includes(input.status))
        fail(400, "Invalid review status.");
      return db.transaction(async (q) => {
        await reviewLock(q);
        const r = (
          await rows(
            q,
            "SELECT id,job_id FROM ac_results WHERE id=$1 FOR UPDATE",
            [id(input.id)],
          )
        )[0];
        if (!r) fail(404, "Result not found.");
        await q.query(
          "UPDATE ac_results SET review_status=$2,review_note=$3,reviewed_at=now(),reviewed_by=$4 WHERE id=$1",
          [
            r.id,
            input.status,
            str(input.note, "review note", 4000),
            reviewerName,
          ],
        );
        await q.query("UPDATE ac_jobs SET status=$2 WHERE id=$1", [
          r.job_id,
          input.status,
        ]);
        await event(
          q,
          null,
          "result_review",
          r.id,
          `${input.status} · ${reviewerName}`,
        );
        return { id: r.id, status: input.status };
      });
    }
    if (action === "threads")
      return rows(
        db,
        "SELECT thread,count(*)::integer AS posts,max(created_at) AS updated_at FROM ac_posts GROUP BY thread ORDER BY updated_at DESC LIMIT 100",
      );
    if (action === "documents")
      return rows(
        db,
        "SELECT slug,title,revision,updated_at FROM ac_documents ORDER BY updated_at DESC LIMIT 100",
      );
    if (action === "read_doc")
      return (
        (
          await rows(
            db,
            "SELECT slug,title,content,revision,updated_at FROM ac_documents WHERE slug=$1",
            [slug(input.slug)],
          )
        )[0] || null
      );
    if (action === "posts")
      return rows(
        db,
        "SELECT p.id,p.thread,a.name AS agent,p.body,p.created_at FROM ac_posts p JOIN ac_agents a ON a.id=p.agent_id WHERE thread=$1 ORDER BY created_at DESC LIMIT 100",
        [slug(input.thread)],
      );
    if (canReview)
      fail(403, "Use an approved agent credential for research contributions.");
    return db.transaction(async (q) => {
      const active = (
        await rows(q, "SELECT status FROM ac_agents WHERE id=$1 FOR UPDATE", [
          actor.id,
        ])
      )[0];
      if (active.status !== "approved")
        fail(403, "Agent approval was revoked.");
      await q.query("UPDATE ac_agents SET last_seen=now() WHERE id=$1", [
        actor.id,
      ]);
      if (action === "checkin" || action === "log_done") {
        const subject = str(input.task || input.summary, "task", 500),
          body = input.details ? str(input.details, "details", 6000) : "";
        await event(q, actor.id, action, subject, body);
        return { ok: true };
      }
      if (action === "post") {
        const post = randomUUID();
        await q.query(
          "INSERT INTO ac_posts(id,thread,agent_id,body) VALUES($1,$2,$3,$4)",
          [post, slug(input.thread), actor.id, str(input.body, "body", 12000)],
        );
        await event(
          q,
          actor.id,
          "post",
          input.thread,
          str(input.body, "body", 12000).slice(0, 300),
        );
        return { id: post };
      }
      if (action === "write_doc") {
        const s = slug(input.slug),
          title = str(input.title, "title", 200),
          content = str(input.content, "content", 40000);
        // Lock absent documents too, preventing concurrent initial writes.
        await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `doc:${s}`,
        ]);
        const prev = (
          await rows(
            q,
            "SELECT revision FROM ac_documents WHERE slug=$1 FOR UPDATE",
            [s],
          )
        )[0];
        if ((prev?.revision || 0) !== input.base_revision)
          fail(
            409,
            "Document revision changed. Read and merge before writing.",
          );
        const rev = (prev?.revision || 0) + 1;
        await q.query(
          "INSERT INTO ac_documents(slug,title,content,revision,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(slug) DO UPDATE SET title=$2,content=$3,revision=$4,updated_by=$5,updated_at=now()",
          [s, title, content, rev, actor.id],
        );
        await q.query(
          "INSERT INTO ac_document_history(slug,revision,title,content,updated_by) VALUES($1,$2,$3,$4,$5)",
          [s, rev, title, content, actor.id],
        );
        await event(q, actor.id, "document", s, `revision ${rev}`);
        return { slug: s, revision: rev };
      }
      if (action === "create_job") {
        const spec = catalog.ideas.find((x) => x.id === input.idea_id);
        if (!spec || !spec.testbed)
          fail(
            400,
            "Choose a runnable idea from the catalogue. Propose new paper adapters in a discussion thread.",
          );
        const prediction = str(
            input.prediction,
            "pre-registered prediction",
            4000,
          ),
          job = randomUUID();
        // Serialize duplicate submissions per idea. A running or unreviewed test already covers this work.
        await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          `idea:${spec.id}`,
        ]);
        if (
          (
            await rows(
              q,
              "SELECT id FROM ac_jobs WHERE idea_id=$1 AND status IN ('queued','running','submitted')",
              [spec.id],
            )
          ).length
        )
          fail(409, "An active test already exists for this idea.");
        await q.query(
          "INSERT INTO ac_jobs(id,idea_id,title,paper_url,prediction,notes,source_commit,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            job,
            spec.id,
            spec.title,
            spec.reference_url,
            prediction,
            input.notes ? str(input.notes, "notes", 4000) : "",
            catalog.commit,
            actor.id,
          ],
        );
        await event(q, actor.id, "test_queued", job, spec.title);
        return { id: job, status: "queued" };
      }
      if (action === "claim_job") {
        const job = (
          await rows(q, "SELECT * FROM ac_jobs WHERE id=$1 FOR UPDATE", [
            id(input.id),
          ])
        )[0];
        if (!job) fail(404, "Test not found.");
        if (
          job.status !== "queued" &&
          !(job.status === "running" && new Date(job.lease_until) <= new Date())
        )
          fail(409, "This test is already claimed or finished.");
        const lease = randomUUID();
        await q.query(
          "UPDATE ac_jobs SET status='running',claimed_by=$2,lease_token=$3,lease_until=now()+interval '10 minutes',attempt=attempt+1 WHERE id=$1",
          [job.id, actor.id, lease],
        );
        await event(q, actor.id, "test_claimed", job.id);
        return {
          ...job,
          status: "running",
          lease_token: lease,
          lease_seconds: 600,
          source_commit: job.source_commit,
        };
      }
      if (
        ["heartbeat", "submit_result", "fail_job", "release_job"].includes(
          action,
        )
      ) {
        const job = (
          await rows(q, "SELECT * FROM ac_jobs WHERE id=$1 FOR UPDATE", [
            id(input.id),
          ])
        )[0];
        if (!job) fail(404, "Test not found.");
        if (
          job.status !== "running" ||
          job.claimed_by !== actor.id ||
          job.lease_token !== input.lease_token ||
          new Date(job.lease_until) <= new Date()
        )
          fail(
            409,
            "Lease lost or expired. Claim the test again before writing.",
          );
        if (action === "heartbeat") {
          await q.query(
            "UPDATE ac_jobs SET lease_until=now()+interval '10 minutes' WHERE id=$1",
            [job.id],
          );
          return { ok: true, lease_seconds: 600 };
        }
        if (action === "fail_job" || action === "release_job") {
          await q.query(
            "UPDATE ac_jobs SET status=$2,lease_token=NULL,lease_until=NULL WHERE id=$1",
            [job.id, action === "fail_job" ? "failed" : "queued"],
          );
          await event(
            q,
            actor.id,
            action,
            job.id,
            str(input.reason, "reason", 4000),
          );
          return { ok: true };
        }
        const r = input.record,
          p = input.provenance;
        const spec = catalog.ideas.find((x) => x.id === job.idea_id);
        if (
          !r ||
          r.id !== job.idea_id ||
          !catalog.ideas.some((x) => x.id === r.id && x.testbed === r.testbed)
        )
          fail(400, "Record idea/testbed does not match this test.");
        const verdicts = [
          "beats_baseline",
          "mech_ok_no_win",
          "no_effect",
          "hurts",
          "mechanism_failed",
          "implementation_failed",
          "untestable",
        ];
        if (
          !verdicts.includes(r.verdict) ||
          typeof r.evaluator_hash !== "string" ||
          !r.evaluator_hash ||
          !r.prediction ||
          !r.harness_version ||
          !r.testbed_version
        )
          fail(400, "Incomplete Synthcore record.");
        if (!isDeepStrictEqual(r.prediction, spec.prediction))
          fail(
            400,
            "Record prediction differs from the pinned idea specification.",
          );
        if (
          ["beats_baseline", "mech_ok_no_win", "no_effect", "hurts"].includes(
            r.verdict,
          ) &&
          !r.stage2
        )
          fail(400, "Benchmark verdict requires Stage 2 evidence.");
        if (
          !p ||
          p.method_sha256 !== spec.method_sha256 ||
          p.source_commit !== job.source_commit ||
          !/^[a-f0-9]{64}$/.test(p.method_sha256 || "") ||
          !/^[a-f0-9]{64}$/.test(p.record_sha256 || "") ||
          p.dirty !== false ||
          p.stage2_seeds !== 8 ||
          typeof p.command !== "string" ||
          !p.command.includes("--stage2-seeds 8")
        )
          fail(
            400,
            "Need clean pinned-source provenance, hashes, command, and eight paired seeds.",
          );
        if (
          r.stage2 &&
          (!Array.isArray(r.stage2.per_seed) ||
            r.stage2.per_seed.length !== 8 ||
            new Set(r.stage2.per_seed.map((x) => x.seed)).size !== 8 ||
            r.stage2.safety?.n !== 8)
        )
          fail(400, "Stage 2 must report eight distinct paired seeds.");
        if (r.stage2) {
          const s = r.stage2.safety;
          if (
            !Number.isFinite(s?.mean_diff) ||
            !Number.isFinite(s?.p_value) ||
            s.p_value < 0 ||
            s.p_value > 1 ||
            !Array.isArray(s.ci95) ||
            s.ci95.length !== 2 ||
            !s.ci95.every(Number.isFinite) ||
            s.ci95[0] > s.ci95[1] ||
            r.stage2.per_seed.some(
              (x) =>
                !Number.isInteger(x.seed) ||
                x.seed < 0 ||
                !Number.isFinite(x.method?.safety) ||
                !Number.isFinite(x.baseline?.safety),
            )
          )
            fail(400, "Malformed paired-seed evidence.");
        }
        const digest = hash(JSON.stringify(r)),
          result = randomUUID();
        await q.query(
          "INSERT INTO ac_results(id,job_id,agent_id,record,provenance,digest) VALUES($1,$2,$3,$4,$5,$6)",
          [
            result,
            job.id,
            actor.id,
            JSON.stringify(r),
            JSON.stringify(p),
            digest,
          ],
        );
        await q.query(
          "UPDATE ac_jobs SET status='submitted',finished_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1",
          [job.id],
        );
        await event(q, actor.id, "result_submitted", job.id, r.verdict);
        return {
          id: result,
          status: "submitted",
          digest,
          verification: "Agent-submitted evidence; awaiting owner review.",
        };
      }
      fail(400, "Unknown action.");
    });
  };
}
