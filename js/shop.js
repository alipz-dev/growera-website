/* =========================================
   GROWERA — SHOP MODULE (v6, server-config)
========================================= */

(function () {
    "use strict";

    var DEFAULT_CONFIG = {
        version: 1,
        updatedAt: 0,
        categories: []
    };

    var config = null;
    var activeCategoryKey = null;

    /* ===== LOAD CONFIG ===== */

    function loadConfig() {
        // Kalau GroweraConfig tersedia → fetch dari server
        if (window.GroweraConfig && window.GroweraConfig.get) {
            return window.GroweraConfig.get("shop")
                .then(function (data) {
                    if (data && Array.isArray(data.categories)) {
                        config = data;
                    } else {
                        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                    }
                    return config;
                })
                .catch(function (err) {
                    console.error("[Shop] Gagal load config:", err);
                    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                    return config;
                });
        }

        // Fallback: pakai default (config kosong)
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        return Promise.resolve(config);
    }

    /* ==== Sisanya SAMA seperti sebelumnya, kecuali: ==== */

    /* ===== STORAGE: hanya untuk ADMIN DRAFT ===== */
    /* Player tidak menyimpan config di localStorage, hanya baca dari server */

    var ADMIN_DRAFT_KEY = "growera_shop_config_draft";

    function saveAdminDraft(cfg) {
        try {
            cfg.updatedAt = Date.now();
            localStorage.setItem(ADMIN_DRAFT_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) { return false; }
    }

    function loadAdminDraft() {
        try {
            var raw = localStorage.getItem(ADMIN_DRAFT_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function clearAdminDraft() {
        try { localStorage.removeItem(ADMIN_DRAFT_KEY); } catch (e) {}
    }

    /* ==== Fungsi render, buildCard, dll TETAP SAMA ==== */

    /* ===== INIT (async) ===== */

    function init() {
        loadConfig().then(function () {
            var cat = getActiveCategory();
            activeCategoryKey = cat ? cat.key : null;
            renderTabs();
            renderHeader();
            renderPanels();
            console.log("[Shop] Ready. " + ((config.categories || []).length) + " kategori.");
        });
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

        // Untuk ADMIN: getConfig() mengembalikan draft (kalau ada) atau config dari server
        getConfig: function () {
            if (currentUserIsAdmin) {
                var draft = loadAdminDraft();
                if (draft) return JSON.parse(JSON.stringify(draft));
            }
            return JSON.parse(JSON.stringify(config || DEFAULT_CONFIG));
        },

        // ADMIN: simpan draft (belum tersimpan permanen)
        setConfig: function (cfg) {
            saveAdminDraft(cfg);
            config = cfg;
            renderTabs();
            renderHeader();
            renderPanels();
        },

        // ADMIN: hapus draft, kembali ke config server
        discardDraft: function () {
            clearAdminDraft();
            return loadConfig().then(function () {
                renderTabs(); renderHeader(); renderPanels();
            });
        },

        resetConfig: function () {
            clearAdminDraft();
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            renderTabs(); renderHeader(); renderPanels();
        },

        exportConfig: function () { return JSON.stringify(config, null, 2); },
        getDefaultConfig: function () { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
    };

    /* ===== Helper: cek admin ===== */
    var currentUserIsAdmin = false;
    // app.js akan set ini via window.GroweraShop.setAdmin(true)
    window.GroweraShop.setAdmin = function (val) {
        currentUserIsAdmin = !!val;
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
