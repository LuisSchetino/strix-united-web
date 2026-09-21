import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export default async function saveV2Mp4s(page) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "qa", "v2-review");
  await mkdir(root, { recursive: true });
  await page.goto("http://localhost:5173/visual-v2-encode.html?v=v12", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__STRIX_V2_MP4_QA__?.ready === true, { timeout: 420000 });
  const names = await page.evaluate(() => window.__STRIX_V2_MP4_QA__.names || []);
  const saved = [];
  for (const name of names) {
    const buffer = await page.evaluate(async (id) => {
      const blob = window.__STRIX_V2_MP4_QA__.blobs[id];
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      const chunk = 0x8000;
      for (let index = 0; index < bytes.length; index += chunk) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
      }
      return btoa(binary);
    }, name);
    const file = join(root, `${name}.mp4`);
    await writeFile(file, Buffer.from(buffer, "base64"));
    saved.push({ name, bytes: Buffer.from(buffer, "base64").length });
  }
  return saved;
}
