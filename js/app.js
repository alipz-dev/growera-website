(() => {
"use strict";

// =========================================================
// CONFIG
// =========================================================

const API_BASE_URL = "";
const API_PREFIX = "/api/growera";
const TOKEN_KEY = "growera_session_token";

// =========================================================
// DOM HELPERS
// =========================================================

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

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

// =========================================================
// PLAYER STATE
// =========================================================

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
    favoriteWorld: "",
    discord: "",
    instagram: "",
    birthdate: "",
    createdAt: 0,
    updatedAt: 0
};

// =========================================================
// HELPERS
// =========================================================

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

// =========================================================
// TOKEN STORAGE (localStorage 24h)
// =========================================================

function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY)
            || sessionStorage.getItem(TOKEN_KEY)
            || "";
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

// =========================================================
// TOAST
// =========================================================

function toast(message, type = "info", duration = 4000) {
    const container = $("#toastContainer");
    if (!container || !message) return;

    const icons = { success: "✓", error: "✕", info: "ℹ" };

    const el = document.createElement("div");
    el.className = `toast toast-${type}`;

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

// =========================================================
// FORM MESSAGE
// =========================================================

function setMessage(message, type = "error") {
    if (!formMessage) return;
    formMessage.textContent = message || "";
    if (message) formMessage.dataset.type = type;
    else delete formMessage.dataset.type;
}

// =========================================================
// BUSY STATE
// =========================================================

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

// =========================================================
// VIEW SWITCH
// =========================================================

function setLoginVisible() {
    isAuthenticated = false;
    loginView?.classList.remove("hidden");
    profileView?.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => usernameInput?.focus(), 150);
}

function setProfileVisible() {
    if (!isAuthenticated) return;
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

// =========================================================
// FOOTER YEAR
// =========================================================

function updateFooterYear() {
    const year = String(new Date().getFullYear());
    if ($("#year")) $("#year").textContent = year;
    if ($("#yearProfile")) $("#yearProfile").textContent = year;
}

// =========================================================
// API REQUEST
// =========================================================

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
            {
                ...options,
                headers,
                cache: "no-store",
                credentials: "same-origin"
            }
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
                status: response.status,
                url: response.url,
                body: rawText.slice(0, 2000)
            });
            throw new Error(
                `Respons server bukan JSON (HTTP ${response.status}).`
            );
        }
    }

    if (!response.ok) {
        const message =
            data?.message || data?.error ||
            `Permintaan gagal (HTTP ${response.status}).`;

        const error = new Error(String(message));
        error.status = response.status;
        error.data = data;
        error.isAuthError = response.status === 401;
        throw error;
    }

    return data;
}

// =========================================================
// NORMALIZE PLAYER
// =========================================================

function normalizePlayer(data) {
    const source =
        data?.player ||
        data?.data?.player ||
        data?.data?.user ||
        data?.user ||
        data?.data ||
        data;

    if (!source || typeof source !== "object") {
        throw new Error("Data pemain dari server tidak valid.");
    }

    const username = safeName(source.username || source.displayName || source.name);
    const displayName = safeName(source.displayName || source.username || source.name);

    const level = Math.max(1, toNumber(source.level, 1));
    const xp = Math.max(0, toNumber(source.xp, 0));
    const nextLevelXp = Math.max(1, toNumber(
        source.nextLevelXp ?? source.requiredXP ?? source.requiredXp ?? source.xpRequired,
        1
    ));

    const gems = Math.max(0, toNumber(source.gems, 0));
    const playtime = Math.max(0, toNumber(source.playtime, 0));
    const online = source.online === true;

    const role = String(source.role || "player").trim().toLowerCase() === "admin"
        ? "admin" : "player";

    return {
        username,
        displayName,
        role,
        level,
        xp,
        nextLevelXp,
        gems,
        playtime,
        online,
        bio: String(source.bio || "").trim(),
        avatarItemId: toNumber(source.avatarItemId, 0),
        country: String(source.country || "").trim().toUpperCase(),
        favoriteWorld: String(source.favoriteWorld || "").trim(),
        discord: String(source.discord || "").trim(),
        instagram: String(source.instagram || "").trim(),
        birthdate: String(source.birthdate || "").trim(),
        createdAt: toNumber(source.createdAt, 0),
        updatedAt: toNumber(source.updatedAt, 0)
    };
}

// =========================================================
// RENDER PROFILE
// =========================================================

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

function renderProfile() {
    const name = safeName(player.displayName || player.username);

    // Header
    if ($("#welcomeName")) $("#welcomeName").textContent = name;
    if ($("#profileName")) $("#profileName").textContent = name;

    if ($("#profileHandle")) {
        $("#profileHandle").textContent = "@" +
            String(player.username || name).toLowerCase()
                .replace(/[^a-z0-9_]/g, "").slice(0, 24);
    }

    // Avatar: pakai PNG kalau ada avatarItemId, kalau tidak pakai inisial
    const avatarEl = $("#avatarInitial");
    if (avatarEl) {
        avatarEl.replaceChildren();
        if (player.avatarItemId > 0) {
            const img = document.createElement("img");
            img.src = "https://api.gtps.cloud/api/item/texture/1791/" + player.avatarItemId;
            img.alt = name;
            img.loading = "eager";
            img.style.cssText = "width:100%;height:100%;object-fit:contain;image-rendering:pixelated;border-radius:50%";
            img.addEventListener("error", () => {
                avatarEl.textContent = name.charAt(0).toUpperCase();
            });
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    }

    // Role badge
    const roleBadge = $("#roleBadge");
    if (roleBadge) {
        roleBadge.classList.remove("role-admin", "role-player");
        if (player.role === "admin") {
            roleBadge.classList.add("role-admin");
            roleBadge.textContent = "✦ ADMIN";
        } else {
            roleBadge.classList.add("role-player");
            roleBadge.textContent = "✦ PLAYER";
        }
    }

    // Level & Gems
    if ($("#levelValue")) $("#levelValue").textContent = fmt(player.level);
    if ($("#gemsValue")) $("#gemsValue").textContent = fmt(player.gems);

    // XP
    const xp = Math.max(0, toNumber(player.xp));
    const next = Math.max(1, toNumber(player.nextLevelXp, 1));
    const percent = Math.min(100, Math.round((xp / next) * 100));

    if ($("#xpPercent")) $("#xpPercent").textContent = percent + "%";
    if ($("#xpFill")) $("#xpFill").style.width = percent + "%";
    if ($("#xpCurrent")) $("#xpCurrent").textContent = fmt(xp) + " XP";
    if ($("#xpNext")) $("#xpNext").textContent = fmt(next) + " XP";

    // Playtime
    if ($("#playtimeValue")) $("#playtimeValue").textContent = fmtPlaytime(player.playtime);

    // About Me
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

    setMetaValue("#countryValue", player.country);
    setMetaValue("#favoriteWorldValue", player.favoriteWorld);
    setMetaValue("#discordValue", player.discord);
    setMetaValue("#instagramValue", player.instagram ? "@" + player.instagram.replace(/^@/, "") : "");
    setMetaValue("#birthdateValue", fmtBirthdate(player.birthdate));
    setMetaValue("#memberSinceValue", fmtDateId(player.createdAt));

    // Member since badge
    const msBadge = $("#memberSinceBadge");
    if (msBadge) {
        if (player.createdAt > 0) msBadge.textContent = "📅 " + fmtDateId(player.createdAt);
        else msBadge.textContent = "NEW";
    }

    // Online indicator
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

    // Dataset untuk CSS
    document.documentElement.dataset.groweraRole = player.role;
}

// =========================================================
// LOGIN
// =========================================================

async function handleLogin(event) {
    event.preventDefault();
    if (isBusy) return;

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    if (!username || !password) {
        setMessage("Masukkan username dan password.", "error");
        return;
    }

    setBusy(true);
    setMessage("");

    try {
        clearToken();

        const result = await apiRequest("/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });

        const token =
            result?.token ||
            result?.accessToken ||
            result?.data?.token ||
            result?.data?.accessToken;

        saveToken(token);

        await loadCurrentPlayer();

        if (passwordInput) passwordInput.value = "";

        setMessage("");
        setProfileVisible();
        toast("Selamat datang, " + player.displayName + "!", "success");
    } catch (error) {
        clearToken();
        setLoginVisible();
        console.error("[GROWERA] Login gagal:", error);

        const msg = error.isAuthError
            ? "Username atau password salah."
            : (error.message || "Login gagal. Silakan coba lagi.");

        setMessage(msg, "error");
    } finally {
        setBusy(false);
    }
}

// =========================================================
// LOAD CURRENT PLAYER
// =========================================================

async function loadCurrentPlayer() {
    const token = getToken();
    if (!token) {
        const err = new Error("Sesi tidak ditemukan.");
        err.isAuthError = true;
        throw err;
    }

    const result = await apiRequest("/me", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
    });

    const normalized = normalizePlayer(result);
    Object.assign(player, normalized);
    isAuthenticated = true;

    return player;
}

// =========================================================
// REFRESH
// =========================================================

async function refreshProfile(silent = false) {
    if (isBusy) return;

    setProfileLoading(true);

    try {
        await loadCurrentPlayer();
        renderProfile();
        if (!silent) toast("Profil diperbarui.", "info", 2200);
    } catch (error) {
        console.error("[GROWERA] Refresh gagal:", error);
        if (error.isAuthError) {
            forceLogout("Sesi berakhir. Silakan login kembali.");
        } else if (!silent) {
            toast("Gagal refresh: " + error.message, "error");
        }
    } finally {
        setProfileLoading(false);
    }
}

// =========================================================
// LOGOUT
// =========================================================

function forceLogout(message) {
    clearToken();
    isAuthenticated = false;

    if (passwordInput) passwordInput.value = "";
    setMessage("");
    setLoginVisible();

    if (message) toast(message, "info");
}

async function handleLogout() {
    if (isBusy) return;

    const token = getToken();
    setBusy(true);

    try {
        if (token) {
            await apiRequest("/logout", {
                method: "POST",
                headers: { Authorization: "Bearer " + token }
            });
        }
    } catch (error) {
        console.warn("[GROWERA] Logout API gagal:", error);
    } finally {
        forceLogout("Kamu telah keluar.");
        setBusy(false);
    }
}

// =========================================================
// SESSION RESTORE
// =========================================================

async function restoreSession() {
    if (!getToken()) {
        setLoginVisible();
        return;
    }

    setBusy(true);

    try {
        await loadCurrentPlayer();
        setProfileVisible();
    } catch (error) {
        console.warn("[GROWERA] Sesi tidak dapat dipulihkan:", error);
        clearToken();
        setLoginVisible();
    } finally {
        setBusy(false);
    }
}

// =========================================================
// PASSWORD TOGGLE
// =========================================================

function wirePasswordToggle() {
    const btn = $("#passwordToggle");
    if (!btn || !passwordInput) return;

    const eyeOpen = btn.querySelector(".eye-open");
    const eyeClosed = btn.querySelector(".eye-closed");

    btn.addEventListener("click", () => {
        const show = passwordInput.type === "password";
        passwordInput.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", String(show));
        btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        if (eyeOpen) eyeOpen.classList.toggle("hidden", show);
        if (eyeClosed) eyeClosed.classList.toggle("hidden", !show);
        passwordInput.focus();
    });
}

// =========================================================
// CAPS LOCK DETECTION
// =========================================================

function wireCapsLock() {
    const warn = $("#capsLockWarning");
    if (!warn) return;

    function check(e) {
        if (typeof e.getModifierState !== "function") return;
        const on = e.getModifierState("CapsLock");
        warn.classList.toggle("show", Boolean(on));
    }

    document.addEventListener("keydown", check);
    document.addEventListener("keyup", check);
}

// =========================================================
// AUTOFOCUS
// =========================================================

function wireAutofocus() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;

    if (!loginView?.classList.contains("hidden")) {
        setTimeout(() => usernameInput?.focus(), 200);
    }
}

// =========================================================
// EVENTS
// =========================================================

loginForm?.addEventListener("submit", handleLogin);
$("#logoutButton")?.addEventListener("click", handleLogout);
$("#refreshButton")?.addEventListener("click", () => refreshProfile(false));

$("#editPreviewButton")?.addEventListener("click", () => {
    toast("Edit profile akan aktif di Sprint berikutnya.", "info");
});

$("#exploreButton")?.addEventListener("click", () => {
    $("#editPreviewButton")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

// =========================================================
// INIT
// =========================================================

updateFooterYear();
wirePasswordToggle();
wireCapsLock();
wireAutofocus();
restoreSession();

})();
