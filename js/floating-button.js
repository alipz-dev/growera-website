/* =========================================
   GROWERA — FLOATING QUICK MENU + SERVER STATS (v4 FINAL)
   Sumber stats: api.gtps.cloud (public endpoint)
   Tidak butuh backend Lua untuk stats.

   Data source: /api/server/public/1791
========================================= */

console.log("[GROWERA FAB] Script loading (v4 FINAL)...");

(function () {
    "use strict";


    /* =========================================
       CONFIG
    ========================================= */

    const SERVER_ID = "1791";
    const API_SERVER_URL = "https://api.gtps.cloud/api/server/public/" + SERVER_ID;

    const STORAGE_KEY = "growera_floating_pos";
    const EDGE_PADDING = 12;
    const DRAG_THRESHOLD = 6;
    const SNAP_DURATION = 320;
    const STATS_REFRESH_MS = 15000;
    const FETCH_TIMEOUT_MS = 6000;

    let btn = null;
    let menu = null;
    let isDragging = false;
    let hasDragged = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let pointerId = null;
    let statsTimer = null;
    let statsAbortController = null;


    /* =========================================
       HELPERS
    ========================================= */

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function getViewport() {
        if (window.visualViewport) {
            return {
                width: window.visualViewport.width,
                height: window.visualViewport.height
            };
        }
        return {
            width: window.innerWidth,
            height: window.innerHeight
        };
    }

    function getBounds() {
        const rect = btn.getBoundingClientRect();
        const w = rect.width || 56;
        const h = rect.height || 56;
        const vp = getViewport();
        return {
            minLeft: EDGE_PADDING,
            minTop: EDGE_PADDING,
            maxLeft: Math.max(EDGE_PADDING, vp.width - w - EDGE_PADDING),
            maxTop: Math.max(EDGE_PADDING, vp.height - h - EDGE_PADDING)
        };
    }

    function applyPos(left, top) {
        if (!btn) return;
        btn.style.left = left + "px";
        btn.style.top = top + "px";
        btn.style.right = "auto";
        btn.style.bottom = "auto";
    }

    function useDefaultPosition() {
        if (!btn) return;
        btn.style.left = "";
        btn.style.top = "";
        btn.style.right = "";
        btn.style.bottom = "";
    }

    function savePos(left, top) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
        } catch (e) { /* ignore */ }
    }

    function loadPos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const pos = JSON.parse(raw);
            if (typeof pos.left !== "number" || typeof pos.top !== "number") return null;
            return pos;
        } catch (e) { return null; }
    }

    function getDefaultPos() {
        const vp = getViewport();
        return {
            left: vp.width - 56 - EDGE_PADDING - 8,
            top: vp.height - 56 - EDGE_PADDING - 8
        };
    }

    function placeAtDefaultOrSaved() {
        try {
            const saved = loadPos();
            if (saved) {
                const b = getBounds();
                const target = {
                    left: clamp(saved.left, b.minLeft, b.maxLeft),
                    top: clamp(saved.top, b.minTop, b.maxTop)
                };
                applyPos(target.left, target.top);
            } else {
                useDefaultPosition();
            }
        } catch (e) {
            console.warn("[GROWERA FAB] place error:", e);
            useDefaultPosition();
        }
    }

    function snapToEdge() {
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const b = getBounds();
        const vp = getViewport();
        const targetLeft = midX < vp.width / 2 ? b.minLeft : b.maxLeft;
        const targetTop = clamp(rect.top, b.minTop, b.maxTop);
        btn.classList.add("snapping");
        applyPos(targetLeft, targetTop);
        savePos(targetLeft, targetTop);
        setTimeout(function () {
            btn.classList.remove("snapping");
        }, SNAP_DURATION);
    }


    /* =========================================
       MENU PANEL
    ========================================= */

    function positionMenu() {
        if (!menu || !btn) return;
        if (!menu.classList.contains("open")) return;

        const btnRect = btn.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const vp = getViewport();
        const gap = 10;

        const spaceAbove = btnRect.top;
        const spaceBelow = vp.height - btnRect.bottom;

        let top;
        if (spaceAbove >= menuRect.height + gap) {
            top = btnRect.top - menuRect.height - gap;
            menu.style.transformOrigin = "bottom center";
        } else if (spaceBelow >= menuRect.height + gap) {
            top = btnRect.bottom + gap;
            menu.style.transformOrigin = "top center";
        } else {
            top = clamp(
                btnRect.top,
                EDGE_PADDING,
                Math.max(EDGE_PADDING, vp.height - menuRect.height - EDGE_PADDING)
            );
        }

        const midX = btnRect.left + btnRect.width / 2;
        let left;
        if (midX < vp.width / 2) {
            left = btnRect.left;
            if (left + menuRect.width > vp.width - EDGE_PADDING) {
                left = vp.width - menuRect.width - EDGE_PADDING;
            }
            menu.style.transformOrigin = menu.style.transformOrigin.replace("center", "left");
        } else {
            left = btnRect.right - menuRect.width;
            if (left < EDGE_PADDING) left = EDGE_PADDING;
            menu.style.transformOrigin = menu.style.transformOrigin.replace("center", "right");
        }

        menu.style.left = left + "px";
        menu.style.top = top + "px";
    }

    function openMenu() {
        if (!menu || !btn) return;
        menu.classList.add("open");
        menu.setAttribute("aria-hidden", "false");
        btn.setAttribute("aria-expanded", "true");
        requestAnimationFrame(function () { positionMenu(); });
        fetchAndRenderStats();
        startStatsTimer();
    }

    function closeMenu() {
        if (!menu || !btn) return;
        menu.classList.remove("open");
        menu.setAttribute("aria-hidden", "true");
        btn.setAttribute("aria-expanded", "false");
        stopStatsTimer();
    }

    function toggleMenu() {
        if (!menu) return;
        if (menu.classList.contains("open")) closeMenu();
        else openMenu();
    }


    /* =========================================
       SERVER STATS
    ========================================= */

    function setEl(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setElClass(id, className) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove("online", "offline", "warn", "critical");
        if (className) el.classList.add(className);
    }

    function setDotClass(className) {
        const dot = document.getElementById("floatingStatsDot");
        if (!dot) return;
        dot.classList.remove("online", "offline", "loading");
        if (className) dot.classList.add(className);
    }

    function formatNumber(n) {
        n = Number(n);
        if (!isFinite(n)) return "—";
        return new Intl.NumberFormat("id-ID").format(Math.floor(n));
    }

    function getLoadClass(percent) {
        if (typeof percent !== "number" || !isFinite(percent)) return "";
        if (percent >= 85) return "critical";
        if (percent >= 60) return "warn";
        return "";
    }

    function renderStatsOffline() {
        setDotClass("offline");
        setEl("floatingStatsTitle", "SERVER OFFLINE");
        setEl("fsStatus", "Offline");
        setElClass("fsStatus", "offline");
        setEl("fsPlayers", "—");
        setEl("fsUptime", "—");
        setEl("fsRam", "—");
        setEl("fsCpu", "—");
        setEl("fsWorlds", "—");
        setEl("fsUpdated", "Tidak dapat terhubung");
    }

    function renderStatsLoading() {
        setDotClass("loading");
        setEl("floatingStatsTitle", "MEMUAT...");
        setEl("fsStatus", "Loading...");
        setElClass("fsStatus", "");
    }

    async function fetchServerData() {
        // Abort request lama
        if (statsAbortController) {
            try { statsAbortController.abort(); } catch (e) {}
        }

        const controller = ("AbortController" in window)
            ? new AbortController()
            : null;
        statsAbortController = controller;

        const timeoutId = setTimeout(function () {
            if (controller) {
                try { controller.abort(); } catch (e) {}
            }
        }, FETCH_TIMEOUT_MS);

        try {
            const opts = {
                method: "GET",
                headers: { "Accept": "application/json" },
                cache: "no-store"
            };
            if (controller) opts.signal = controller.signal;

            const response = await fetch(API_SERVER_URL, opts);
            clearTimeout(timeoutId);

            if (!response.ok) return null;
            return await response.json();
        } catch (err) {
            clearTimeout(timeoutId);
            return null;
        } finally {
            if (statsAbortController === controller) {
                statsAbortController = null;
            }
        }
    }

    async function fetchAndRenderStats() {
        renderStatsLoading();
        const data = await fetchServerData();
        renderStats(data);
    }

    function renderStats(data) {
        if (!data || typeof data !== "object" || !data.state) {
            renderStatsOffline();
            return;
        }

        const state = data.state;
        const tier = data.tier_info || {};

        // === STATUS ===
        const isOnline = state.server_status === 1;

        if (isOnline) {
            setDotClass("online");
            setEl("floatingStatsTitle", "SERVER ONLINE");
            setEl("fsStatus", "Online");
            setElClass("fsStatus", "online");
        } else {
            setDotClass("offline");
            setEl("floatingStatsTitle", "SERVER OFFLINE");
            setEl("fsStatus", "Offline");
            setElClass("fsStatus", "offline");
        }

        // === PLAYERS ===
        const players = Number(state.players_online) || 0;
        const maxPlayers = Number(tier.max_players_online) || 0;
        if (maxPlayers > 0) {
            setEl("fsPlayers", formatNumber(players) + " / " + formatNumber(maxPlayers));
        } else {
            setEl("fsPlayers", formatNumber(players) + " online");
        }

        // === UPTIME (pakai server_status_changed) ===
        const statusChanged = Number(state.server_status_changed) || 0;
        if (statusChanged > 0 && isOnline) {
            const nowSec = Math.floor(Date.now() / 1000);
            const uptimeSec = nowSec - statusChanged;
            setEl("fsUptime", formatUptime(uptimeSec));
        } else {
            setEl("fsUptime", "—");
        }

        // === RAM ===
        const memUsed = Number(state.memory_usage) || 0;
        const memMax = Number(tier.max_memory_usage) || 0;
        if (memMax > 0) {
            setEl("fsRam", formatNumber(memUsed) + " / " + formatNumber(memMax) + " MB");
            const memPercent = (memUsed / memMax) * 100;
            setElClass("fsRam", getLoadClass(memPercent));
        } else {
            setEl("fsRam", formatNumber(memUsed) + " MB");
        }

        // === CPU ===
        const cpuUsed = Number(state.cpu_usage) || 0;
        const cpuMax = Number(tier.max_cpu_usage) || 0;
        if (cpuMax > 0) {
            setEl("fsCpu", cpuUsed.toFixed(2) + "% / " + cpuMax + "%");
            const cpuPercent = (cpuUsed / cpuMax) * 100;
            setElClass("fsCpu", getLoadClass(cpuPercent));
        } else {
            setEl("fsCpu", cpuUsed.toFixed(2) + "%");
        }

        // === WORLDS ===
        const activeWorlds = Number(state.active_worlds) || 0;
        setEl("fsWorlds", formatNumber(activeWorlds) + " active");

        // === UPDATED ===
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        setEl("fsUpdated", "Update " + hh + ":" + mm + ":" + ss);
    }

    function formatUptime(seconds) {
        seconds = Math.floor(Number(seconds) || 0);
        if (seconds <= 0) return "—";
        if (seconds < 60) return seconds + "s";
        const m = Math.floor(seconds / 60);
        if (m < 60) return m + "m";
        const h = Math.floor(m / 60);
        const rm = m % 60;
        if (h < 24) return h + "h " + rm + "m";
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return d + "d " + rh + "h";
    }

    function startStatsTimer() {
        stopStatsTimer();
        statsTimer = setInterval(fetchAndRenderStats, STATS_REFRESH_MS);
    }

    function stopStatsTimer() {
        if (statsTimer) {
            clearInterval(statsTimer);
            statsTimer = null;
        }
    }


    /* =========================================
       POINTER EVENTS
    ========================================= */

    function onPointerDown(e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (pointerId !== null) return;

        pointerId = e.pointerId;
        isDragging = true;
        hasDragged = false;

        startX = e.clientX;
        startY = e.clientY;

        const rect = btn.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        btn.classList.add("dragging");
        closeMenu();
    }

    function onPointerMove(e) {
        if (!isDragging || e.pointerId !== pointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!hasDragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
            hasDragged = true;
        }
        if (!hasDragged) return;

        const b = getBounds();
        const newLeft = clamp(startLeft + dx, b.minLeft, b.maxLeft);
        const newTop = clamp(startTop + dy, b.minTop, b.maxTop);

        applyPos(newLeft, newTop);
    }

    function onPointerUp(e) {
        if (e.pointerId !== pointerId) return;

        const wasDragged = hasDragged;
        isDragging = false;
        btn.classList.remove("dragging");

        try { btn.releasePointerCapture(e.pointerId); } catch (err) {}

        pointerId = null;
        hasDragged = false;

        if (wasDragged) {
            snapToEdge();
        } else {
            toggleMenu();
        }
    }

    function onPointerCancel(e) {
        if (e.pointerId !== pointerId) return;
        isDragging = false;
        btn.classList.remove("dragging");
        try { btn.releasePointerCapture(e.pointerId); } catch (err) {}
        pointerId = null;
        hasDragged = false;
    }


    /* =========================================
       GLOBAL HANDLERS
    ========================================= */

    function onDocClick(e) {
        if (!menu || !btn) return;
        if (!menu.classList.contains("open")) return;
        if (menu.contains(e.target)) return;
        if (btn.contains(e.target)) return;
        closeMenu();
    }

    function onKeyDown(e) {
        if (e.key === "Escape") closeMenu();
    }

    function onResize() {
        if (!btn) return;
        try {
            const rect = btn.getBoundingClientRect();
            const b = getBounds();
            const left = clamp(rect.left, b.minLeft, b.maxLeft);
            const top = clamp(rect.top, b.minTop, b.maxTop);
            if (left !== rect.left || top !== rect.top) {
                applyPos(left, top);
                savePos(left, top);
            }
            if (menu && menu.classList.contains("open")) positionMenu();
        } catch (e) { /* ignore */ }
    }


    /* =========================================
       MENU ITEMS
    ========================================= */

    function wireMenuItems() {
        if (!menu) return;

        menu.querySelectorAll("[data-page]").forEach(function (el) {
            el.addEventListener("click", function () {
                const page = el.dataset.page;
                if (typeof navigateTo === "function") navigateTo(page);
                closeMenu();
            });
        });

        const logoutBtn = menu.querySelector("[data-action='logout']");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", function () {
                closeMenu();
                const mainLogout = document.getElementById("logoutButton");
                if (mainLogout) mainLogout.click();
            });
        }
    }


    /* =========================================
       INIT
    ========================================= */

    function init() {
        btn = document.getElementById("floatingQuickBtn");
        menu = document.getElementById("floatingMenu");

        if (!btn || !menu) {
            console.error("[GROWERA FAB] Element #floatingQuickBtn atau #floatingMenu tidak ditemukan!");
            return;
        }

        placeAtDefaultOrSaved();

        btn.addEventListener("pointerdown", onPointerDown);
        btn.addEventListener("pointermove", onPointerMove);
        btn.addEventListener("pointerup", onPointerUp);
        btn.addEventListener("pointercancel", onPointerCancel);

        document.addEventListener("click", onDocClick, true);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", onResize);
        }

        window.addEventListener("orientationchange", function () {
            setTimeout(onResize, 250);
        });

        wireMenuItems();

        console.log("[GROWERA FAB] v4 FINAL initialized. SERVER_ID=" + SERVER_ID);
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.GroweraFloating = {
        init: init,
        closeMenu: closeMenu,
        refreshStats: fetchAndRenderStats,
        resetPosition: function () {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            useDefaultPosition();
        }
    };


    /* =========================================
       BOOTSTRAP
    ========================================= */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
