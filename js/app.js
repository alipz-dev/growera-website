/* =========================================
   GROWERA — CORE
   Login, session, navigasi, admin check,
   editor view switcher, helper global.

   Modul terpisah:
   - news.js     : News home + editor
   - shop.js     : Topup / Crystal Store + editor paket
   - profile.js  : Profil + inventory
   - rewards.js  : Rewards page + modal + editor

   Helper global yang dipakai modul lain:
   - loadSession(), readJSONResponse()
   - formatNumber(), formatRupiah(), formatDateTime()
   - getInitial(), showEditorView()
   - setStatusElement(), setPlayerStatus(), setProfileStatus()
========================================= */

/* =========================================
   API CONFIG
========================================= */

const API_LOGIN_URL = "/api/growera/login";
const API_LOGOUT_URL = "/api/growera/logout";
const API_ADMIN_CHECK_URL = "/api/growera/admin/check";


/* =========================================
   STORAGE KEYS
========================================= */

const STORAGE_KEYS = {
    token: "growera_token",
    username: "growera_username",
    expiresAt: "growera_expires_at"
};


/* =========================================
   DOM REFS (login)
========================================= */

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");


/* =========================================
   STATE
========================================= */

let currentUserIsAdmin = false;


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
   EDITOR VIEW SWITCHER (dipakai modul)
========================================= */

function showEditorView(viewName) {
    const views = {
        roadmap:        "editorViewRoadmap",
        list:           "editorViewNewsList",
        form:           "editorViewNewsForm",
        "rewards-list": "editorViewRewardsList",
        "rewards-form": "editorViewRewardsForm",
        "topup-list":   "editorViewTopupList",
        "topup-form":   "editorViewTopupForm"
    };

    Object.keys(views).forEach(function (key) {
        const el = document.getElementById(views[key]);
        if (!el) return;
        el.classList.toggle("hidden", key !== viewName);
    });

    const content = document.querySelector(".content");
    if (content) content.scrollTo({ top: 0, behavior: "auto" });
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

    if (pageName === "rewards" && window.GroweraRewards) {
        window.GroweraRewards.onNavigate();
    }

    if (pageName === "topup" && window.GroweraShop) {
        window.GroweraShop.onNavigate();
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

        if (window.GroweraProfile) await window.GroweraProfile.fetch();
        await checkAdminStatus();
        if (window.GroweraNews) await window.GroweraNews.loadHome();
        if (window.GroweraShop) await window.GroweraShop.loadPublic();
        if (window.GroweraRewards) await window.GroweraRewards.loadPublic();
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

document.getElementById("accountButton").addEventListener("click", function() {
    navigateTo("profile");
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        if (window.GroweraProfile) window.GroweraProfile.closeInventory();
        if (window.GroweraNews) window.GroweraNews.closeModal();
        if (window.GroweraRewards) window.GroweraRewards.closeModal();
    }
});


/* =========================================
   LOGOUT
========================================= */

document.getElementById("logoutButton").addEventListener("click", async function() {
    const session = loadSession();

    if (window.GroweraProfile) window.GroweraProfile.reset();

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

    if (window.GroweraProfile) window.GroweraProfile.closeInventory();
    if (window.GroweraNews) window.GroweraNews.closeModal();
    if (window.GroweraRewards) window.GroweraRewards.closeModal();

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

    let result = "error";
    if (window.GroweraProfile) {
        result = await window.GroweraProfile.fetch();
    }

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

    if (window.GroweraNews) await window.GroweraNews.loadHome();
    if (window.GroweraShop) await window.GroweraShop.loadPublic();
    if (window.GroweraRewards) await window.GroweraRewards.loadPublic();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
} else {
    bootstrap();
}
