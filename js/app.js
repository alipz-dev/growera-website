/* =========================================
   GROWERA — CORE (v2, FIXED)
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
   SAFE CALL HELPER
   Panggil method opsional tanpa bikin error kalau tidak ada.
========================================= */

function safeCall(obj, methodName, args) {
    if (!obj) return Promise.resolve();
    if (typeof obj[methodName] !== "function") return Promise.resolve();

    try {
        const result = obj[methodName].apply(obj, args || []);
        if (result && typeof result.catch === "function") {
            return result.catch(function (err) {
                console.warn("[GROWERA] " + methodName + " error:", err);
            });
        }
        return Promise.resolve(result);
    } catch (err) {
        console.warn("[GROWERA] " + methodName + " threw:", err);
        return Promise.resolve();
    }
}


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
    if (!loginMessage) return;
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
    Array.from(element.childNodes).forEach(function (node) {
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
   SCROLL RESET HELPER
========================================= */

function resetContentScroll() {
    const content = document.querySelector(".content");
    if (!content) return;

    content.scrollTop = 0;

    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            content.scrollTop = 0;
        });
    });
}


/* =========================================
   SCREEN SWITCHERS
========================================= */

function showLoginScreen() {
    if (loginScreen) loginScreen.classList.remove("hidden");
    if (dashboardScreen) dashboardScreen.classList.add("hidden");
}

function hideLoginScreen() {
    if (loginScreen) loginScreen.classList.add("hidden");
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

    const headerUser = document.getElementById("headerUsername");
    if (headerUser) headerUser.textContent = username;

    const playerUser = document.getElementById("playerUsername");
    if (playerUser) playerUser.textContent = username;

    const profileUser = document.getElementById("profileUsername");
    if (profileUser) profileUser.textContent = username;

    const headerAvatar = document.getElementById("headerAvatar");
    if (headerAvatar) headerAvatar.textContent = initial;

    const playerAvatar = document.getElementById("playerAvatar");
    if (playerAvatar) playerAvatar.textContent = initial;

    hideLoginScreen();
    if (dashboardScreen) dashboardScreen.classList.remove("hidden");

    // FIX: set status default, jangan biarkan "Memuat..." dari HTML
    setPlayerStatus("Menyambung ke server...", "#65E7FF");
    setProfileStatus("Menyambung ke server...", "#65E7FF");

    window.scrollTo({ top: 0, behavior: "auto" });
    navigateTo("home");
}


/* =========================================
   EDITOR VIEW SWITCHER
========================================= */

function showEditorView(viewName) {
    const views = {
        roadmap:          "editorViewRoadmap",
        list:             "editorViewNewsList",
        form:             "editorViewNewsForm",
        "rewards-list":   "editorViewRewardsList",
        "rewards-form":   "editorViewRewardsForm",
        "topup-list":     "editorViewTopupList",
        "topup-form":     "editorViewTopupForm",
        "shop-categories": "editorViewShopCategories",
        "shop-packages":  "editorViewShopPackages",
        "shop-form":      "editorViewShopForm"
    };

    Object.keys(views).forEach(function (key) {
        const el = document.getElementById(views[key]);
        if (!el) return;
        el.classList.toggle("hidden", key !== viewName);
    });

    resetContentScroll();
}


/* =========================================
   PAGE NAVIGATION
========================================= */

function navigateTo(pageName) {
    const validPages = [
        "home", "profile", "rewards", "topup", "editor",
        "events", "history", "more"
    ];

    if (validPages.indexOf(pageName) === -1) pageName = "home";

    if (pageName === "editor" && !currentUserIsAdmin) {
        console.warn("[GROWERA] Akses editor ditolak.");
        pageName = "more";
    }

    document.querySelectorAll(".app-page").forEach(function (page) {
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
    ).forEach(function (button) {
        button.classList.toggle("active", button.dataset.page === pageName);
    });

    if (pageName === "editor") {
        showEditorView("roadmap");
    }

    // FIX: pakai safeCall supaya tidak error kalau method tidak ada
    if (pageName === "rewards") {
        safeCall(window.GroweraRewards, "onNavigate");
    }

    if (pageName === "topup") {
        safeCall(window.GroweraShop, "onNavigate");
    }

    resetContentScroll();
}

document.querySelectorAll("[data-page]").forEach(function (button) {
    button.addEventListener("click", function () {
        navigateTo(button.dataset.page);
    });
});


/* =========================================
   LOGIN HANDLER
========================================= */

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
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

            // FIX: pakai safeCall, admin check paralel
            await safeCall(window.GroweraProfile, "fetch");

            await checkAdminStatus();

            await safeCall(window.GroweraNews, "loadHome");
            await safeCall(window.GroweraShop, "loadPublic");
            await safeCall(window.GroweraRewards, "loadPublic");
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
}


/* =========================================
   BUTTON EVENTS
========================================= */

const accountButton = document.getElementById("accountButton");
if (accountButton) {
    accountButton.addEventListener("click", function () {
        navigateTo("profile");
    });
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        safeCall(window.GroweraProfile, "closeInventory");
        safeCall(window.GroweraNews, "closeModal");
        safeCall(window.GroweraRewards, "closeModal");
    }
});


/* =========================================
   LOGOUT
========================================= */

async function performLogout() {
    const session = loadSession();

    safeCall(window.GroweraProfile, "reset");

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

    safeCall(window.GroweraProfile, "closeInventory");
    safeCall(window.GroweraNews, "closeModal");
    safeCall(window.GroweraRewards, "closeModal");

    if (dashboardScreen) dashboardScreen.classList.add("hidden");
    if (loginScreen) loginScreen.classList.remove("hidden");

    if (loginForm) loginForm.reset();

    showLoginMessage("Kamu telah keluar dari dashboard.", "#65E7FF");

    window.scrollTo({ top: 0, behavior: "auto" });
}

const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
    logoutButton.addEventListener("click", performLogout);
}

const sidebarLogoutButton = document.getElementById("sidebarLogoutButton");
if (sidebarLogoutButton) {
    sidebarLogoutButton.addEventListener("click", performLogout);
}


/* =========================================
   BOOTSTRAP (FIXED)
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

    // FIX #1: cek admin PARALEL dengan fetch profile.
    // Jangan sampai admin button tidak muncul hanya karena profile gagal.
    const adminPromise = checkAdminStatus();

    let profileResult = "error";
    if (window.GroweraProfile && typeof window.GroweraProfile.fetch === "function") {
        profileResult = await window.GroweraProfile.fetch();
    }

    // FIX #2: kalau unauthorized, bersihkan sesi & balik ke login
    if (profileResult === "unauthorized") {
        clearSession();
        showLoginScreen();
        showLoginMessage(
            "Sesi sebelumnya telah berakhir. Silakan login kembali.",
            "#FF8585"
        );
        if (dbg) dbg.textContent = "Sesi ditolak oleh server (401).";
        return;
    }

    // FIX #3: kalau error, tetap tunggu admin check, jangan return diam-diam
    if (profileResult === "error") {
        if (dbg) dbg.textContent =
            "Sesi tersimpan, tapi server tidak merespons. Coba refresh.";
        await adminPromise.catch(function () {});
        return;
    }

    if (dbg) dbg.textContent = "Sesi valid: " + session.username;

    // Tunggu admin check selesai (kalau belum)
    await adminPromise.catch(function () {});

    // FIX #4: pakai safeCall — jangan error kalau method tidak ada
    await safeCall(window.GroweraNews, "loadHome");
    await safeCall(window.GroweraShop, "loadPublic");
    await safeCall(window.GroweraRewards, "loadPublic");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
} else {
    bootstrap();
}
