import fs from "node:fs/promises";
import path from "node:path";

const SERVER_ID = process.env.GT_SERVER_ID || "1791";
const TEMPLATE = process.env.TEXTURE_URL_TEMPLATE ||
  "https://api.gtps.cloud/api/item/texture/{serverId}/{itemId}";
const OUT = path.resolve("assets/items");
const IDS_FILE = path.resolve("data/item-ids.txt");
const MANIFEST_FILE = path.join(OUT, "manifest.json");
const DELAY = Number(process.env.REQUEST_DELAY_MS || 750);
const MAX_BYTES = Number(process.env.MAX_IMAGE_BYTES || 5000000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function imageExtension(type, b) {
  type = (type || "").split(";")[0].trim().toLowerCase();
  if (type === "image/png" || (b[0] === 137 && b.toString("ascii", 1, 4) === "PNG")) return "png";
  if (type === "image/jpeg" || (b[0] === 255 && b[1] === 216 && b[2] === 255)) return "jpg";
  if (type === "image/webp" || (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")) return "webp";
  if (type === "image/gif" || b.toString("ascii", 0, 3) === "GIF") return "gif";
  return null;
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const raw = await fs.readFile(IDS_FILE, "utf8");
  const ids = [...new Set(raw.split(/\r?\n/).map(s => s.trim()).filter(s => /^\d+$/.test(s)))];
  if (!ids.length) {
    console.log("No IDs found. Add one numeric item ID per line to data/item-ids.txt.");
    return;
  }

  let manifest = {};
  try { manifest = JSON.parse(await fs.readFile(MANIFEST_FILE, "utf8")); } catch {}
  let downloaded = 0, skipped = 0, failed = 0;

  for (const id of ids) {
    try {
      const url = TEMPLATE.replaceAll("{serverId}", encodeURIComponent(SERVER_ID))
                          .replaceAll("{itemId}", encodeURIComponent(id));
      const res = await fetch(url, {
        headers: { "User-Agent": "GROWERA-texture-collector/1.0" },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const len = Number(res.headers.get("content-length") || 0);
      if (len > MAX_BYTES) throw new Error("response exceeds size limit");
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BYTES) throw new Error("empty or oversized response");
      const ext = imageExtension(res.headers.get("content-type"), bytes);
      if (!ext) throw new Error("response is not a recognized PNG/JPEG/WebP/GIF image");

      const filename = `${id}.${ext}`;
      const target = path.join(OUT, filename);
      if (manifest[id]?.file === filename) {
        try { await fs.access(target); skipped++; await sleep(DELAY); continue; } catch {}
      }
      await fs.writeFile(target, bytes);
      manifest[id] = { file: filename, contentType: res.headers.get("content-type") || `image/${ext}`, bytes: bytes.length };
      console.log(`[${id}] saved ${filename}`);
      downloaded++;
    } catch (e) {
      console.warn(`[${id}] skipped: ${e.message}`);
      failed++;
    }
    await sleep(DELAY);
  }
  await fs.writeFile(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Finished: ${downloaded} downloaded, ${skipped} already present, ${failed} failed.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
