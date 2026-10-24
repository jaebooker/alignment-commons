import { database } from "../lib/db.mjs";
import { createService } from "../lib/service.mjs";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    if (!["GET", "POST"].includes(req.method)) {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed." });
    }
    const action = req.method === "GET" ? req.query.action : req.body?.action;
    if (
      req.method === "GET" &&
      !["catalog", "projects", "overview", "activity"].includes(action)
    )
      return res
        .status(405)
        .json({ error: "Use POST for authenticated actions." });
    if (
      req.method === "POST" &&
      !String(req.headers["content-type"] || "").includes("application/json")
    )
      return res.status(415).json({ error: "Use application/json." });
    if (Buffer.byteLength(JSON.stringify(req.body || {})) > 2000000)
      return res.status(413).json({ error: "Request too large." });
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const service = createService(
      ["catalog", "projects"].includes(action) ? null : database(),
    );
    const data = await service(
      action,
      req.method === "POST" ? req.body.input || {} : action === "activity" ? {before:req.query.before,agent:req.query.agent} : {},
      token,
      req.headers["x-vercel-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown",
    );
    return res.status(200).json({ data });
  } catch (e) {
    if (!e.status) console.error("Commons request failed", e.code || e.name);
    return res.status(e.status || 500).json({
      error: e.status ? e.message : "Workspace request failed. Please retry.",
    });
  }
}
