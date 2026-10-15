/* =========================================
   GROWERA — ROULETTE POPUP (v2, fix)
   Muncul otomatis setelah player login.
========================================= */

(function () {
    "use strict";

    var STORAGE_KEY = "growera_roulette_popup_v1";

    var PRIZES = [
        { iconId: 112,  name: "25 Gems",     reward: { type: "gems", amount: 25 } },
        { iconId: 1360, name: "Mystery",     reward: { type: "mystery", amount: 1 } },
        { iconId: 242,  name: "100 Coins",   reward: { type: "coins", amount: 100 } },
        { iconId: 1458, name: "10 Gems",     reward: { type: "gems", amount: 10 } },
        { iconId: 1344, name: "Ice Crystal", reward: { type: "item", itemId: 1344, amount: 1 } },
        { iconId: 4820, name: "Royal Chest", reward: { type: "chest", amount: 1 } },
        { iconId: 6746, name: "50 Gems",     reward: { type: "gems", amount: 50 } },
        { iconId: 1458, name: "Shard",       reward: { type: "shard", amount: 1 } }
    ];

    var SLICE_COUNT = PRIZES.length;
    var SLICE_ANGLE = 360 / SLICE_COUNT;

    var state = {
        points: 10,
        spinning: false,
        rotation: 0,
        shownThisSession: false
    };

    var dom = {};

    function $(id) { return document.getElementById(id); }

    function iconImg(id, size) {
        if (window.GroweraIcon) return window.GroweraIcon.img(id, size);
        var i = document.createElement("img");
        i.src = "/assets/itemimage/" + id + ".png";
        i.width = size; i.height = size;
        i.style.cssText = "width:" + size + "px;height:" + size + "px;object-fit:contain;image-rendering:pixelated";
        return i;
    }

    function loadState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var data = JSON.parse(raw);
            if (typeof data.points === "number") state.points = Math.max(0, data.points);
        } catch (e) {}
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ points: state.points }));
        } catch (e) {}
    }

    /* ===== RENDER WHEEL ===== */

    function renderWheel() {
        var wheel = dom.wheel;
        if (!wheel) return;

        wheel.querySelectorAll(".roulette-popup-slice").forEach(function (s) { s.remove(); });

        var radius = 78;

        PRIZES.forEach(function (p, i) {
            var slice = document.createElement("div");
            slice.className = "roulette-popup-slice";

            var angle = i * SLICE_ANGLE + (SLICE_ANGLE / 2);
            var rad = (angle - 90) * Math.PI / 180;
            var x = Math.cos(rad) * radius;
            var y = Math.sin(rad) * radius;

            slice.style.transform = "translate(calc(-50% + " + x + "px), calc(-50% + " + y + "px))";
            slice.appendChild(iconImg(p.iconId, 22));
            wheel.appendChild(slice);
        });
    }

    function renderBalance() {
        if (dom.balance) dom.balance.textContent = state.points + " PTS";
        if (dom.btn1)  dom.btn1.disabled = state.spinning || state.points < 1;
        if (dom.btn10) dom.btn10.disabled = state.spinning || state.points < 10;
    }

    function showResult(text) {
        var el = dom.result;
        if (!el) return;
        el.textContent = text;
        el.classList.remove("show");
        void el.offsetWidth;
        el.classList.add("show");
    }

    /* ===== SPIN ===== */

    function spin(times) {
        if (state.spinning) return;
        if (state.points < times) {
            showResult("Poin tidak cukup!");
            return;
        }

        state.spinning = true;
        state.points -= times;
        saveState();
        renderBalance();

        var winners = [];
        for (var k = 0; k < times; k++) {
            winners.push(Math.floor(Math.random() * SLICE_COUNT));
        }
        var lastWinner = winners[winners.length - 1];

        var targetAngle = (360 - lastWinner * SLICE_ANGLE) - (SLICE_ANGLE / 2);
        var currentAngle = ((state.rotation % 360) + 360) % 360;
        var delta = ((targetAngle - currentAngle) + 360) % 360;
        var extraSpins = 360 * (5 + times);
        state.rotation += extraSpins + delta;

        dom.wheel.style.transition = "transform " + (3 + times * 0.3) + "s cubic-bezier(0.10, 0.72, 0.08, 1)";
        dom.wheel.style.transform = "rotate(" + state.rotation + "deg)";

        setTimeout(function () {
            state.spinning = false;
            renderBalance();

            if (times === 1) {
                showResult("+" + PRIZES[lastWinner].name);
            } else {
                var summary = {};
                winners.forEach(function (w) {
                    var name = PRIZES[w].name;
                    summary[name] = (summary[name] || 0) + 1;
                });
                var parts = [];
                Object.keys(summary).forEach(function (k) {
                    parts.push(summary[k] + "× " + k);
                });
                showResult(parts.slice(0, 2).join(" · ") + (parts.length > 2 ? " +" + (parts.length - 2) : ""));
            }
        }, (3 + times * 0.3) * 1000);
    }

    /* ===== POPUP ===== */

    function openPopup() {
        if (!dom.popup) return;
        dom.popup.hidden = false;
        requestAnimationFrame(function () { dom.popup.classList.add("is-open"); });
        console.log("[RoulettePopup] Opened.");
    }

    function closePopup() {
        if (!dom.popup) return;
        dom.popup.classList.remove("is-open");
        setTimeout(function () { dom.popup.hidden = true; }, 300);
    }

    function isOpen() {
        return dom.popup && dom.popup.classList.contains("is-open");
    }

    /* ===== INIT ===== */

    function cacheDom() {
        dom.popup = $("roulettePopup");
        dom.wheel = $("roulettePopupWheel");
        dom.balance = $("roulettePopupBalance");
        dom.btn1 = $("rouletteRoll1");
        dom.btn10 = $("rouletteRoll10");
        dom.close = $("roulettePopupClose");
        dom.result = $("roulettePopupResult");
    }

    function wire() {
        if (dom.close) dom.close.addEventListener("click", closePopup);
        if (dom.btn1)  dom.btn1.addEventListener("click", function () { spin(1); });
        if (dom.btn10) dom.btn10.addEventListener("click", function () { spin(10); });

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && isOpen()) closePopup();
        });

        var dashboard = $("dashboardScreen");
        if (!dashboard) {
            console.warn("[RoulettePopup] #dashboardScreen tidak ditemukan.");
            return;
        }

        function checkDashboard() {
            var visible = !dashboard.classList.contains("hidden");
            if (visible && !state.shownThisSession) {
                state.shownThisSession = true;
                console.log("[RoulettePopup] Dashboard visible, showing popup...");
                setTimeout(openPopup, 800);
            } else if (!visible) {
                state.shownThisSession = false;
                closePopup();
            }
        }

        if (window.MutationObserver) {
            new MutationObserver(checkDashboard).observe(dashboard, {
                attributes: true,
                attributeFilter: ["class"]
            });
        }

        // Initial check (kalau dashboard sudah visible saat script load)
        checkDashboard();

        // Backup: cek tiap 1 detik selama 5 detik pertama
        var checks = 0;
        var backupTimer = setInterval(function () {
            checks++;
            checkDashboard();
            if (checks >= 5 || state.shownThisSession) clearInterval(backupTimer);
        }, 1000);
    }

    function init() {
        cacheDom();
        if (!dom.popup) {
            console.warn("[RoulettePopup] Element #roulettePopup tidak ditemukan.");
            return;
        }
        loadState();
        renderWheel();
        renderBalance();
        wire();
        console.log("[RoulettePopup] Ready. Points:", state.points);
    }

    window.GroweraRoulettePopup = {
        open: openPopup,
        close: closePopup,
        isOpen: isOpen,
        refresh: function () { loadState(); renderBalance(); },
        setPoints: function (p) {
            state.points = Math.max(0, Number(p) || 0);
            saveState();
            renderBalance();
        },
        spin: spin
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
