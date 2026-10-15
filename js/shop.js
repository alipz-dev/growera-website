/* =========================================
   GROWERA — SHOP MODULE (v7, GTPS)
========================================= */

(function () {
    "use strict";

    /* ===== UI ICONS (item GTPS) ===== */

    var UI = {
        shop: 1430,       // Shop Sign
        package: 1430,    // Shop Sign
        payment: 1434,    // Cash Register
        gems: 112,        // Gems
        howto: 1128,      // Up Up and Away
        save: 102,        // Wooden Platform
        add: 1426,        // For Sale Sign
        edit: 3494,       // Paintbrush
        trash: 856,       // Garbage
        export: 1128,
        import: 174,      // Yellow Block
        reset: 1344,      // Ice Cube
        close: 32
    };

    /* ===== HELPERS ===== */

    function $(id) { return document.getElementById(id); }
    function isEmpty(v) { return v === undefined || v === null || String(v).trim() === ""; }
    function hasNumber(v) { if (isEmpty(v)) return false; var n = Number(v); return Number.isFinite(n) && n > 0; }

    function fmtNum(n) {
        if (typeof window.formatNumber === "function") return window.formatNumber(n);
        return (n || 0).toLocaleString("id-ID");
    }
    function fmtRp(n) {
        if (typeof window.formatRupiah === "function") return window.formatRupiah(n);
        return "Rp " + (n || 0).toLocaleString("id-ID");
    }
    function formatDisplayValue(v) {
        if (isEmpty(v)) return "";
        var s = String(v).trim();
        if (/^-?\d+$/.test(s)) {
            var n = parseInt(s, 10);
            return (typeof window.formatNumber === "function") ? window.formatNumber(n) : n.toLocaleString("id-ID");
        }
        return s;
    }

    function iconEl(id, size) {
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size;
        img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size +
            "px;object-fit:contain;image-rendering:pixelated;display:block;pointer-events:none";
        img.alt = "";
        img.draggable = false;
        var fb = false;
        img.addEventListener("error", function onErr() {
            if (!fb) { fb = true; img.src = "https://api.gtps.cloud/api/item/texture/" + id + "/"; return; }
            img.removeEventListener("error", onErr);
            img.style.display = "none";
        });
        return img;
    }

    var config = null;
    var activeCategoryKey = null;

    /* ===== CATEGORY ===== */

    function getCategories() {
        if (!config) return [];
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
        if (!activeCategoryKey || !categories.some(function (c) { return c.key === activeCategoryKey; })) {
            activeCategoryKey = categories[0].key;
        }
        categories.forEach(function (cat) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "shop-tab" + (cat.key === activeCategoryKey ? " active" : "");
            if (!isEmpty(cat.currencyIcon)) btn.appendChild(iconEl(cat.currencyIcon, 16));
            btn.appendChild(document.createTextNode(!isEmpty(cat.title) ? cat.title : (cat.key || "").toUpperCase()));
            btn.addEventListener("click", function () {
                activeCategoryKey = cat.key;
                renderTabs(); renderHeader(); renderPanels();
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
        var currencyBlock = $("shopCurrency");

        if (header) header.dataset.variant = cat.variant || "crystal";

        if (eyebrow) {
            if (isEmpty(cat.eyebrow)) { eyebrow.textContent = ""; eyebrow.style.display = "none"; }
            else { eyebrow.textContent = cat.eyebrow; eyebrow.style.display = ""; }
        }
        if (title) title.textContent = !isEmpty(cat.title) ? cat.title : (cat.key || "").toUpperCase();
        if (subtitle) {
            if (isEmpty(cat.subtitle)) { subtitle.textContent = ""; subtitle.style.display = "none"; }
            else { subtitle.textContent = cat.subtitle; subtitle.style.display = ""; }
        }
        if (currencyName) currencyName.textContent = isEmpty(cat.currencyName) ? "" : cat.currencyName;
        if (currencyIcon) {
            currencyIcon.replaceChildren();
            if (!isEmpty(cat.currencyIcon)) currencyIcon.appendChild(iconEl(cat.currencyIcon, 18));
        }
        if (currencyBlock) {
            currencyBlock.style.display = (isEmpty(cat.currencyName) && isEmpty(cat.currencyIcon)) ? "none" : "";
        }
        if (balanceWrap) balanceWrap.classList.toggle("hidden", cat.showBalance === false);
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
            if (!isEmpty(cat.currencyIcon)) {
                var ic = document.createElement("div");
                ic.className = "shop-empty-icon";
                ic.appendChild(iconEl(cat.currencyIcon, 56));
                empty.appendChild(ic);
            }
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
            packages.forEach(function (pkg) { grid.appendChild(buildCard(pkg, cat)); });
            panel.appendChild(grid);
        }

        panel.appendChild(buildHowToSection());
        wrap.appendChild(panel);
    }

    /* ===== BUILD CARD ===== */

    function buildCard(pkg, cat) {
        var card = document.createElement("div");
        card.className = "shop-card";
        if (pkg.tier === "popular" || pkg.tier === "best") card.classList.add("featured");
        if (pkg.tier === "mega") card.classList.add("tier-mega");
        if (pkg.tier === "divine") card.classList.add("tier-divine");

        if (!isEmpty(pkg.badge)) {
            var badge = document.createElement("div");
            badge.className = "shop-card-badge";
            if (pkg.tier === "mega") badge.classList.add("mega");
            if (pkg.tier === "divine") badge.classList.add("divine");
            badge.textContent = pkg.badge;
            card.appendChild(badge);
        }

        var hasIcon = !isEmpty(pkg.iconId);
        var hasValue = !isEmpty(pkg.displayValue);
        var hasUnit = !isEmpty(pkg.displayUnit);

        if (hasIcon || hasValue || hasUnit) {
            var main = document.createElement("div");
            main.className = "shop-card-main";
            if (hasIcon) {
                var iw = document.createElement("div");
                iw.className = "shop-card-icon";
                iw.appendChild(iconEl(pkg.iconId, 40));
                main.appendChild(iw);
            }
            if (hasValue || hasUnit) {
                var tb = document.createElement("div");
                if (hasValue) {
                    var vEl = document.createElement("div");
                    vEl.className = "shop-card-value";
                    vEl.textContent = formatDisplayValue(pkg.displayValue);
                    tb.appendChild(vEl);
                }
                if (hasUnit) {
                    var uEl = document.createElement("div");
                    uEl.className = "shop-card-unit";
                    uEl.textContent = pkg.displayUnit;
                    tb.appendChild(uEl);
                }
                main.appendChild(tb);
            }
            card.appendChild(main);
            var divider = document.createElement("div");
            divider.className = "shop-card-divider";
            card.appendChild(divider);
        }

        if (!isEmpty(pkg.bonusText)) {
            var bonus = document.createElement("div");
            bonus.className = "shop-card-bonus";
            bonus.textContent = pkg.bonusText;
            card.appendChild(bonus);
        }

        if (hasNumber(pkg.price)) {
            var price = document.createElement("div");
            price.className = "shop-card-price";
            price.textContent = fmtRp(Number(pkg.price));
            card.appendChild(price);
        }

        if (pkg.rewards && pkg.rewards.length > 0) {
            var rewards = document.createElement("div");
            rewards.className = "shop-card-rewards";
            rewards.appendChild(document.createTextNode("Berisi: "));
            pkg.rewards.forEach(function (r, i) {
                if (i > 0) rewards.appendChild(document.createTextNode(", "));
                rewards.appendChild(buildRewardLabel(r));
            });
            card.appendChild(rewards);
        }

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
            if (!isEmpty(r.itemId)) {
                span.appendChild(iconEl(r.itemId, 14));
                span.appendChild(document.createTextNode(" x" + (r.amount || 1)));
            } else {
                span.textContent = "-";
            }
        } else if (r.type === "role") {
            span.textContent = "Role #" + r.roleId + (r.durationDays > 0 ? " (" + r.durationDays + "d)" : " (Perm)");
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
        h.appendChild(iconEl(UI.howto, 22));
        h.appendChild(document.createTextNode("Cara Membeli"));
        section.appendChild(h);

        var steps = document.createElement("div");
        steps.className = "shop-steps";
        var stepData = [
            { iconId: UI.package, title: "Pilih paket", desc: "Klik tombol Beli pada paket yang kamu inginkan." },
            { iconId: UI.payment, title: "Lakukan pembayaran", desc: "Ikuti instruksi dari metode pembayaran." },
            { iconId: UI.gems,    title: "Hadiah otomatis masuk", desc: "Setelah diverifikasi, hadiah langsung masuk ke akunmu." }
        ];
        stepData.forEach(function (s) {
            var step = document.createElement("div");
            step.className = "shop-step";
            var num = document.createElement("div");
            num.className = "shop-step-num";
            num.appendChild(iconEl(s.iconId, 24));
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
        var profile = window.GroweraProfile && window.GroweraProfile.current;
        var val = "—";
        if (profile && cat.currencyKey && typeof profile[cat.currencyKey] !== "undefined") {
            val = fmtNum(profile[cat.currencyKey]);
        }
        el.textContent = val;
    }

    /* ===== BUY ===== */

    function handleBuy(pkg, cat) {
        var backendId = pkg.backendId;
        if (!backendId) { alert("Error: package tidak punya backend ID. Refresh halaman."); return; }

        var token = null;
        try { token = localStorage.getItem("growera_token"); } catch (e) {}
        if (!token) { alert("Silakan login dulu."); return; }

        var msg = "Beli paket " + (pkg.displayValue || "?") + " " + (pkg.displayUnit || "");
        if (hasNumber(pkg.price)) msg += "\nHarga: " + fmtRp(pkg.price);
        msg += "\n\nLanjut?";
        if (!confirm(msg)) return;

        fetch("/api/growera/shop/purchase", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ packageId: backendId }),
            cache: "no-store"
        })
        .then(function (res) {
            return res.text().then(function (t) { return { ok: res.ok, status: res.status, text: t }; });
        })
        .then(function (r) {
            var data;
            try { data = JSON.parse(r.text); } catch (e) { data = {}; }
            if (!r.ok || data.success !== true) {
                throw new Error(data.message || ("Gagal (HTTP " + r.status + ")"));
            }
            alert(data.message || "Pembelian berhasil!");
            if (window.GroweraProfile && window.GroweraProfile.fetch) {
                window.GroweraProfile.fetch();
            }
        })
        .catch(function (err) {
            console.error("[Shop] Purchase error:", err);
            alert("Gagal membeli: " + err.message);
        });
    }

    /* ===== INIT ===== */

    function init() {
        if (!window.GroweraConfig) {
            console.error("[Shop] ConfigLoader tidak tersedia.");
            return;
        }
        window.GroweraConfig.get("shop")
            .then(function (data) {
                config = data;
                var cat = getActiveCategory();
                activeCategoryKey = cat ? cat.key : null;
                renderTabs(); renderHeader(); renderPanels();
                console.log("[Shop] Ready. " + ((config.categories || []).length) + " kategori.");
            })
            .catch(function (err) {
                console.error("[Shop] Load error:", err);
                config = { categories: [] };
                renderTabs(); renderHeader(); renderPanels();
            });
    }

    function reload() {
        if (!window.GroweraConfig) return Promise.resolve();
        return window.GroweraConfig.refresh("shop").then(function (data) {
            config = data;
            var cat = getActiveCategory();
            if (!activeCategoryKey) activeCategoryKey = cat ? cat.key : null;
            renderTabs(); renderHeader(); renderPanels();
        });
    }

    window.GroweraShop = {
        init: init,
        reload: reload,
        render: function () { renderTabs(); renderHeader(); renderPanels(); },
        updateBalance: updateBalance,
        getConfig: function () { return JSON.parse(JSON.stringify(config || { categories: [] })); },
        setAdmin: function () {},
        isAdmin: function () { return false; }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
