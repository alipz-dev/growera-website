// js/login.js
// Login page logic + UX Tier 1
// Wrapper-based fade-in (CSS) → no JS timer for animation class

import { apiRequest, saveToken, clearToken } from "./core.js";

const $ = (s) => document.querySelector(s);

const REMEMBER_KEY = "growera_last_username";

const loginForm = $("#loginForm");
const formMessage = $("#formMessage");
const loginButton = $("#loginButton");
const usernameInput = $("#username");
const passwordInput = $("#password");
const loginCard = document.querySelector(".login-card");  // inner card untuk shake
const continueAsWrap = $("#continueAsWrap");
const continueAsBtn = $("#continueAsBtn");
const continueAsAvatar = $("#continueAsAvatar");
const continueAsUsername = $("#continueAsUsername");

let isBusy = false;
let submitTimerId = 0;
let submitStartAt = 0;

/* ===== Message ===== */
function setMessage(message, type = "error") {
    if (!formMessage) return;
    formMessage.textContent = message || "";
    if (message) formMessage.dataset.type = type;
    else delete formMessage.dataset.type;
}

/* ===== Remember Username ===== */
function saveLastUsername(username) {
    try {
        const clean = String(username || "").trim();
        if (clean) localStorage.setItem(REMEMBER_KEY, clean);
    } catch {}
}

function getLastUsername() {
    try {
        return String(localStorage.getItem(REMEMBER_KEY) || "").trim();
    } catch { return ""; }
}

/* ===== Continue As ===== */
function showContinueAs(username) {
    if (!continueAsWrap || !username) return;
    const name = String(username).trim();
    if (!name) return;
    if (continueAsUsername) continueAsUsername.textContent = "@" + name;
    if (continueAsAvatar) continueAsAvatar.textContent = name.charAt(0).toUpperCase();
    continueAsWrap.hidden = false;
}

function hideContinueAs() {
    if (continueAsWrap) continueAsWrap.hidden = true;
}

function updateContinueAsVisibility() {
    const last = getLastUsername();
    if (!last) { hideContinueAs(); return; }
    const current = (usernameInput?.value || "").trim();
    if (current === "" || current === last) {
        showContinueAs(last);
    } else {
        hideContinueAs();
    }
}

function handleContinueAsClick() {
    const last = getLastUsername();
    if (!last || !usernameInput) return;
    usernameInput.value = last;
    hideContinueAs();
    setMessage("");
    setTimeout(() => passwordInput?.focus(), 50);
}

/* ===== Shake Animation ===== */
function triggerShake() {
    if (!loginCard) return;
    loginCard.classList.remove("is-shaking");
    void loginCard.offsetWidth;
    loginCard.classList.add("is-shaking");
    setTimeout(() => {
        loginCard.classList.remove("is-shaking");
    }, 500);
}

/* ===== Submit Timer ===== */
function formatSubmitLabel(seconds) {
    if (seconds < 0.5) return "SIGNING IN";
    return "SIGNING IN (" + seconds.toFixed(1) + "s)";
}

function startSubmitTimer() {
    submitStartAt = performance.now();
    if (submitTimerId) clearInterval(submitTimerId);
    submitTimerId = setInterval(() => {
        const elapsed = (performance.now() - submitStartAt) / 1000;
        const label = loginButton?.querySelector(".btn-label");
        if (label) label.textContent = formatSubmitLabel(elapsed);
    }, 100);
}

function stopSubmitTimer() {
    if (submitTimerId) {
        clearInterval(submitTimerId);
        submitTimerId = 0;
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

    if (isBusy) startSubmitTimer();
    else stopSubmitTimer();
}

/* ===== Smart Refocus ===== */
function smartRefocusAfterError() {
    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!username) { usernameInput?.focus(); return; }
    if (!password) { passwordInput?.focus(); return; }
    if (passwordInput) {
        passwordInput.focus();
        try { passwordInput.select(); } catch {}
    }
}

/* ===== Clear Error on Typing ===== */
function wireInputClearOnType() {
    const handler = () => {
        if (formMessage?.textContent) setMessage("");
    };
    usernameInput?.addEventListener("input", handler);
    passwordInput?.addEventListener("input", handler);
}

/* ===== Smart Initial Focus ===== */
function smartInitialFocus() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    setTimeout(() => {
        const userFilled = usernameInput?.value.trim() !== "";
        if (userFilled && passwordInput) {
            passwordInput.focus();
        } else {
            usernameInput?.focus();
        }
    }, 200);
}

/* ===== Login Handler ===== */
async function handleLogin(event) {
    event.preventDefault();
    if (isBusy) return;

    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    if (!username || !password) {
        setMessage("Masukkan username dan password.", "error");
        triggerShake();
        if (!username) usernameInput?.focus();
        else if (!password) passwordInput?.focus();
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
        const token = result?.token || result?.accessToken || result?.data?.token || result?.data?.accessToken;
        saveToken(token);
        saveLastUsername(username);
        window.location.replace("/profile.html");
    } catch (error) {
        clearToken();
        console.error("[GROWERA] Login gagal:", error);
        const msg = error.isAuthError
            ? "Username atau password salah."
            : (error.message || "Login gagal. Silakan coba lagi.");
        setMessage(msg, "error");
        triggerShake();
        smartRefocusAfterError();
    } finally {
        setBusy(false);
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

/* ===== Caps Lock Warning ===== */
function wireCapsLock() {
    const warn = $("#capsLockWarning");
    if (!warn) return;
    function check(e) {
        if (typeof e.getModifierState !== "function") return;
        warn.classList.toggle("show", Boolean(e.getModifierState("CapsLock")));
    }
    document.addEventListener("keydown", check);
    document.addEventListener("keyup", check);
}

/* ===== Footer Year ===== */
function updateFooterYear() {
    const year = String(new Date().getFullYear());
    if ($("#year")) $("#year").textContent = year;
}

/* ===== Init ===== */
function init() {
    // Prefill username + tampilkan Continue As kalau ada last username
    const last = getLastUsername();
    if (last && usernameInput) {
        usernameInput.value = last;
        showContinueAs(last);
    }

    // Visibility listener (hide kalau user ketik username berbeda)
    usernameInput?.addEventListener("input", updateContinueAsVisibility);

    // Continue As click
    continueAsBtn?.addEventListener("click", handleContinueAsClick);

    // Clear error saat user ketik ulang
    wireInputClearOnType();

    // Focus pintar (skip username kalau sudah prefilled)
    smartInitialFocus();
}

/* ===== Bootstrap ===== */
loginForm?.addEventListener("submit", handleLogin);
wirePasswordToggle();
wireCapsLock();
updateFooterYear();
init();
