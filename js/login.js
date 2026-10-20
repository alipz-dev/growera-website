// js/login.js
// Login page logic + UX Tier 1
// Redirect target: /home.html (bukan /profile.html)

import { apiRequest, saveToken, clearToken } from "./core.js";

const $ = (s) => document.querySelector(s);
const REMEMBER_KEY = "growera_last_username";

const loginForm = $("#loginForm");
const formMessage = $("#formMessage");
const loginButton = $("#loginButton");
const usernameInput = $("#username");
const passwordInput = $("#password");
const loginCard = document.querySelector(".login-card");
const continueAsWrap = $("#continueAsWrap");
const continueAsBtn = $("#continueAsBtn");
const continueAsAvatar = $("#continueAsAvatar");
const continueAsUsername = $("#continueAsUsername");

let isBusy = false;
let submitTimerId = 0;
let submitStartAt = 0;

function setMessage(message, type = "error") {
    if (!formMessage) return;
    formMessage.textContent = message || "";
    if (message) formMessage.dataset.type = type;
    else delete formMessage.dataset.type;
}

function saveLastUsername(username) {
    try {
        const clean = String(username || "").trim();
        if (clean) localStorage.setItem(REMEMBER_KEY, clean);
    } catch {}
}

function getLastUsername() {
    try { return String(localStorage.getItem(REMEMBER_KEY) || "").trim(); }
    catch { return ""; }
}

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
    if (current === "" || current === last) showContinueAs(last);
    else hideContinueAs();
}

function handleContinueAsClick() {
    const last = getLastUsername();
    if (!last || !usernameInput) return;
    usernameInput.value = last;
    hideContinueAs();
    setMessage("");
    setTimeout(() => passwordInput?.focus(), 50);
}

function triggerShake() {
    if (!loginCard) return;
    loginCard.classList.remove("is-shaking");
    void loginCard.offsetWidth;
    loginCard.classList.add("is-shaking");
    setTimeout(() => loginCard.classList.remove("is-shaking"), 500);
}

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
    if (submitTimerId) { clearInterval(submitTimerId); submitTimerId = 0; }
}

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

function wireInputClearOnType() {
    const handler = () => { if (formMessage?.textContent) setMessage(""); };
    usernameInput?.addEventListener("input", handler);
    passwordInput?.addEventListener("input", handler);
}

function smartInitialFocus() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    setTimeout(() => {
        const userFilled = usernameInput?.value.trim() !== "";
        if (userFilled && passwordInput) passwordInput.focus();
        else usernameInput?.focus();
    }, 200);
}

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

        // ▼▼▼ INI PERUBAHANNYA — ke /home.html ▼▼▼
        window.location.replace("/home.html");
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
        warn.classList.toggle("show", Boolean(e.getModifierState("CapsLock")));
    }
    document.addEventListener("keydown", check);
    document.addEventListener("keyup", check);
}

function updateFooterYear() {
    if ($("#year")) $("#year").textContent = String(new Date().getFullYear());
}

function init() {
    const last = getLastUsername();
    if (last && usernameInput) {
        usernameInput.value = last;
        showContinueAs(last);
    }
    usernameInput?.addEventListener("input", updateContinueAsVisibility);
    continueAsBtn?.addEventListener("click", handleContinueAsClick);
    wireInputClearOnType();
    smartInitialFocus();
}

loginForm?.addEventListener("submit", handleLogin);
wirePasswordToggle();
wireCapsLock();
updateFooterYear();
init();
