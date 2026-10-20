// js/home.js
// Home page logic (dashboard hub)

import {
    apiRequest,
    getToken,
    clearToken,
    toast,
    safeName, toNumber, fmt,
    itemImageUrl,
    getAchievementsMaster
} from "./core.js";

const $ = (s) => document.querySelector(s);

let isAuthenticated = false;
let isBusy = false;
let lastRefreshAt = 0;
let lastUpdatedTimerId = 0;

const player = {
    username: "Player",
    level: 1, gems: 0, xp: 0, nextLevelXp: 1, playtime: 0,
    online: false, avatarItemId: 0,
    todayDate: "", todayEvents: ""
};

/* ===== Item Image Loader ===== */
function loadItemImage(img, itemId, onFail) {
    if (!img) return;
    const n = Number(itemId) || 0;
    if (n <= 0) { if (typeof onFail === "function") onFail(); return; }
    const url = itemImageUrl(n);
    if (!url) { if (typeof onFail === "function") onFail(); return; }
    img.src = url;
    img.addEventListener("error", () => {
        if (typeof onFail === "function") onFail();
    }, { once: true });
}

/* ===== Skeleton ===== */
function setSkeletonLoading(loading) {
    document.body.classList.toggle("is-loading", Boolean(loading));
}

/* ===== Last Updated ===== */
function startLastUpdatedTimer() {
    if (lastUpdatedTimerId) clearInterval(lastUpdatedTimerId);
    lastUpdatedTimerId = setInterval(updateLastUpdatedText, 1000);
    updateLastUpdatedText();
}

function updateLastUpdatedText() {
    const el = $("#lastUpdated");
    if (!el) return;

    if (!lastRefreshAt) {
        el.textContent = "Loading...";
        el.classList.remove("is-fresh", "is-stale");
        return;
    }

    const seconds = Math.max(0, Math.floor((Date.now() - lastRefreshAt) / 1000));
    el.classList.remove("is-fresh", "is-stale");

    if (seconds < 5) {
        el.textContent = "Updated just now";
        el.classList.add("is-fresh");
    } else if (seconds < 60) {
        el.textContent = "Updated " + seconds + "s ago";
        if (seconds < 30) el.classList.add("is-fresh");
    } else if (seconds < 3600) {
        el.textContent = "Updated " + Math.floor(seconds / 60) + "m ago";
    } else {
        el.textContent = "Updated " + Math.floor(seconds / 3600) + "h ago";
        el.classList.add("is-stale");
    }
}

function markRefreshed() {
    lastRefreshAt = Date.now();
    updateLastUpdatedText();
}

/* ===== Sticky Topbar ===== */
function wireStickyTopbar() {
    const topbar = $("#topbar");
    if (!topbar) return;
    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            topbar.classList.toggle("is-scrolled", window.scrollY > 8);
            ticking = false;
        });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
}

/* ===== Render Player Summary ===== */
function renderPlayerSummary() {
    const name = safeName(player.username);

    if ($("#welcomeName")) $("#welcomeName").textContent = name;
    if ($("#miniName")) $("#miniName").textContent = name;
    if ($("#miniHandle")) {
        $("#miniHandle").textContent = "@" + name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    }

    const avatarEl = $("#miniAvatar");
    if (avatarEl) {
        avatarEl.replaceChildren();
        if (player.avatarItemId > 0) {
            const img = document.createElement("img");
            img.alt = name;
            loadItemImage(img, player.avatarItemId, () => {
                avatarEl.replaceChildren();
                avatarEl.textContent = name.charAt(0).toUpperCase();
            });
            avatarEl.appendChild(img);
        } else {
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    }

    if ($("#miniLevel")) $("#miniLevel").textContent = fmt(player.level);
    if ($("#miniGems")) $("#miniGems").textContent = fmt(player.gems);

    // Online pill
    const pill = $("#onlinePill"), onlineText = $("#onlineText");
    if (pill && onlineText) {
        if (player.online) {
            pill.classList.add("is-online");
            onlineText.textContent = "ONLINE";
        } else {
            pill.classList.remove("is-online");
            onlineText.textContent = "OFFLINE";
        }
    }

    // Today
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
}

/* ===== Render Quick Nav Counts ===== */
function renderQuickNavCounts(data) {
    if (!data) return;

    // Achievements: unlocked/total
    const achEl = $("#navCountAch");
    if (achEl && data.achievements) {
        const unlocked = Array.isArray(data.achievements.unlockedIds)
            ? data.achievements.unlockedIds.length
            : (data.achievements.total || 0);
        // Tampilkan total unlocked; total master akan di-update async
        achEl.textContent = String(unlocked);
    }

    // Friends
    const friendsEl = $("#navCountFriends");
    if (friendsEl && data.friends) {
        const total = Array.isArray(data.friends.list) ? data.friends.list.length : (data.friends.total || 0);
        friendsEl.textContent = String(total);
    }

    // Guild
    const guildEl = $("#navCountGuild");
    if (guildEl && data.guild) {
        const g = data.guild;
        guildEl.textContent = (!g.id || g.id <= 0) ? "None" : (g.title || ("#" + g.id));
    }

    // Playtime
    const ptEl = $("#navCountPlaytime");
    if (ptEl) {
        ptEl.textContent = formatShortPlaytime(player.playtime);
    }

    // Inventory & Worlds count — fetch terpisah (batch, tapi postpone)
    // Untuk sekarang tampil "—" atau isi setelah fetch async di bawah
    fetchAndUpdateInvWorldsCounts();
}

function formatShortPlaytime(seconds) {
    const s = Math.floor(toNumber(seconds));
    if (s <= 0) return "0h";
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h";
    const m = Math.floor((s % 3600) / 60);
    return (m > 0 ? m + "m" : "< 1m");
}

async function fetchAndUpdateInvWorldsCounts() {
    const token = getToken();
    if (!token) return;
    const headers = { Authorization: "Bearer " + token };

    // Parallel: inventory + worlds
    const [invRes, wrRes] = await Promise.allSettled([
        apiRequest("/inventory", { method: "GET", headers }),
        apiRequest("/worlds", { method: "GET", headers })
    ]);

    if (invRes.status === "fulfilled") {
        const total = invRes.value?.total ?? (invRes.value?.items?.length || 0);
        const el = $("#navCountInventory");
        if (el) el.textContent = String(total);
    }

    if (wrRes.status === "fulfilled") {
        const counts = wrRes.value?.counts || {};
        const total = (counts.owned || 0) + (counts.recent || 0) + (counts.access || 0) + (counts.locked || 0);
        const el = $("#navCountWorlds");
        if (el) el.textContent = String(total);
    }
}

/* ===== Profile Normalize ===== */
function normalizePlayer(data) {
    const source = data?.player || data?.data?.player || data?.data?.user || data?.user || data?.data || data;
    if (!source || typeof source !== "object") throw new Error("Data pemain tidak valid.");
    return {
        username: safeName(source.username || source.name),
        level: Math.max(1, toNumber(source.level, 1)),
        gems: Math.max(0, toNumber(source.gems, 0)),
        xp: Math.max(0, toNumber(source.xp, 0)),
        nextLevelXp: Math.max(1, toNumber(source.nextLevelXp ?? source.requiredXP, 1)),
        playtime: Math.max(0, toNumber(source.playtime, 0)),
        online: source.online === true,
        avatarItemId: toNumber(source.avatarItemId, 0),
        todayDate: String(source.todayDate || "").trim(),
        todayEvents: String(source.todayEvents || "").trim()
    };
}

/* ===== Fetch Full Profile ===== */
async function fetchHomeData() {
    const token = getToken();
    if (!token) {
        const e = new Error("Sesi tidak ditemukan.");
        e.isAuthError = true;
        throw e;
    }
    return await apiRequest("/me/full", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
    });
}

async function loadHome() {
    if (isBusy) return;
    isBusy = true;
    setSkeletonLoading(true);
    const btn = $("#refreshButton");
    if (btn) btn.classList.add("is-loading");

    try {
        // Parallel: main profile + master achievement (untuk denominator)
        const masterPromise = getAchievementsMaster().catch(() => null);
        const full = await fetchHomeData();
        applyFullData(full);

        // Update achievement count dengan denominator (X/Y) setelah master ready
        const master = await masterPromise;
        if (master && full?.achievements?.unlockedIds) {
            const achEl = $("#navCountAch");
            if (achEl) achEl.textContent = full.achievements.unlockedIds.length + "/" + master.length;
        }

        markRefreshed();
    } catch (error) {
        console.error("[GROWERA] Load home gagal:", error);
        if (error.isAuthError) {
            clearToken();
            window.location.replace("/");
            return;
        }
        toast("Gagal memuat: " + error.message, "error");
    } finally {
        setSkeletonLoading(false);
        if (btn) btn.classList.remove("is-loading");
        isBusy = false;
    }
}

function applyFullData(data) {
    if (!data) return;
    if (data.user) {
        const p = normalizePlayer(data.user);
        Object.assign(player, p);
    }
    isAuthenticated = true;
    renderPlayerSummary();
    renderQuickNavCounts(data);
}

/* ===== Logout ===== */
async function handleLogout() {
    if (isBusy) return;
    const token = getToken();
    isBusy = true;
    try {
        if (token) await apiRequest("/logout", { method: "POST", headers: { Authorization: "Bearer " + token } });
    } catch (error) { console.warn("[GROWERA] Logout gagal:", error); }
    finally {
        clearToken();
        window.location.replace("/");
    }
}

/* ===== Footer ===== */
function updateFooterYear() {
    if ($("#year")) $("#year").textContent = String(new Date().getFullYear());
}

/* ===== Wire Events ===== */
function wireEvents() {
    $("#logoutButton")?.addEventListener("click", handleLogout);
    $("#refreshButton")?.addEventListener("click", () => loadHome());
    wireStickyTopbar();
}

/* ===== Init ===== */
async function init() {
    const token = getToken();
    if (!token) {
        window.location.replace("/");
        return;
    }

    startLastUpdatedTimer();
    wireEvents();
    updateFooterYear();
    await loadHome();
}

init();
