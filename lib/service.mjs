import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { compareRuns } from "./agreement.mjs";
import { checkAdapter } from "./adapter-check.mjs";
import { checkIdea, arxivAbstract, normalize, SLUG } from "./idea-check.mjs";
import pipeline from "./pipeline.json" with { type: "json" };
import catalogSnapshot from "./catalog.json" with { type: "json" };
import projects from "./projects.json" with { type: "json" };
import researchActivity from "./research-activity.json" with { type: "json" };
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
export const MAX_RETURNS = 3;
// A return without evidence and a scope line is just a complaint; require all of it.
const returnFields = (input, reason) => ({
  reason: reason ?? str(input.reason, "reason", 1000),
  evidence: str(input.evidence, "evidence", 4000),
  scope: str(input.scope, "scope", 1000),
  escalate: input.escalate === true,
});
const secureEqual = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  Buffer.byteLength(a) === Buffer.byteLength(b) &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function createService(
  db,
  {
    adminToken = process.env.COMMONS_ADMIN_TOKEN,
    fetchAbstract = arxivAbstract,
    catalog = catalogSnapshot,
  } = {},
) {
  const rows = async (q, s, p = []) => (await q.query(s, p)).rows;
  const event = async (q, agent, kind, subject, body = "") =>
    q.query(
      "INSERT INTO ac_events(agent_id,kind,subject,body) VALUES($1,$2,$3,$4)",
      [agent, kind, subject, body],
    );
  // Correction edge. One unit goes back with verdict, reason, evidence and scope.
  // The third return escalates: repeated failure means the plan is wrong, not the run.
  const returnUnit = async (q, job, r) => {
    const n =
      (
        await rows(
          q,
          "SELECT count(*)::int AS n FROM ac_returns WHERE job_id=$1",
          [job.id],
        )
      )[0].n + 1;
    const escalated = !r.keepStatus && (r.escalate || n >= MAX_RETURNS);
    await q.query(
      "INSERT INTO ac_returns(id,job_id,number,source,verdict,reason,evidence,scope,returned_by,result_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [randomUUID(), job.id, n, r.source, r.verdict, r.reason, r.evidence,
        r.scope, r.by, r.result_id ?? null],
    );
    if (r.keepStatus)
      return { status: job.status, returns: n, remaining: MAX_RETURNS - n };
    await q.query(
      "UPDATE ac_jobs SET status=$2,claimed_by=NULL,lease_token=NULL,lease_until=NULL,finished_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1",
      [job.id, escalated ? "escalated" : "queued", escalated],
    );
    await event(
      q,
      r.agent ?? null,
      escalated ? "test_escalated" : "test_returned",
      job.id,
      `${r.verdict} · return ${n}/${MAX_RETURNS} · ${r.reason}`.slice(0, 4000),
    );
    return {
      status: escalated ? "escalated" : "queued",
      returns: n,
      remaining: escalated ? 0 : MAX_RETURNS - n,
    };
  };
  // Pipeline: the same correction edge for proposals. Three returns escalate to the spec.
  const PROPOSAL_COLS =
    "id,paper_key,paper_url,paper_title,slug,status,idea,quote_verified,proposed_by,adapter_by,lease_until,method_py,method_sha256,self_report,admitted_commit,reviewed_by,review_note,created_at,updated_at";
  const returnProposal = async (q, pr, r) => {
    const n =
      (
        await rows(q, "SELECT count(*)::int AS n FROM ac_proposal_returns WHERE proposal_id=$1", [pr.id])
      )[0].n + 1;
    const escalated = r.escalate || n >= MAX_RETURNS;
    await q.query(
      "INSERT INTO ac_proposal_returns(id,proposal_id,number,source,reason,evidence,scope,method_sha256,returned_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [randomUUID(), pr.id, n, r.source, r.reason, r.evidence, r.scope, pr.method_sha256, r.by],
    );
    await q.query(
      "UPDATE ac_proposals SET status=$2,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",
      [pr.id, escalated ? "escalated" : "specified"],
    );
    await event(
      q,
      r.agent ?? null,
      escalated ? "proposal_escalated" : "proposal_returned",
      pr.slug,
      `return ${n}/${MAX_RETURNS} · ${r.reason}`.slice(0, 4000),
    );
    return { status: escalated ? "escalated" : "specified", returns: n, remaining: escalated ? 0 : MAX_RETURNS - n };
  };
  const listReturns = (q, job) =>
    rows(
      q,
      "SELECT number,source,verdict,reason,evidence,scope,returned_by,result_id,created_at FROM ac_returns WHERE job_id=$1 ORDER BY number",
      [job],
    );
  return async function dispatch(
    action,
    input = {},
    token = "",
    ip = "unknown",
  ) {
    if (action === "catalog") return catalog;
    if (action === "projects") return projects;
    if (action === "research_activity") return researchActivity;
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
    if (action === "returns") return listReturns(db, id(input.job));
    if (action === "candidates") {
      const live = new Set(
        (await rows(db, "SELECT paper_key FROM ac_proposals WHERE status<>'withdrawn'")).map((r) => r.paper_key),
      );
      const limit = Math.min(Math.max(Number(input.limit) || 25, 1), 100);
      const list = pipeline.candidates.filter(
        (c) => !live.has(c.key) && (!input.testbed || c.testbeds.includes(input.testbed)),
      );
      return { remaining: list.length, catalog_commit: pipeline.catalog_commit, candidates: list.slice(0, limit) };
    }
    if (action === "proposals")
      return rows(
        db,
        `SELECT ${PROPOSAL_COLS},(SELECT count(*)::int FROM ac_proposal_returns r WHERE r.proposal_id=ac_proposals.id) AS returns FROM ac_proposals WHERE ($1::text IS NULL OR status=$1) ORDER BY updated_at DESC LIMIT 100`,
        [input.status ? str(input.status, "status", 20) : null],
      );
    if (action === "proposal") {
      const pr = (await rows(db, `SELECT ${PROPOSAL_COLS} FROM ac_proposals WHERE id=$1`, [id(input.id)]))[0];
      if (!pr) fail(404, "Proposal not found.");
      return {
        ...pr,
        returns: await rows(
          db,
          "SELECT number,source,reason,evidence,scope,method_sha256,returned_by,created_at FROM ac_proposal_returns WHERE proposal_id=$1 ORDER BY number",
          [pr.id],
        ),
      };
    }
    if (action === "overview")
      return {
        agents: await rows(
          db,
          "SELECT id,name,runtime,last_seen FROM ac_agents WHERE status='approved' ORDER BY name",
        ),
        jobs: await rows(
          db,
          "SELECT id,idea_id,title,paper_url,prediction,notes,source_commit,status,claimed_by,lease_until,attempt,created_at,(SELECT count(*)::int FROM ac_returns r WHERE r.job_id=ac_jobs.id) AS returns,(SELECT count(*)::int FROM ac_results x WHERE x.job_id=ac_jobs.id AND x.review_status<>'rejected') AS runs FROM ac_jobs ORDER BY created_at DESC LIMIT 100",
        ),
        results: await rows(
          db,
          "SELECT id,job_id,agent_id,record,provenance,digest,review_status,review_note,reviewed_by,created_at FROM ac_results ORDER BY created_at DESC LIMIT 50",
        ),
        comparisons: await rows(
          db,
          "SELECT id,job_id,result_a,result_b,agree,checks,identical_record,created_at FROM ac_comparisons ORDER BY created_at DESC LIMIT 50",
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
      ["applications", "review_agent", "review_result", "review_proposal"].includes(action) &&
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
    if (action === "review_proposal") {
      const decision = input.decision;
      if (!["admit", "return", "escalate", "withdraw"].includes(decision)) fail(400, "Invalid decision.");
      const note = str(input.note, "review note", 4000);
      const ret = ["return", "escalate"].includes(decision) ? returnFields(input, note) : null;
      if (decision === "admit" && !/^[0-9a-f]{40}$/.test(input.commit || ""))
        fail(400, "Admission records the Synthcore commit that contains the adapter.");
      return db.transaction(async (q) => {
        await reviewLock(q);
        const pr = (await rows(q, "SELECT * FROM ac_proposals WHERE id=$1 FOR UPDATE", [id(input.id)]))[0];
        if (!pr) fail(404, "Proposal not found.");
        if (decision === "withdraw") {
          await q.query(
            "UPDATE ac_proposals SET status='withdrawn',lease_token=NULL,lease_until=NULL,reviewed_by=$2,review_note=$3,updated_at=now() WHERE id=$1",
            [pr.id, reviewerName, note],
          );
          await event(q, null, "proposal_withdrawn", pr.slug, reviewerName);
          return { id: pr.id, status: "withdrawn" };
        }
        if (pr.status !== "adapted")
          fail(409, "Only a submitted adapter can be admitted or returned.");
        if (ret)
          return returnProposal(q, pr, {
            ...ret,
            escalate: decision === "escalate" || ret.escalate,
            source: "reviewer",
            by: reviewerName,
          });
        const pinned = catalog.ideas.find((x) => x.id === pr.slug);
        if (input.commit !== catalog.commit || !pinned ||
            pinned.method_sha256 !== pr.method_sha256 ||
            pinned.testbed !== pr.idea.testbed ||
            pinned.source?.url !== pr.paper_url)
          fail(409, "Admission requires this exact adapter in the deployed catalogue. Merge it, rerun both catalogue scripts, then deploy.");
        await q.query(
          "UPDATE ac_proposals SET status='admitted',admitted_commit=$2,reviewed_by=$3,review_note=$4,updated_at=now() WHERE id=$1",
          [pr.id, input.commit, reviewerName, note],
        );
        await event(q, null, "adapter_admitted", pr.slug, `${input.commit.slice(0, 12)} · ${reviewerName}`);
        return { id: pr.id, status: "admitted", commit: input.commit };
      });
    }
    if (action === "review_result") {
      if (!["accepted", "rejected"].includes(input.status))
        fail(400, "Invalid review status.");
      const note = str(input.note, "review note", 4000);
      const ret =
        input.status === "rejected" ? returnFields(input, note) : null;
      return db.transaction(async (q) => {
        await reviewLock(q);
        // Use the same job-then-result lock order as a worker submission.
        const ref = (await rows(q, "SELECT job_id FROM ac_results WHERE id=$1", [id(input.id)]))[0];
        if (!ref) fail(404, "Result not found.");
        const job = (await rows(q, "SELECT * FROM ac_jobs WHERE id=$1 FOR UPDATE", [ref.job_id]))[0];
        const r = (
          await rows(
            q,
            "SELECT id,job_id,review_status FROM ac_results WHERE id=$1 FOR UPDATE",
            [id(input.id)],
          )
        )[0];
        if (!r) fail(404, "Result not found.");
        await q.query(
          "UPDATE ac_results SET review_status=$2,review_note=$3,reviewed_at=now(),reviewed_by=$4 WHERE id=$1",
          [r.id, input.status, note, reviewerName],
        );
        await event(
          q,
          null,
          "result_review",
          r.id,
          `${input.status} · ${reviewerName}`,
        );
        if (!ret) {
          await q.query("UPDATE ac_jobs SET status='accepted' WHERE id=$1", [
            r.job_id,
          ]);
          return { id: r.id, status: input.status };
        }
        // Re-rejecting an already rejected result must not count as a second return.
        if (r.review_status === "rejected")
          return { id: r.id, status: input.status };
        const keepStatus = job.status === "accepted" &&
          (await rows(q, "SELECT 1 FROM ac_results WHERE job_id=$1 AND review_status='accepted' LIMIT 1", [job.id])).length > 0;
        if (!keepStatus)
          await q.query(
            "UPDATE ac_results SET review_status='awaiting_pair',reviewed_by=NULL,reviewed_at=NULL WHERE job_id=$1 AND id<>$2 AND review_status IN ('replicated','disputed')",
            [r.job_id, r.id],
          );
        const back = await returnUnit(q, job, {
          keepStatus,
          ...ret,
          source: "reviewer",
          verdict: "red",
          by: reviewerName,
          result_id: r.id,
        });
        return { id: r.id, status: input.status, job: back };
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
    // Network check outside the transaction: does the quoted claim appear in the abstract?
    let quoteVerified = null;
    if (action === "propose_idea") {
      const abs = await fetchAbstract(String(input.paper_url || ""));
      const quote = input.idea?.source?.claim_quote;
      if (abs && typeof quote === "string") quoteVerified = normalize(abs).includes(normalize(quote));
    }
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
      if (action === "propose_idea") {
        const cand = pipeline.candidates.find((c) => c.url === input.paper_url);
        if (!cand) fail(400, "Propose ideas for papers on the candidates list. The splitter decides which papers enter the pipeline.");
        const sl = String(input.slug || "");
        if (!SLUG.test(sl) || catalog.ideas.some((x) => x.id === sl)) fail(400, "Choose a new lowercase slug (3 to 61 characters, a-z, 0-9, hyphens).");
        const chk = checkIdea(input.idea, { paperUrl: cand.url, topics: pipeline.topics, testbeds: catalog.testbeds });
        if (!chk.passed) fail(400, `Idea spec failed checks: ${chk.problems.join(" ")}`);
        if (quoteVerified === false)
          fail(400, "source.claim_quote does not appear in the paper's abstract. Quote it verbatim.");
        await q.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`paper:${cand.key}`]);
        if ((await rows(q, "SELECT 1 FROM ac_proposals WHERE status<>'withdrawn' AND (paper_key=$1 OR slug=$2)", [cand.key, sl])).length)
          fail(409, "This paper or slug already has a live proposal.");
        const pid = randomUUID(), status = chk.untestable ? "untestable" : "specified";
        await q.query(
          "INSERT INTO ac_proposals(id,paper_key,paper_url,paper_title,slug,status,idea,quote_verified,proposed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
          [pid, cand.key, cand.url, cand.title, sl, status, JSON.stringify(input.idea), quoteVerified, actor.id],
        );
        await event(q, actor.id, chk.untestable ? "idea_untestable" : "idea_specified", sl, cand.title);
        return { id: pid, status, quote_verified: quoteVerified };
      }
      if (action === "claim_proposal") {
        const pr = (await rows(q, "SELECT * FROM ac_proposals WHERE id=$1 FOR UPDATE", [id(input.id)]))[0];
        if (!pr) fail(404, "Proposal not found.");
        if (!(pr.status === "specified" || (pr.status === "adapting" && new Date(pr.lease_until) <= new Date())))
          fail(409, "This proposal is not open for an adapter.");
        const lease = randomUUID();
        await q.query(
          "UPDATE ac_proposals SET status='adapting',adapter_by=$2,lease_token=$3,lease_until=now()+interval '2 hours',updated_at=now() WHERE id=$1",
          [pr.id, actor.id, lease],
        );
        await event(q, actor.id, "adapter_claimed", pr.slug);
        const returns = await rows(
          q,
          "SELECT number,source,reason,evidence,scope,method_sha256,returned_by,created_at FROM ac_proposal_returns WHERE proposal_id=$1 ORDER BY number",
          [pr.id],
        );
        const { lease_token: _, ...rest } = pr;
        return { ...rest, status: "adapting", lease_token: lease, lease_seconds: 7200, returns };
      }
      if (["submit_adapter", "fail_proposal", "release_proposal"].includes(action)) {
        const pr = (await rows(q, "SELECT * FROM ac_proposals WHERE id=$1 FOR UPDATE", [id(input.id)]))[0];
        if (!pr) fail(404, "Proposal not found.");
        if (pr.status !== "adapting" || pr.adapter_by !== actor.id || pr.lease_token !== input.lease_token || new Date(pr.lease_until) <= new Date())
          fail(409, "Adapter lease lost or expired. Claim the proposal again.");
        if (action === "release_proposal") {
          await q.query(
            "UPDATE ac_proposals SET status='specified',lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",
            [pr.id],
          );
          await event(q, actor.id, "adapter_released", pr.slug, str(input.reason, "reason", 1000));
          return { ok: true };
        }
        if (action === "fail_proposal")
          return returnProposal(q, pr, { ...returnFields(input), source: "adapter", by: actor.name, agent: actor.id });
        const src = input.method_py;
        const st = checkAdapter(src);
        if (!st.passed) fail(400, `Adapter failed static checks: ${st.problems.join(" ")}`);
        const sha = hash(src), rep = input.self_report, g = rep?.gate;
        if (
          !rep || rep.checker_version !== 1 || rep.slug !== pr.slug || rep.method_sha256 !== sha ||
          rep.static?.passed !== true || rep.passed !== true || g?.ran !== true ||
          g.testbed !== pr.idea.testbed || typeof g.passed !== "boolean" || !Number.isFinite(g.observed) ||
          typeof g.evaluator_hash !== "string" || !/^[0-9a-f]{40}$/.test(rep.synthcore_commit || "")
        )
          fail(400, "self_report must be the unmodified check_adapter.py output for this exact method.py, with a gate that ran.");
        await q.query(
          "UPDATE ac_proposals SET status='adapted',method_py=$2,method_sha256=$3,self_report=$4,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1",
          [pr.id, src, sha, JSON.stringify(rep)],
        );
        await event(q, actor.id, "adapter_submitted", pr.slug,
          `gate ${g.passed ? "passed" : "failed"} · ${g.quantity ?? ""} ${g.observed}`);
        return {
          id: pr.id,
          status: "adapted",
          method_sha256: sha,
          verification: "Self-reported check. A reviewer reads the code and reruns the check before admission; nobody else executes it until then.",
        };
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
        if (
          (
            await rows(
              q,
              "SELECT id FROM ac_jobs WHERE idea_id=$1 AND status='escalated' AND source_commit=$2",
              [spec.id, catalog.commit],
            )
          ).length
        )
          fail(
            409,
            "This idea escalated after repeated returns at the current pinned commit. Fix the plan or adapter through discussion; a new catalogue commit reopens it.",
          );
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
          (
            await rows(
              q,
              "SELECT 1 FROM ac_results WHERE job_id=$1 AND agent_id=$2 AND review_status<>'rejected'",
              [job.id, actor.id],
            )
          ).length
        )
          fail(
            409,
            "This test needs an independent runner. You already have a live result for it.",
          );
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
          returns: await listReturns(q, job.id),
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
        if (action === "fail_job")
          return returnUnit(q, job, {
            ...returnFields(input),
            source: "worker",
            verdict: "error",
            by: actor.name,
            agent: actor.id,
          });
        if (action === "release_job") {
          await q.query(
            "UPDATE ac_jobs SET status='queued',lease_token=NULL,lease_until=NULL WHERE id=$1",
            [job.id],
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
          "safe_but_incomplete",
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
        if (r.verdict === "safe_but_incomplete") {
          const c = r.stage2?.completion;
          if (r.verdict_rule_version !== 2 || !c?.applicable || !c.measured ||
              typeof c.source !== "string" ||
              ![c.method_mean, c.baseline_mean, c.mean_diff, c.margin].every(Number.isFinite) ||
              !Array.isArray(c.ci95) || c.ci95.length !== 2 || !c.ci95.every(Number.isFinite) ||
              c.ci95[0] > c.ci95[1])
            fail(400, "Completion-aware verdict requires version 2 and measured completion evidence.");
        }
        if (!isDeepStrictEqual(r.prediction, spec.prediction))
          fail(
            400,
            "Record prediction differs from the pinned idea specification.",
          );
        if (
          ["beats_baseline", "safe_but_incomplete", "mech_ok_no_win", "no_effect", "hurts"].includes(
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
        const partner = (
          await rows(
            q,
            "SELECT * FROM ac_results WHERE job_id=$1 AND agent_id<>$2 AND review_status IN ('submitted','awaiting_pair') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
            [job.id, actor.id],
          )
        )[0];
        const cmp = partner
          ? compareRuns(partner, {
              agent_id: actor.id,
              record: r,
              provenance: p,
              digest,
            })
          : null;
        const status = !cmp ? "awaiting_pair" : cmp.agree ? "replicated" : "disputed";
        await q.query(
          "INSERT INTO ac_results(id,job_id,agent_id,record,provenance,digest,review_status) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [result, job.id, actor.id, JSON.stringify(r), JSON.stringify(p), digest, status],
        );
        if (!cmp) {
          // First run: the test goes back to the queue for a different agent.
          await q.query(
            "UPDATE ac_jobs SET status='queued',claimed_by=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1",
            [job.id],
          );
          await event(q, actor.id, "result_submitted", job.id, `${r.verdict} · run 1 of 2`);
          return {
            id: result,
            status,
            digest,
            verification:
              "First of two runs. A different approved agent must run this test; a code node then compares the records.",
          };
        }
        await q.query(
          "UPDATE ac_results SET review_status=$2,reviewed_by=$3,reviewed_at=CASE WHEN $4 THEN now() ELSE NULL END WHERE id = ANY($1::uuid[])",
          [[partner.id, result], status, cmp.agree ? "agreement gate" : null, cmp.agree],
        );
        await q.query(
          "INSERT INTO ac_comparisons(id,job_id,result_a,result_b,agree,checks,identical_record) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [randomUUID(), job.id, partner.id, result, cmp.agree, JSON.stringify(cmp.checks), cmp.identical_record],
        );
        await q.query(
          "UPDATE ac_jobs SET status=$2,finished_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1",
          [job.id, status],
        );
        const failed = cmp.checks.filter((c) => !c.pass).map((c) => c.name);
        await event(
          q,
          actor.id,
          cmp.agree ? "test_replicated" : "test_disputed",
          job.id,
          cmp.agree ? `${r.verdict} · two runs agree` : `disagreement: ${failed.join(", ")}`,
        );
        return {
          id: result,
          status,
          digest,
          comparison: cmp,
          verification: cmp.agree
            ? "Two independent runs of the pinned method agree. This is reproducible execution, not remote attestation or independent science."
            : "The runs disagree. A reviewer resolves the dispute; rejecting one run returns the test for another attempt.",
        };
      }
      fail(400, "Unknown action.");
    });
  };
}
