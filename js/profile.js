// js/profile.js
// Logic untuk profile page (profile.html)
// v2: friends enriched with avatar, level, online, sort, search, detail dialog

import {
    apiRequest,
    getToken,
    clearToken,
    toast,
    safeName, toNumber, fmt,
    fmtDateId, fmtBirthdate, fmtPlaytime,
    avatarUrl, flagUrl,
    generateDayRange,
    getAchievementsMaster,
    getItemsMaster,
    resolveItemName
} from "./core.js";

const $ = (s) => document.querySelector(s);
const editDialog = $("#editDialog");

let isAuthenticated = false;
let isBusy = false;
let isSavingEdit = false;

const player = {
    username: "Player", displayName: "Player", role: "player",
    level: 1, xp: 0, nextLevelXp: 1, gems: 0, playtime: 0, online: false,
    bio: "", avatarItemId: 0, country: "", discordId: "", discordUsername: "",
    birthdate: "", createdAt: 0, updatedAt: 0, todayDate: "", todayEvents: ""
};

/* ===== Normalize ===== */
function normalizePlayer(data) {
    const source = data?.player || data?.data?.player || data?.data?.user || data?.user || data?.data || data;
    if (!source || typeof source !== "object") throw new Error("Data pemain dari server tidak valid.");
    const username = safeName(source.username || source.name);
    return {
        username, displayName: username,
        role: String(source.role || "player").trim().toLowerCase() === "admin" ? "admin" : "player",
        level: Math.max(1, toNumber(source.level, 1)),
        xp: Math.max(0, toNumber(source.xp, 0)),
        nextLevelXp: Math.max(1, toNumber(source.nextLevelXp ?? source.requiredXP ?? source.requiredXp ?? source.xpRequired, 1)),
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
        updatedAt: toNumber(source.updatedAt, 0),
        todayDate: String(source.todayDate || "").trim(),
        todayEvents: String(source.todayEvents || "").trim()
    };
}

/* ===== Last Seen Formatter ===== */
function formatLastSeen(lastSeenUnix) {
    const n = Number(lastSeenUnix) || 0;
    if (n <= 0) return "Never online";
    const nowSec = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, nowSec - n);
    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + "d ago";
    if (diff < 86400 * 365) return Math.floor(diff / (86400 * 30)) + "mo ago";
    return Math.floor(diff / (86400 * 365)) + "y ago";
}

/* ===== Render Profile ===== */
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
    img.style.cssText = "display:inline-block;vertical-align:-2px;margin-right:7px;border-radius:3px;box-shadow:0 0 0 1px #ffffff1f;width:20px;height:auto";
    img.addEventListener("error", () => { img.remove(); }, { once: true });
    el.appendChild(img);
    el.appendChild(document.createTextNode(code));
}

function renderProfile() {
    const name = safeName(player.username);
    if ($("#welcomeName")) $("#welcomeName").textContent = name;
    if ($("#profileName")) $("#profileName").textContent = name;
    if ($("#profileHandle")) {
        $("#profileHandle").textContent = "@" + name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    }
    const avatarEl = $("#avatarInitial");
    if (avatarEl) {
        avatarEl.replaceChildren();
        if (player.avatarItemId > 0) {
            const img = document.createElement("img");
            img.src = avatarUrl(player.avatarItemId);
            img.alt = name;
            img.addEventListener("error", () => { avatarEl.textContent = name.charAt(0).toUpperCase(); });
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    }
    const roleBadge = $("#roleBadge");
    if (roleBadge) {
        roleBadge.classList.remove("role-admin", "role-player");
        if (player.role === "admin") { roleBadge.classList.add("role-admin"); roleBadge.textContent = "ADMIN"; }
        else { roleBadge.classList.add("role-player"); roleBadge.textContent = "PLAYER"; }
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
        if (player.bio) { bio.textContent = player.bio; bio.classList.remove("is-empty"); }
        else { bio.textContent = "Belum ada bio."; bio.classList.add("is-empty"); }
    }
    setCountryValue(player.country);
    setMetaValue("#birthdateValue", fmtBirthdate(player.birthdate));
    setMetaValue("#discordValue", player.discordUsername ? "@" + player.discordUsername : "");
    setMetaValue("#memberSinceValue", fmtDateId(player.createdAt));

    if ($("#todayDate")) $("#todayDate").textContent = player.todayDate || "—";
    if ($("#todayEvents")) {
        if (player.todayEvents) {
            $("#todayEvents").textContent = player.todayEvents;
            $("#todayEvents").style.color = "";
        } else {
            $("#todayEvents").textContent = "No events today";
            $("#todayEvents").style.color = "#4b5670";
        }
    }

    const msBadge = $("#memberSinceBadge");
    if (msBadge) msBadge.textContent = player.createdAt > 0 ? fmtDateId(player.createdAt) : "NEW";
    const pill = $("#onlinePill"), onlineText = $("#onlineText");
    if (pill && onlineText) {
        if (player.online) { pill.classList.add("is-online"); onlineText.textContent = "ONLINE"; }
        else { pill.classList.remove("is-online"); onlineText.textContent = "OFFLINE"; }
    }
    document.documentElement.dataset.groweraRole = player.role;
    renderDiscordState();
}

/* ===== Stat Cards ===== */
function resetStatCardValues() {
    const ach = $("#statAchValue"), fr = $("#statFriendsValue"), gd = $("#statGuildValue");
    if (ach) ach.textContent = "—";
    if (fr) fr.textContent = "—";
    if (gd) gd.textContent = "—";
}

function applyFullProfile(data) {
    if (!data) return;
    if (data.user) {
        const normalized = normalizePlayer(data.user);
        Object.assign(player, normalized);
    }
    isAuthenticated = true;

    if (data.achievements && Array.isArray(data.achievements.unlockedIds)) {
        const el = $("#statAchValue");
        if (el) el.textContent = String(data.achievements.unlockedIds.length);
    }
    if (data.friends && Array.isArray(data.friends.list)) {
        const el = $("#statFriendsValue");
        if (el) el.textContent = String(data.friends.list.length);
    }
    if (data.guild) {
        const el = $("#statGuildValue");
        if (el) {
            const g = data.guild;
            if (!g.id || g.id <= 0) el.textContent = "None";
            else el.textContent = g.title || ("#" + g.id);
        }
    }
}

/* ===== Bootstrap ===== */
let fullProfileData = null;

async function fetchFullProfile() {
    const token = getToken();
    if (!token) { const e = new Error("Sesi tidak ditemukan."); e.isAuthError = true; throw e; }
    const result = await apiRequest("/me/full", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
    });
    fullProfileData = result;
    return result;
}

async function bootstrapProfile() {
    const masterPromise = getAchievementsMaster().catch((e) => {
        console.warn("[GROWERA] achievements.json gagal load:", e);
        return null;
    });
    const itemsPromise = getItemsMaster().catch((e) => {
        console.warn("[GROWERA] items.json gagal load:", e);
        return null;
    });

    const [full] = await Promise.all([fetchFullProfile(), masterPromise, itemsPromise]);
    applyFullProfile(full);

    try {
        const master = await getAchievementsMaster();
        if (master && full?.achievements?.unlockedIds) {
            const el = $("#statAchValue");
            if (el) el.textContent = full.achievements.unlockedIds.length + "/" + master.length;
        }
    } catch {}
}

/* ===== Country Auto-detect ===== */
async function detectCountry() {
    try {
        const res = await fetch("https://ipwho.is/", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || data.success === false) return null;
        const code = String(data.country_code || "").toUpperCase();
        return /^[A-Z]{2}$/.test(code) ? code : null;
    } catch { return null; }
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
            body: JSON.stringify({ bio: player.bio, avatarItemId: player.avatarItemId, country: detected, birthdate: player.birthdate })
        });
        const updated = normalizePlayer(result);
        Object.assign(player, updated);
        renderProfile();
        console.log("[GROWERA] Country auto-set to " + detected);
    } catch (e) { console.warn("[GROWERA] Auto country failed:", e); }
}

/* ===== Refresh ===== */
function setProfileLoading(loading) {
    const btn = $("#refreshButton");
    if (btn) btn.classList.toggle("is-loading", Boolean(loading));
}

async function refreshProfile(silent = false) {
    if (isBusy) return;
    setProfileLoading(true);
    try {
        await bootstrapProfile();
        renderProfile();
        if (!silent) toast("Profil diperbarui.", "info", 2200);
    } catch (error) {
        console.error("[GROWERA] Refresh gagal:", error);
        if (error.isAuthError) forceLogout();
        else if (!silent) toast("Gagal refresh: " + error.message, "error");
    } finally { setProfileLoading(false); }
}

/* ===== Logout ===== */
function forceLogout(message) {
    clearToken();
    isAuthenticated = false;
    fullProfileData = null;
    closeEditDialog();
    closeAllInfoDialogs();
    resetStatCardValues();
    if (message) toast(message, "info");
    window.location.replace("/");
}

async function handleLogout() {
    if (isBusy) return;
    const token = getToken();
    isBusy = true;
    try {
        if (token) await apiRequest("/logout", { method: "POST", headers: { Authorization: "Bearer " + token } });
    } catch (error) { console.warn("[GROWERA] Logout API gagal:", error); }
    finally {
        clearToken();
        window.location.replace("/");
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
        img.width = 24; img.height = 24;
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
    const preview = $("#avatarPreview"), input = $("#editAvatarId");
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
    const bio = $("#editBio"), counter = $("#bioCounter");
    if (!bio || !counter) return;
    counter.textContent = bio.value.length + " / 200";
}

function setEditError(message) {
    const el = $("#editError");
    if (!el) return;
    if (message) { el.textContent = message; el.classList.add("show"); }
    else { el.textContent = ""; el.classList.remove("show"); }
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

function renderDiscordState() {
    const name = $("#discordName"), hint = $("#discordHint"), btn = $("#discordBindBtn");
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
            await apiRequest("/me/discord/unbind", { method: "POST", headers: { Authorization: "Bearer " + token } });
            player.discordId = ""; player.discordUsername = "";
            renderProfile();
            toast("Discord berhasil di-unbind.", "success");
        } catch (e) { toast("Gagal unbind: " + e.message, "error"); }
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
    if (bio.length > 200) { setEditError("Bio maksimal 200 karakter."); return; }
    let avatarItemId = 0;
    if (avatarRaw !== "") {
        avatarItemId = Math.floor(Number(avatarRaw) || 0);
        if (avatarItemId < 0 || avatarItemId > 999999) { setEditError("Avatar item ID harus antara 0 sampai 999999."); return; }
    }
    if (birthdate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) { setEditError("Format birthdate tidak valid."); return; }
    const token = getToken();
    if (!token) { setEditError("Sesi tidak ditemukan. Silakan login kembali."); return; }
    setSavingEdit(true);
    try {
        const result = await apiRequest("/me", {
            method: "PUT",
            headers: { Authorization: "Bearer " + token },
            body: JSON.stringify({ bio, avatarItemId, country: player.country, birthdate })
        });
        const updated = normalizePlayer(result);
        Object.assign(player, updated);
        renderProfile();
        closeEditDialog();
        toast("Profil berhasil disimpan.", "success");
    } catch (error) {
        console.error("[GROWERA] Save profile gagal:", error);
        if (error.isAuthError) { closeEditDialog(); forceLogout(); return; }
        setEditError(error.message || "Gagal menyimpan profil.");
    } finally { setSavingEdit(false); }
}

/* ===== TABS: Inventory / Worlds ===== */
const contentTabs = { loaded: { inventory: false, worlds: false }, current: "inventory" };

function switchTab(tabName) {
    contentTabs.current = tabName;
    document.querySelectorAll(".tab-btn").forEach((b) => {
        const active = b.dataset.tab === tabName;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach((p) => {
        p.classList.toggle("active", p.id === "tabPanel" + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    });
    if (!contentTabs.loaded[tabName]) loadTabData(tabName);
}

async function loadTabData(tabName) {
    const token = getToken();
    if (!token) return;
    const loading = $("#" + tabName + "Loading");
    if (loading) loading.hidden = false;
    try {
        if (tabName === "inventory") {
            const [result] = await Promise.all([
                apiRequest("/inventory", { method: "GET", headers: { Authorization: "Bearer " + token } }),
                getItemsMaster().catch(() => null)
            ]);
            renderInventoryTab(result);
            contentTabs.loaded.inventory = true;
        } else if (tabName === "worlds") {
            const result = await apiRequest("/worlds", { method: "GET", headers: { Authorization: "Bearer " + token } });
            renderWorldsTab(result);
            contentTabs.loaded.worlds = true;
        }
    } catch (error) {
        console.error("[GROWERA] Load tab " + tabName + " gagal:", error);
        if (loading) { loading.textContent = "Gagal memuat: " + error.message; loading.hidden = false; }
    } finally {
        if (loading && contentTabs.loaded[tabName]) loading.hidden = true;
    }
}

function renderInventoryTab(result) {
    const items = result?.items || [];
    const grid = $("#inventoryGridContent"), empty = $("#inventoryEmpty"), count = $("#tabCountInventory");
    if (count) count.textContent = String(items.length);
    if (!items.length) { if (empty) empty.hidden = false; if (grid) grid.hidden = true; return; }
    if (empty) empty.hidden = true;
    if (grid) {
        grid.hidden = false;
        grid.replaceChildren();
        items.forEach((item) => {
            const resolvedName = resolveItemName(item.id);
            const card = document.createElement("div");
            card.className = "inv-item";
            card.title = resolvedName + " · x" + item.count;
            const idBadge = document.createElement("div");
            idBadge.className = "inv-item-id";
            idBadge.textContent = "#" + item.id;
            const countBadge = document.createElement("div");
            countBadge.className = "inv-item-count";
            countBadge.textContent = "×" + fmt(item.count);
            const imgWrap = document.createElement("div");
            imgWrap.className = "inv-item-img";
            const img = document.createElement("img");
            img.src = avatarUrl(item.id);
            img.alt = resolvedName;
            img.loading = "lazy";
            img.addEventListener("error", () => { imgWrap.textContent = "?"; imgWrap.style.color = "#4b5670"; imgWrap.style.fontSize = "14px"; });
            imgWrap.appendChild(img);
            const name = document.createElement("div");
            name.className = "inv-item-name";
            name.textContent = resolvedName;
            card.appendChild(idBadge); card.appendChild(countBadge);
            card.appendChild(imgWrap); card.appendChild(name);
            grid.appendChild(card);
        });
    }
}

function renderWorldsTab(result) {
    const groups = [
        { listId: "worldsOwnedList", countId: "worldsOwnedCount", data: result?.owned || [] },
        { listId: "worldsRecentList", countId: "worldsRecentCount", data: result?.recent || [] },
        { listId: "worldsAccessList", countId: "worldsAccessCount", data: result?.access || [] },
        { listId: "worldsLockedList", countId: "worldsLockedCount", data: result?.locked || [] }
    ];
    let total = 0;
    groups.forEach((g) => {
        total += g.data.length;
        const countEl = $("#" + g.countId);
        if (countEl) countEl.textContent = String(g.data.length);
        const listEl = $("#" + g.listId);
        if (!listEl) return;
        listEl.replaceChildren();
        if (!g.data.length) {
            const empty = document.createElement("div");
            empty.className = "world-empty";
            empty.textContent = "Tidak ada data.";
            listEl.appendChild(empty);
            return;
        }
        g.data.forEach((w) => {
            const chip = document.createElement("span");
            chip.className = "world-chip";
            chip.textContent = w.name || ("World #" + w.id);
            if (w.id) chip.title = "ID: " + w.id;
            listEl.appendChild(chip);
        });
    });
    const tabCount = $("#tabCountWorlds");
    if (tabCount) tabCount.textContent = String(total);
    const content = $("#worldsContent");
    if (content) content.hidden = false;
}

/* ===== INFO DIALOGS ===== */
const infoDialogLoaded = { achievements: false, friends: false, guild: false, playtime: false };

function openInfoDialog(name) {
    const dlg = document.getElementById(name);
    if (!dlg) return;
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute("open", "");
    const key = name.replace("dialog", "").toLowerCase();
    if (key === "achievements") loadAchievementsDialog();
    else if (key === "friends") loadFriendsDialog();
    else if (key === "guild") loadGuildDialog();
    else if (key === "playtime" && !infoDialogLoaded.playtime) loadPlaytimeDialog();
}

function closeInfoDialog(name) {
    const dlg = document.getElementById(name);
    if (!dlg) return;
    if (dlg.open && typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
}

function closeAllInfoDialogs() {
    ["dialogAchievements", "dialogFriends", "dialogGuild", "dialogPlaytime", "dialogFriendDetail"].forEach((id) => {
        const dlg = document.getElementById(id);
        if (dlg && dlg.open && typeof dlg.close === "function") dlg.close();
    });
    infoDialogLoaded.achievements = false;
    infoDialogLoaded.friends = false;
    infoDialogLoaded.guild = false;
    infoDialogLoaded.playtime = false;
    friendsCache = [];
}

/* ==== Achievements ==== */
async function loadAchievementsDialog() {
    const token = getToken();
    if (!token) return;
    const loading = $("#achievementsLoading"), summary = $("#achSummary"), grid = $("#achGridContent"), empty = $("#achievementsEmpty");
    if (loading) { loading.hidden = false; loading.textContent = "Memuat achievements..."; }
    if (summary) summary.hidden = true;
    if (grid) grid.hidden = true;
    if (empty) empty.hidden = true;

    try {
        const [master, unlockRes] = await Promise.all([
            getAchievementsMaster(),
            apiRequest("/achievements/unlocked", { method: "GET", headers: { Authorization: "Bearer " + token } })
        ]);

        const unlockedIds = Array.isArray(unlockRes?.unlockedIds) ? unlockRes.unlockedIds : [];
        const unlockedSet = new Set(unlockedIds.map((id) => Number(id)));
        const total = master.length;
        const unlockedCount = unlockedIds.length;

        const statAch = $("#statAchValue");
        if (statAch) statAch.textContent = total > 0 ? (unlockedCount + "/" + total) : "0/0";

        if (total === 0) {
            if (empty) { empty.textContent = "Belum ada achievement terdaftar."; empty.hidden = false; }
            infoDialogLoaded.achievements = true;
            return;
        }

        if (summary) summary.hidden = false;
        if (grid) grid.hidden = false;
        if ($("#achUnlockedCount")) $("#achUnlockedCount").textContent = String(unlockedCount);
        if ($("#achTotalCount")) $("#achTotalCount").textContent = String(total);
        const percent = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;
        if ($("#achProgressFill")) $("#achProgressFill").style.width = percent + "%";
        if ($("#achProgressText")) $("#achProgressText").textContent = percent + "%";

        if (grid) {
            grid.replaceChildren();
            const sorted = [...master].sort((a, b) => {
                const ua = unlockedSet.has(Number(a.id));
                const ub = unlockedSet.has(Number(b.id));
                if (ua !== ub) return ua ? -1 : 1;
                return (Number(a.id) || 0) - (Number(b.id) || 0);
            });

            sorted.forEach((ach) => {
                const achId = Number(ach.id) || 0;
                const isUnlocked = unlockedSet.has(achId);
                const achName = String(ach.name || "").trim() || ("Achievement #" + achId);
                const achDesc = String(ach.description || "").trim();
                const iconId = Number(ach.iconId) || 202;

                const card = document.createElement("div");
                card.className = "ach-card" + (isUnlocked ? " unlocked" : "");

                const icon = document.createElement("div");
                icon.className = "ach-icon";
                const img = document.createElement("img");
                img.src = avatarUrl(iconId);
                img.alt = "";
                img.loading = "lazy";
                img.addEventListener("error", () => {
                    icon.textContent = isUnlocked ? "★" : "○";
                    icon.style.color = isUnlocked ? "#f8d58c" : "#4b5670";
                    icon.style.fontSize = "20px";
                });
                icon.appendChild(img);

                const info = document.createElement("div");
                info.className = "ach-info";
                const name = document.createElement("div");
                name.className = "ach-name";
                name.textContent = achName;
                const desc = document.createElement("div");
                desc.className = "ach-desc";
                desc.textContent = achDesc || "—";
                const badge = document.createElement("span");
                badge.className = "ach-badge";
                badge.textContent = isUnlocked ? "UNLOCKED" : "LOCKED";
                info.appendChild(name);
                if (achDesc) info.appendChild(desc);
                info.appendChild(badge);
                card.appendChild(icon);
                card.appendChild(info);
                grid.appendChild(card);
            });
        }
        infoDialogLoaded.achievements = true;
    } catch (error) {
        console.error("[GROWERA] Load achievements gagal:", error);
        if (loading) { loading.textContent = "Gagal memuat: " + error.message; loading.hidden = false; }
    } finally { if (loading && infoDialogLoaded.achievements) loading.hidden = true; }
}

/* ==== FRIENDS (v2: with avatar, level, online, sort, search, detail) ==== */

let friendsCache = [];

function createFriendCard(friend) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "friend-card" + (friend.online ? " is-online" : " is-offline");
    card.setAttribute("aria-label", "View " + (friend.username || "friend") + " details");

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "friend-avatar-wrap";

    const avatar = document.createElement("div");
    avatar.className = "friend-avatar";
    if (friend.avatarItemId > 0) {
        const img = document.createElement("img");
        img.src = avatarUrl(friend.avatarItemId);
        img.alt = friend.username || "Friend";
        img.loading = "lazy";
        img.addEventListener("error", () => {
            avatar.replaceChildren();
            avatar.textContent = (friend.username || "?").charAt(0).toUpperCase();
        }, { once: true });
        avatar.appendChild(img);
    } else {
        avatar.textContent = (friend.username || "?").charAt(0).toUpperCase();
    }

    const dot = document.createElement("span");
    dot.className = "friend-online-dot";

    avatarWrap.appendChild(avatar);
    avatarWrap.appendChild(dot);

    const info = document.createElement("div");
    info.className = "friend-info";

    const name = document.createElement("div");
    name.className = "friend-name";
    name.textContent = friend.username || "(unknown)";

    const meta = document.createElement("div");
    meta.className = "friend-meta";

    const levelSpan = document.createElement("span");
    levelSpan.className = "friend-level";
    levelSpan.textContent = "LV " + (Number(friend.level) || 1);

    meta.appendChild(levelSpan);

    if (friend.userID > 0) {
        const sep = document.createElement("span");
        sep.className = "friend-meta-sep";
        sep.textContent = "•";
        const idSpan = document.createElement("span");
        idSpan.textContent = "#" + friend.userID;
        meta.appendChild(sep);
        meta.appendChild(idSpan);
    }

    const lastSeen = document.createElement("div");
    lastSeen.className = "friend-last-seen";
    lastSeen.textContent = friend.online ? "Online now" : formatLastSeen(friend.lastSeen);

    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(lastSeen);

    card.appendChild(avatarWrap);
    card.appendChild(info);

    card.addEventListener("click", () => openFriendDetail(friend));
    return card;
}

function renderFriendsList(query) {
    const grid = $("#friendsGridContent");
    const empty = $("#friendsEmpty");
    const emptySearch = $("#friendsEmptySearch");
    const countEl = $("#friendsSearchCount");

    if (!grid) return;

    const q = String(query || "").trim().toLowerCase();

    let list = friendsCache.slice();
    if (q) {
        list = list.filter((f) => String(f.username || "").toLowerCase().includes(q));
    }

    // Sort: online first, then level desc, then name asc
    list.sort((a, b) => {
        if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1;
        const la = Number(a.level) || 0;
        const lb = Number(b.level) || 0;
        if (la !== lb) return lb - la;
        return String(a.username || "").localeCompare(String(b.username || ""));
    });

    if (countEl) {
        if (q && friendsCache.length > 0) {
            countEl.textContent = list.length + "/" + friendsCache.length;
            countEl.hidden = false;
        } else {
            countEl.hidden = true;
        }
    }

    if (friendsCache.length === 0) {
        if (empty) empty.hidden = false;
        if (emptySearch) emptySearch.hidden = true;
        grid.hidden = true;
        return;
    }

    if (list.length === 0) {
        if (empty) empty.hidden = true;
        if (emptySearch) emptySearch.hidden = false;
        grid.hidden = true;
        return;
    }

    if (empty) empty.hidden = true;
    if (emptySearch) emptySearch.hidden = true;
    grid.hidden = false;
    grid.replaceChildren();
    list.forEach((f) => grid.appendChild(createFriendCard(f)));
}

function openFriendDetail(friend) {
    const dlg = $("#dialogFriendDetail");
    if (!dlg) return;

    if ($("#friendDetailName")) {
        $("#friendDetailName").textContent = friend.username || "(unknown)";
    }

    const avatarEl = $("#friendDetailAvatar");
    if (avatarEl) {
        avatarEl.replaceChildren();
        if (friend.avatarItemId > 0) {
            const img = document.createElement("img");
            img.src = avatarUrl(friend.avatarItemId);
            img.alt = friend.username || "Friend";
            img.addEventListener("error", () => {
                avatarEl.replaceChildren();
                avatarEl.textContent = (friend.username || "?").charAt(0).toUpperCase();
            }, { once: true });
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = (friend.username || "?").charAt(0).toUpperCase();
        }
    }

    const statusEl = $("#friendDetailStatus");
    if (statusEl) {
        statusEl.textContent = friend.online ? "Online" : "Offline";
        statusEl.classList.toggle("is-online", Boolean(friend.online));
    }

    if ($("#friendDetailId")) {
        $("#friendDetailId").textContent = friend.userID > 0 ? "#" + friend.userID : "#—";
    }
    if ($("#friendDetailLevel")) $("#friendDetailLevel").textContent = String(Number(friend.level) || 1);
    if ($("#friendDetailGems")) $("#friendDetailGems").textContent = fmt(Number(friend.gems) || 0);

    const countryEl = $("#friendDetailCountry");
    if (countryEl) {
        countryEl.replaceChildren();
        const code = String(friend.country || "").toUpperCase();
        if (/^[A-Z]{2}$/.test(code)) {
            const flagImg = document.createElement("img");
            flagImg.src = flagUrl(code);
            flagImg.alt = code;
            flagImg.loading = "lazy";
            flagImg.style.cssText = "display:inline-block;vertical-align:-2px;margin-right:6px;border-radius:3px;width:16px;height:auto";
            flagImg.addEventListener("error", () => flagImg.remove(), { once: true });
            countryEl.appendChild(flagImg);
            countryEl.appendChild(document.createTextNode(code));
        } else {
            countryEl.textContent = "—";
        }
    }

    if ($("#friendDetailLastSeen")) {
        $("#friendDetailLastSeen").textContent = friend.online ? "Online now" : formatLastSeen(friend.lastSeen);
    }

    const bioEl = $("#friendDetailBio");
    if (bioEl) {
        if (friend.bio) {
            bioEl.textContent = friend.bio;
            bioEl.classList.remove("is-empty");
        } else {
            bioEl.textContent = "Belum ada bio.";
            bioEl.classList.add("is-empty");
        }
    }

    if (typeof dlg.showModal === "function") {
        if (!dlg.open) dlg.showModal();
    } else {
        dlg.setAttribute("open", "");
    }
}

async function loadFriendsDialog() {
    const token = getToken();
    if (!token) return;
    const loading = $("#friendsLoading"), grid = $("#friendsGridContent");
    const empty = $("#friendsEmpty"), emptySearch = $("#friendsEmptySearch");
    const countEl = $("#friendsSearchCount");

    if (loading) { loading.hidden = false; loading.textContent = "Memuat daftar teman..."; }
    if (grid) grid.hidden = true;
    if (empty) empty.hidden = true;
    if (emptySearch) emptySearch.hidden = true;
    if (countEl) countEl.hidden = true;

    try {
        const result = await apiRequest("/friends", { method: "GET", headers: { Authorization: "Bearer " + token } });
        const list = result?.friends || [];
        friendsCache = list;

        const statFriends = $("#statFriendsValue");
        if (statFriends) statFriends.textContent = String(list.length);

        const searchInput = $("#friendsSearch");
        if (searchInput) searchInput.value = "";

        if (loading) loading.hidden = true;
        renderFriendsList("");
        infoDialogLoaded.friends = true;
    } catch (error) {
        console.error("[GROWERA] Load friends gagal:", error);
        if (loading) { loading.textContent = "Gagal memuat: " + error.message; loading.hidden = false; }
    }
}

/* ==== Guild ==== */
function fmtGuildDate(unixSec) {
    const n = Number(unixSec) || 0;
    if (n <= 0) return "—";
    try { return new Date(n * 1000).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return "—"; }
}

function renderGuildMembers(guild) {
    const members = guild?.members || [];
    const countEl = $("#guildMembersCount");
    const listEl = $("#guildMembersList");
    const emptyEl = $("#guildMembersEmpty");
    if (countEl) countEl.textContent = String(members.length);
    if (!members.length) {
        if (emptyEl) emptyEl.hidden = false;
        if (listEl) { listEl.hidden = true; listEl.replaceChildren(); }
        return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (listEl) {
        listEl.hidden = false;
        listEl.replaceChildren();
        members.forEach((name) => {
            const chip = document.createElement("span");
            chip.className = "guild-member-chip";
            chip.textContent = name;
            listEl.appendChild(chip);
        });
    }
}

async function loadGuildDialog() {
    const token = getToken();
    if (!token) return;
    const loading = $("#guildLoading"), content = $("#guildContent"), empty = $("#guildEmpty");
    if (loading) { loading.hidden = false; loading.textContent = "Memuat data guild..."; }
    if (content) content.hidden = true;
    if (empty) empty.hidden = true;
    try {
        const result = await apiRequest("/guild", { method: "GET", headers: { Authorization: "Bearer " + token } });
        const guild = result?.guild || { id: 0 };
        const statGuild = $("#statGuildValue");
        if (!guild.id || guild.id <= 0) {
            if (statGuild) statGuild.textContent = "None";
            if (empty) empty.hidden = false;
            infoDialogLoaded.guild = true;
            return;
        }
        if (statGuild) statGuild.textContent = guild.title || ("#" + guild.id);
        if (content) {
            content.hidden = false;
            if ($("#guildName")) $("#guildName").textContent = guild.title || ("Guild #" + guild.id);
            if ($("#guildDesc")) {
                if (guild.description) { $("#guildDesc").textContent = guild.description; $("#guildDesc").style.color = ""; }
                else { $("#guildDesc").textContent = "Tidak ada deskripsi."; $("#guildDesc").style.color = "#4b5670"; }
            }
            if ($("#guildLevel")) $("#guildLevel").textContent = "LV " + (guild.level || 0);
            if ($("#guildId")) $("#guildId").textContent = "#" + guild.id;
            if ($("#guildLevelValue")) $("#guildLevelValue").textContent = guild.level || 0;
            if ($("#guildXp")) $("#guildXp").textContent = fmt(guild.xp || 0);
            if ($("#guildPoints")) $("#guildPoints").textContent = fmt(guild.points || 0);
            if ($("#guildWorld")) $("#guildWorld").textContent = guild.worldID > 0 ? ("#" + guild.worldID) : "—";
            if ($("#guildCreated")) $("#guildCreated").textContent = fmtGuildDate(guild.created);

            const mascotWrap = $("#guildMascotWrap"), mascotImg = $("#guildMascotImg"), mascotFallback = $("#guildMascotFallback");
            if (mascotWrap) mascotWrap.querySelectorAll(".guild-mascot-bg").forEach((el) => el.remove());
            if (guild.mascotBg > 0 && mascotWrap) {
                const bg = document.createElement("div");
                bg.className = "guild-mascot-bg";
                bg.style.backgroundImage = "url('" + avatarUrl(guild.mascotBg) + "')";
                mascotWrap.insertBefore(bg, mascotWrap.firstChild);
            }
            const fgId = (guild.mascotFg > 0) ? guild.mascotFg : (guild.mascotDisplay > 0 ? guild.mascotDisplay : 0);
            if (fgId > 0 && mascotImg) {
                mascotImg.src = avatarUrl(fgId);
                mascotImg.style.display = "block";
                mascotImg.className = "guild-mascot-fg";
                mascotImg.addEventListener("error", function () {
                    mascotImg.style.display = "none";
                    if (mascotFallback) mascotFallback.style.display = "";
                }, { once: true });
                if (mascotFallback) mascotFallback.style.display = "none";
            } else {
                if (mascotImg) mascotImg.style.display = "none";
                if (mascotFallback) mascotFallback.style.display = "";
            }
            renderGuildMembers(guild);
        }
        infoDialogLoaded.guild = true;
    } catch (error) {
        console.error("[GROWERA] Load guild gagal:", error);
        if (loading) { loading.textContent = "Gagal memuat: " + error.message; loading.hidden = false; }
    } finally { if (loading && infoDialogLoaded.guild) loading.hidden = true; }
}

/* ==== Playtime ==== */
function renderPlaytimeBars(chartEl, range, valueMap, opts = {}) {
    if (!chartEl) return 0;
    chartEl.replaceChildren();
    const monthly = opts.monthly === true;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let sum = 0, max = 1;
    range.forEach(({ dayKey }) => {
        const v = valueMap[dayKey] || 0;
        sum += v;
        if (v > max) max = v;
    });
    const todayKey = range.length ? range[range.length - 1].dayKey : 0;

    range.forEach(({ dayKey, date }) => {
        const val = valueMap[dayKey] || 0;
        const wrap = document.createElement("div");
        wrap.className = "pt-bar-wrap";
        if (dayKey === todayKey) wrap.classList.add("is-today");
        const pct = val > 0 ? Math.max(4, Math.round((val / max) * 100)) : 0;
        const bar = document.createElement("div");
        bar.className = "pt-bar";
        bar.style.height = pct + "%";
        bar.title = fmtPlaytime(val) + " · " + date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
        const label = document.createElement("span");
        label.className = "pt-label";
        label.textContent = monthly ? String(date.getDate()) : dayNames[date.getDay()];
        wrap.appendChild(bar);
        wrap.appendChild(label);
        chartEl.appendChild(wrap);
    });
    return sum;
}

async function loadPlaytimeDialog() {
    const token = getToken();
    if (!token) return;
    const loading = $("#playtimeLoading"), content = $("#playtimeContent");
    const totalEl = $("#playtimeTotal");
    if (loading) { loading.hidden = false; loading.textContent = "Memuat data playtime..."; }
    if (content) content.hidden = true;
    try {
        const result = await apiRequest("/playtime", { method: "GET", headers: { Authorization: "Bearer " + token } });
        const total = result?.totalPlaytime || 0;
        const daily = Array.isArray(result?.daily) ? result.daily : [];
        const valueMap = {};
        daily.forEach((d) => {
            const k = Number(d.dayKey) || 0;
            const v = Number(d.seconds) || 0;
            if (k > 0 && v > 0) valueMap[k] = v;
        });
        if (totalEl) totalEl.textContent = fmtPlaytime(total);
        const weeklyRange = generateDayRange(7);
        const monthlyRange = generateDayRange(30);
        const weeklySum = renderPlaytimeBars($("#weeklyChart"), weeklyRange, valueMap, { monthly: false });
        const monthlySum = renderPlaytimeBars($("#monthlyChart"), monthlyRange, valueMap, { monthly: true });
        if ($("#weeklySum")) $("#weeklySum").textContent = fmtPlaytime(weeklySum);
        if ($("#monthlySum")) $("#monthlySum").textContent = fmtPlaytime(monthlySum);
        if (content) content.hidden = false;
        infoDialogLoaded.playtime = true;
    } catch (error) {
        console.error("[GROWERA] Load playtime gagal:", error);
        if (loading) { loading.textContent = "Gagal memuat: " + error.message; loading.hidden = false; }
    } finally { if (loading && infoDialogLoaded.playtime) loading.hidden = true; }
}

/* ===== Wire Events ===== */
function wireEvents() {
    $("#logoutButton")?.addEventListener("click", handleLogout);
    $("#refreshButton")?.addEventListener("click", () => refreshProfile(false));
    $("#editPreviewButton")?.addEventListener("click", openEditDialog);
    $("#editForm")?.addEventListener("submit", handleEditSubmit);
    $("#editCloseBtn")?.addEventListener("click", closeEditDialog);
    $("#editCancelBtn")?.addEventListener("click", (e) => { e.preventDefault(); closeEditDialog(); });
    editDialog?.addEventListener("click", (e) => { if (e.target === editDialog) closeEditDialog(); });
    $("#editAvatarId")?.addEventListener("input", updateAvatarPreview);
    $("#editBio")?.addEventListener("input", updateBioCounter);
    $("#discordBindBtn")?.addEventListener("click", handleDiscordBind);
    $("#exploreButton")?.addEventListener("click", () => {
        $("#editPreviewButton")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && editDialog?.open) closeEditDialog();
    });

    // Tabs
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Info dialogs open
    document.querySelectorAll("[data-open-dialog]").forEach((el) => {
        const handler = () => openInfoDialog(el.dataset.openDialog);
        el.addEventListener("click", handler);
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
        });
    });

    // Info dialogs close
    document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
        btn.addEventListener("click", () => closeInfoDialog(btn.dataset.closeDialog));
    });

    // Info dialog backdrop click
    ["dialogAchievements", "dialogFriends", "dialogGuild", "dialogPlaytime", "dialogFriendDetail"].forEach((id) => {
        const dlg = document.getElementById(id);
        if (!dlg) return;
        dlg.addEventListener("click", (e) => { if (e.target === dlg) closeInfoDialog(id); });
    });

    // Friends search
    $("#friendsSearch")?.addEventListener("input", (e) => {
        renderFriendsList(e.target.value);
    });
}

/* ===== Footer Year ===== */
function updateFooterYear() {
    const year = String(new Date().getFullYear());
    if ($("#yearProfile")) $("#yearProfile").textContent = year;
}

/* ===== Init ===== */
async function init() {
    const token = getToken();
    if (!token) {
        window.location.replace("/");
        return;
    }

    isBusy = true;
    try {
        await bootstrapProfile();
        renderProfile();
        autoFillCountryIfEmpty();
    } catch (error) {
        console.error("[GROWERA] Init gagal:", error);
        if (error.isAuthError) {
            clearToken();
            window.location.replace("/");
            return;
        }
        toast("Gagal memuat profil: " + error.message, "error");
    } finally {
        isBusy = false;
    }
}

wireEvents();
switchTab("inventory");
updateFooterYear();
init();
