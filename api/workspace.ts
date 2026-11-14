import type { IncomingMessage, ServerResponse } from "node:http";
import { hostedWorkspace } from "../server/hosted.js";
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }
  const result = await hostedWorkspace();
  res.statusCode = result.state === "error" ? 503 : 200;
  res.end(JSON.stringify(result));
}
