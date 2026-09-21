import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "qa", "v2-review");
await mkdir(root, { recursive: true });

const server = createServer(async (request, response) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type, x-qa-name");
  response.setHeader("access-control-allow-methods", "POST, OPTIONS");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405);
    response.end("method");
    return;
  }
  const name = basename(String(request.headers["x-qa-name"] || "file.bin").replace(/[^\w.\-]+/g, "-"));
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  await writeFile(join(root, name), buffer);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, name, bytes: buffer.length }));
});

server.listen(8791, "127.0.0.1", () => {
  console.log("qa-ingest-ready 8791");
});
