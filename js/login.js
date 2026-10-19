// js/login.js
// Logic untuk login page (index.html)

import { apiRequest, saveToken, clearToken } from "./core.js";

const $ = (s) => document.querySelector(s);

const loginForm = $("#loginForm");
const formMessage = $("#formMessage");
const loginButton = $("#loginButton");
const usernameInput = $("#username");
const passwordInput = $("#password");

let isBusy = false;

/* ===== Messages ===== */
function setMessage(message, type = "error") {
    if (!formMessage) return;
    formMessage.textContent = message || "";
    if (message) formMessage.dataset.type = type;
    else delete formMessage.dataset.type;
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

        // Redirect to profile page
        window.location.replace("/profile.html");
    } catch (error) {
        clearToken();
        console.error("[GROWERA] Login gagal:", error);
        const msg = error.isAuthError
            ? "Username atau password salah."
            : (error.message || "Login gagal. Silakan coba lagi.");
        setMessage(msg, "error");
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

/* ===== Autofocus ===== */
function wireAutofocus() {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
    setTimeout(() => usernameInput?.focus(), 200);
}

/* ===== Footer Year ===== */
function updateFooterYear() {
    const year = String(new Date().getFullYear());
    if ($("#year")) $("#year").textContent = year;
}

/* ===== Init ===== */
loginForm?.addEventListener("submit", handleLogin);
wirePasswordToggle();
wireCapsLock();
wireAutofocus();
updateFooterYear();
