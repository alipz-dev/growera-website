/* =========================================
   GROWERA — TEXTURE DOWNLOADER
   Download semua item texture dari GTPS API
   ke folder assets/itemimage/{id}.png

   Cara pakai:
     node scripts/download-textures.js

   Opsi (env):
     CONCURRENCY=8    jumlah paralel
     DELAY_MS=50      delay antar request
     FORCE=1          paksa download ulang
     LIMIT=500        batasi jumlah (buat tes)
========================================= */

const fs   = require("fs");
const path = require("path");

/* ====== KONFIG ====== */

const ROOT        = path.join(__dirname, "..");
const ITEM_DB     = path.join(ROOT, "data", "itemregister.json");
const OUTPUT_DIR  = path.join(ROOT, "assets", "itemimage");
const API_BASE    = "https://api.gtps.cloud/api/item/texture";

const CONCURRENCY = parseInt(process.env.CONCURRENCY || "8", 10);
const DELAY_MS    = parseInt(process.env.DELAY_MS    || "50", 10);
const RETRY_MAX   = 3;
const FORCE       = process.env.FORCE === "1";
const LIMIT       = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;

/* ====== UTIL ====== */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p) {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}

function logProgress(done, total, ok, skip, fail) {
    const pct   = ((done / total) * 100).toFixed(1);
    const barLen = 30;
    const filled = Math.round((done / total) * barLen);
    const bar    = "█".repeat(filled) + "░".repeat(barLen - filled);
    process.stdout.write(
        `\r[${bar}] ${done}/${total} (${pct}%)  ✅${ok}  ⏭${skip}  ❌${fail}   `
    );
}

/* ====== FETCH + RETRY ====== */

async function fetchTexture(id) {
    const url = `${API_BASE}/${id}/`;

    for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "GroweraTextureDownloader/1.0",
                    "Accept": "image/png,image/*,*/*"
                }
            });

            if (!res.ok) {
                if (res.status === 404) return null; // item tidak punya texture
                throw new Error("HTTP " + res.status);
            }

            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 20) return null; // file terlalu kecil, kemungkinan error
            return buf;

        } catch (err) {
            if (attempt === RETRY_MAX) {
                throw new Error(`ID ${id}: ${err.message}`);
            }
            await sleep(300 * attempt);
        }
    }
    return null;
}

/* ====== MAIN ====== */

async function main() {
    console.log("=================================================");
    console.log(" GROWERA — Item Texture Downloader");
    console.log("=================================================");
    console.log(" DB       :", ITEM_DB);
    console.log(" Output   :", OUTPUT_DIR);
    console.log(" API      :", API_BASE);
    console.log(" Concurrency:", CONCURRENCY, "| Delay:", DELAY_MS + "ms");
    console.log(" Force    :", FORCE ? "YA (overwrite)" : "tidak (skip existing)");
    if (LIMIT) console.log(" Limit    :", LIMIT, "item (tes)");
    console.log("=================================================\n");

    if (!fs.existsSync(ITEM_DB)) {
        console.error("❌ File tidak ditemukan:", ITEM_DB);
        process.exit(1);
    }

    const json  = JSON.parse(fs.readFileSync(ITEM_DB, "utf8"));
    const items = Array.isArray(json.items) ? json.items : [];
    if (!items.length) {
        console.error("❌ Tidak ada item di dalam JSON.");
        process.exit(1);
    }

    let ids = items
        .map((it) => it && typeof it.id === "number" ? it.id : null)
        .filter((id) => id !== null && id >= 0);

    if (LIMIT) ids = ids.slice(0, LIMIT);

    ensureDir(OUTPUT_DIR);

    const total = ids.length;
    let done = 0, ok = 0, skip = 0, fail = 0;
    const failedIds = [];

    logProgress(done, total, ok, skip, fail);

    // Worker pool
    let cursor = 0;
    async function worker() {
        while (true) {
            const idx = cursor++;
            if (idx >= ids.length) return;

            const id  = ids[idx];
            const out = path.join(OUTPUT_DIR, `${id}.png`);

            // Skip kalau sudah ada
            if (!FORCE && fileExists(out)) {
                skip++; done++;
                logProgress(done, total, ok, skip, fail);
                continue;
            }

            try {
                const buf = await fetchTexture(id);
                if (buf) {
                    fs.writeFileSync(out, buf);
                    ok++;
                } else {
                    skip++; // tidak ada texture
                }
            } catch (err) {
                fail++;
                failedIds.push(id);
                // Log error ke baris baru biar tidak numpuk
                process.stdout.write("\n⚠️  " + err.message + "\n");
            }

            done++;
            logProgress(done, total, ok, skip, fail);

            if (DELAY_MS > 0) await sleep(DELAY_MS);
        }
    }

    const workers = [];
    for (let i = 0; i < CONCURRENCY; i++) workers.push(worker());
    await Promise.all(workers);

    console.log("\n");
    console.log("=================================================");
    console.log(" SELESAI");
    console.log("=================================================");
    console.log(" Total ID    :", total);
    console.log(" ✅ Downloaded:", ok);
    console.log(" ⏭  Skipped   :", skip, "(sudah ada / tidak punya texture)");
    console.log(" ❌ Failed    :", fail);
    console.log(" Output dir  :", OUTPUT_DIR);
    if (failedIds.length) {
        console.log(" Failed IDs  :", failedIds.slice(0, 50).join(", "),
                    failedIds.length > 50 ? "..." : "");
    }
    console.log("=================================================");
}

main().catch((err) => {
    console.error("\n💥 Fatal:", err);
    process.exit(1);
});