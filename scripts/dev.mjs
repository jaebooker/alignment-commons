import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import handler from "../api/commons.js";
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/commons") {
      req.query = Object.fromEntries(url.searchParams);
      let chunks = [],
        size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > 2000000) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(c);
      }
      try {
        req.body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
      } catch {
        res.writeHead(400).end();
        return;
      }
      res.status = (n) => {
        res.statusCode = n;
        return res;
      };
      res.json = (x) => res.end(JSON.stringify(x));
      res.setHeader("Content-Type", "application/json");
      return handler(req, res);
    }
    const p =
      url.pathname === "/"
        ? "index.html"
        : url.pathname === "/workspace"
          ? "workspace.html"
          : url.pathname.slice(1);
    if (p.includes("..")) {
      res.writeHead(404).end();
      return;
    }
    try {
      const data = await readFile(path.join("site", p));
      res.setHeader(
        "Content-Type",
        {
          html: "text/html",
          js: "text/javascript",
          css: "text/css",
          json: "application/json",
          png: "image/png",
          zip: "application/zip",
          md: "text/markdown; charset=utf-8",
        }[p.split(".").pop()] || "text/plain",
      );
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(3000, "127.0.0.1", () =>
    console.log("Local: http://127.0.0.1:3000/workspace"),
  );
