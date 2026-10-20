// js/home.js
// Home page logic (dashboard hub + news display only)
// Post/edit/delete/pin news dilakukan di /admin.html

import {
    apiRequest,
    getToken,
    clearToken,
    toast,
    safeName, toNumber, fmt,
    itemImageUrl,
    getAchievementsMaster,
    getItemsMaster
} from "./core.js";

import { renderMarkdown, stripMarkdown } from "./markdown.js";

const $ = (s) => document.querySelector(s);

let isAuthenticated = false;
let isBusy = false;
let lastRefreshAt = 0;
let lastUpdatedTimerId = 0;

const player = {
    username: "Player",
    role: "player",
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

    const achEl = $("#navCountAch");
    if (achEl && data.achievements) {
        const unlocked = Array.isArray(data.achievements.unlockedIds)
            ? data.achievements.unlockedIds.length
            : (data.achievements.total || 0);
        achEl.textContent = String(unlocked);
    }

    const friendsEl = $("#navCountFriends");
    if (friendsEl && data.friends) {
        const total = Array.isArray(data.friends.list) ? data.friends.list.length : (data.friends.total || 0);
        friendsEl.textContent = String(total);
    }

    const guildEl = $("#navCountGuild");
    if (guildEl && data.guild) {
        const g = data.guild;
        guildEl.textContent = (!g.id || g.id <= 0) ? "None" : (g.title || ("#" + g.id));
    }

    const ptEl = $("#navCountPlaytime");
    if (ptEl) ptEl.textContent = formatShortPlaytime(player.playtime);

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
        role: String(source.role || "player").trim().toLowerCase() === "admin" ? "admin" : "player",
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

/* ============================================================
   NEWS — Display only (read-only di home page)
   ============================================================ */

let newsCache = [];
let isNewsBusy = false;

async function fetchLatestNews(limit = 5) {
    try {
        const result = await apiRequest("/news/latest?limit=" + limit, { method: "GET" });
        const list = Array.isArray(result?.news) ? result.news : [];
        return list;
    } catch (e) {
        console.warn("[GROWERA] Fetch news gagal:", e);
        return null;
    }
}

/* ===== Helpers ===== */
const NEWS_TAG_LABELS = {
    UPDATE: "✨ UPDATE",
    FIX: "🔧 FIX",
    EVENT: "🎉 EVENT",
    MAINTENANCE: "🛠️ MAINT",
    INFO: "📢 INFO"
};

function getTagClass(tag) {
    const t = String(tag || "UPDATE").toUpperCase();
    const valid = ["UPDATE", "FIX", "EVENT", "MAINTENANCE", "INFO"];
    if (!valid.includes(t)) return "tag-update";
    if (t === "MAINTENANCE") return "tag-maintenance";
    return "tag-" + t.toLowerCase();
}

function getTagLabel(tag) {
    const t = String(tag || "UPDATE").toUpperCase();
    return NEWS_TAG_LABELS[t] || "✨ UPDATE";
}

function formatNewsDate(unixSec) {
    const n = Number(unixSec) || 0;
    if (n <= 0) return "—";
    const nowSec = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, nowSec - n);

    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d ago";
    if (diff < 86400 * 30) return Math.floor(diff / (86400 * 7)) + "w ago";

    try {
        return new Date(n * 1000).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric"
        });
    } catch { return "—"; }
}

function formatNewsDateFull(unixSec) {
    const n = Number(unixSec) || 0;
    if (n <= 0) return "—";
    try {
        return new Date(n * 1000).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch { return "—"; }
}

function isNewNews(unixSec) {
    const n = Number(unixSec) || 0;
    if (n <= 0) return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return (nowSec - n) < (86400 * 3);
}

/* ===== Render News Card ===== */
function createNewsCard(news) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "news-card";
    if (news.pinned === 1) card.classList.add("is-pinned");
    card.setAttribute("aria-label", "Read news: " + (news.title || ""));

    // Pin badge
    if (news.pinned === 1) {
        const pinBadge = document.createElement("span");
        pinBadge.className = "news-pin-badge";
        pinBadge.textContent = "📌";
        pinBadge.title = "Pinned";
        card.appendChild(pinBadge);
    }

    const head = document.createElement("div");
    head.className = "news-card-head";

    const tag = document.createElement("span");
    tag.className = "news-tag " + getTagClass(news.tag);
    tag.textContent = getTagLabel(news.tag);
    head.appendChild(tag);

    if (isNewNews(news.createdAt)) {
        const dot = document.createElement("span");
        dot.className = "news-new-dot";
        dot.title = "Baru";
        head.appendChild(dot);
    }

    const date = document.createElement("span");
    date.className = "news-date";
    date.textContent = formatNewsDate(news.createdAt);
    head.appendChild(date);

    card.appendChild(head);

    const title = document.createElement("h3");
    title.className = "news-card-title";
    title.textContent = news.title || "(Tanpa judul)";
    card.appendChild(title);

    // Preview pakai renderMarkdown (compact mode)
    const previewWrap = document.createElement("div");
    previewWrap.className = "news-card-preview";
    try {
        const rendered = renderMarkdown(news.body);
        rendered.classList.add("is-compact");
        previewWrap.appendChild(rendered);
    } catch (e) {
        console.warn("[GROWERA] Preview markdown gagal, fallback text:", e);
        previewWrap.textContent = stripMarkdown(news.body, 140);
    }
    card.appendChild(previewWrap);

    const foot = document.createElement("div");
    foot.className = "news-card-foot";

    const author = document.createElement("span");
    author.className = "news-author";
    author.textContent = "@" + (news.author || "admin");
    foot.appendChild(author);

    const readMore = document.createElement("span");
    readMore.className = "news-read-more";
    readMore.textContent = "Read more →";
    foot.appendChild(readMore);

    card.appendChild(foot);

    card.addEventListener("click", () => openNewsDetail(news));
    return card;
}

/* ===== Render News List ===== */
function renderNewsList(newsItems) {
    const loading = $("#newsLoading");
    const list = $("#newsList");
    const empty = $("#newsEmpty");

    if (loading) loading.hidden = true;

    if (!newsItems || newsItems.length === 0) {
        if (list) { list.hidden = true; list.replaceChildren(); }
        if (empty) empty.hidden = false;
        return;
    }

    if (empty) empty.hidden = true;
    if (list) {
        list.hidden = false;
        list.replaceChildren();
        newsItems.forEach((n) => list.appendChild(createNewsCard(n)));
    }
}

/* ===== Load News ===== */
async function loadNews() {
    if (isNewsBusy) return;
    isNewsBusy = true;

    const loading = $("#newsLoading");
    const list = $("#newsList");
    const empty = $("#newsEmpty");

    if (loading) { loading.hidden = false; loading.textContent = "Memuat news..."; }
    if (list) list.hidden = true;
    if (empty) empty.hidden = true;

    try {
        const news = await fetchLatestNews(5);
        if (news === null) {
            if (loading) { loading.textContent = "Gagal memuat news."; loading.hidden = false; }
            return;
        }
        newsCache = news;
        renderNewsList(news);
    } catch (e) {
        console.error("[GROWERA] Load news gagal:", e);
        if (loading) { loading.textContent = "Gagal memuat news."; loading.hidden = false; }
    } finally {
        isNewsBusy = false;
    }
}

/* ===== Open News Detail Dialog ===== */
function openNewsDetail(news) {
    if (!news) return;
    const dlg = $("#dialogNewsDetail");
    if (!dlg) return;

    if ($("#newsDetailEyebrow")) {
        $("#newsDetailEyebrow").textContent = "NEWS · " + (news.tag || "UPDATE");
    }
    if ($("#newsDetailTitle")) $("#newsDetailTitle").textContent = news.title || "(Tanpa judul)";

    const tagEl = $("#newsDetailTag");
    if (tagEl) {
        tagEl.className = "news-tag " + getTagClass(news.tag);
        tagEl.textContent = getTagLabel(news.tag);
    }
    if ($("#newsDetailDate")) $("#newsDetailDate").textContent = formatNewsDateFull(news.createdAt);
    if ($("#newsDetailAuthor")) $("#newsDetailAuthor").textContent = "@" + (news.author || "admin");

    // Render markdown untuk body
    const bodyEl = $("#newsDetailBody");
    if (bodyEl) {
        bodyEl.replaceChildren();
        try {
            const rendered = renderMarkdown(news.body);
            bodyEl.appendChild(rendered);
        } catch (e) {
            console.warn("[GROWERA] Markdown render gagal:", e);
            bodyEl.textContent = news.body || "(Tanpa konten)";
        }
    }

    if (typeof dlg.showModal === "function") {
        if (!dlg.open) dlg.showModal();
    } else {
        dlg.setAttribute("open", "");
    }
}

/* ===== Wire News Detail Dialog Close ===== */
function wireNewsEvents() {
    const dlgDetail = $("#dialogNewsDetail");

    document.querySelectorAll('[data-close-dialog="dialogNewsDetail"]').forEach((btn) => {
        btn.addEventListener("click", () => {
            if (dlgDetail?.open && typeof dlgDetail.close === "function") dlgDetail.close();
            else dlgDetail?.removeAttribute("open");
        });
    });

    if (dlgDetail) {
        dlgDetail.addEventListener("click", (e) => {
            if (e.target === dlgDetail) {
                if (typeof dlgDetail.close === "function") dlgDetail.close();
                else dlgDetail.removeAttribute("open");
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && dlgDetail?.open) {
            if (typeof dlgDetail.close === "function") dlgDetail.close();
            else dlgDetail.removeAttribute("open");
        }
    });
}

/* ===== Admin Button Visibility ===== */
function updateAdminUI() {
    const btn = $("#adminPostNewsBtn");
    if (!btn) return;
    if (player.role === "admin") btn.hidden = false;
    else btn.hidden = true;
}

/* ============================================================
   END NEWS
   ============================================================ */

/* ===== Bootstrap Home ===== */
async function loadHome() {
    if (isBusy) return;
    isBusy = true;
    setSkeletonLoading(true);
    const btn = $("#refreshButton");
    if (btn) btn.classList.add("is-loading");

    try {
        const masterPromise = getAchievementsMaster().catch(() => null);
        // ▼ Preload items master supaya nama item muncul di markdown ▼
        const itemsPromise = getItemsMaster().catch(() => null);

        const full = await fetchHomeData();
        applyFullData(full);

        // Tunggu master achievements + items selesai load
        const [master] = await Promise.all([masterPromise, itemsPromise]);

        if (master && full?.achievements?.unlockedIds) {
            const achEl = $("#navCountAch");
            if (achEl) achEl.textContent = full.achievements.unlockedIds.length + "/" + master.length;
        }

        loadNews();
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
    updateAdminUI();
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
    wireNewsEvents();
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
