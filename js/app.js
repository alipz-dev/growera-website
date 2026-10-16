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

    setMetaValue("#countryValue", player.country);
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

/* ===== Auto-detect Country ===== */

async function detectCountry() {
    try {
        const res = await fetch("https://ipwho.is/", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.success === false) return null;
        const code = String(data.country_code || "").toUpperCase();
        return /^[A-Z]{2}$/.test(code) ? code : null;
    } catch {
        return null;
    }
}

async function autoFillCountryIfEmpty() {
    if (player.country && player.country.length === 2) return;

    const token = getToken();
    if (!token) return;

    const detected = await detectCountry();
    if (!detected) return;

    try {
        const result = await apiRequest("/me", {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: JSON.stringify({
                bio: player.bio,
                avatarItemId: player.avatarItemId,
                country: detected,
                birthdate: player.birthdate
            })
        });

        const updated = normalizePlayer(result);
        Object.assign(player, updated);
        renderProfile();
        console.log("[GROWERA] Country auto-set to " + detected);
    } catch (e) {
        console.warn("[GROWERA] Auto country failed:", e);
    }
}

/* ===== Login ===== */

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

        const token = result?.token || result?.accessToken ||
            result?.data?.token || result?.data?.accessToken;

        saveToken(token);

        await loadCurrentPlayer();

        if (passwordInput) passwordInput.value = "";

        setMessage("");
        setProfileVisible();
        toast("Selamat datang, " + player.username + "!", "success");

        autoFillCountryIfEmpty();
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

/* ===== Load ===== */

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

async function refreshProfile(silent = false) {
    if (isBusy) return;
    setProfileLoading(true);

    try {
        await loadCurrentPlayer();
        renderProfile();
        if (!silent) toast("Profil diperbarui.", "info", 2200);
    } catch (error) {
        console.error("[GROWERA] Refresh gagal:", error);
        if (error.isAuthError) forceLogout("Sesi berakhir. Silakan login kembali.");
        else if (!silent) toast("Gagal refresh: " + error.message, "error");
    } finally {
        setProfileLoading(false);
    }
}

/* ===== Logout ===== */

function forceLogout(message) {
    clearToken();
    isAuthenticated = false;
    closeEditDialog();
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

/* ===== Restore ===== */

async function restoreSession() {
    if (!getToken()) {
        setLoginVisible();
        return;
    }

    setBusy(true);

    try {
        await loadCurrentPlayer();
        setProfileVisible();
        autoFillCountryIfEmpty();
    } catch (error) {
        console.warn("[GROWERA] Sesi tidak dapat dipulihkan:", error);
        clearToken();
        setLoginVisible();
    } finally {
        setBusy(false);
    }
}

/* ===== Edit Dialog ===== */

function buildAvatarPresets() {
    const container = $("#avatarPresets");
    if (!container) return;

    const ids = [112, 242, 1458, 4820, 1796, 6016];
    container.replaceChildren();

    ids.forEach((id) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.avatarId = String(id);
        btn.title = "Item #" + id;

        const img = document.createElement("img");
        img.src = avatarUrl(id);
        img.width = 24;
        img.height = 24;
        img.alt = "Item " + id;
        img.style.cssText = "image-rendering:pixelated";

        btn.appendChild(img);
        btn.addEventListener("click", () => {
            const input = $("#editAvatarId");
            if (!input) return;
            input.value = input.value === String(id) ? "" : String(id);
            updateAvatarPreview();
        });

        container.appendChild(btn);
    });
}

function updateAvatarPreview() {
    const preview = $("#avatarPreview");
    const input = $("#editAvatarId");
    if (!preview || !input) return;

    const id = Math.floor(Number(input.value) || 0);
    preview.replaceChildren();

    if (id <= 0) {
        const ph = document.createElement("span");
        ph.className = "avatar-placeholder";
        ph.textContent = "?";
        preview.appendChild(ph);
    } else {
        const img = document.createElement("img");
        img.src = avatarUrl(id);
        img.alt = "Avatar";
        img.addEventListener("error", () => {
            preview.replaceChildren();
            const ph = document.createElement("span");
            ph.className = "avatar-placeholder";
            ph.textContent = "?";
            preview.appendChild(ph);
        });
        preview.appendChild(img);
    }

    document.querySelectorAll("#avatarPresets button").forEach((b) => {
        b.classList.toggle("active", Number(b.dataset.avatarId) === id);
    });
}

function updateBioCounter() {
    const bio = $("#editBio");
    const counter = $("#bioCounter");
    if (!bio || !counter) return;
    counter.textContent = bio.value.length + " / 200";
}

function renderDiscordState() {
    const name = $("#discordName");
    const hint = $("#discordHint");
    const btn = $("#discordBindBtn");
    const btnLabel = btn?.querySelector(".btn-label");

    if (!name || !hint || !btn) return;

    if (player.discordId && player.discordUsername) {
        name.textContent = "@" + player.discordUsername;
        hint.textContent = "ID: " + player.discordId;
        if (btnLabel) btnLabel.textContent = "UNBIND";
        btn.disabled = false;
        btn.dataset.mode = "unbind";
        const badge = btn.querySelector(".badge-soon");
        if (badge) badge.remove();
    } else {
        name.textContent = "Belum terhubung";
        hint.textContent = "Hubungkan akun Discord untuk verifikasi";
        if (btnLabel) btnLabel.textContent = "BIND DISCORD";
        btn.disabled = true;
        btn.dataset.mode = "bind";
        if (!btn.querySelector(".badge-soon")) {
            const badge = document.createElement("span");
            badge.className = "badge-soon";
            badge.textContent = "SOON";
            btn.appendChild(badge);
        }
    }
}

async function handleDiscordBind() {
    const btn = $("#discordBindBtn");
    const mode = btn?.dataset.mode;

    if (mode === "unbind") {
        if (!confirm("Unbind akun Discord?")) return;
        const token = getToken();
        if (!token) return;
        try {
            await apiRequest("/me/discord/unbind", {
                method: "POST",
                headers: { Authorization: "Bearer " + token }
            });
            player.discordId = "";
            player.discordUsername = "";
            renderProfile();
            toast("Discord berhasil di-unbind.", "success");
        } catch (e) {
            toast("Gagal unbind: " + e.message, "error");
        }
        return;
    }

    toast("Discord OAuth akan tersedia setelah admin mengkonfigurasi. Hubungi admin.", "info", 5000);
}

function openEditDialog() {
    if (!editDialog) return;

    $("#editBio").value = player.bio || "";
    $("#editAvatarId").value = player.avatarItemId > 0 ? String(player.avatarItemId) : "";
    $("#editCountry").value = player.country || "";
    $("#editBirthdate").value = /^\d{4}-\d{2}-\d{2}$/.test(player.birthdate) ? player.birthdate : "";

    buildAvatarPresets();
    updateAvatarPreview();
    updateBioCounter();
    renderDiscordState();
    setEditError("");
    setSavingEdit(false);

    if (typeof editDialog.showModal === "function") editDialog.showModal();
    else editDialog.setAttribute("open", "");

    setTimeout(() => $("#editBio")?.focus(), 120);
}

function closeEditDialog() {
    if (!editDialog) return;
    if (editDialog.open && typeof editDialog.close === "function") editDialog.close();
    else editDialog.removeAttribute("open");
}

async function handleEditSubmit(event) {
    event.preventDefault();
    if (isSavingEdit) return;

    setEditError("");

    const bio = $("#editBio").value.trim();
    const avatarRaw = $("#editAvatarId").value.trim();
    const birthdate = $("#editBirthdate").value.trim();

    if (bio.length > 200) {
        setEditError("Bio maksimal 200 karakter.");
        return;
    }

    let avatarItemId = 0;
    if (avatarRaw !== "") {
        avatarItemId = Math.floor(Number(avatarRaw) || 0);
        if (avatarItemId < 0 || avatarItemId > 999999) {
            setEditError("Avatar item ID harus antara 0 sampai 999999.");
            return;
        }
    }

    if (birthdate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
        setEditError("Format birthdate tidak valid.");
        return;
    }

    const token = getToken();
    if (!token) {
        setEditError("Sesi tidak ditemukan. Silakan login kembali.");
        return;
    }

    setSavingEdit(true);

    try {
        const result = await apiRequest("/me", {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: JSON.stringify({
                bio,
                avatarItemId,
                country: player.country,
                birthdate
            })
        });

        const updated = normalizePlayer(result);
        Object.assign(player, updated);

        renderProfile();
        closeEditDialog();
        toast("Profil berhasil disimpan.", "success");
    } catch (error) {
        console.error("[GROWERA] Save profile gagal:", error);
        if (error.isAuthError) {
            closeEditDialog();
            forceLogout("Sesi berakhir. Silakan login kembali.");
            return;
        }
        setEditError(error.message || "Gagal menyimpan profil.");
    } finally {
        setSavingEdit(false);
    }
}

/* ===== Password Toggle ===== */

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

function wireAutofocus() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    if (!loginView?.classList.contains("hidden")) {
        setTimeout(() => usernameInput?.focus(), 200);
    }
}

/* ===== Events ===== */

loginForm?.addEventListener("submit", handleLogin);
$("#logoutButton")?.addEventListener("click", handleLogout);
$("#refreshButton")?.addEventListener("click", () => refreshProfile(false));
$("#editPreviewButton")?.addEventListener("click", openEditDialog);

$("#editForm")?.addEventListener("submit", handleEditSubmit);
$("#editCloseBtn")?.addEventListener("click", closeEditDialog);
$("#editCancelBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    closeEditDialog();
});

editDialog?.addEventListener("click", (e) => {
    if (e.target === editDialog) closeEditDialog();
});

$("#editAvatarId")?.addEventListener("input", updateAvatarPreview);
$("#editBio")?.addEventListener("input", updateBioCounter);
$("#discordBindBtn")?.addEventListener("click", handleDiscordBind);

$("#exploreButton")?.addEventListener("click", () => {
    $("#editPreviewButton")?.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && editDialog?.open) closeEditDialog();
});

/* ===== Init ===== */

updateFooterYear();
wirePasswordToggle();
wireCapsLock();
wireAutofocus();
restoreSession();

})();
