/* =========================================
   API CONFIGURATION
========================================= */

const API_LOGIN_URL = "/api/growera/login";
const API_PROFILE_URL = "/api/growera/me";
const API_LOGOUT_URL = "/api/growera/logout";
const API_INVENTORY_URL = "/api/growera/inventory";
const API_ADMIN_CHECK_URL = "/api/growera/admin/check";
const API_NEWS_PUBLIC_URL = "/api/growera/news";
const API_NEWS_ADMIN_URL = "/api/growera/admin/news";
const API_REWARDS_PUBLIC_URL = "/api/growera/rewards";
const API_REWARDS_ADMIN_URL = "/api/growera/admin/rewards";

const SERVER_ID = "1791";


/* =========================================
   STORE CATEGORY CONFIG
========================================= */

const STORE_CATEGORIES = {
    topup: {
        eyebrow: "CRYSTAL STORE",
        title: "CRYSTAL STORE",
        subtitle: "Isi ulang Gems untuk membuka berbagai kesempatan eksklusif di Crystal Era.",
        currencyIcon: "💎",
        currencyName: "GEMS",
        variant: "crystal",
        showBalance: true
    },
    assets: {
        eyebrow: "ASSETS STORE",
        title: "ASSETS STORE",
        subtitle: "Perkuat koleksimu dan temukan berbagai aset berharga untuk perjalananmu di Crystal Era.",
        currencyIcon: "🟠",
        currencyName: "ASSETS CURRENCY",
        variant: "assets",
        showBalance: false
    },
    items: {
        eyebrow: "ITEMS STORE",
        title: "ITEMS STORE",
        subtitle: "Temukan item pilihan, koleksi eksklusif, dan berbagai perlengkapan untuk petualanganmu.",
        currencyIcon: "🟣",
        currencyName: "ITEMS CURRENCY",
        variant: "items",
        showBalance: false
    }
};

const STORAGE_KEYS = {
    token: "growera_token",
    username: "growera_username",
    expiresAt: "growera_expires_at"
};

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

let profileRequestID = 0;
let inventoryRequestID = 0;
let currentProfile = null;

let currentUserIsAdmin = false;

let newsState = {
    view: "roadmap",
    mode: "create",
    editingId: null,
    articles: []
};


/* =========================================
   STORAGE HELPERS
========================================= */

function saveSession(token, username, expiresAt) {
    const t = String(token || "");
    const u = String(username || "");
    const e = String(expiresAt || "");

    try {
        localStorage.setItem(STORAGE_KEYS.token, t);
        localStorage.setItem(STORAGE_KEYS.username, u);
        localStorage.setItem(STORAGE_KEYS.expiresAt, e);
    } catch (error) { console.warn("[GROWERA] localStorage gagal:", error); }

    try {
        sessionStorage.setItem(STORAGE_KEYS.token, t);
        sessionStorage.setItem(STORAGE_KEYS.username, u);
        sessionStorage.setItem(STORAGE_KEYS.expiresAt, e);
    } catch (error) { console.warn("[GROWERA] sessionStorage gagal:", error); }
}

function loadSession() {
    let token = null, username = null, expiresAt = null;

    try {
        token = localStorage.getItem(STORAGE_KEYS.token);
        username = localStorage.getItem(STORAGE_KEYS.username);
        expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
    } catch (error) { console.warn("[GROWERA] Baca localStorage gagal:", error); }

    if (!token || !username) {
        try {
            token = token || sessionStorage.getItem(STORAGE_KEYS.token);
            username = username || sessionStorage.getItem(STORAGE_KEYS.username);
            expiresAt = expiresAt || sessionStorage.getItem(STORAGE_KEYS.expiresAt);
        } catch (error) { console.warn("[GROWERA] Baca sessionStorage gagal:", error); }
    }

    return { token, username, expiresAt };
}

function clearSession() {
    try {
        localStorage.removeItem(STORAGE_KEYS.token);
        localStorage.removeItem(STORAGE_KEYS.username);
        localStorage.removeItem(STORAGE_KEYS.expiresAt);
    } catch (error) { console.warn("[GROWERA] Hapus localStorage gagal:", error); }

    try {
        sessionStorage.removeItem(STORAGE_KEYS.token);
        sessionStorage.removeItem(STORAGE_KEYS.username);
        sessionStorage.removeItem(STORAGE_KEYS.expiresAt);
    } catch (error) { console.warn("[GROWERA] Hapus sessionStorage gagal:", error); }
}


/* =========================================
   HELPERS
========================================= */

function showLoginMessage(message, color) {
    loginMessage.textContent = message;
    loginMessage.style.color = color || "#9BAAC3";
}

function formatNumber(value) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 0
    }).format(number);
}

function formatRupiah(amount) {
    const number = Number(amount) || 0;
    return "Rp " + new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 0
    }).format(number);
}

function formatDateTime(unixSeconds) {
    const n = Number(unixSeconds);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n * 1000).toLocaleString("id-ID");
}

function getInitial(username) {
    return String(username || "P").trim().charAt(0).toUpperCase() || "P";
}

async function readJSONResponse(response) {
    const raw = await response.text();
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(
            "Respons API bukan JSON yang valid. HTTP " + response.status
        );
    }
}

function setStatusElement(element, message, color) {
    if (!element) return;
    let dot = element.querySelector(".status-dot");
    if (!dot) {
        dot = document.createElement("span");
        dot.className = "status-dot";
        element.prepend(dot);
    }
    dot.style.background = color;
    element.style.color = color;
    Array.from(element.childNodes).forEach(function(node) {
        if (node !== dot) node.remove();
    });
    element.appendChild(document.createTextNode(message));
}

function setPlayerStatus(message, color) {
    setStatusElement(document.getElementById("playerStatus"), message, color);
}

function setProfileStatus(message, color) {
    setStatusElement(document.getElementById("profileStatusMessage"), message, color);
}


/* =========================================
   SCREEN SWITCHERS
========================================= */

function showLoginScreen() {
    loginScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
}

function hideLoginScreen() {
    loginScreen.classList.add("hidden");
}


/* =========================================
   ADMIN CHECK
========================================= */

function updateAdminUI() {
    const btn = document.getElementById("adminEditorBtn");
    if (!btn) return;
    if (currentUserIsAdmin) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
}

async function checkAdminStatus() {
    const session = loadSession();

    if (!session.token) {
        currentUserIsAdmin = false;
        updateAdminUI();
        return false;
    }

    try {
        const response = await fetch(API_ADMIN_CHECK_URL, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        if (!response.ok) {
            currentUserIsAdmin = false;
            updateAdminUI();
            return false;
        }

        const data = await readJSONResponse(response);
        currentUserIsAdmin = data.isAdmin === true;
        updateAdminUI();
        return currentUserIsAdmin;
    } catch (error) {
        console.warn("[GROWERA ADMIN] Check failed:", error);
        currentUserIsAdmin = false;
        updateAdminUI();
        return false;
    }
}


/* =========================================
   LOGIN REQUEST
========================================= */

async function loginRequest(username, password) {
    const response = await fetch(API_LOGIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ username, password }),
        cache: "no-store"
    });

    const data = await readJSONResponse(response);

    if (!response.ok || data.success !== true) {
        throw new Error(data.message || "Login gagal.");
    }

    if (!data.user || typeof data.user.username !== "string") {
        throw new Error("Respons login tidak memiliki identitas pengguna.");
    }

    if (typeof data.token !== "string" || !data.token) {
        throw new Error("Token sesi tidak ditemukan pada respons API.");
    }

    return {
        username: data.user.username,
        token: data.token,
        expiresAt: data.expiresAt
    };
}


/* =========================================
   SHOW DASHBOARD
========================================= */

function showDashboard(username) {
    const initial = getInitial(username);

    document.getElementById("headerUsername").textContent = username;
    document.getElementById("playerUsername").textContent = username;
    document.getElementById("profileUsername").textContent = username;

    document.getElementById("headerAvatar").textContent = initial;
    document.getElementById("playerAvatar").textContent = initial;

    hideLoginScreen();
    dashboardScreen.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "auto" });
    navigateTo("home");
}


/* =========================================
   RESET PROFILE DISPLAY
========================================= */

function resetProfileDisplay() {
    currentProfile = null;

    document.getElementById("statPlaytime").textContent = "—";
    document.getElementById("statPlaytimeNote").textContent =
        "Memuat data dari server...";

    document.getElementById("profileError").classList.add("hidden");
    document.getElementById("profileDetails").replaceChildren();

    const placeholder = document.createElement("p");
    placeholder.textContent = "Sedang mengambil data profil...";
    document.getElementById("profileDetails").appendChild(placeholder);

    setPlayerStatus("Memuat...", "#65E7FF");
    setProfileStatus("Memuat profil pemain...", "#65E7FF");

    document.getElementById("rightPlayerUsername").textContent = "Memuat...";
    document.getElementById("rightPlayerRole").textContent = "Memuat role...";
    document.getElementById("rightPlayerAvatar").textContent = "P";
    document.getElementById("rightPlayerLevel").textContent = "—";
    document.getElementById("rightPlayerUserID").textContent = "—";
    document.getElementById("rightPlayerGems").textContent = "—";
    document.getElementById("rightPlayerPlaytime").textContent = "—";

    resetPlayerOverview();
    updateTopupBalance(null);
}


/* =========================================
   RENDER PROFILE
========================================= */

function renderProfileDetails(profile) {
    const container = document.getElementById("profileDetails");
    container.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Account Information";
    heading.style.color = "#65E7FF";
    container.appendChild(heading);

    const roleName = profile.role && profile.role.name
        ? profile.role.name : "Player";
    const roleID = profile.role && profile.role.id !== undefined
        ? profile.role.id : 0;

    const fields = [
        ["Username", profile.username],
        ["Display Name", profile.displayName],
        ["User ID", profile.userID],
        ["Level", formatNumber(profile.level)],
        ["XP", formatNumber(profile.xp)],
        ["Required XP", formatNumber(profile.requiredXP)],
        ["Gems", formatNumber(profile.gems)],
        ["Playtime (raw)", formatNumber(profile.playtime)],
        ["Role", roleName],
        ["Role ID", formatNumber(roleID)]
    ];

    fields.forEach(function(field) {
        const row = document.createElement("div");
        row.className = "profile-details-row";

        const label = document.createElement("span");
        label.className = "profile-details-label";
        label.textContent = field[0];

        const value = document.createElement("span");
        value.className = "profile-details-value";
        value.textContent = field[1] === null || field[1] === undefined
            ? "—" : String(field[1]);

        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
    });

    const createdAt = Number(profile.accountCreatedAt);

    if (Number.isFinite(createdAt) && createdAt > 0) {
        const row = document.createElement("div");
        row.className = "profile-details-row";

        const label = document.createElement("span");
        label.className = "profile-details-label";
        label.textContent = "Account Created";

        const value = document.createElement("span");
        value.className = "profile-details-value";
        value.textContent = new Date(createdAt * 1000).toLocaleString("id-ID");

        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
    }

    const note = document.createElement("p");
    note.textContent =
        "Playtime ditampilkan sesuai nilai mentah dari server. " +
        "Satuannya belum dikonfirmasi.";
    note.style.fontSize = "11px";
    note.style.color = "#7186A4";
    container.appendChild(note);
}


/* =========================================
   PLAYER OVERVIEW
========================================= */

function resetPlayerOverview() {
    document.getElementById("playerLevel").textContent = "—";
    document.getElementById("playerGems").textContent = "—";
    document.getElementById("levelProgressXP").textContent = "— / — XP";
    document.getElementById("levelProgressFill").style.width = "0%";
    document.getElementById("levelProgressPercent").textContent = "0%";
    document.getElementById("levelProgressRemaining").textContent = "Memuat...";
}

function updatePlayerOverview(profile) {
    if (!profile) return;

    const level = Number(profile.level) || 0;
    const xp = Number(profile.xp) || 0;
    const requiredXP = Number(profile.requiredXP) || 0;

    document.getElementById("playerLevel").textContent = formatNumber(level);
    document.getElementById("playerGems").textContent = formatNumber(profile.gems);

    if (requiredXP > 0) {
        const percent = Math.min(100, Math.max(0, (xp / requiredXP) * 100));

        document.getElementById("levelProgressXP").textContent =
            formatNumber(xp) + " / " + formatNumber(requiredXP) + " XP";

        document.getElementById("levelProgressFill").style.width =
            percent.toFixed(2) + "%";

        document.getElementById("levelProgressPercent").textContent =
            percent.toFixed(1) + "%";

        const remaining = Math.max(0, requiredXP - xp);

        document.getElementById("levelProgressRemaining").textContent =
            remaining === 0 ? "Siap naik level"
                : "Butuh " + formatNumber(remaining) + " XP lagi";
    } else {
        document.getElementById("levelProgressXP").textContent =
            formatNumber(xp) + " XP";
        document.getElementById("levelProgressFill").style.width = "0%";
        document.getElementById("levelProgressPercent").textContent = "—";
        document.getElementById("levelProgressRemaining").textContent =
            "Data required XP belum tersedia dari server";
    }
}


/* =========================================
   TOP UP PAGE
========================================= */

const TOPUP_PACKAGES = [
    { id: "starter", gems: 100, bonusPercent: 0, price: 15000, tier: "starter", badge: null },
    { id: "basic", gems: 300, bonusPercent: 5, price: 40000, tier: "basic", badge: null },
    { id: "popular", gems: 800, bonusPercent: 15, price: 100000, tier: "popular", badge: "⭐ POPULER" },
    { id: "best", gems: 1800, bonusPercent: 20, price: 200000, tier: "best", badge: "🔥 BEST VALUE" },
    { id: "mega", gems: 5000, bonusPercent: 25, price: 500000, tier: "mega", badge: "🟠 MEGA PACK" },
    { id: "divine", gems: 35000, bonusPercent: 40, price: 1500000, tier: "divine", badge: "🌈 DIVINE PACK" }
];

function renderTopupPackages() {
    const grid = document.getElementById("topupGrid");
    if (!grid) return;

    grid.replaceChildren();

    TOPUP_PACKAGES.forEach(function (pkg) {
        const card = document.createElement("div");
        card.className = "topup-card";

        if (pkg.tier === "popular" || pkg.tier === "best") card.classList.add("featured");
        if (pkg.tier === "mega") card.classList.add("tier-mega");
        if (pkg.tier === "divine") card.classList.add("tier-divine");

        if (pkg.badge) {
            const badge = document.createElement("div");
            badge.className = "topup-card-badge";
            if (pkg.tier === "mega") badge.classList.add("mega");
            if (pkg.tier === "divine") badge.classList.add("divine");
            badge.textContent = pkg.badge;
            card.appendChild(badge);
        }

        const gemsRow = document.createElement("div");
        gemsRow.className = "topup-card-gems";

        const gemsIcon = document.createElement("div");
        gemsIcon.className = "topup-card-gems-icon";
        gemsIcon.textContent = "💎";

        const gemsTextBlock = document.createElement("div");
        const gemsValue = document.createElement("div");
        gemsValue.className = "topup-card-gems-value";
        gemsValue.textContent = formatNumber(pkg.gems);

        const gemsUnit = document.createElement("div");
        gemsUnit.className = "topup-card-gems-unit";
        gemsUnit.textContent = "GEMS";

        gemsTextBlock.appendChild(gemsValue);
        gemsTextBlock.appendChild(gemsUnit);
        gemsRow.appendChild(gemsIcon);
        gemsRow.appendChild(gemsTextBlock);
        card.appendChild(gemsRow);

        if (pkg.bonusPercent > 0) {
            const bonus = document.createElement("div");
            bonus.className = "topup-card-bonus";
            bonus.textContent = "+" + pkg.bonusPercent + "% BONUS";
            card.appendChild(bonus);
        }

        const divider = document.createElement("div");
        divider.className = "topup-card-divider";
        card.appendChild(divider);

        const price = document.createElement("div");
        price.className = "topup-card-price";
        price.textContent = formatRupiah(pkg.price);
        card.appendChild(price);

        const totalReceived = Math.floor(
            pkg.gems + (pkg.gems * pkg.bonusPercent / 100)
        );

        const total = document.createElement("div");
        total.className = "topup-card-total";
        total.innerHTML = "Total <strong>" + formatNumber(totalReceived) + " 💎</strong>";
        card.appendChild(total);

        const buyBtn = document.createElement("button");
        buyBtn.className = "topup-buy-btn";
        buyBtn.type = "button";
        buyBtn.textContent = "Beli";
        buyBtn.addEventListener("click", function () { handleTopupBuy(pkg); });
        card.appendChild(buyBtn);

        grid.appendChild(card);
    });
}

function updateTopupBalance(profile) {
    const el = document.getElementById("topupBalance");
    if (!el) return;
    if (!profile) { el.textContent = "—"; return; }
    el.textContent = formatNumber(profile.gems) + " 💎";
}

function handleTopupBuy(pkg) {
    alert(
        "Paket: " + formatNumber(pkg.gems) + " Gems (" +
        formatRupiah(pkg.price) + ")\n\n" +
        "Pembayaran otomatis akan segera tersedia."
    );
}

function updateStoreHeader(categoryKey) {
    const cat = STORE_CATEGORIES[categoryKey];
    if (!cat) return;

    const header = document.getElementById("storeHeader");
    const eyebrow = document.getElementById("storeEyebrow");
    const title = document.getElementById("storeTitle");
    const subtitle = document.getElementById("storeSubtitle");
    const currencyIcon = document.getElementById("storeCurrencyIcon");
    const currencyName = document.getElementById("storeCurrencyName");
    const balanceWrap = document.getElementById("topupBalanceWrap");

    if (header) header.dataset.variant = cat.variant;
    if (eyebrow) eyebrow.textContent = cat.eyebrow;
    if (title) title.textContent = cat.title;
    if (subtitle) subtitle.textContent = cat.subtitle;
    if (currencyIcon) currencyIcon.textContent = cat.currencyIcon;
    if (currencyName) currencyName.textContent = cat.currencyName;
    if (balanceWrap) balanceWrap.classList.toggle("hidden", !cat.showBalance);
}

document.querySelectorAll("[data-topup-tab]").forEach(function (tab) {
    tab.addEventListener("click", function () {
        const target = tab.dataset.topupTab;

        document.querySelectorAll("[data-topup-tab]").forEach(function (t) {
            t.classList.toggle("active", t.dataset.topupTab === target);
        });

        const panels = {
            topup: "topupPanelTopup",
            assets: "topupPanelAssets",
            items: "topupPanelItems"
        };

        Object.keys(panels).forEach(function (key) {
            const el = document.getElementById(panels[key]);
            if (!el) return;
            el.classList.toggle("hidden", key !== target);
        });

        updateStoreHeader(target);
        const content = document.querySelector(".content");
        if (content) content.scrollTo({ top: 0, behavior: "auto" });
    });
});


/* =========================================
   PROFILE ERROR
========================================= */

function showProfileError(message) {
    const errorBox = document.getElementById("profileError");
    const errorMessage = document.getElementById("profileErrorMessage");

    errorMessage.textContent = message;
    errorBox.classList.remove("hidden");

    document.getElementById("profileDetails").replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "Profile API Error";
    heading.style.color = "#FF8585";

    const detail = document.createElement("p");
    detail.textContent = message;

    document.getElementById("profileDetails").appendChild(heading);
    document.getElementById("profileDetails").appendChild(detail);

    setPlayerStatus("Gagal memuat profil", "#FF8585");
    setProfileStatus("Gagal memuat profil", "#FF8585");

    document.getElementById("rightPlayerRole").textContent = "Gagal memuat profil";

    resetPlayerOverview();
}


/* =========================================
   FETCH PLAYER PROFILE
========================================= */

async function fetchPlayerProfile() {
    const session = loadSession();

    if (!session.token) {
        showProfileError("Token login tidak ditemukan. Silakan login kembali.");
        return "unauthorized";
    }

    const requestID = ++profileRequestID;
    resetProfileDisplay();

    try {
        const response = await fetch(API_PROFILE_URL, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        if (requestID !== profileRequestID) return "error";

        if (response.status === 401) {
            showProfileError("Sesi tidak valid atau telah berakhir.");
            return "unauthorized";
        }

        const data = await readJSONResponse(response);
        if (requestID !== profileRequestID) return "error";

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "Gagal mengambil profil.");
        }

        if (!data.user || typeof data.user !== "object") {
            throw new Error("Respons API tidak memiliki data user.");
        }

        const profile = data.user;
        if (!profile.username) {
            throw new Error("Username tidak ditemukan pada data profil.");
        }

        currentProfile = profile;

        const roleName = profile.role && profile.role.name
            ? profile.role.name : "Player";

        document.getElementById("rightPlayerUsername").textContent =
            profile.username || "Player";
        document.getElementById("rightPlayerRole").textContent = roleName;
        document.getElementById("rightPlayerAvatar").textContent =
            getInitial(profile.username);
        document.getElementById("rightPlayerLevel").textContent =
            formatNumber(profile.level);
        document.getElementById("rightPlayerUserID").textContent =
            formatNumber(profile.userID);
        document.getElementById("rightPlayerGems").textContent =
            formatNumber(profile.gems);
        document.getElementById("rightPlayerPlaytime").textContent =
            formatNumber(profile.playtime);

        const username = String(profile.username);
        const initial = getInitial(username);

        document.getElementById("headerUsername").textContent = username;
        document.getElementById("playerUsername").textContent = username;
        document.getElementById("profileUsername").textContent = username;

        document.getElementById("headerAvatar").textContent = initial;
        document.getElementById("playerAvatar").textContent = initial;

        document.getElementById("statPlaytime").textContent =
            formatNumber(profile.playtime);
        document.getElementById("statPlaytimeNote").textContent =
            "Nilai playtime dari server";

        updatePlayerOverview(profile);
        updateTopupBalance(profile);
        renderProfileDetails(profile);

        document.getElementById("profileError").classList.add("hidden");

        setPlayerStatus("Profil berhasil dimuat", "#58FFAD");
        setProfileStatus("Profil berhasil dimuat", "#58FFAD");

        return "ok";
    } catch (error) {
        if (requestID !== profileRequestID) return "error";
        console.error("[GROWERA PROFILE ERROR]", error);
        showProfileError(error.message || "Tidak dapat mengambil data profil.");
        return "error";
    }
}


/* =========================================
   HOME NEWS — HERO + LIST
========================================= */

async function loadHomeNews() {
    try {
        const response = await fetch(API_NEWS_PUBLIC_URL, {
            cache: "no-store"
        });

        const data = await readJSONResponse(response);
        if (!response.ok || data.success !== true) return;

        const articles = Array.isArray(data.articles) ? data.articles : [];

        if (articles.length === 0) {
            document.getElementById("newsListSection").classList.add("hidden");
            return;
        }

        const newest = articles[0];
        setHeroNews(newest);

        const others = articles.slice(1, 5);
        renderNewsList(others);
    } catch (err) {
        console.warn("[GROWERA] Load home news failed:", err);
    }
}

function setHeroNews(article) {
    if (!article) return;

    document.getElementById("newsTitle").textContent = article.title || "Untitled";
    document.getElementById("newsExcerpt").textContent = article.excerpt || "";
    document.getElementById("newsBadge").textContent = article.badge || "GROWERA NEWS";

    const dateEl = document.getElementById("newsDate");
    if (dateEl && article.updatedAt) {
        dateEl.textContent = "Update " +
            new Date(article.updatedAt * 1000).toLocaleDateString("id-ID");
    }

    window.__currentHomeArticle = article;
}

function renderNewsList(articles) {
    const section = document.getElementById("newsListSection");
    const container = document.getElementById("newsListContainer");

    if (!section || !container) return;

    if (!Array.isArray(articles) || articles.length === 0) {
        section.classList.add("hidden");
        return;
    }

    section.classList.remove("hidden");
    container.replaceChildren();

    articles.forEach(function (article) {
        const item = document.createElement("button");
        item.className = "news-list-mini";
        item.type = "button";

        const info = document.createElement("div");
        info.className = "news-list-mini-info";

        const title = document.createElement("div");
        title.className = "news-list-mini-title";
        title.textContent = article.title || "Untitled";

        const date = document.createElement("div");
        date.className = "news-list-mini-date";
        date.textContent = article.updatedAt
            ? new Date(article.updatedAt * 1000).toLocaleDateString("id-ID")
            : "—";

        info.appendChild(title);
        info.appendChild(date);

        const arrow = document.createElement("span");
        arrow.className = "news-list-mini-arrow";
        arrow.textContent = "→";

        item.appendChild(info);
        item.appendChild(arrow);

        item.addEventListener("click", function () {
            openNewsModalWith(article);
        });

        container.appendChild(item);
    });
}

function openNewsModalWith(article) {
    const modal = document.getElementById("newsModal");
    if (!modal || !article) return;

    document.getElementById("newsModalBadge").textContent =
        article.badge || "CRYSTAL ERA";

    document.getElementById("newsModalTitle").textContent =
        article.title || "Untitled";

    document.getElementById("newsModalMeta").textContent =
        "Dipublikasikan oleh " + (article.author || "GROWERA") + " · " +
        (article.updatedAt
            ? new Date(article.updatedAt * 1000).toLocaleDateString("id-ID")
            : "—");

    const bodyEl = document.getElementById("newsModalBody");
    bodyEl.replaceChildren();

    const body = String(article.body || "").trim();

    if (body === "") {
        const emptyPara = document.createElement("p");
        emptyPara.textContent = "(Artikel ini belum memiliki isi.)";
        emptyPara.style.color = "var(--muted)";
        emptyPara.style.fontStyle = "italic";
        bodyEl.appendChild(emptyPara);
    } else {
        const paragraphs = body.split(/\n\s*\n/);
        paragraphs.forEach(function (raw) {
            const text = raw.trim();
            if (!text) return;

            const para = document.createElement("p");
            para.textContent = text;
            bodyEl.appendChild(para);
        });
    }

    modal.classList.add("open");
}

function openNewsModal() {
    if (window.__currentHomeArticle) {
        openNewsModalWith(window.__currentHomeArticle);
    } else {
        const modal = document.getElementById("newsModal");
        if (modal) modal.classList.add("open");
    }
}

function closeNewsModal() {
    const modal = document.getElementById("newsModal");
    if (!modal) return;
    modal.classList.remove("open");
}


/* =========================================
   INVENTORY
========================================= */

function itemTextureURL(itemId) {
    return "https://api.gtps.cloud/api/item/texture/" + SERVER_ID + "/" + itemId;
}

function openInventoryModal() {
    const modal = document.getElementById("inventoryModal");
    if (!modal) return;
    modal.classList.add("open");
    fetchInventory();
}

function closeInventoryModal() {
    const modal = document.getElementById("inventoryModal");
    if (!modal) return;
    modal.classList.remove("open");
}

async function fetchInventory() {
    const grid = document.getElementById("inventoryGrid");
    const note = document.getElementById("inventoryNote");
    if (!grid || !note) return;

    grid.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "Memuat inventory...";
    loading.style.color = "var(--muted)";
    loading.style.fontSize = "12px";
    grid.appendChild(loading);

    note.textContent = "Menghubungi server...";

    const session = loadSession();
    if (!session.token) {
        note.textContent = "Token tidak ditemukan.";
        grid.replaceChildren();
        return;
    }

    const requestID = ++inventoryRequestID;

    try {
        const response = await fetch(API_INVENTORY_URL, {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);
        if (requestID !== inventoryRequestID) return;

        if (response.status === 401) {
            note.textContent = "Sesi tidak valid. Silakan login ulang.";
            grid.replaceChildren();
            return;
        }

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        const items = Array.isArray(data.items) ? data.items : [];
        const sourceLabel = data.source === "live" ? "live scan" : "cache server";
        const updatedAt = Number(data.updatedAt);

        let updatedLabel = "";
        if (Number.isFinite(updatedAt) && updatedAt > 0) {
            updatedLabel = " · update: " + new Date(
                updatedAt * 1000
            ).toLocaleString("id-ID");
        }

        note.textContent = "Sumber: " + sourceLabel +
            " · " + items.length + " jenis item" + updatedLabel;

        renderInventory(items);
    } catch (error) {
        if (requestID !== inventoryRequestID) return;
        console.error("[GROWERA INVENTORY ERROR]", error);
        note.textContent = "Gagal memuat inventory: " + (error.message || "unknown");
        grid.replaceChildren();
        const errorLine = document.createElement("p");
        errorLine.textContent = "Tidak dapat mengambil inventory dari server.";
        errorLine.style.color = "var(--danger)";
        errorLine.style.fontSize = "12px";
        grid.appendChild(errorLine);
    }
}

function renderInventory(items) {
    const grid = document.getElementById("inventoryGrid");
    if (!grid) return;
    grid.replaceChildren();

    if (!Array.isArray(items) || items.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "Inventory kosong.";
        empty.style.color = "var(--muted)";
        empty.style.fontSize = "12px";
        grid.appendChild(empty);
        return;
    }

    items.forEach(function (item) {
        const itemID = Number(item.id);
        const itemName = String(item.name || ("Item #" + itemID));
        const itemCount = Number(item.count) || 0;

        const card = document.createElement("div");
        card.className = "inventory-item";
        card.title = itemName + " (ID: " + itemID + ")";

        const icon = document.createElement("img");
        icon.className = "inventory-item-icon";
        icon.alt = itemName;
        icon.loading = "lazy";
        icon.src = itemTextureURL(itemID);

        icon.addEventListener("error", function () {
            const fallback = document.createElement("span");
            fallback.className = "inventory-item-icon";
            fallback.textContent = "📦";
            fallback.title = "Texture tidak tersedia";
            if (icon.parentNode === card) card.replaceChild(fallback, icon);
        });

        const nameEl = document.createElement("div");
        nameEl.className = "inventory-item-name";
        nameEl.textContent = itemName;

        const countEl = document.createElement("div");
        countEl.className = "inventory-item-count";
        countEl.textContent = "× " + formatNumber(itemCount);

        card.appendChild(icon);
        card.appendChild(nameEl);
        card.appendChild(countEl);
        grid.appendChild(card);
    });
}


/* =========================================
   NEWS EDITOR
========================================= */

function showEditorView(viewName) {
    const views = {
        roadmap:        "editorViewRoadmap",
        list:           "editorViewNewsList",
        form:           "editorViewNewsForm",
        "rewards-list": "editorViewRewardsList",
        "rewards-form": "editorViewRewardsForm"
    };

    Object.keys(views).forEach(function (key) {
        const el = document.getElementById(views[key]);
        if (!el) return;
        el.classList.toggle("hidden", key !== viewName);
    });

    newsState.view = viewName;

    const content = document.querySelector(".content");
    if (content) content.scrollTo({ top: 0, behavior: "auto" });
}

function resetNewsForm() {
    document.getElementById("newsFormTitleInput").value = "";
    document.getElementById("newsFormBadge").value = "GROWERA NEWS";
    document.getElementById("newsFormExcerpt").value = "";
    document.getElementById("newsFormBody").value = "";
    newsState.mode = "create";
    newsState.editingId = null;
    document.getElementById("newsFormTitle").textContent = "Buat Artikel Baru";
}

function fillNewsForm(article) {
    document.getElementById("newsFormTitleInput").value = article.title || "";
    document.getElementById("newsFormBadge").value = article.badge || "GROWERA NEWS";
    document.getElementById("newsFormExcerpt").value = article.excerpt || "";
    document.getElementById("newsFormBody").value = article.body || "";
    newsState.mode = "edit";
    newsState.editingId = article.id;
    document.getElementById("newsFormTitle").textContent = "Edit Artikel";
}

async function loadNewsList() {
    const container = document.getElementById("newsListContainer");
    if (!container) return;

    container.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Memuat artikel...</p>';

    const session = loadSession();
    if (!session.token) {
        container.innerHTML = '<p style="color:var(--danger);font-size:12px">Token tidak ditemukan.</p>';
        return;
    }

    try {
        const response = await fetch(API_NEWS_ADMIN_URL, {
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        newsState.articles = Array.isArray(data.articles) ? data.articles : [];
        renderNewsListAdmin(newsState.articles);
    } catch (err) {
        container.innerHTML = '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Gagal memuat: ' + err.message + '</p>';
    }
}

function renderNewsListAdmin(articles) {
    const container = document.getElementById("newsListContainer");
    if (!container) return;

    if (articles.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:30px">Belum ada artikel.<br>Klik "+ Baru" untuk mulai.</p>';
        return;
    }

    container.innerHTML = "";

    articles.forEach(function (article) {
        const item = document.createElement("div");
        item.className = "news-list-item";

        const content = document.createElement("div");
        content.className = "news-list-item-content";

        const header = document.createElement("div");
        header.className = "news-list-item-header";

        const badge = document.createElement("span");
        badge.className = "news-status-badge " +
            (article.status === "published" ? "published" : "draft");
        badge.textContent = article.status;

        const title = document.createElement("h3");
        title.className = "news-list-item-title";
        title.textContent = article.title;

        header.appendChild(badge);
        header.appendChild(title);

        const excerpt = document.createElement("p");
        excerpt.className = "news-list-item-excerpt";
        excerpt.textContent = article.excerpt || "(tanpa excerpt)";

        const meta = document.createElement("div");
        meta.className = "news-list-item-meta";

        const dateSpan = document.createElement("span");
        dateSpan.textContent = formatDateTime(article.updatedAt);

        const sep = document.createElement("span");
        sep.textContent = "·";

        const authorSpan = document.createElement("span");
        authorSpan.textContent = article.author || "unknown";

        meta.appendChild(dateSpan);
        meta.appendChild(sep);
        meta.appendChild(authorSpan);

        content.appendChild(header);
        content.appendChild(excerpt);
        content.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "news-list-item-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "news-action-btn edit";
        editBtn.type = "button";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", function () {
            editNews(article.id);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "news-action-btn delete";
        deleteBtn.type = "button";
        deleteBtn.textContent = "Hapus";
        deleteBtn.addEventListener("click", function () {
            deleteNews(article.id, article.title);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(content);
        item.appendChild(actions);

        container.appendChild(item);
    });
}

async function editNews(id) {
    const session = loadSession();
    if (!session.token) return;

    try {
        const response = await fetch(API_NEWS_ADMIN_URL + "/" + id, {
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        fillNewsForm(data.article);
        showEditorView("form");
    } catch (err) {
        alert("Gagal memuat artikel: " + err.message);
    }
}

async function deleteNews(id, title) {
    if (!confirm('Hapus artikel "' + title + '"?\n\nTindakan ini tidak bisa dibatalkan.')) {
        return;
    }

    const session = loadSession();
    if (!session.token) return;

    try {
        const response = await fetch(API_NEWS_ADMIN_URL + "/" + id, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        alert("Artikel dihapus.");
        await loadNewsList();
        await loadHomeNews();
    } catch (err) {
        alert("Gagal menghapus: " + err.message);
    }
}

async function saveNews(status) {
    const title = document.getElementById("newsFormTitleInput").value.trim();
    const badge = document.getElementById("newsFormBadge").value.trim() || "GROWERA NEWS";
    const excerpt = document.getElementById("newsFormExcerpt").value.trim();
    const body = document.getElementById("newsFormBody").value.trim();

    if (!title) {
        alert("Title wajib diisi.");
        return;
    }

    if (status === "published" && !body) {
        alert("Body wajib diisi untuk publish. Simpan sebagai draft kalau belum selesai.");
        return;
    }

    const session = loadSession();
    if (!session.token) return;

    const payload = { title, badge, excerpt, body, status };

    const isEdit = newsState.mode === "edit";
    const url = isEdit
        ? API_NEWS_ADMIN_URL + "/" + newsState.editingId
        : API_NEWS_ADMIN_URL;

    const method = isEdit ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Authorization": "Bearer " + session.token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload),
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        alert(status === "published"
            ? "Artikel dipublikasikan."
            : "Draft tersimpan.");

        showEditorView("list");
        await loadNewsList();
        await loadHomeNews();
    } catch (err) {
        alert("Gagal menyimpan: " + err.message);
    }
}

function initNewsEditor() {
    const roadmapNewsBtn = document.querySelector('[data-editor-module="news"]');
    if (roadmapNewsBtn) {
        roadmapNewsBtn.addEventListener("click", function () {
            showEditorView("list");
            loadNewsList();
        });
    }

    const backToRoadmap = document.getElementById("newsBackToRoadmap");
    if (backToRoadmap) {
        backToRoadmap.addEventListener("click", function () {
            showEditorView("roadmap");
        });
    }

    const createBtn = document.getElementById("newsCreateBtn");
    if (createBtn) {
        createBtn.addEventListener("click", function () {
            resetNewsForm();
            showEditorView("form");
        });
    }

    const formBack = document.getElementById("newsFormBack");
    if (formBack) {
        formBack.addEventListener("click", function () {
            showEditorView("list");
            loadNewsList();
        });
    }

    const formCancel = document.getElementById("newsFormCancel");
    if (formCancel) {
        formCancel.addEventListener("click", function () {
            showEditorView("list");
            loadNewsList();
        });
    }

    const saveDraft = document.getElementById("newsFormSaveDraft");
    if (saveDraft) {
        saveDraft.addEventListener("click", function () {
            saveNews("draft");
        });
    }

    const publish = document.getElementById("newsFormPublish");
    if (publish) {
        publish.addEventListener("click", function () {
            saveNews("published");
        });
    }
}


/* =========================================
   REWARDS SYSTEM
========================================= */

const REWARD_CATEGORIES = {
    "milestone": {
        key: "milestone",
        eyebrow: "MILESTONE REWARDS",
        title: "Milestone",
        subtitle: "Reach new milestones and unlock your legacy.",
        icon: "💠",
        variant: "milestone",
        actionLabel: "View Rewards",
        modalSubtitle: "Every achievement tells a story."
    },
    "daily-login": {
        key: "daily-login",
        eyebrow: "DAILY LOGIN",
        title: "Daily Login",
        subtitle: "Return every day. Discover new rewards.",
        icon: "🎁",
        variant: "daily-login",
        actionLabel: "View Rewards",
        modalSubtitle: "Return every day. Discover new rewards."
    },
    "daily-quest": {
        key: "daily-quest",
        eyebrow: "DAILY QUEST",
        title: "Daily Quest",
        subtitle: "Complete your daily challenges.",
        icon: "⚔️",
        variant: "daily-quest",
        actionLabel: "View Quests",
        modalSubtitle: "Crystal Challenges"
    },
    "weekly-quest": {
        key: "weekly-quest",
        eyebrow: "WEEKLY QUEST",
        title: "Weekly Quest",
        subtitle: "Take on greater challenges every week.",
        icon: "📅",
        variant: "weekly-quest",
        actionLabel: "View Quests",
        modalSubtitle: "Weekly Trials"
    },
    "monthly-quest": {
        key: "monthly-quest",
        eyebrow: "MONTHLY QUEST",
        title: "Monthly Quest",
        subtitle: "One month. Greater challenges. Legendary rewards.",
        icon: "👑",
        variant: "monthly-quest",
        actionLabel: "Explore Monthly",
        modalSubtitle: "Legendary Trials"
    }
};

const RARITY_LABELS = {
    common:    "Common",
    rare:      "Rare",
    epic:      "Epic",
    legendary: "Legendary",
    divine:    "Divine"
};

const rewardsState = {
    items: [],
    editingId: null,
    mode: "create",
    filter: "all",
    loaded: false
};


/* =========================================
   REWARDS — PUBLIC PAGE
========================================= */

function renderRewardsCards() {
    const grid = document.getElementById("rewardsGrid");
    if (!grid) return;

    grid.replaceChildren();

    Object.values(REWARD_CATEGORIES).forEach(function (cat) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "rewards-card";
        card.dataset.variant = cat.variant;
        card.setAttribute("aria-label", cat.title + " — " + cat.actionLabel);

        const icon = document.createElement("div");
        icon.className = "rewards-card-icon";
        icon.textContent = cat.icon;

        const label = document.createElement("div");
        label.className = "rewards-card-label";
        label.textContent = cat.eyebrow;

        const title = document.createElement("h3");
        title.className = "rewards-card-title";
        title.textContent = cat.title;

        const desc = document.createElement("p");
        desc.className = "rewards-card-desc";
        desc.textContent = cat.subtitle;

        const action = document.createElement("div");
        action.className = "rewards-card-action";

        const actionLabel = document.createElement("span");
        actionLabel.textContent = cat.actionLabel;

        const arrow = document.createElement("span");
        arrow.className = "rewards-card-arrow";
        arrow.textContent = "→";

        action.appendChild(actionLabel);
        action.appendChild(arrow);

        card.appendChild(icon);
        card.appendChild(label);
        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(action);

        card.addEventListener("click", function () {
            openRewardsModal(cat.key);
        });

        grid.appendChild(card);
    });
}

async function loadPublicRewards() {
    try {
        const response = await fetch(API_REWARDS_PUBLIC_URL, {
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            rewardsState.items = [];
            rewardsState.loaded = true;
            return;
        }

        rewardsState.items = Array.isArray(data.rewards) ? data.rewards : [];
        rewardsState.loaded = true;
    } catch (err) {
        console.warn("[GROWERA REWARDS] Load public rewards failed:", err);
        rewardsState.items = [];
        rewardsState.loaded = true;
    }
}


/* =========================================
   REWARDS — MODAL
========================================= */

function openRewardsModal(categoryKey) {
    const cat = REWARD_CATEGORIES[categoryKey];
    if (!cat) return;

    const modal = document.getElementById("rewardsModal");
    const content = document.getElementById("rewardsModalContent");
    const icon = document.getElementById("rewardsModalIcon");
    const title = document.getElementById("rewardsModalTitle");
    const subtitle = document.getElementById("rewardsModalSubtitle");

    if (!modal || !content) return;

    content.dataset.variant = cat.variant;
    icon.textContent = cat.icon;
    title.textContent = cat.eyebrow;
    subtitle.textContent = cat.modalSubtitle;

    renderRewardsModalBody(categoryKey);

    modal.classList.add("open");

    const body = document.getElementById("rewardsModalBody");
    if (body) body.scrollTop = 0;
}

function closeRewardsModal() {
    const modal = document.getElementById("rewardsModal");
    if (!modal) return;
    modal.classList.remove("open");
}

function getPublishedRewardsByCategory(categoryKey) {
    return rewardsState.items
        .filter(function (it) {
            return it &&
                it.category === categoryKey &&
                (it.status === "published" || !it.status);
        })
        .sort(function (a, b) {
            const oa = Number(a.order) || 0;
            const ob = Number(b.order) || 0;
            if (oa !== ob) return oa - ob;
            return String(a.name || "").localeCompare(String(b.name || ""));
        });
}

function renderRewardsModalBody(categoryKey) {
    const body = document.getElementById("rewardsModalBody");
    if (!body) return;

    body.replaceChildren();

    const items = getPublishedRewardsByCategory(categoryKey);

    if (items.length === 0) {
        body.appendChild(renderRewardsEmptyState(categoryKey));
        return;
    }

    if (categoryKey === "daily-login") {
        renderDailyLoginBody(body, items);
        return;
    }

    if (categoryKey === "monthly-quest") {
        renderMonthlyQuestBody(body, items);
        return;
    }

    renderRewardsListBody(body, items);
}

function renderRewardsEmptyState(categoryKey) {
    const wrap = document.createElement("div");
    wrap.className = "rewards-empty";

    const icon = document.createElement("span");
    icon.className = "rewards-empty-icon";
    icon.textContent = "🔒";

    const line1 = document.createElement("div");
    line1.textContent = "Belum ada reward untuk kategori ini.";

    const line2 = document.createElement("div");
    line2.style.marginTop = "6px";
    line2.style.fontSize = "10.5px";
    line2.style.letterSpacing = "1.5px";
    line2.style.textTransform = "uppercase";
    line2.style.fontFamily = "monospace";
    line2.textContent = "COMING SOON";

    wrap.appendChild(icon);
    wrap.appendChild(line1);
    wrap.appendChild(line2);

    return wrap;
}

function rewardRarityClass(rarity) {
    const valid = ["common", "rare", "epic", "legendary", "divine"];
    const r = valid.includes(rarity) ? rarity : "common";
    return "rarity-" + r;
}


/* --- List style (milestone, daily-quest, weekly-quest) --- */

function renderRewardsListBody(body, items) {
    const label = document.createElement("div");
    label.className = "rewards-modal-section-label";
    label.textContent = "Available Rewards";
    body.appendChild(label);

    items.forEach(function (item) {
        body.appendChild(buildRewardItemRow(item));
    });
}

function buildRewardItemRow(item) {
    const rarity = item.rarity || "common";
    const rarityClass = rewardRarityClass(rarity);

    const row = document.createElement("div");
    row.className = "reward-item " + rarityClass;

    const icon = document.createElement("div");
    icon.className = "reward-item-icon";
    icon.textContent = item.icon || "◇";

    const content = document.createElement("div");
    content.className = "reward-item-content";

    const name = document.createElement("h3");
    name.className = "reward-item-name";
    name.textContent = item.name || "Untitled Reward";

    const desc = document.createElement("p");
    desc.className = "reward-item-desc";
    desc.textContent = item.description || "";

    const footer = document.createElement("div");
    footer.className = "reward-item-footer";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.gap = "6px";
    left.style.alignItems = "center";
    left.style.flexWrap = "wrap";

    const rarityBadge = document.createElement("span");
    rarityBadge.className = "reward-item-rarity";
    rarityBadge.textContent = RARITY_LABELS[rarity] || "Common";
    left.appendChild(rarityBadge);

    if (item.progress) {
        const prog = document.createElement("span");
        prog.className = "reward-item-progress";
        prog.textContent = "PROGRESS " + item.progress;
        left.appendChild(prog);
    }

    footer.appendChild(left);

    if (item.reward) {
        const rewardEl = document.createElement("span");
        rewardEl.className = "reward-item-reward";
        rewardEl.textContent = "🎁 " + item.reward;
        footer.appendChild(rewardEl);
    }

    content.appendChild(name);
    if (item.description) content.appendChild(desc);
    content.appendChild(footer);

    row.appendChild(icon);
    row.appendChild(content);

    return row;
}


/* --- Daily Login style (calendar grid) --- */

function renderDailyLoginBody(body, items) {
    const label = document.createElement("div");
    label.className = "rewards-modal-section-label";
    label.textContent = "7-Day Login Calendar";
    body.appendChild(label);

    const grid = document.createElement("div");
    grid.className = "rewards-login-grid";

    const sorted = items.slice().sort(function (a, b) {
        const da = Number(a.day) || Number(a.order) || 0;
        const db = Number(b.day) || Number(b.order) || 0;
        return da - db;
    });

    sorted.forEach(function (item) {
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);

        const day = document.createElement("div");
        day.className = "rewards-login-day " + rarityClass;

        const labelEl = document.createElement("div");
        labelEl.className = "rewards-login-day-label";
        labelEl.textContent = "Day " + (item.day || item.order || "?");

        const iconEl = document.createElement("div");
        iconEl.className = "rewards-login-day-icon";
        iconEl.textContent = item.icon || "🎁";

        const nameEl = document.createElement("div");
        nameEl.className = "rewards-login-day-name";
        nameEl.textContent = item.name || "Reward";

        const rarityEl = document.createElement("div");
        rarityEl.className = "rewards-login-day-rarity";
        rarityEl.textContent = RARITY_LABELS[rarity] || "Common";

        day.appendChild(labelEl);
        day.appendChild(iconEl);
        day.appendChild(nameEl);
        day.appendChild(rarityEl);

        grid.appendChild(day);
    });

    body.appendChild(grid);

    const note = document.createElement("p");
    note.style.margin = "14px 0 0";
    note.style.color = "var(--muted)";
    note.style.fontSize = "11px";
    note.style.lineHeight = "1.6";
    note.style.textAlign = "center";
    note.textContent = "Kalender di atas masih dalam tahap desain. Sistem klaim harian belum aktif.";
    body.appendChild(note);
}


/* --- Monthly Quest style (hero + list) --- */

function renderMonthlyQuestBody(body, items) {
    const heroItem = items.find(function (it) { return it.featured; }) || items[0];
    const rest = items.filter(function (it) { return it !== heroItem; });

    if (heroItem) {
        const hero = document.createElement("div");
        hero.className = "rewards-monthly-hero";

        const label = document.createElement("div");
        label.className = "rewards-monthly-hero-label";
        label.textContent = "FEATURED MONTHLY REWARD";

        const title = document.createElement("h3");
        title.className = "rewards-monthly-hero-title";
        title.textContent = heroItem.name || "Crystal Sovereign";

        const desc = document.createElement("p");
        desc.className = "rewards-monthly-hero-desc";
        desc.textContent = heroItem.description || "";

        const emblem = document.createElement("div");
        emblem.className = "rewards-monthly-hero-emblem";
        emblem.textContent = heroItem.icon || "👑";

        hero.appendChild(label);
        hero.appendChild(title);
        if (heroItem.description) hero.appendChild(desc);
        hero.appendChild(emblem);

        body.appendChild(hero);
    }

    if (rest.length > 0) {
        const listLabel = document.createElement("div");
        listLabel.className = "rewards-modal-section-label";
        listLabel.textContent = "Legendary Challenges";
        body.appendChild(listLabel);

        rest.forEach(function (item) {
            body.appendChild(buildRewardItemRow(item));
        });
    }
}


/* =========================================
   REWARDS — ADMIN EDITOR
========================================= */

async function loadAdminRewards() {
    const container = document.getElementById("rewardsAdminList");
    if (!container) return;

    container.innerHTML =
        '<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Memuat reward...</p>';

    const session = loadSession();
    if (!session.token) {
        container.innerHTML =
            '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Token tidak ditemukan.</p>';
        return;
    }

    try {
        const response = await fetch(API_REWARDS_ADMIN_URL, {
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        rewardsState.items = Array.isArray(data.rewards) ? data.rewards : [];
        renderAdminRewardsList();
    } catch (err) {
        container.innerHTML =
            '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Gagal memuat: ' +
            err.message + '</p>';
    }
}

function renderAdminRewardsList() {
    const container = document.getElementById("rewardsAdminList");
    if (!container) return;

    const filter = rewardsState.filter || "all";
    const list = rewardsState.items
        .filter(function (it) {
            return filter === "all" || it.category === filter;
        })
        .sort(function (a, b) {
            const ca = String(a.category || "");
            const cb = String(b.category || "");
            if (ca !== cb) return ca.localeCompare(cb);
            const oa = Number(a.order) || 0;
            const ob = Number(b.order) || 0;
            return oa - ob;
        });

    if (list.length === 0) {
        container.innerHTML =
            '<p style="color:var(--muted);font-size:12px;text-align:center;padding:30px">' +
            'Belum ada reward untuk kategori ini.<br>Klik "+ Baru" untuk mulai.' +
            '</p>';
        return;
    }

    container.innerHTML = "";

    list.forEach(function (item) {
        const cat = REWARD_CATEGORIES[item.category];
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);

        const row = document.createElement("div");
        row.className = "news-list-item";

        const content = document.createElement("div");
        content.className = "news-list-item-content";

        const header = document.createElement("div");
        header.className = "news-list-item-header";

        const statusBadge = document.createElement("span");
        statusBadge.className = "news-status-badge " +
            (item.status === "published" ? "published" : "draft");
        statusBadge.textContent = item.status || "draft";

        const catBadge = document.createElement("span");
        catBadge.className = "news-status-badge";
        catBadge.style.background = "rgba(155, 123, 255, 0.12)";
        catBadge.style.border = "1px solid rgba(155, 123, 255, 0.3)";
        catBadge.style.color = "#C7B8FF";
        catBadge.textContent = cat ? (cat.icon + " " + cat.title) : item.category;

        const rarityBadge = document.createElement("span");
        rarityBadge.className = "news-status-badge " + rarityClass;
        rarityBadge.style.background = "rgba(255,255,255,0.04)";
        rarityBadge.style.border = "1px solid var(--rarity-color, rgba(130,160,210,0.3))";
        rarityBadge.style.color = "var(--rarity-color, var(--muted))";
        rarityBadge.textContent = RARITY_LABELS[rarity] || "Common";

        const title = document.createElement("h3");
        title.className = "news-list-item-title";
        title.textContent = (item.icon || "") + " " + (item.name || "Untitled");

        header.appendChild(statusBadge);
        header.appendChild(catBadge);
        header.appendChild(rarityBadge);
        header.appendChild(title);

        const excerpt = document.createElement("p");
        excerpt.className = "news-list-item-excerpt";
        excerpt.textContent = item.description || "(tanpa deskripsi)";

        const meta = document.createElement("div");
        meta.className = "news-list-item-meta";
        meta.appendChild(document.createTextNode(
            "order " + (item.order || 0) + " · " + formatDateTime(item.updatedAt)
        ));

        content.appendChild(header);
        content.appendChild(excerpt);
        content.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "news-list-item-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "news-action-btn edit";
        editBtn.type = "button";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", function () { editReward(item.id); });

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "news-action-btn delete";
        deleteBtn.type = "button";
        deleteBtn.textContent = "Hapus";
        deleteBtn.addEventListener("click", function () {
            deleteReward(item.id, item.name);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        row.appendChild(content);
        row.appendChild(actions);
        container.appendChild(row);
    });
}

function resetRewardsForm() {
    document.getElementById("rewardsFormCategory").value = "milestone";
    document.getElementById("rewardsFormName").value = "";
    document.getElementById("rewardsFormDescription").value = "";
    document.getElementById("rewardsFormIcon").value = "";
    document.getElementById("rewardsFormRarity").value = "common";
    document.getElementById("rewardsFormProgress").value = "";
    document.getElementById("rewardsFormDay").value = "";
    document.getElementById("rewardsFormReward").value = "";
    document.getElementById("rewardsFormOrder").value = "0";
    document.getElementById("rewardsFormStatus").value = "draft";

    rewardsState.mode = "create";
    rewardsState.editingId = null;

    document.getElementById("rewardsFormTitle").textContent = "Buat Reward Baru";
}

function fillRewardsForm(item) {
    document.getElementById("rewardsFormCategory").value = item.category || "milestone";
    document.getElementById("rewardsFormName").value = item.name || "";
    document.getElementById("rewardsFormDescription").value = item.description || "";
    document.getElementById("rewardsFormIcon").value = item.icon || "";
    document.getElementById("rewardsFormRarity").value = item.rarity || "common";
    document.getElementById("rewardsFormProgress").value = item.progress || "";
    document.getElementById("rewardsFormDay").value =
        item.day !== undefined && item.day !== null ? item.day : "";
    document.getElementById("rewardsFormReward").value = item.reward || "";
    document.getElementById("rewardsFormOrder").value =
        item.order !== undefined && item.order !== null ? item.order : 0;
    document.getElementById("rewardsFormStatus").value = item.status || "draft";

    rewardsState.mode = "edit";
    rewardsState.editingId = item.id;

    document.getElementById("rewardsFormTitle").textContent = "Edit Reward";
}

async function editReward(id) {
    const session = loadSession();
    if (!session.token) return;

    try {
        const response = await fetch(API_REWARDS_ADMIN_URL + "/" + id, {
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        fillRewardsForm(data.reward);
        showEditorView("rewards-form");
    } catch (err) {
        alert("Gagal memuat reward: " + err.message);
    }
}

async function deleteReward(id, name) {
    if (!confirm('Hapus reward "' + (name || "ini") + '"?\n\nTindakan ini tidak bisa dibatalkan.')) {
        return;
    }

    const session = loadSession();
    if (!session.token) return;

    try {
        const response = await fetch(API_REWARDS_ADMIN_URL + "/" + id, {
            method: "DELETE",
            headers: {
                "Authorization": "Bearer " + session.token,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        alert("Reward dihapus.");
        await loadAdminRewards();
        await loadPublicRewards();
    } catch (err) {
        alert("Gagal menghapus: " + err.message);
    }
}

async function saveReward(status) {
    const category = document.getElementById("rewardsFormCategory").value;
    const name = document.getElementById("rewardsFormName").value.trim();
    const description = document.getElementById("rewardsFormDescription").value.trim();
    const icon = document.getElementById("rewardsFormIcon").value.trim();
    const rarity = document.getElementById("rewardsFormRarity").value;
    const progress = document.getElementById("rewardsFormProgress").value.trim();
    const dayRaw = document.getElementById("rewardsFormDay").value.trim();
    const reward = document.getElementById("rewardsFormReward").value.trim();
    const orderRaw = document.getElementById("rewardsFormOrder").value.trim();
    const formStatus = document.getElementById("rewardsFormStatus").value;

    if (!name) {
        alert("Name wajib diisi.");
        return;
    }

    const session = loadSession();
    if (!session.token) return;

    const payload = {
        category: category,
        name: name,
        description: description,
        icon: icon,
        rarity: rarity,
        progress: progress,
        reward: reward,
        order: Number(orderRaw) || 0,
        status: status || formStatus || "draft"
    };

    if (dayRaw !== "") {
        const dayNum = Number(dayRaw);
        if (Number.isFinite(dayNum) && dayNum > 0) payload.day = dayNum;
    }

    const isEdit = rewardsState.mode === "edit";
    const url = isEdit
        ? API_REWARDS_ADMIN_URL + "/" + rewardsState.editingId
        : API_REWARDS_ADMIN_URL;

    const method = isEdit ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Authorization": "Bearer " + session.token,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload),
            cache: "no-store"
        });

        const data = await readJSONResponse(response);

        if (!response.ok || data.success !== true) {
            throw new Error(data.message || "HTTP " + response.status);
        }

        alert(status === "published"
            ? "Reward dipublikasikan."
            : "Draft tersimpan.");

        showEditorView("rewards-list");
        await loadAdminRewards();
        await loadPublicRewards();
    } catch (err) {
        alert("Gagal menyimpan: " + err.message);
    }
}

function initRewardsEditor() {
    const roadmapBtn = document.querySelector('[data-editor-module="rewards"]');
    if (roadmapBtn) {
        roadmapBtn.addEventListener("click", function () {
            showEditorView("rewards-list");
            loadAdminRewards();
        });
    }

    const backToRoadmap = document.getElementById("rewardsBackToRoadmap");
    if (backToRoadmap) {
        backToRoadmap.addEventListener("click", function () {
            showEditorView("roadmap");
        });
    }

    const createBtn = document.getElementById("rewardsCreateBtn");
    if (createBtn) {
        createBtn.addEventListener("click", function () {
            resetRewardsForm();
            showEditorView("rewards-form");
        });
    }

    const filterWrap = document.getElementById("rewardsFilter");
    if (filterWrap) {
        filterWrap.querySelectorAll("[data-filter]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                filterWrap.querySelectorAll("[data-filter]").forEach(function (b) {
                    b.classList.toggle("active", b === btn);
                });
                rewardsState.filter = btn.dataset.filter || "all";
                renderAdminRewardsList();
            });
        });
    }

    const formBack = document.getElementById("rewardsFormBack");
    if (formBack) {
        formBack.addEventListener("click", function () {
            showEditorView("rewards-list");
            loadAdminRewards();
        });
    }

    const formCancel = document.getElementById("rewardsFormCancel");
    if (formCancel) {
        formCancel.addEventListener("click", function () {
            showEditorView("rewards-list");
            loadAdminRewards();
        });
    }

    const saveDraft = document.getElementById("rewardsFormSaveDraft");
    if (saveDraft) {
        saveDraft.addEventListener("click", function () {
            saveReward("draft");
        });
    }

    const publish = document.getElementById("rewardsFormPublish");
    if (publish) {
        publish.addEventListener("click", function () {
            saveReward("published");
        });
    }

    const modal = document.getElementById("rewardsModal");
    if (modal) {
        modal.addEventListener("click", function (event) {
            if (event.target === event.currentTarget) closeRewardsModal();
        });
    }

    const closeBtn = document.getElementById("rewardsModalCloseBtn");
    if (closeBtn) {
        closeBtn.addEventListener("click", closeRewardsModal);
    }

    renderRewardsCards();
}

function initRewardsPageObserver() {
    document.querySelectorAll('[data-page="rewards"]').forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (!rewardsState.loaded) {
                loadPublicRewards();
            }
        });
    });
}


/* =========================================
   PAGE NAVIGATION
========================================= */

function navigateTo(pageName) {
    const validPages = [
        "home", "profile", "rewards", "topup", "editor",
        "events", "history", "more"
    ];

    if (!validPages.includes(pageName)) pageName = "home";

    if (pageName === "editor" && !currentUserIsAdmin) {
        console.warn("[GROWERA] Akses editor ditolak.");
        pageName = "more";
    }

    document.querySelectorAll(".app-page").forEach(function(page) {
        page.classList.add("hidden");
    });

    let targetPage = document.getElementById(pageName + "Page");

    if (!targetPage) {
        pageName = "more";
        targetPage = document.getElementById("morePage");
    }

    if (!targetPage) return;

    targetPage.classList.remove("hidden");

    document.querySelectorAll(
        ".sidebar-nav .nav-button, .sidebar-bottom .nav-button"
    ).forEach(function(button) {
        button.classList.toggle("active", button.dataset.page === pageName);
    });

    if (pageName === "editor") {
        showEditorView("roadmap");
    }

    if (pageName === "rewards" && !rewardsState.loaded) {
        loadPublicRewards();
    }

    const content = document.querySelector(".content");
    if (content) content.scrollTo({ top: 0, behavior: "auto" });
}

document.querySelectorAll("[data-page]").forEach(function(button) {
    button.addEventListener("click", function() {
        navigateTo(button.dataset.page);
    });
});


/* =========================================
   LOGIN HANDLER
========================================= */

loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        showLoginMessage("Username dan password wajib diisi.", "#FF8585");
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "SIGNING IN...";
    showLoginMessage("Memeriksa kredensial akun...", "#65E7FF");

    try {
        const result = await loginRequest(username, password);

        saveSession(result.token, result.username, result.expiresAt);
        passwordInput.value = "";

        showDashboard(result.username);
        await fetchPlayerProfile();
        await checkAdminStatus();
        await loadHomeNews();
        await loadPublicRewards();
    } catch (error) {
        console.error("[GROWERA LOGIN ERROR]", error);
        showLoginMessage(
            error.message || "Tidak dapat menghubungi API GROWERA.",
            "#FF8585"
        );
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "SIGN IN";
    }
});


/* =========================================
   BUTTON EVENTS
========================================= */

document.getElementById("retryProfileButton").addEventListener("click", function() {
    fetchPlayerProfile();
});

document.getElementById("accountButton").addEventListener("click", function() {
    navigateTo("profile");
});

document.getElementById("newsReadMoreBtn").addEventListener("click", openNewsModal);

document.getElementById("newsModalCloseBtn").addEventListener("click", closeNewsModal);

document.getElementById("newsModal").addEventListener("click", function (event) {
    if (event.target === event.currentTarget) closeNewsModal();
});

document.getElementById("viewInventoryBtn").addEventListener("click", openInventoryModal);

document.getElementById("inventoryCloseBtn").addEventListener("click", closeInventoryModal);

document.getElementById("inventoryModal").addEventListener("click", function (event) {
    if (event.target === event.currentTarget) closeInventoryModal();
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closeInventoryModal();
        closeNewsModal();
        closeRewardsModal();
    }
});


/* =========================================
   LOGOUT
========================================= */

document.getElementById("logoutButton").addEventListener("click", async function() {
    const session = loadSession();

    profileRequestID++;
    inventoryRequestID++;
    currentProfile = null;

    if (session.token) {
        try {
            await fetch(API_LOGOUT_URL, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Accept": "application/json"
                },
                cache: "no-store"
            });
        } catch (error) {
            console.warn("[GROWERA LOGOUT] Request server gagal.");
        }
    }

    clearSession();

    currentUserIsAdmin = false;
    updateAdminUI();

    closeInventoryModal();
    closeNewsModal();
    closeRewardsModal();

    dashboardScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");

    loginForm.reset();

    showLoginMessage("Kamu telah keluar dari dashboard.", "#65E7FF");

    window.scrollTo({ top: 0, behavior: "auto" });
});

document.getElementById("sidebarLogoutButton").addEventListener("click", function() {
    document.getElementById("logoutButton").click();
});


/* =========================================
   BOOTSTRAP
========================================= */

async function bootstrap() {
    const session = loadSession();
    const dbg = document.getElementById("sessionDebug");

    renderTopupPackages();
    updateStoreHeader("topup");
    initNewsEditor();
    initRewardsEditor();
    initRewardsPageObserver();

    if (!session.token || !session.username) {
        if (dbg) dbg.textContent = "Tidak ada sesi tersimpan di browser.";
        showLoginScreen();
        return;
    }

    if (dbg) {
        dbg.textContent = "Sesi ditemukan untuk: " + session.username +
            " · mencoba memulihkan...";
    }

    showDashboard(session.username);

    const result = await fetchPlayerProfile();

    if (result === "unauthorized") {
        clearSession();
        showLoginScreen();
        showLoginMessage(
            "Sesi sebelumnya telah berakhir. Silakan login kembali.",
            "#FF8585"
        );
        if (dbg) dbg.textContent = "Sesi ditolak oleh server (401).";
        return;
    }

    if (result === "error") {
        if (dbg) dbg.textContent =
            "Sesi tersimpan, tapi server tidak merespons.";
        return;
    }

    if (dbg) dbg.textContent = "Sesi valid: " + session.username;

    await checkAdminStatus();
    await loadHomeNews();
    await loadPublicRewards();
}

bootstrap();
