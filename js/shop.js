/* =========================================
   GROWERA — SHOP MODULE
   Top Up page (Crystal / Assets / Items),
   render paket, tab switching, balance update.

   Dependensi (dari app.js):
   - formatNumber(), formatRupiah()

   Public API (window.GroweraShop):
   - init()                        : wire tab (auto dijalankan)
   - updateBalance(profile|null)   : dipanggil app.js saat profil load
========================================= */

(function () {
    "use strict";


    /* =========================================
       STORE CATEGORIES
    ========================================= */

    const STORE_CATEGORIES = {
        topup: {
            eyebrow: "CRYSTAL STORE",
            title: "CRYSTAL STORE",
            subtitle: "Isi ulang Gems untuk membuka berbagai kesempatan eksklusif di Crystal Era.",
            currencyIcon: "💎",
            currencyName: "GEMS",
            variant: "crystal",
            showBalance: true
        },
        assets: {
            eyebrow: "ASSETS STORE",
            title: "ASSETS STORE",
            subtitle: "Perkuat koleksimu dan temukan berbagai aset berharga untuk perjalananmu di Crystal Era.",
            currencyIcon: "🟠",
            currencyName: "ASSETS CURRENCY",
            variant: "assets",
            showBalance: false
        },
        items: {
            eyebrow: "ITEMS STORE",
            title: "ITEMS STORE",
            subtitle: "Temukan item pilihan, koleksi eksklusif, dan berbagai perlengkapan untuk petualanganmu.",
            currencyIcon: "🟣",
            currencyName: "ITEMS CURRENCY",
            variant: "items",
            showBalance: false
        }
    };


    /* =========================================
       TOPUP PACKAGES
    ========================================= */

    const TOPUP_PACKAGES = [
        { id: "starter", gems: 100, bonusPercent: 0, price: 15000, tier: "starter", badge: null },
        { id: "basic", gems: 300, bonusPercent: 5, price: 40000, tier: "basic", badge: null },
        { id: "popular", gems: 800, bonusPercent: 15, price: 100000, tier: "popular", badge: "⭐ POPULER" },
        { id: "best", gems: 1800, bonusPercent: 20, price: 200000, tier: "best", badge: "🔥 BEST VALUE" },
        { id: "mega", gems: 5000, bonusPercent: 25, price: 500000, tier: "mega", badge: "🟠 MEGA PACK" },
        { id: "divine", gems: 35000, bonusPercent: 40, price: 1500000, tier: "divine", badge: "🌈 DIVINE PACK" }
    ];


    /* =========================================
       RENDER PACKAGES
    ========================================= */

    function renderTopupPackages() {
        const grid = document.getElementById("topupGrid");
        if (!grid) return;

        grid.replaceChildren();

        TOPUP_PACKAGES.forEach(function (pkg) {
            const card = document.createElement("div");
            card.className = "topup-card";

            if (pkg.tier === "popular" || pkg.tier === "best") card.classList.add("featured");
            if (pkg.tier === "mega") card.classList.add("tier-mega");
            if (pkg.tier === "divine") card.classList.add("tier-divine");

            if (pkg.badge) {
                const badge = document.createElement("div");
                badge.className = "topup-card-badge";
                if (pkg.tier === "mega") badge.classList.add("mega");
                if (pkg.tier === "divine") badge.classList.add("divine");
                badge.textContent = pkg.badge;
                card.appendChild(badge);
            }

            const gemsRow = document.createElement("div");
            gemsRow.className = "topup-card-gems";

            const gemsIcon = document.createElement("div");
            gemsIcon.className = "topup-card-gems-icon";
            gemsIcon.textContent = "💎";

            const gemsTextBlock = document.createElement("div");
            const gemsValue = document.createElement("div");
            gemsValue.className = "topup-card-gems-value";
            gemsValue.textContent = formatNumber(pkg.gems);

            const gemsUnit = document.createElement("div");
            gemsUnit.className = "topup-card-gems-unit";
            gemsUnit.textContent = "GEMS";

            gemsTextBlock.appendChild(gemsValue);
            gemsTextBlock.appendChild(gemsUnit);
            gemsRow.appendChild(gemsIcon);
            gemsRow.appendChild(gemsTextBlock);
            card.appendChild(gemsRow);

            if (pkg.bonusPercent > 0) {
                const bonus = document.createElement("div");
                bonus.className = "topup-card-bonus";
                bonus.textContent = "+" + pkg.bonusPercent + "% BONUS";
                card.appendChild(bonus);
            }

            const divider = document.createElement("div");
            divider.className = "topup-card-divider";
            card.appendChild(divider);

            const price = document.createElement("div");
            price.className = "topup-card-price";
            price.textContent = formatRupiah(pkg.price);
            card.appendChild(price);

            const totalReceived = Math.floor(
                pkg.gems + (pkg.gems * pkg.bonusPercent / 100)
            );

            const total = document.createElement("div");
            total.className = "topup-card-total";
            total.innerHTML = "Total <strong>" + formatNumber(totalReceived) + " 💎</strong>";
            card.appendChild(total);

            const buyBtn = document.createElement("button");
            buyBtn.className = "topup-buy-btn";
            buyBtn.type = "button";
            buyBtn.textContent = "Beli";
            buyBtn.addEventListener("click", function () { handleTopupBuy(pkg); });
            card.appendChild(buyBtn);

            grid.appendChild(card);
        });
    }


    /* =========================================
       BALANCE UPDATE
    ========================================= */

    function updateBalance(profile) {
        const el = document.getElementById("topupBalance");
        if (!el) return;
        if (!profile) { el.textContent = "—"; return; }
        el.textContent = formatNumber(profile.gems) + " 💎";
    }


    /* =========================================
       BUY HANDLER
    ========================================= */

    function handleTopupBuy(pkg) {
        alert(
            "Paket: " + formatNumber(pkg.gems) + " Gems (" +
            formatRupiah(pkg.price) + ")\n\n" +
            "Pembayaran otomatis akan segera tersedia."
        );
    }


    /* =========================================
       HEADER UPDATE
    ========================================= */

    function updateStoreHeader(categoryKey) {
        const cat = STORE_CATEGORIES[categoryKey];
        if (!cat) return;

        const header = document.getElementById("storeHeader");
        const eyebrow = document.getElementById("storeEyebrow");
        const title = document.getElementById("storeTitle");
        const subtitle = document.getElementById("storeSubtitle");
        const currencyIcon = document.getElementById("storeCurrencyIcon");
        const currencyName = document.getElementById("storeCurrencyName");
        const balanceWrap = document.getElementById("topupBalanceWrap");

        if (header) header.dataset.variant = cat.variant;
        if (eyebrow) eyebrow.textContent = cat.eyebrow;
        if (title) title.textContent = cat.title;
        if (subtitle) subtitle.textContent = cat.subtitle;
        if (currencyIcon) currencyIcon.textContent = cat.currencyIcon;
        if (currencyName) currencyName.textContent = cat.currencyName;
        if (balanceWrap) balanceWrap.classList.toggle("hidden", !cat.showBalance);
    }


    /* =========================================
       INIT
    ========================================= */

    function init() {
        document.querySelectorAll("[data-topup-tab]").forEach(function (tab) {
            tab.addEventListener("click", function () {
                const target = tab.dataset.topupTab;

                document.querySelectorAll("[data-topup-tab]").forEach(function (t) {
                    t.classList.toggle("active", t.dataset.topupTab === target);
                });

                const panels = {
                    topup: "topupPanelTopup",
                    assets: "topupPanelAssets",
                    items: "topupPanelItems"
                };

                Object.keys(panels).forEach(function (key) {
                    const el = document.getElementById(panels[key]);
                    if (!el) return;
                    el.classList.toggle("hidden", key !== target);
                });

                updateStoreHeader(target);
                const content = document.querySelector(".content");
                if (content) content.scrollTo({ top: 0, behavior: "auto" });
            });
        });

        renderTopupPackages();
        updateStoreHeader("topup");
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.GroweraShop = {
        init: init,
        updateBalance: updateBalance,
        _categories: STORE_CATEGORIES,
        _packages: TOPUP_PACKAGES
    };

    init();

})();
