/* =========================================
   GROWERA Crystal Roulette — UI DEMO ONLY
   Trigger: sidebar nav button (#rouletteNavButton)
========================================= */

(function () {
    "use strict";

    const PREFIX  = "growera_roulette_demo_v1:";
    const DEFAULT = { daily: 2, online: 3 };

    const PRIZES = [
        { icon: "💎", name: "Crystal", prize: "25 Gems (DEMO)" },
        { icon: "🎁", name: "Mystery", prize: "Mystery Box (DEMO)" },
        { icon: "🪙", name: "Coins",   prize: "100 Coins (DEMO)" },
        { icon: "✨", name: "Bonus",   prize: "Bonus Reward (DEMO)" },
        { icon: "🧊", name: "Ice",     prize: "Ice Crystal (DEMO)" },
        { icon: "👑", name: "Royal",   prize: "Royal Chest (DEMO)" },
        { icon: "🌌", name: "Cosmic",  prize: "Cosmic Fragment (DEMO)" },
        { icon: "💠", name: "Shard",   prize: "Crystal Shard (DEMO)" }
    ];

    const $ = id => document.getElementById(id);

    let navBtn, panel, overlay, wheel, spinBtn, statusEl;
    let selected   = "daily";
    let spinning   = false;
    let rotation   = 0;
    let accountKey = "";
    let state      = { ...DEFAULT };


    /* =========================================
       ACCOUNT / STATE
    ========================================= */

    function username() {
        const name = $("headerUsername")?.textContent.trim();
        return name && name !== "Player"
            ? name
            : ($("username")?.value.trim() || "demo-player");
    }

    function dashboardVisible() {
        const el = $("dashboardScreen");
        return !!el && !el.classList.contains("hidden");
    }

    function loadState() {
        const key = PREFIX + username().toLowerCase();
        if (key === accountKey) return;
        accountKey = key;
        try {
            const saved = JSON.parse(localStorage.getItem(key) || "null");
            state = (saved
                && Number.isFinite(saved.daily)
                && Number.isFinite(saved.online))
                ? {
                    daily:  Math.max(0, Math.floor(saved.daily)),
                    online: Math.max(0, Math.floor(saved.online))
                }
                : { ...DEFAULT };
        } catch (_) {
            state = { ...DEFAULT };
        }
        saveState();
    }

    function saveState() {
        try {
            localStorage.setItem(
                accountKey || (PREFIX + username().toLowerCase()),
                JSON.stringify(state)
            );
        } catch (_) {}
    }

    function total() {
        return Math.max(0, state.daily) + Math.max(0, state.online);
    }


    /* =========================================
       RENDER
    ========================================= */

    function render() {
        const panelTotal = $("roulettePanelTotal");
        if (panelTotal) panelTotal.textContent = total();

        const dBal = $("rouletteDailyBalance");
        if (dBal) dBal.textContent = state.daily +
            (state.daily === 1 ? " point" : " points");

        const oBal = $("rouletteOnlineBalance");
        if (oBal) oBal.textContent = state.online +
            (state.online === 1 ? " point" : " points");

        if (spinBtn) {
            spinBtn.disabled = spinning || state[selected] <= 0;
        }

        document.querySelectorAll(".roulette-type").forEach(function (b) {
            const isSel = b.dataset.rouletteType === selected;
            b.classList.toggle("is-selected", isSel);
            b.setAttribute("aria-pressed", isSel ? "true" : "false");
        });
    }

    function status(text) {
        if (statusEl) statusEl.textContent = text;
    }


    /* =========================================
       PANEL OPEN / CLOSE
    ========================================= */

    function isPanelOpen() {
        return panel
            && !panel.hasAttribute("hidden")
            && panel.classList.contains("is-open");
    }

    function openPanel() {
        if (!dashboardVisible()) return;
        loadState();

        // Sembunyikan semua app-page supaya roulette tampil sebagai "halaman"
        document
            .querySelectorAll("#dashboardScreen .app-page")
            .forEach(p => p.classList.add("hidden"));

        // Tandai nav button Roulette aktif, matikan yang lain
        document
            .querySelectorAll(".sidebar-nav .nav-button")
            .forEach(b => b.classList.remove("active"));
        navBtn?.classList.add("active");

        panel.removeAttribute("hidden");
        requestAnimationFrame(() => panel.classList.add("is-open"));
        render();
    }

    // restoreHome = true (default) → tampilkan kembali homePage
    // restoreHome = false          → biarkan app.js yang atur halaman
    function closePanel(restoreHome) {
        if (!panel) return;

        panel.classList.remove("is-open");
        panel.setAttribute("hidden", "");
        navBtn?.classList.remove("active");

        if (restoreHome !== false) {
            const homePage = $("homePage");
            if (homePage) homePage.classList.remove("hidden");

            const homeBtn = document.querySelector(
                '.sidebar-nav .nav-button[data-page="home"]'
            );
            if (homeBtn) homeBtn.classList.add("active");
        }
    }


    /* =========================================
       WIN OVERLAY
    ========================================= */

    function closeWin() {
        if (!overlay) return;
        overlay.classList.remove("is-open");
        overlay.hidden = true;
        overlay
            .querySelectorAll(".roulette-particle")
            .forEach(p => p.remove());
    }

    function particles() {
        const card = $("rouletteWinCard");
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const colors = ["#65E7FF", "#9B7BFF", "#F1CC78", "#58FFAD", "#FFFFFF"];

        for (let i = 0; i < 30; i++) {
            const p = document.createElement("i");
            p.className = "roulette-particle";
            p.style.setProperty("--particle-x", (rect.left + rect.width / 2) + "px");
            p.style.setProperty("--particle-y", (rect.top + rect.height / 2) + "px");
            p.style.setProperty("--particle-dx", (Math.random() * 360 - 180) + "px");
            p.style.setProperty("--particle-dy", (Math.random() * 420 - 230) + "px");
            p.style.setProperty("--particle-color", colors[i % colors.length]);
            p.style.setProperty("--particle-duration", (0.75 + Math.random() * 0.8) + "s");

            overlay.appendChild(p);
            p.addEventListener("animationend", () => p.remove(), { once: true });
        }
    }

    function win(prize) {
        $("rouletteWinIcon").textContent  = prize.icon;
        $("rouletteWinPrize").textContent = prize.prize;
        overlay.hidden = false;
        overlay.classList.add("is-open");
        particles();
    }


    /* =========================================
       TYPE SELECT
    ========================================= */

    function select(type) {
        if (spinning) return;
        selected = type;

        const heading = $("rouletteWheelHeading");
        if (heading) {
            heading.textContent = type === "daily"
                ? "DAILY ROULETTE"
                : "ONLINE ROULETTE";
        }

        status(type === "daily"
            ? "Gunakan poin Daily untuk memutar roda."
            : "Gunakan poin Online untuk memutar roda.");

        render();
    }


    /* =========================================
       SPIN
    ========================================= */

    function spin() {
        if (spinning || state[selected] <= 0) return;

        spinning = true;
        state[selected]--;
        saveState();
        render();

        status("Crystal wheel sedang berputar...");
        spinBtn.textContent = "SPINNING...";

        const winner = Math.floor(Math.random() * PRIZES.length);
        const seg    = 360 / PRIZES.length;
        const current = ((rotation % 360) + 360) % 360;
        const target  = (360 - winner * seg) % 360;

        rotation += 360 * 6 + ((target - current + 360) % 360);

        wheel.style.transition = "transform 5.2s cubic-bezier(.10,.72,.08,1)";
        wheel.style.transform  = "rotate(" + rotation + "deg)";

        setTimeout(function () {
            spinning = false;
            spinBtn.textContent = "✦ SPIN ROULETTE · 1 POINT";
            status("Putaran selesai. Hadiah demo berhasil didapatkan!");
            render();
            win(PRIZES[winner]);
        }, 5350);
    }


    /* =========================================
       WHEEL LABELS
    ========================================= */

    function drawLabels() {
        // Hindari duplikat kalau init dipanggil ulang
        wheel.querySelectorAll(".roulette-wheel-label").forEach(el => el.remove());

        PRIZES.forEach(function (p, i) {
            const label = document.createElement("div");
            label.className = "roulette-wheel-label";
            label.style.transform =
                "rotate(" + (i * 45) + "deg) " +
                "translateY(-82px) " +
                "rotate(" + (-i * 45) + "deg)";

            const icon = document.createElement("span");
            icon.textContent = p.icon;

            const name = document.createElement("b");
            name.textContent = p.name;

            label.append(icon, name);
            wheel.appendChild(label);
        });
    }


    /* =========================================
       INIT
    ========================================= */

    function init() {
        navBtn   = $("rouletteNavButton");
        panel    = $("roulettePanel");
        overlay  = $("rouletteWinOverlay");
        wheel    = $("rouletteWheel");
        spinBtn  = $("rouletteSpinBtn");
        statusEl = $("rouletteWheelStatus");

        if (!navBtn || !panel || !overlay || !wheel || !spinBtn) {
            console.error("[GROWERA ROULETTE] Markup belum lengkap.");
            return;
        }

        loadState();
        drawLabels();

        // Toggle panel via sidebar nav button
        navBtn.addEventListener("click", function () {
            if (isPanelOpen()) closePanel();   // restore home
            else               openPanel();
        });

        // Tombol close di dalam panel
        const closeBtn = $("rouletteCloseBtn");
        if (closeBtn) {
            closeBtn.addEventListener("click", function () { closePanel(); });
        }

        // Spin
        spinBtn.addEventListener("click", spin);

        // Win overlay
        const winCloseBtn = $("rouletteWinCloseBtn");
        if (winCloseBtn) winCloseBtn.addEventListener("click", closeWin);

        overlay.addEventListener("click", function (e) {
            if (e.target === overlay) closeWin();
        });

        // Pilih tipe roulette
        document.querySelectorAll(".roulette-type").forEach(function (b) {
            b.addEventListener("click", function () {
                select(b.dataset.rouletteType);
            });
        });

        // ESC menutup panel & overlay
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") {
                closePanel();
                closeWin();
            }
        });

        // Kalau user klik nav button lain (Home/Profile/Rewards/Topup/More),
        // tutup panel Roulette tanpa restore home — biarkan app.js yang atur.
        document
            .querySelectorAll('.sidebar-nav .nav-button[data-page]')
            .forEach(function (btn) {
                btn.addEventListener("click", function () {
                    if (isPanelOpen()) closePanel(false);
                });
            });

        // Logout → tutup panel & overlay
        ["logoutButton", "sidebarLogoutButton"].forEach(function (id) {
            const el = $(id);
            if (el) el.addEventListener("click", function () {
                closePanel(false);
                closeWin();
            });
        });

        // Kalau dashboard disembunyikan (logout), tutup semua
        const dashboard = $("dashboardScreen");
        if (dashboard && "MutationObserver" in window) {
            new MutationObserver(function () {
                if (!dashboardVisible()) {
                    closePanel(false);
                    closeWin();
                } else {
                    loadState();
                    render();
                }
            }).observe(dashboard, {
                attributes: true,
                attributeFilter: ["class", "style"]
            });
        }

        // Kalau username berubah (login user lain), reload state
        const nameEl = $("headerUsername");
        if (nameEl && "MutationObserver" in window) {
            new MutationObserver(function () {
                if (dashboardVisible()) {
                    loadState();
                    render();
                }
            }).observe(nameEl, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }

        // Multi-tab sync
        window.addEventListener("storage", function (e) {
            if (e.key === accountKey) {
                loadState();
                render();
            }
        });

        select("daily");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.GroweraRoulette = {
        open:     openPanel,
        close:    closePanel,
        closeWin: closeWin,
        refresh:  function () { loadState(); render(); },
        setDemoPoints: function (daily, online) {
            state.daily  = Math.max(0, Math.floor(Number(daily)  || 0));
            state.online = Math.max(0, Math.floor(Number(online) || 0));
            saveState();
            render();
        }
    };
})();
