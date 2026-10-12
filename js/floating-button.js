/* =========================================
   GROWERA — FLOATING QUICK MENU (v2 — fixed)
   Draggable FAB dengan quick access menu.

   FIX v2:
   - Tidak pakai visibility:hidden (biar selalu visible meski JS error)
   - Default position pakai CSS (bottom/right) — akurat di mobile Chrome
   - Pakai visualViewport kalau tersedia (handle toolbar dinamis)
   - try/catch di semua handler

   Fitur:
   - Drag (mouse + touch) via pointer events
   - Auto-snap ke tepi layar setelah release
   - Posisi tersimpan di localStorage
   - Klik (tanpa drag) → buka menu
   - Menu auto-position (atas/bawah, kiri/kanan)

   Public API (window.GroweraFloating):
   - init()
   - closeMenu()
   - resetPosition()
========================================= */

console.log("[GROWERA FAB] Script loading...");

(function () {
    "use strict";


    /* =========================================
       CONFIG
    ========================================= */

    const STORAGE_KEY = "growera_floating_pos";
    const EDGE_PADDING = 12;
    const DRAG_THRESHOLD = 6;
    const SNAP_DURATION = 320;


    /* =========================================
       STATE
    ========================================= */

    let btn = null;
    let menu = null;
    let isDragging = false;
    let hasDragged = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let pointerId = null;


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
        // Pakai CSS default (bottom/right) — biar browser yang handle
        // toolbar dinamis di mobile
        if (!btn) return;
        btn.style.left = "";
        btn.style.top = "";
        btn.style.right = "";
        btn.style.bottom = "";
    }

    function savePos(left, top) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ left: left, top: top }));
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
            console.warn("[GROWERA FAB] placeAtDefaultOrSaved error:", e);
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
                vp.height - menuRect.height - EDGE_PADDING
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
    }

    function closeMenu() {
        if (!menu || !btn) return;
        menu.classList.remove("open");
        menu.setAttribute("aria-hidden", "true");
        btn.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
        if (!menu) return;
        if (menu.classList.contains("open")) closeMenu();
        else openMenu();
    }


    /* =========================================
       POINTER EVENTS (drag)
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

        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
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

        try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }

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
        try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
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

        // Set posisi (kalau ada saved) atau biarkan CSS default
        placeAtDefaultOrSaved();

        // Pointer events
        btn.addEventListener("pointerdown", onPointerDown);
        btn.addEventListener("pointermove", onPointerMove);
        btn.addEventListener("pointerup", onPointerUp);
        btn.addEventListener("pointercancel", onPointerCancel);

        // Global
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

        console.log("[GROWERA FAB] Initialized. Position:",
            getComputedStyle(btn).bottom, getComputedStyle(btn).right);
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.GroweraFloating = {
        init: init,
        closeMenu: closeMenu,
        resetPosition: function () {
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
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
