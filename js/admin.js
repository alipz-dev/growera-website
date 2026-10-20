// js/admin.js
// Admin panel — News CRUD (Create/Read/Update/Delete/Pin)

import {
    apiRequest,
    getToken,
    clearToken,
    toast
} from "./core.js";

import { renderMarkdown, stripMarkdown } from "./markdown.js";

const $ = (s) => document.querySelector(s);

let currentUser = { username: "", role: "player" };
let isAdmin = false;
let isBusy = false;
let newsList = [];

let editingId = null;       // null = create mode, number = edit mode
let deletingId = null;
let isSaving = false;
let isDeleting = false;

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

function formatDate(unixSec) {
    const n = Number(unixSec) || 0;
    if (n <= 0) return "—";
    const nowSec = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, nowSec - n);

    if (diff < 60) return "Just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + "d ago";

    try {
        return new Date(n * 1000).toLocaleDateString("id-ID", {
            day: "numeric", month: "short", year: "numeric"
        });
    } catch { return "—"; }
}

function formatDateFull(unixSec) {
    const n = Number(unixSec) || 0;
    if (n <= 0) return "—";
    try {
        return new Date(n * 1000).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    } catch { return "—"; }
}

/* ===== SVG Icons ===== */
const ICONS = {
    edit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    pin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>',
    unpin: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22" stroke="none" fill="none"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>',
    del: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>'
};

/* ===== Session & Admin Check ===== */
async function loadCurrentUser() {
    const token = getToken();
    if (!token) {
        window.location.replace("/");
        return false;
    }
    try {
        const result = await apiRequest("/me", {
            method: "GET",
            headers: { Authorization: "Bearer " + token }
        });
        const user = result?.user || result?.data?.user || {};
        currentUser = {
            username: String(user.username || "").trim() || "Player",
            role: String(user.role || "player").toLowerCase() === "admin" ? "admin" : "player"
        };
        isAdmin = currentUser.role === "admin";
        return true;
    } catch (e) {
        if (e.isAuthError) {
            clearToken();
            window.location.replace("/");
            return false;
        }
        console.error("[ADMIN] Load user gagal:", e);
        return false;
    }
}

function updateAdminVisibility() {
    const adminBadge = $("#adminName");
    if (adminBadge) adminBadge.textContent = currentUser.username.toUpperCase();

    const denied = $("#adminDenied");
    const content = $("#adminContent");

    if (isAdmin) {
        denied.hidden = true;
        content.hidden = false;
    } else {
        denied.hidden = false;
        content.hidden = true;
    }
}

/* ===== Fetch News List ===== */
async function fetchAllNews() {
    try {
        const result = await apiRequest("/news", { method: "GET" });
        return Array.isArray(result?.news) ? result.news : [];
    } catch (e) {
        console.error("[ADMIN] Fetch news gagal:", e);
        throw e;
    }
}

/* ===== Render News Card (Admin) ===== */
function createAdminCard(news) {
    const card = document.createElement("div");
    card.className = "admin-news-card";
    if (news.pinned === 1) card.classList.add("is-pinned");

    if (news.pinned === 1) {
        const pinBadge = document.createElement("span");
        pinBadge.className = "admin-news-pin-badge";
        pinBadge.textContent = "📌";
        pinBadge.title = "Pinned";
        card.appendChild(pinBadge);
    }

    const head = document.createElement("div");
    head.className = "admin-news-head";

    const tag = document.createElement("span");
    tag.className = "news-tag " + getTagClass(news.tag);
    tag.textContent = getTagLabel(news.tag);
    head.appendChild(tag);

    card.appendChild(head);

    const title = document.createElement("h3");
    title.className = "admin-news-title";
    title.textContent = news.title || "(Tanpa judul)";
    card.appendChild(title);

    const preview = document.createElement("p");
    preview.className = "admin-news-preview";
    preview.textContent = stripMarkdown(news.body, 160);
    card.appendChild(preview);

    const meta = document.createElement("div");
    meta.className = "admin-news-meta";
    meta.appendChild(document.createTextNode("@" + (news.author || "admin")));
    meta.appendChild(document.createTextNode("•"));
    meta.appendChild(document.createTextNode(formatDate(news.createdAt)));
    if (news.updatedAt && news.updatedAt !== news.createdAt) {
        meta.appendChild(document.createTextNode("•"));
        meta.appendChild(document.createTextNode("edited"));
    }
    card.appendChild(meta);

    // Actions
    const actions = document.createElement("div");
    actions.className = "admin-news-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "admin-action-btn";
    editBtn.innerHTML = ICONS.edit + "<span>EDIT</span>";
    editBtn.addEventListener("click", () => openEditor(news));
    actions.appendChild(editBtn);

    const pinBtn = document.createElement("button");
    pinBtn.type = "button";
    pinBtn.className = "admin-action-btn" + (news.pinned === 1 ? " is-pinned" : "");
    pinBtn.innerHTML = (news.pinned === 1 ? ICONS.unpin : ICONS.pin) +
        "<span>" + (news.pinned === 1 ? "UNPIN" : "PIN") + "</span>";
    pinBtn.addEventListener("click", () => togglePin(news, pinBtn));
    actions.appendChild(pinBtn);

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "admin-action-btn is-danger";
    delBtn.innerHTML = ICONS.del + "<span>DELETE</span>";
    delBtn.addEventListener("click", () => openDeleteConfirm(news));
    actions.appendChild(delBtn);

    card.appendChild(actions);
    return card;
}

/* ===== Render News List ===== */
function renderNewsList(items) {
    const loading = $("#adminLoading");
    const list = $("#adminNewsList");
    const empty = $("#adminEmpty");

    if (loading) loading.hidden = true;

    // Update stats
    const totalEl = $("#statTotalNews");
    const pinnedEl = $("#statPinnedNews");
    if (totalEl) totalEl.textContent = String(items.length);
    if (pinnedEl) pinnedEl.textContent = String(items.filter((n) => n.pinned === 1).length);

    if (!items || items.length === 0) {
        if (list) { list.hidden = true; list.replaceChildren(); }
        if (empty) empty.hidden = false;
        return;
    }

    if (empty) empty.hidden = true;
    if (list) {
        list.hidden = false;
        list.replaceChildren();
        items.forEach((n) => list.appendChild(createAdminCard(n)));
    }
}

/* ===== Load News ===== */
async function loadNews() {
    const loading = $("#adminLoading");
    const list = $("#adminNewsList");
    const empty = $("#adminEmpty");

    if (loading) { loading.hidden = false; loading.textContent = "Memuat news..."; }
    if (list) list.hidden = true;
    if (empty) empty.hidden = true;

    try {
        const items = await fetchAllNews();
        newsList = items;
        renderNewsList(items);
    } catch (e) {
        if (loading) {
            loading.textContent = "Gagal memuat news: " + (e.message || "Unknown error");
            loading.hidden = false;
        }
    }
}

/* ===== Toggle Pin ===== */
async function togglePin(news, btnEl) {
    if (isBusy || !news) return;
    isBusy = true;
    if (btnEl) btnEl.disabled = true;

    try {
        const token = getToken();
        if (!token) throw new Error("Sesi tidak ditemukan");
        const result = await apiRequest("/admin/news/" + news.id + "/pin", {
            method: "POST",
            headers: { Authorization: "Bearer " + token }
        });
        const updated = result?.news;
        if (updated) {
            news.pinned = updated.pinned;
            toast(updated.pinned === 1 ? "News pinned" : "News unpinned", "success", 2200);
            await loadNews();
        }
    } catch (e) {
        console.error("[ADMIN] Pin gagal:", e);
        toast("Gagal: " + (e.message || "Unknown error"), "error");
    } finally {
        isBusy = false;
        if (btnEl) btnEl.disabled = false;
    }
}

/* ===== Editor Dialog ===== */
function setEditorMode(mode, news) {
    const eyebrow = $("#editorEyebrow");
    const title = $("#editorTitle");
    const saveBtn = $("#editorSaveBtn");

    if (mode === "create") {
        editingId = null;
        if (eyebrow) eyebrow.textContent = "NEW NEWS";
        if (title) title.textContent = "Create News";
        if (saveBtn) {
            const label = saveBtn.querySelector(".btn-label");
            if (label) label.textContent = "CREATE";
        }
        if ($("#editorNewsTitle")) $("#editorNewsTitle").value = "";
        if ($("#editorNewsTag")) $("#editorNewsTag").value = "UPDATE";
        if ($("#editorNewsBody")) $("#editorNewsBody").value = "";
    } else if (mode === "edit" && news) {
        editingId = news.id;
        if (eyebrow) eyebrow.textContent = "EDIT NEWS #" + news.id;
        if (title) title.textContent = "Edit News";
        if (saveBtn) {
            const label = saveBtn.querySelector(".btn-label");
            if (label) label.textContent = "SAVE";
        }
        if ($("#editorNewsTitle")) $("#editorNewsTitle").value = news.title || "";
        if ($("#editorNewsTag")) $("#editorNewsTag").value = String(news.tag || "UPDATE").toUpperCase();
        if ($("#editorNewsBody")) $("#editorNewsBody").value = news.body || "";
    }

    updateEditorCounters();
    updateEditorPreview();
    setEditorError("");
    setEditorSaving(false);
}

function updateEditorCounters() {
    const title = $("#editorNewsTitle");
    const body = $("#editorNewsBody");
    const titleCounter = $("#editorTitleCounter");
    const bodyCounter = $("#editorBodyCounter");

    if (title && titleCounter) titleCounter.textContent = title.value.length + " / 100";
    if (body && bodyCounter) bodyCounter.textContent = body.value.length + " / 2000";
}

function updateEditorPreview() {
    const body = $("#editorNewsBody");
    const preview = $("#editorPreview");
    if (!body || !preview) return;

    const text = body.value.trim();
    preview.replaceChildren();

    if (!text) {
        const ph = document.createElement("p");
        ph.style.cssText = "color:#4b5670;font-style:italic;margin:0;";
        ph.textContent = "Preview muncul di sini...";
        preview.appendChild(ph);
        return;
    }

    try {
        const rendered = renderMarkdown(text);
        preview.appendChild(rendered);
    } catch (e) {
        preview.textContent = text;
    }
}

function setEditorError(msg) {
    const el = $("#editorError");
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add("show"); }
    else { el.textContent = ""; el.classList.remove("show"); }
}

function setEditorSaving(saving) {
    isSaving = Boolean(saving);
    const btn = $("#editorSaveBtn");
    if (!btn) return;
    btn.disabled = isSaving;
    btn.setAttribute("aria-busy", String(isSaving));
    const cancel = $("#editorCancelBtn");
    if (cancel) cancel.disabled = isSaving;
    const closeBtn = $("#editorCloseBtn");
    if (closeBtn) closeBtn.disabled = isSaving;
}

function openEditor(news) {
    const dlg = $("#dialogEditor");
    if (!dlg) return;

    if (news) {
        setEditorMode("edit", news);
    } else {
        setEditorMode("create", null);
    }

    if (typeof dlg.showModal === "function") {
        if (!dlg.open) dlg.showModal();
    } else {
        dlg.setAttribute("open", "");
    }

    setTimeout(() => $("#editorNewsTitle")?.focus(), 120);
}

function closeEditor() {
    const dlg = $("#dialogEditor");
    if (!dlg) return;
    if (dlg.open && typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
    editingId = null;
}

async function handleEditorSubmit(event) {
    event.preventDefault();
    if (isSaving) return;
    setEditorError("");

    const title = ($("#editorNewsTitle")?.value || "").trim();
    const body = ($("#editorNewsBody")?.value || "").trim();
    const tag = ($("#editorNewsTag")?.value || "UPDATE").toUpperCase();

    if (title.length < 3) {
        setEditorError("Title minimal 3 karakter.");
        $("#editorNewsTitle")?.focus();
        return;
    }
    if (title.length > 100) {
        setEditorError("Title maksimal 100 karakter.");
        return;
    }
    if (body.length < 10) {
        setEditorError("Body minimal 10 karakter.");
        $("#editorNewsBody")?.focus();
        return;
    }
    if (body.length > 2000) {
        setEditorError("Body maksimal 2000 karakter.");
        return;
    }

    const token = getToken();
    if (!token) {
        setEditorError("Sesi tidak ditemukan.");
        return;
    }

    setEditorSaving(true);

    try {
        let result;
        if (editingId) {
            // Update
            result = await apiRequest("/admin/news/" + editingId, {
                method: "PUT",
                headers: { Authorization: "Bearer " + token },
                body: JSON.stringify({ title, body, tag })
            });
        } else {
            // Create
            result = await apiRequest("/admin/news", {
                method: "POST",
                headers: { Authorization: "Bearer " + token },
                body: JSON.stringify({ title, body, tag })
            });
        }

        if (!result?.success) {
            throw new Error(result?.message || "Gagal menyimpan news");
        }

        toast(editingId ? "News berhasil diupdate!" : "News berhasil dibuat!", "success");
        closeEditor();
        await loadNews();
    } catch (e) {
        console.error("[ADMIN] Save news gagal:", e);
        if (e.isAuthError) {
            setEditorError("Sesi berakhir. Silakan login kembali.");
            setTimeout(() => {
                clearToken();
                window.location.replace("/");
            }, 1200);
            return;
        }
        if (e.status === 403) {
            setEditorError("Akses admin diperlukan.");
            return;
        }
        setEditorError(e.message || "Gagal menyimpan news.");
    } finally {
        setEditorSaving(false);
    }
}

/* ===== Delete Confirmation ===== */
function setConfirmError(msg) {
    const el = $("#confirmError");
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add("show"); }
    else { el.textContent = ""; el.classList.remove("show"); }
}

function setConfirmDeleting(deleting) {
    isDeleting = Boolean(deleting);
    const btn = $("#confirmDeleteBtn");
    if (!btn) return;
    btn.disabled = isDeleting;
    btn.setAttribute("aria-busy", String(isDeleting));
    const label = btn.querySelector(".btn-label");
    if (label) label.textContent = isDeleting ? "DELETING..." : "DELETE";
    const cancel = $("#confirmCancelBtn");
    if (cancel) cancel.disabled = isDeleting;
    const closeBtn = $("#confirmCloseBtn");
    if (closeBtn) closeBtn.disabled = isDeleting;
}

function openDeleteConfirm(news) {
    const dlg = $("#dialogConfirm");
    if (!dlg || !news) return;

    deletingId = news.id;
    setConfirmError("");
    setConfirmDeleting(false);

    const preview = $("#confirmPreview");
    if (preview) {
        preview.replaceChildren();
        const strong = document.createElement("strong");
        strong.textContent = news.title || "(Tanpa judul)";
        const meta = document.createElement("span");
        meta.textContent = "#" + news.id + " · " + formatDateFull(news.createdAt);
        preview.appendChild(strong);
        preview.appendChild(meta);
    }

    if (typeof dlg.showModal === "function") {
        if (!dlg.open) dlg.showModal();
    } else {
        dlg.setAttribute("open", "");
    }
}

function closeDeleteConfirm() {
    const dlg = $("#dialogConfirm");
    if (!dlg) return;
    if (dlg.open && typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
    deletingId = null;
}

async function handleDeleteConfirm(event) {
    event.preventDefault();
    if (isDeleting || !deletingId) return;
    setConfirmError("");

    const token = getToken();
    if (!token) {
        setConfirmError("Sesi tidak ditemukan.");
        return;
    }

    setConfirmDeleting(true);

    try {
        await apiRequest("/admin/news/" + deletingId, {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token }
        });
        toast("News berhasil dihapus", "success");
        closeDeleteConfirm();
        await loadNews();
    } catch (e) {
        console.error("[ADMIN] Delete news gagal:", e);
        if (e.isAuthError) {
            setConfirmError("Sesi berakhir. Silakan login kembali.");
            setTimeout(() => {
                clearToken();
                window.location.replace("/");
            }, 1200);
            return;
        }
        if (e.status === 403) {
            setConfirmError("Akses admin diperlukan.");
            return;
        }
        setConfirmError(e.message || "Gagal menghapus news.");
    } finally {
        setConfirmDeleting(false);
    }
}

/* ===== Wire Events ===== */
function wireEvents() {
    $("#btnCreateNews")?.addEventListener("click", () => openEditor(null));

    // Editor form
    $("#editorForm")?.addEventListener("submit", handleEditorSubmit);
    $("#editorCloseBtn")?.addEventListener("click", () => { if (!isSaving) closeEditor(); });
    $("#editorCancelBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isSaving) closeEditor();
    });

    // Editor inputs (live counter + preview)
    $("#editorNewsTitle")?.addEventListener("input", updateEditorCounters);
    $("#editorNewsBody")?.addEventListener("input", () => {
        updateEditorCounters();
        updateEditorPreview();
    });

    // Editor dialog backdrop
    const dlgEditor = $("#dialogEditor");
    if (dlgEditor) {
        dlgEditor.addEventListener("click", (e) => {
            if (e.target === dlgEditor && !isSaving) closeEditor();
        });
    }

    // Confirm form
    $("#confirmForm")?.addEventListener("submit", handleDeleteConfirm);
    $("#confirmCloseBtn")?.addEventListener("click", () => { if (!isDeleting) closeDeleteConfirm(); });
    $("#confirmCancelBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isDeleting) closeDeleteConfirm();
    });

    const dlgConfirm = $("#dialogConfirm");
    if (dlgConfirm) {
        dlgConfirm.addEventListener("click", (e) => {
            if (e.target === dlgConfirm && !isDeleting) closeDeleteConfirm();
        });
    }

    // Logout
    $("#logoutButton")?.addEventListener("click", handleLogout);

    // ESC to close
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (dlgEditor?.open && !isSaving) closeEditor();
            if (dlgConfirm?.open && !isDeleting) closeDeleteConfirm();
        }
    });

    // Sticky topbar
    wireStickyTopbar();
}

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

/* ===== Logout ===== */
async function handleLogout() {
    const token = getToken();
    try {
        if (token) await apiRequest("/logout", { method: "POST", headers: { Authorization: "Bearer " + token } });
    } catch (e) { /* ignore */ }
    finally {
        clearToken();
        window.location.replace("/");
    }
}

/* ===== Footer ===== */
function updateFooterYear() {
    if ($("#year")) $("#year").textContent = String(new Date().getFullYear());
}

/* ===== Init ===== */
async function init() {
    updateFooterYear();
    wireEvents();

    const ok = await loadCurrentUser();
    if (!ok) return;

    updateAdminVisibility();

    if (isAdmin) {
        await loadNews();
    }
}

init();
