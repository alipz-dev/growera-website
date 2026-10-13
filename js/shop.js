/* =========================================
   GROWERA — SHOP MODULE (v3)
   Render shop dari config (localStorage > default).
========================================= */

(function () {
    "use strict";

    var STORAGE_KEY = "growera_shop_config";

    var DEFAULT_CONFIG = {
        version: 1,
        updatedAt: 0,
        categories: [
            {
                key: "topup",
                eyebrow: "CRYSTAL STORE",
                title: "CRYSTAL STORE",
                subtitle: "Isi ulang Gems untuk membuka berbagai kesempatan eksklusif di Crystal Era.",
                currencyIcon: 112,
                currencyName: "GEMS",
                currencyKey: "gems",
                variant: "crystal",
                showBalance: true,
                order: 1,
                active: true,
                packages: [
                    { id: "starter", iconId: 112, price: 15000, tier: "starter", badge: null, order: 1, active: true, displayValue: 100, displayUnit: "GEMS", bonusText: null, rewards: [{ type: "gems", amount: 100 }] }
                ]
            }
        ]
    };

    var config = null;
    var activeCategoryKey = null;

    /* ===== STORAGE ===== */

    function loadConfig() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            var parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.categories)) {
                return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            }
            return parsed;
        } catch (e) {
            console.error("[Shop] Gagal load config:", e);
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    function persistConfig(cfg) {
        try {
            cfg.updatedAt = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) {
            console.error("[Shop] Gagal simpan config:", e);
            return false;
        }
    }

    /* ===== HELPERS ===== */

    function $(id) { return document.getElementById(id); }

    function fmtNum(n) {
        if (typeof window.formatNumber === "function") return window.formatNumber(n);
        return (n || 0).toLocaleString("id-ID");
    }

    function fmtRp(n) {
        if (typeof window.formatRupiah === "function") return window.formatRupiah(n);
        return "Rp " + (n || 0).toLocaleString("id-ID");
    }

    function createIcon(id, size) {
        if (window.GroweraItemPicker && window.GroweraItemPicker.createIcon) {
            return window.GroweraItemPicker.createIcon(id, size);
        }
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size;
        img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size + "px;object-fit:contain;image-rendering:pixelated;display:block";
        img.alt = "";
        return img;
    }

    function getCategories() {
        return (config.categories || [])
            .filter(function (c) { return c.active !== false; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    }

    function getActiveCategory() {
        var list = getCategories();
        return list.filter(function (c) { return c.key === activeCategoryKey; })[0] || list[0];
    }

    /* ===== RENDER TABS ===== */

    function renderTabs() {
        var wrap = $("topupTabs");
        if (!wrap) return;

        wrap.replaceChildren();

        var categories = getCategories();
        if (categories.length === 0) return;

        // Kalau activeCategoryKey tidak valid, pakai yang pertama
        if (!activeCategoryKey || !categories.some(function (c) { return c.key === activeCategoryKey; })) {
            activeCategoryKey = categories[0].key;
        }

        categories.forEach(function (cat) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "topup-tab" + (cat.key === activeCategoryKey ? " active" : "");
            btn.dataset.topupTab = cat.key;

            if (cat.currencyIcon) {
                btn.appendChild(createIcon(cat.currencyIcon, 16));
            }
            btn.appendChild(document.createTextNode(cat.title || cat.key.toUpperCase()));

            btn.addEventListener("click", function () {
                activeCategoryKey = cat.key;
                renderTabs();
                renderHeader();
                renderPanels();
            });

            wrap.appendChild(btn);
        });
    }

    /* ===== RENDER HEADER ===== */

    function renderHeader() {
        var cat = getActiveCategory();
        if (!cat) return;

        var header = $("storeHeader");
        var eyebrow = $("storeEyebrow");
        var title = $("storeTitle");
        var subtitle = $("storeSubtitle");
        var currencyName = $("storeCurrencyName");
        var currencyIcon = $("storeCurrencyIcon");
        var balanceWrap = $("topupBalanceWrap");

        if (header) header.dataset.variant = cat.variant || "crystal";
        if (eyebrow) eyebrow.textContent = cat.eyebrow || "";
        if (title) title.textContent = cat.title || "";
        if (subtitle) subtitle.textContent = cat.subtitle || "";
        if (currencyName) currencyName.textContent = cat.currencyName || "CURRENCY";

        if (currencyIcon) {
            currencyIcon.replaceChildren();
            if (cat.currencyIcon) currencyIcon.appendChild(createIcon(cat.currencyIcon, 18));
        }

        if (balanceWrap) {
            balanceWrap.classList.toggle("hidden", cat.showBalance === false);
        }

        updateBalance();
    }

    /* ===== RENDER PANELS ===== */

    function renderPanels() {
        var wrap = $("topupPanels");
        if (!wrap) return;

        wrap.replaceChildren();

        var cat = getActiveCategory();
        if (!cat) return;

        var panel = document.createElement("div");
        panel.className = "topup-tab-panel";

        var packages = (cat.packages || [])
            .filter(function (p) { return p.active !== false; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

        if (packages.length === 0) {
            var empty = document.createElement("div");
            empty.className = "topup-placeholder";
            var ic = document.createElement("div");
            ic.className = "topup-placeholder-icon";
            ic.appendChild(createIcon(cat.currencyIcon || 112, 56));
            empty.appendChild(ic);
            var h = document.createElement("h3");
            h.textContent = "Belum ada paket";
            empty.appendChild(h);
            var p = document.createElement("p");
            p.textContent = "Paket untuk kategori ini belum ditambahkan oleh admin.";
            empty.appendChild(p);
            panel.appendChild(empty);
        } else {
            var grid = document.createElement("div");
            grid.className = "topup-grid";
            packages.forEach(function (pkg) {
                grid.appendChild(buildCard(pkg, cat));
            });
            panel.appendChild(grid);
        }

        // Info tambahan: cara top up
        if (cat.key === "topup" || true) {
            panel.appendChild(buildHowToSection(cat));
        }

        wrap.appendChild(panel);
    }

    function buildCard(pkg, cat) {
        var card = document.createElement("div");
        card.className = "topup-card";

        if (pkg.tier === "popular" || pkg.tier === "best") card.classList.add("featured");
        if (pkg.tier === "mega") card.classList.add("tier-mega");
        if (pkg.tier === "divine") card.classList.add("tier-divine");

        if (pkg.badge) {
            var badge = document.createElement("div");
            badge.className = "topup-card-badge";
            if (pkg.tier === "mega") badge.classList.add("mega");
            if (pkg.tier === "divine") badge.classList.add("divine");
            badge.textContent = pkg.badge;
            card.appendChild(badge);
        }

        var gemsRow = document.createElement("div");
        gemsRow.className = "topup-card-gems";

        var gemsIcon = document.createElement("div");
        gemsIcon.className = "topup-card-gems-icon";
        gemsIcon.appendChild(createIcon(pkg.iconId || 112, 32));

        var textBlock = document.createElement("div");
        var valueEl = document.createElement("div");
        valueEl.className = "topup-card-gems-value";
        valueEl.textContent = fmtNum(pkg.displayValue || 0);
        var unitEl = document.createElement("div");
        unitEl.className = "topup-card-gems-unit";
        unitEl.textContent = pkg.displayUnit || "GEMS";
        textBlock.appendChild(valueEl);
        textBlock.appendChild(unitEl);

        gemsRow.appendChild(gemsIcon);
        gemsRow.appendChild(textBlock);
        card.appendChild(gemsRow);

        if (pkg.bonusText) {
            var bonus = document.createElement("div");
            bonus.className = "topup-card-bonus";
            bonus.textContent = pkg.bonusText;
            card.appendChild(bonus);
        }

        var divider = document.createElement("div");
        divider.className = "topup-card-divider";
        card.appendChild(divider);

        var price = document.createElement("div");
        price.className = "topup-card-price";
        price.textContent = fmtRp(pkg.price || 0);
        card.appendChild(price);

        var total = document.createElement("div");
        total.className = "topup-card-total";
        total.appendChild(document.createTextNode("Berisi: "));
        var rewards = pkg.rewards || [];
        if (rewards.length === 0) {
            total.appendChild(document.createTextNode("-"));
        } else {
            rewards.forEach(function (r, i) {
                if (i > 0) total.appendChild(document.createTextNode(", "));
                total.appendChild(formatRewardShort(r));
            });
        }
        card.appendChild(total);

        var buyBtn = document.createElement("button");
        buyBtn.type = "button";
        buyBtn.className = "topup-buy-btn";
        buyBtn.textContent = "Beli";
        buyBtn.addEventListener("click", function () { handleBuy(pkg, cat); });
        card.appendChild(buyBtn);

        return card;
    }

    function formatRewardShort(r) {
        var span = document.createElement("span");
        if (r.type === "gems") {
            span.textContent = fmtNum(r.amount) + " Gems";
        } else if (r.type === "item") {
            span.appendChild(createIcon(r.itemId, 14));
            span.appendChild(document.createTextNode(" x" + (r.amount || 1)));
        } else if (r.type === "role") {
            span.textContent = "Role #" + r.roleId + (r.durationDays > 0 ? " (" + r.durationDays + "d)" : " (Perm)");
        } else if (r.type === "currency") {
            span.textContent = fmtNum(r.amount) + " " + (r.currencyKey || "?");
        } else {
            span.textContent = r.type;
        }
        return span;
    }

    function buildHowToSection(cat) {
        var section = document.createElement("section");
        section.className = "topup-section";

        var h = document.createElement("h2");
        h.className = "topup-section-heading";
        h.appendChild(createIcon(1128, 22));
        h.appendChild(document.createTextNode("Cara Membeli"));
        section.appendChild(h);

        var steps = document.createElement("div");
        steps.className = "topup-steps";

        var stepData = [
            { num: "1", title: "Pilih paket", desc: "Klik tombol Beli pada paket yang kamu inginkan." },
            { num: "2", title: "Lakukan pembayaran", desc: "Ikuti instruksi dari metode pembayaran yang kamu pilih." },
            { num: "3", title: "Hadiah otomatis masuk", desc: "Setelah diverifikasi, hadiah langsung masuk ke akunmu." }
        ];

        stepData.forEach(function (s) {
            var step = document.createElement("div");
            step.className = "topup-step";
            var num = document.createElement("div");
            num.className = "topup-step-num";
            num.textContent = s.num;
            var txt = document.createElement("div");
            txt.className = "topup-step-text";
            var strong = document.createElement("strong");
            strong.textContent = s.title;
            txt.appendChild(strong);
            txt.appendChild(document.createElement("br"));
            txt.appendChild(document.createTextNode(s.desc));
            step.appendChild(num);
            step.appendChild(txt);
            steps.appendChild(step);
        });

        section.appendChild(steps);
        return section;
    }

    /* ===== BALANCE ===== */

    function updateBalance() {
        var el = $("topupBalance");
        if (!el) return;

        var cat = getActiveCategory();
        if (!cat) return;

        var profile = window.GroweraProfile && window.GroweraProfile.getProfile
            ? window.GroweraProfile.getProfile() : null;

        var val = "—";
        if (profile && cat.currencyKey && typeof profile[cat.currencyKey] !== "undefined") {
            val = fmtNum(profile[cat.currencyKey]);
        } else if (profile && cat.currencyKey === "gems" && typeof profile.gems !== "undefined") {
            val = fmtNum(profile.gems);
        }

        el.textContent = val;
    }

    /* ===== BUY ===== */

    function handleBuy(pkg, cat) {
        // Kirim event ke backend / server Lua
        var payload = {
            categoryKey: cat.key,
            packageId: pkg.id,
            price: pkg.price,
            rewards: pkg.rewards || [],
            timestamp: Date.now()
        };

        console.log("[Shop] Purchase request:", payload);

        // TODO: ganti dengan fetch ke API server Lua kamu
        // fetch("/api/shop/purchase", { method: "POST", body: JSON.stringify(payload) })

        alert(
            "Paket: " + (pkg.displayValue || "?") + " " + (pkg.displayUnit || "") +
            "\nHarga: " + fmtRp(pkg.price) +
            "\n\nPembayaran otomatis akan segera tersedia."
        );
    }

    /* ===== INIT ===== */

    function init() {
        config = loadConfig();

        var cat = getActiveCategory();
        activeCategoryKey = cat ? cat.key : null;

        renderTabs();
        renderHeader();
        renderPanels();

        console.log("[Shop] Ready. " + config.categories.length + " kategori.");
    }

    /* ===== PUBLIC API ===== */

    window.GroweraShop = {
        init: init,
        render: function () {
            renderTabs();
            renderHeader();
            renderPanels();
        },
        updateBalance: updateBalance,

        getConfig: function () { return JSON.parse(JSON.stringify(config)); },
        setConfig: function (cfg) {
            config = cfg;
            persistConfig(config);
            renderTabs(); renderHeader(); renderPanels();
        },
        resetConfig: function () {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            persistConfig(config);
            renderTabs(); renderHeader(); renderPanels();
        },
        exportConfig: function () { return JSON.stringify(config, null, 2); },

        getDefaultConfig: function () { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
