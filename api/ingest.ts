import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticated, hostedStep } from "../server/hosted.js";
export const maxDuration = 60;
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST" && req.method !== "GET") {
    res.statusCode = 405;
    res.end("{}");
    return;
  }
  if (!authenticated(req.headers.authorization)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }
  try {
    const result = await hostedStep();
    res.statusCode = result.status === "error" ? 502 : 200;
    res.end(JSON.stringify(result));
  } catch {
    res.statusCode = 503;
    res.end(JSON.stringify({ error: "Hosted ingestion unavailable" }));
  }
}
