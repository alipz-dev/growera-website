(() => {
"use strict";

const API_BASE_URL = "";
const API_PREFIX = "/api/growera";
const TOKEN_KEY = "growera_session_token";
const GTPS_SERVER_ID = "1791";

const $ = (s) => document.querySelector(s);

const loginView = $("#loginView");
const profileView = $("#profileView");
const loginForm = $("#loginForm");
const formMessage = $("#formMessage");
const editDialog = $("#editDialog");
const loginButton = $("#loginButton");
const usernameInput = $("#username");
const passwordInput = $("#password");

let isAuthenticated = false;
let isBusy = false;
let isSavingEdit = false;

const player = {
    username: "Player",
    displayName: "Player",
    role: "player",
    level: 1,
    xp: 0,
    nextLevelXp: 1,
    gems: 0,
    playtime: 0,
    online: false,
    bio: "",
    avatarItemId: 0,
    country: "",
    discordId: "",
    discordUsername: "",
    birthdate: "",
    createdAt: 0,
    updatedAt: 0
};

/* ===== Helpers ===== */

function safeName(v) {
    return String(v ?? "Player").trim().slice(0, 32) || "Player";
}

function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function fmt(v) {
    return Math.max(0, toNumber(v)).toLocaleString("en-US");
}

function fmtDateId(unixSec) {
    const n = toNumber(unixSec);
    if (n <= 0) return "—";
    try {
        return new Date(n * 1000).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric"
        });
    } catch { return "—"; }
}

function fmtBirthdate(str) {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return str || "";
    try {
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric"
        });
    } catch { return str; }
}

function fmtPlaytime(seconds) {
    const s = Math.floor(toNumber(seconds));
    if (s <= 0) return "—";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(d + "d");
    if (h > 0) parts.push(h + "h");
    if (m > 0 && d === 0) parts.push(m + "m");
    return parts.length ? parts.join(" ") : "< 1m";
}

function avatarUrl(id) {
    return "https://api.gtps.cloud/api/item/texture/" + GTPS_SERVER_ID + "/" + id + "/";
}

function flagUrl(code) {
    if (!code || code.length !== 2) return "";
    return "https://flagcdn.com/w40/" + code.toLowerCase() + ".png";
}

/* ===== Token ===== */

function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || "";
    } catch { return ""; }
}

function saveToken(token) {
    if (typeof token !== "string" || !token.trim()) {
        throw new Error("Server tidak memberikan token sesi.");
    }
    try {
        localStorage.setItem(TOKEN_KEY, token);
        try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
    } catch {
        throw new Error("Browser tidak dapat menyimpan sesi.");
    }
}

function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch {}
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}

/* ===== Toast ===== */

function toast(message, type = "info", duration = 4000) {
    const container = $("#toastContainer");
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

    el.appendChild(icon);
    el.appendChild(body);
    container.appendChild(el);

    requestAnimationFrame(() => el.classList.add("show"));

    setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => el.remove(), 300);
    }, duration);
}

/* ===== Messages ===== */

function setMessage(message, type = "error") {
    if (!formMessage) return;
    formMessage.textContent = message || "";
    if (message) formMessage.dataset.type = type;
    else delete formMessage.dataset.type;
}

function setEditError(message) {
    const el = $("#editError");
    if (!el) return;
    if (message) {
        el.textContent = message;
        el.classList.add("show");
    } else {
        el.textContent = "";
        el.classList.remove("show");
    }
}

/* ===== Busy ===== */

function setBusy(busy) {
    isBusy = Boolean(busy);
    if (loginButton) {
        loginButton.disabled = isBusy;
        loginButton.setAttribute("aria-busy", String(isBusy));
        const label = loginButton.querySelector(".btn-label");
        if (label) label.textContent = isBusy ? "SIGNING IN" : "SIGN IN";
    }
    if (loginForm) loginForm.setAttribute("aria-busy", String(isBusy));
}

function setSavingEdit(saving) {
    isSavingEdit = Boolean(saving);
    const btn = $("#editSaveBtn");
    if (!btn) return;
    btn.disabled = isSavingEdit;
    btn.setAttribute("aria-busy", String(isSavingEdit));
    const label = btn.querySelector(".btn-label");
    if (label) label.textContent = isSavingEdit ? "SAVING" : "SAVE CHANGES";
    const cancel = $("#editCancelBtn");
    if (cancel) cancel.disabled = isSavingEdit;
}

/* ===== View ===== */

function setLoginVisible() {
    isAuthenticated = false;
    document.documentElement.setAttribute("data-auth", "out");
    loginView?.classList.remove("hidden");
    profileView?.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => usernameInput?.focus(), 150);
}

function setProfileVisible() {
    if (!isAuthenticated) return;
    document.documentElement.setAttribute("data-auth", "in");
    renderProfile();
    loginView?.classList.add("hidden");
    profileView?.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function setProfileLoading(loading) {
    if (!profileView) return;
    profileView.classList.toggle("is-loading", Boolean(loading));
    const btn = $("#refreshButton");
    if (btn) btn.classList.toggle("is-loading", Boolean(loading));
}

function updateFooterYear() {
    const year = String(new Date().getFullYear());
    if ($("#year")) $("#year").textContent = year;
    if ($("#yearProfile")) $("#yearProfile").textContent = year;
}

/* ===== API ===== */

async function apiRequest(path, options = {}) {
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
        throw new Error("Path API tidak valid.");
    }

    const headers = {
        Accept: "application/json",
        ...(options.headers || {})
    };

    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let response;
    try {
        response = await fetch(
            API_BASE_URL.replace(/\/+$/, "") + API_PREFIX + path,
            { ...options, headers, cache: "no-store", credentials: "same-origin" }
        );
    } catch (error) {
        const networkError = new Error(
            "Tidak dapat terhubung ke server. Periksa koneksi dan server Lua."
        );
        networkError.cause = error;
        throw networkError;
    }

    const rawText = await response.text();

    let data = {};
    if (rawText) {
        try {
            data = JSON.parse(rawText);
        } catch {
            console.error("[GROWERA] Respons bukan JSON:", {
                status: response.status, url: response.url,
                body: rawText.slice(0, 2000)
            });
            throw new Error("Respons server bukan JSON (HTTP " + response.status + ").");
        }
    }

    if (!response.ok) {
        const message = data?.message || data?.error ||
            ("Permintaan gagal (HTTP " + response.status + ").");
        const error = new Error(String(message));
        error.status = response.status;
        error.data = data;
        error.isAuthError = response.status === 401;
        throw error;
    }

    return data;
}

/* ===== Normalize ===== */

function normalizePlayer(data) {
    const source =
        data?.player || data?.data?.player || data?.data?.user ||
        data?.user || data?.data || data;

    if (!source || typeof source !== "object") {
        throw new Error("Data pemain dari server tidak valid.");
    }

    const username = safeName(source.username || source.name);

    return {
        username,
        displayName: username,
        role: String(source.role || "player").trim().toLowerCase() === "admin"
            ? "admin" : "player",
        level: Math.max(1, toNumber(source.level, 1)),
        xp: Math.max(0, toNumber(source.xp, 0)),
        nextLevelXp: Math.max(1, toNumber(
            source.nextLevelXp ?? source.requiredXP ?? source.requiredXp ?? source.xpRequired, 1
        )),
        gems: Math.max(0, toNumber(source.gems, 0)),
        playtime: Math.max(0, toNumber(source.playtime, 0)),
        online: source.online === true,
        bio: String(source.bio || "").trim(),
        avatarItemId: toNumber(source.avatarItemId, 0),
        country: String(source.country || "").trim().toUpperCase(),
        discordId: String(source.discordId || "").trim(),
        discordUsername: String(source.discordUsername || "").trim(),
        birthdate: String(source.birthdate || "").trim(),
        createdAt: toNumber(source.createdAt, 0),
        updatedAt: toNumber(source.updatedAt, 0)
    };
}

/* ===== Render ===== */

function setMetaValue(id, value, emptyText = "—") {
    const el = $(id);
    const item = el?.closest(".meta-item");
    if (!el) return;
    if (value === undefined || value === null || String(value).trim() === "") {
        el.textContent = emptyText;
        if (item) item.classList.add("is-empty");
    } else {
        el.textContent = String(value);
        if (item) item.classList.remove("is-empty");
    }
}

function setCountryValue(code) {
    const el = $("#countryValue");
    const item = el?.closest(".meta-item");
    if (!el) return;

    el.replaceChildren();

    if (!code || !/^[A-Z]{2}$/.test(code)) {
        el.textContent = "—";
        if (item) item.classList.add("is-empty");
        return;
    }

    if (item) item.classList.remove("is-empty");

    const img = document.createElement("img");
    img.src = flagUrl(code);
    img.alt = code;
    img.loading = "lazy";
    img.style.cssText =
        "display:inline-block;vertical-align:-2px;margin-right:7px;" +
        "border-radius:3px;box-shadow:0 0 0 1px #ffffff1f;width:20px;height:auto";

    img.addEventListener("error", () => {
        img.remove();
    }, { once: true });

    el.appendChild(img);
    el.appendChild(document.createTextNode(code));
}

function renderProfile() {
    const name = safeName(player.username);

    if ($("#welcomeName")) $("#welcomeName").textContent = name;
    if ($("#profileName")) $("#profileName").textContent = name;

    if ($("#profileHandle")) {
        $("#profileHandle").textContent = "@" +
            name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    }

    const avatarEl = $("#avatarInitial");
    if (avatarEl) {
        avatarEl.replaceChildren();
        if (player.avatarItemId > 0) {
            const img = document.createElement("img");
            img.src = avatarUrl(player.avatarItemId);
            img.alt = name;
            img.addEventListener("error", () => {
                avatarEl.textContent = name.charAt(0).toUpperCase();
            });
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    }

    const roleBadge = $("#roleBadge");
    if (roleBadge) {
        roleBadge.classList.remove("role-admin", "role-player");
        if (player.role === "admin") {
            roleBadge.classList.add("role-admin");
            roleBadge.textContent = "ADMIN";
        } else {
            roleBadge.classList.add("role-player");
            roleBadge.textContent = "PLAYER";
        }
    }

    if ($("#levelValue")) $("#levelValue").textContent = fmt(player.level);
    if ($("#gemsValue")) $("#gemsValue").textContent = fmt(player.gems);

    const xp = Math.max(0, toNumber(player.xp));
    const next = Math.max(1, toNumber(player.nextLevelXp, 1));
    const percent = Math.min(100, Math.round((xp / next) * 100));

    if ($("#xpPercent")) $("#xpPercent").textContent = percent + "%";
    if ($("#xpFill")) $("#xpFill").style.width = percent + "%";
    if ($("#xpCurrent")) $("#xpCurrent").textContent = fmt(xp) + " XP";
    if ($("#xpNext")) $("#xpNext").textContent = fmt(next) + " XP";

    if ($("#playtimeValue")) $("#playtimeValue").textContent = fmtPlaytime(player.playtime);

    const bio = $("#bioValue");
    if (bio) {
        if (player.bio) {
            bio.textContent = player.bio;
            bio.classList.remove("is-empty");
        } else {
            bio.textContent = "Belum ada bio.";
            bio.classList.add("is-empty");
        }
    }

    setCountryValue(player.country);
    setMetaValue("#birthdateValue", fmtBirthdate(player.birthdate));
    setMetaValue("#discordValue", player.discordUsername ? "@" + player.discordUsername : "");
    setMetaValue("#memberSinceValue", fmtDateId(player.createdAt));

    const msBadge = $("#memberSinceBadge");
    if (msBadge) {
        msBadge.textContent = player.createdAt > 0 ? fmtDateId(player.createdAt) : "NEW";
    }

    const pill = $("#onlinePill");
    const onlineText = $("#onlineText");
    if (pill && onlineText) {
        if (player.online) {
            pill.classList.add("is-online");
            onlineText.textContent = "ONLINE";
        } else {
            pill.classList.remove("is-online");
            onlineText.textContent = "OFFLINE";
        }
    }

    document.documentElement.dataset.groweraRole = player.role;

    renderDiscordState();
}

/* ===== Stat Cards Prefetch ===== */

let cardPrefetched = false;

function resetStatCardValues() {
    const ach = $("#statAchValue");
    const fr = $("#statFriendsValue");
    const gd = $("#statGuildValue");
    if (ach) ach.textContent = "—";
    if (fr) fr.textContent = "—";
    if (gd) gd.textContent = "—";
}

async function prefetchCardStats() {
    if (cardPrefetched) return;

    const token = getToken();
    if (!token) return;

    cardPrefetched = true;

    const headers = { Authorization: "Bearer " + token };

    const [achRes, frRes, gdRes] = await Promise.allSettled([
        apiRequest("/achievements", { method: "GET", headers }),
        apiRequest("/friends", { method: "GET", headers }),
        apiRequest("/guild", { method: "GET", headers })
    ]);

    if (achRes.status === "fulfilled") {
        const r = achRes.value;
        const achievements = r?.achievements || [];
        const total = r?.total || achievements.length;
        const unlocked = r?.unlocked || achievements.filter((a) => a.unlocked).length;
        const el = $("#statAchValue");
        if (el) el.textContent = total > 0 ? (unlocked + "/" + total) : "0/0";
    } else {
        console.warn("[GROWERA] Prefetch achievements gagal:", achRes.reason);
    }

    if (frRes.status === "fulfilled") {
        const list = frRes.value?.friends || [];
        const el = $("#statFriendsValue");
        if (el) el.textContent = String(list.length);
    } else {
        console.warn("[GROWERA] Prefetch friends gagal:", frRes.reason);
    }

    if (gdRes.status === "fulfilled") {
        const guild = gdRes.value?.guild || { id: 0 };
        const el = $("#statGuildValue");
        if (el) {
            if (!guild.id || guild.id <= 0
