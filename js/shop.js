/* =========================================
   GROWERA — SHOP MODULE (v4, clean)
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
                    {
                        id: "starter",
                        iconId: 112,
                        price: 15000,
                        tier: "starter",
                        badge: null,
                        order: 1,
                        active: true,
                        displayValue: 100,
                        displayUnit: "GEMS",
                        rewards: [{ type: "gems", amount: 100 }]
                    }
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
            console.error("[Shop] Load error:", e);
            return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        }
    }

    function persistConfig(cfg) {
        try {
            cfg.updatedAt = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) {
            console.error("[Shop] Save error:", e);
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
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size;
        img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size +
            "px;object-fit:contain;image-rendering:pixelated;display:block";
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
        if (!list.length) return null;
        for (var i = 0; i < list.length; i++) {
            if (list[i].key === activeCategoryKey) return list[i];
        }
        return list[0];
    }

    /* ===== RENDER TABS ===== */

    function renderTabs() {
        var wrap = $("shopTabs");
        if (!wrap) return;
        wrap.replaceChildren();

        var categories = getCategories();
        if (!categories.length) return;

        if (!activeCategoryKey ||
            !categories.some(function (c) { return c.key === activeCategoryKey; })) {
            activeCategoryKey = categories[0].key;
        }

        categories.forEach(function (cat) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "shop-tab" + (cat.key === activeCategoryKey ? " active" : "");

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

        var header = $("shopHeader");
        var eyebrow = $("shopEyebrow");
        var title = $("shopTitle");
        var subtitle = $("shopSubtitle");
        var currencyName = $("shopCurrencyName");
        var currencyIcon = $("shopCurrencyIcon");
        var balanceWrap = $("shopBalanceWrap");

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
        var wrap = $("shopPanels");
        if (!wrap) return;
        wrap.replaceChildren();

        var cat = getActiveCategory();
        if (!cat) return;

        var panel = document.createElement("div");
        panel.className = "shop-panel";

        var packages = (cat.packages || [])
            .filter(function (p) { return p.active !== false; })
            .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

        if (!packages.length) {
            var empty = document.createElement("div");
            empty.className = "shop-empty";

            var ic = document.createElement("div");
            ic.className = "shop-empty-icon";
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
            grid.className = "shop-grid";
            packages.forEach(function (pkg) {
                grid.appendChild(buildCard(pkg, cat));
            });
            panel.appendChild(grid);
        }

        panel.appendChild(buildHowToSection(cat));
        wrap.appendChild(panel);
    }

    /* ===== BUILD CARD ===== */

    function buildCard(pkg, cat) {
        var card = document.createElement("div");
        card.className = "shop-card";

        if (pkg.tier === "popular" || pkg.tier === "best") card.classList.add("featured");
        if (pkg.tier === "mega") card.classList.add("tier-mega");
        if (pkg.tier === "divine") card.classList.add("tier-divine");

        if (pkg.badge) {
            var badge = document.createElement("div");
            badge.className = "shop-card-badge";
            if (pkg.tier === "mega") badge.classList.add("mega");
            if (pkg.tier === "divine") badge.classList.add("divine");
            badge.textContent = pkg.badge;
            card.appendChild(badge);
        }

        var main = document.createElement("div");
        main.className = "shop-card-main";

        var iconWrap = document.createElement("div");
        iconWrap.className = "shop-card-icon";
        iconWrap.appendChild(createIcon(pkg.iconId || 112, 40));

        var textBlock = document.createElement("div");
        var valueEl = document.createElement("div");
        valueEl.className = "shop-card-value";
        valueEl.textContent = fmtNum(pkg.displayValue || 0);
        var unitEl = document.createElement("div");
        unitEl.className = "shop-card-unit";
        unitEl.textContent = pkg.displayUnit || "GEMS";
        textBlock.appendChild(valueEl);
        textBlock.appendChild(unitEl);

        main.appendChild(iconWrap);
        main.appendChild(textBlock);
        card.appendChild(main);

        var divider = document.createElement("div");
        divider.className = "shop-card-divider";
        card.appendChild(divider);

        var price = document.createElement("div");
        price.className = "shop-card-price";
        price.textContent = fmtRp(pkg.price || 0);
        card.appendChild(price);

        var rewards = document.createElement("div");
        rewards.className = "shop-card-rewards";
        rewards.appendChild(document.createTextNode("Berisi: "));
        if (!pkg.rewards || !pkg.rewards.length) {
            rewards.appendChild(document.createTextNode("-"));
        } else {
            pkg.rewards.forEach(function (r, i) {
                if (i > 0) rewards.appendChild(document.createTextNode(", "));
                rewards.appendChild(buildRewardLabel(r));
            });
        }
        card.appendChild(rewards);

        var buyBtn = document.createElement("button");
        buyBtn.type = "button";
        buyBtn.className = "shop-buy-btn";
        buyBtn.textContent = "Beli";
        buyBtn.addEventListener("click", function () { handleBuy(pkg, cat); });
        card.appendChild(buyBtn);

        return card;
    }

    function buildRewardLabel(r) {
        var span = document.createElement("span");
        if (r.type === "gems") {
            span.textContent = fmtNum(r.amount) + " Gems";
        } else if (r.type === "item") {
            span.appendChild(createIcon(r.itemId, 14));
            span.appendChild(document.createTextNode(" x" + (r.amount || 1)));
        } else if (r.type === "role") {
            span.textContent = "Role #" + r.roleId +
                (r.durationDays > 0 ? " (" + r.durationDays + "d)" : " (Perm)");
        } else if (r.type === "currency") {
            span.textContent = fmtNum(r.amount) + " " + (r.currencyKey || "?");
        } else {
            span.textContent = r.type;
        }
        return span;
    }

    function buildHowToSection() {
        var section = document.createElement("section");
        section.className = "shop-section";

        var h = document.createElement("h2");
        h.className = "shop-section-heading";
        h.appendChild(createIcon(1128, 22));
        h.appendChild(document.createTextNode("Cara Membeli"));
        section.appendChild(h);

        var steps = document.createElement("div");
        steps.className = "shop-steps";

        [
            { num: "1", title: "Pilih paket", desc: "Klik tombol Beli pada paket yang kamu inginkan." },
            { num: "2", title: "Lakukan pembayaran", desc: "Ikuti instruksi dari metode pembayaran." },
            { num: "3", title: "Hadiah otomatis masuk", desc: "Setelah diverifikasi, hadiah langsung masuk ke akunmu." }
        ].forEach(function (s) {
            var step = document.createElement("div");
            step.className = "shop-step";

            var num = document.createElement("div");
            num.className = "shop-step-num";
            num.textContent = s.num;

            var txt = document.createElement("div");
            txt.className = "shop-step-text";
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
        var el = $("shopBalance");
        if (!el) return;

        var cat = getActiveCategory();
        if (!cat) { el.textContent = "—"; return; }

        var profile = window.GroweraProfile && window.GroweraProfile.getProfile
            ? window.GroweraProfile.getProfile() : null;

        var val = "—";
        if (profile && cat.currencyKey && typeof profile[cat.currencyKey] !== "undefined") {
            val = fmtNum(profile[cat.currencyKey]);
        }
        el.textContent = val;
    }

    /* ===== BUY ===== */

    function handleBuy(pkg, cat) {
        var payload = {
            categoryKey: cat.key,
            packageId: pkg.id,
            price: pkg.price,
            rewards: pkg.rewards || [],
            timestamp: Date.now()
        };

        console.log("[Shop] Purchase request:", payload);

        // TODO: kirim ke server Lua lewat API
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

        console.log("[Shop] Ready. " + (config.categories || []).length + " kategori.");
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
            renderTabs();
            renderHeader();
            renderPanels();
        },
        resetConfig: function () {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            persistConfig(config);
            renderTabs();
            renderHeader();
            renderPanels();
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
