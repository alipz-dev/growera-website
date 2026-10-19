// js/core.js
// Shared utilities untuk login.js dan profile.js
// ES Module — pakai `import` di file lain

export const API_BASE_URL = "";
export const API_PREFIX = "/api/growera";
export const TOKEN_KEY = "growera_session_token";
export const GTPS_SERVER_ID = "1791";
export const ACHIEVEMENTS_JSON_URL = "data/achievements.json";
export const ITEMS_JSON_URL = "data/items.json";

/* ===== Token ===== */
export function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ""; }
    catch { return ""; }
}

export function saveToken(token) {
    if (typeof token !== "string" || !token.trim()) throw new Error("Server tidak memberikan token sesi.");
    try {
        localStorage.setItem(TOKEN_KEY, token);
        try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    } catch { throw new Error("Browser tidak dapat menyimpan sesi."); }
}

export function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}

/* ===== API Request ===== */
export async function apiRequest(path, options = {}) {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
        throw new Error("Path API tidak valid.");
    }
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
        response = await fetch(
            API_BASE_URL.replace(/\/+$/, "") + API_PREFIX + path,
            { ...options, headers, cache: "no-store", credentials: "same-origin" });
    } catch (error) {
        const ne = new Error("Tidak dapat terhubung ke server. Periksa koneksi dan server Lua.");
        ne.cause = error; throw ne;
    }

    const rawText = await response.text();
    let data = {};
    if (rawText) {
        try { data = JSON.parse(rawText); }
        catch {
            console.error("[GROWERA] Respons bukan JSON:", { status: response.status, url: response.url, body: rawText.slice(0, 2000) });
            throw new Error("Respons server bukan JSON (HTTP " + response.status + ").");
        }
    }
    if (!response.ok) {
        const message = data?.message || data?.error || ("Permintaan gagal (HTTP " + response.status + ").");
        const error = new Error(String(message));
        error.status = response.status;
        error.data = data;
        error.isAuthError = response.status === 401;
        throw error;
    }
    return data;
}

/* ===== Toast ===== */
export function toast(message, type = "info", duration = 4000) {
    const container = document.querySelector("#toastContainer");
    if (!container || !message) return;
    const icons = { success: "✓", error: "✕", info: "ℹ" };
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = icons[type] || "ℹ";
    const body = document.createElement("div");
    body.className = "toast-body";
    body.textContent = String(message);
    el.appendChild(icon); el.appendChild(body);
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, duration);
}

/* ===== Helpers ===== */
export function safeName(v) { return String(v ?? "Player").trim().slice(0, 32) || "Player"; }
export function toNumber(v, f = 0) { const n = Number(v); return Number.isFinite(n) ? n : f; }
export function fmt(v) { return Math.max(0, toNumber(v)).toLocaleString("en-US"); }

export function fmtDateId(unixSec) {
    const n = toNumber(unixSec);
    if (n <= 0) return "—";
    try { return new Date(n * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return "—"; }
}

export function fmtBirthdate(str) {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return str || "";
    try {
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch { return str; }
}

export function fmtPlaytime(seconds) {
    const s = Math.floor(toNumber(seconds));
    if (s <= 0) return "—";
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(d + "d");
    if (h > 0) parts.push(h + "h");
    if (m > 0 && d === 0) parts.push(m + "m");
    return parts.length ? parts.join(" ") : "< 1m";
}

export function avatarUrl(id) { return "https://api.gtps.cloud/api/item/texture/" + GTPS_SERVER_ID + "/" + id + "/"; }
export function flagUrl(code) { return (!code || code.length !== 2) ? "" : "https://flagcdn.com/w40/" + code.toLowerCase() + ".png"; }

export function dayKeyFromDate(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

export function generateDayRange(daysBack) {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = daysBack - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        result.push({ dayKey: dayKeyFromDate(d), date: d });
    }
    return result;
}

/* ===== Master Data Cache (achievements.json + items.json) ===== */
let achMasterCache = null;
let achMasterPromise = null;
let itemsMasterCache = null;
let itemsMasterPromise = null;
let itemsMapCache = null;

export async function getAchievementsMaster() {
    if (achMasterCache !== null) return achMasterCache;
    if (achMasterPromise) return achMasterPromise;
    achMasterPromise = (async () => {
        try {
            const res = await fetch(ACHIEVEMENTS_JSON_URL, { cache: "default", credentials: "same-origin" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error("Invalid format");
            achMasterCache = data;
            return data;
        } catch (e) {
            console.error("[GROWERA] Fetch achievements.json gagal:", e);
            achMasterPromise = null;
            throw e;
        }
    })();
    return achMasterPromise;
}

export async function getItemsMaster() {
    if (itemsMasterCache !== null) return itemsMasterCache;
    if (itemsMasterPromise) return itemsMasterPromise;
    itemsMasterPromise = (async () => {
        try {
            const res = await fetch(ITEMS_JSON_URL, { cache: "default", credentials: "same-origin" });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error("Invalid format");
            itemsMasterCache = data;
            itemsMapCache = {};
            data.forEach((it) => {
                const id = Number(it.id) || 0;
                if (id > 0) itemsMapCache[id] = String(it.name || "");
            });
            return data;
        } catch (e) {
            console.error("[GROWERA] Fetch items.json gagal:", e);
            itemsMapCache = {};
            itemsMasterPromise = null;
            throw e;
        }
    })();
    return itemsMasterPromise;
}

export function resolveItemName(id) {
    if (!itemsMapCache) return "Item #" + id;
    const name = itemsMapCache[id];
    return (name && name.trim()) ? name : ("Item #" + id);
}
