/* =========================================
   GROWERA — CENTRAL ICON HELPER
   Semua icon pakai item PNG GTPS.
========================================= */

(function () {
    "use strict";

    var ICON = {
        /* News */
        news: 5016,
        newsBadge: 660,

        /* Rewards */
        milestone: 1458,
        dailyLogin: 1360,
        dailyQuest: 94,
        weeklyQuest: 7162,
        monthlyQuest: 4820,
        featured: 4820,

        /* Status */
        lock: 202,
        unlock: 204,

        /* Shop */
        shop: 1430,
        payment: 1434,
        gems: 112,
        howto: 1128,
        save: 102,
        add: 1426,
        edit: 3494,
        trash: 856,
        export: 1128,
        import: 174,
        reset: 1344,
        close: 32,

        /* Profile */
        profile: 980,
        world: 242,
        space: 6746,

        /* Floating */
        players: 980,
        uptime: 7162,
        ram: 164,
        cpu: 902,
        floatingBtn: 1360,

        /* Roulette */
        roulette: 758,
        daily: 932,
        online: 934,
        coin: 242,
        sparkle: 1458,
        ice: 1344,
        crown: 4820,
        cosmic: 6746,

        /* Nav */
        home: 224,
        rewards: 1458,
        topup: 112,
        more: 1430,
        settings: 32,
        logout: 6
    };

    function img(id, size) {
        size = size || 20;
        var i = document.createElement("img");
        i.src = "/assets/itemimage/" + id + ".png";
        i.width = size;
        i.height = size;
        i.alt = "";
        i.draggable = false;
        i.loading = "lazy";
        i.decoding = "async";
        i.style.cssText = "width:" + size + "px;height:" + size +
            "px;object-fit:contain;image-rendering:pixelated;display:block;pointer-events:none";
        var fb = false;
        i.addEventListener("error", function onErr() {
            if (!fb) {
                fb = true;
                i.src = "https://api.gtps.cloud/api/item/texture/" + id + "/";
                return;
            }
            i.removeEventListener("error", onErr);
            i.style.display = "none";
        });
        return i;
    }

    function span(id, size) {
        size = size || 20;
        var s = document.createElement("span");
        s.className = "item-icon";
        s.style.cssText = "display:inline-flex;align-items:center;justify-content:center;" +
            "width:" + size + "px;height:" + size + "px;flex-shrink:0;vertical-align:middle";
        s.appendChild(img(id, size));
        return s;
    }

    function html(id, size) {
        size = size || 20;
        return '<img src="/assets/itemimage/' + id + '.png" ' +
            'width="' + size + '" height="' + size + '" ' +
            'style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;' +
            'image-rendering:pixelated;vertical-align:middle;display:inline-block" ' +
            'loading="lazy" decoding="async" draggable="false" alt="">';
    }

    function set(el, id, size) {
        if (!el) return;
        el.replaceChildren();
        if (typeof id === "number") el.appendChild(img(id, size || 20));
    }

    function attach(root) {
        var scope = root || document;
        scope.querySelectorAll("[data-item-icon]").forEach(function (el) {
            if (el.dataset.itemIconAttached === "1") return;
            el.dataset.itemIconAttached = "1";
            var id = parseInt(el.dataset.itemIcon, 10);
            if (isNaN(id)) return;
            var size = parseInt(el.dataset.itemIconSize || "20", 10);
            el.replaceChildren(img(id, size));
        });
    }

    /* Render semua [data-theme-icon] setelah theme di-apply */
    function renderThemeIcons(themeCfg) {
        var nodes = document.querySelectorAll("[data-theme-icon]");
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var key = el.dataset.themeIcon;
            var id = themeCfg && themeCfg.icons && themeCfg.icons[key];
            if (typeof id !== "number") continue;
            var size = parseInt(el.dataset.itemIconSize || "20", 10);
            el.replaceChildren(img(id, size));
        }
    }

    window.GroweraIcon = {
        ID: ICON,
        img: img,
        span: span,
        html: html,
        set: set,
        attach: attach,
        renderThemeIcons: renderThemeIcons
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () { attach(); });
    } else {
        attach();
    }

    if (typeof MutationObserver !== "undefined") {
        new MutationObserver(function () { attach(); })
            .observe(document.body, { childList: true, subtree: true });
    }

    console.log("[Icon] Ready.");
})();
