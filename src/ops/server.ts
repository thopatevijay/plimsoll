import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { statePath } from "../util/io.js";

// Minimal read-only HTTP endpoint exposing the agent's LIVE snapshot, so the
// dashboard (hosted separately on Vercel) can fetch real state instead of the
// bundled sample. Serves the per-cycle snapshot.json with permissive CORS.
//
// Binds to $PORT (Railway injects it and routes the public domain there). Started
// only from the continuous runner — never the one-shot tracer, which must exit.
export function startSnapshotServer(): void {
  const port = Number(process.env.PORT) || 8080;
  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    const path = statePath("snapshot.json");
    if (!existsSync(path)) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "no snapshot yet — agent still warming up" }));
      return;
    }
    try {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(readFileSync(path, "utf8"));
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  });
  // A server failure must never take down the trade loop — log and continue.
  server.on("error", (e) => console.log(`[server] snapshot endpoint error (non-fatal): ${e.message}`));
  server.listen(port, () => console.log(`[server] live snapshot endpoint on :${port}`));
}
