/* =========================================
   GROWERA — CONFIG LOADER (v3, GTPS)
   Shop & Theme fetch dari server GTPS.
========================================= */

(function () {
    "use strict";

    var CACHE_KEY_PREFIX = "growera_config_cache_";
    var CACHE_TTL = 2 * 60 * 1000;
    var TOKEN_KEY = "growera_token";

    var memoryCache = {};
    var pendingRequests = {};

    function getToken() {
        try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; }
    }

    function apiFetch(url, opts) {
        opts = opts || {};
        opts.headers = opts.headers || {};
        if (!opts.headers["Accept"]) opts.headers["Accept"] = "application/json";
        if (opts.body && !opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
        var token = getToken();
        if (token && !opts.headers["Authorization"]) opts.headers["Authorization"] = "Bearer " + token;
        if (opts.cache === undefined) opts.cache = "no-store";
        return fetch(url, opts);
    }

    function getCacheFromStorage(key) {
        try {
            var raw = localStorage.getItem(CACHE_KEY_PREFIX + key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function setCacheToStorage(key, entry) {
        try { localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry)); } catch (e) {}
    }

    function isCacheStale(entry) {
        if (!entry || !entry.fetchedAt) return true;
        return (Date.now() - entry.fetchedAt) > CACHE_TTL;
    }

    /* ===== SHOP ===== */

    function loadShopFromServer() {
        return apiFetch("/api/growera/shop/config")
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (data) {
                if (!data || data.success !== true) throw new Error("Invalid response");
                var cfg = data.config || { version: 1, categories: [] };
                if (!Array.isArray(cfg.categories)) cfg.categories = [];
                return cfg;
            });
    }

    function loadShopFallback() {
        return fetch("/data/shop-config.json?_t=" + Date.now(), { cache: "no-store" })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            });
    }

    /* ===== THEME ===== */

    function loadThemeFromServer() {
        return apiFetch("/api/growera/theme")
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (data) {
                if (!data || data.success !== true) throw new Error("Invalid response");
                return data.theme || null;
            });
    }

    function loadThemeFallback() {
        return fetch("/data/theme-config.json?_t=" + Date.now(), { cache: "no-store" })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            });
    }

    /* ===== LOADER REGISTRY ===== */

    var LOADERS = {
        shop:  { primary: loadShopFromServer,  fallback: loadShopFallback },
        theme: { primary: loadThemeFromServer, fallback: loadThemeFallback }
    };

    function fetchConfig(name) {
        if (pendingRequests[name]) return pendingRequests[name];

        var loader = LOADERS[name];
        if (!loader) return Promise.reject(new Error("Unknown config: " + name));

        var cached = memoryCache[name];
        if (cached && !isCacheStale(cached)) return Promise.resolve(cached.data);

        var stored = getCacheFromStorage(name);
        if (stored && stored.data && !isCacheStale(stored)) {
            memoryCache[name] = stored;
            return Promise.resolve(stored.data);
        }

        var promise = loader.primary()
            .then(function (data) {
                if (!data) throw new Error("Empty response");
                var entry = {
                    version: (data && data.version) || 1,
                    data: data,
                    fetchedAt: Date.now()
                };
                memoryCache[name] = entry;
                setCacheToStorage(name, entry);
                return data;
            })
            .catch(function (err) {
                console.warn("[ConfigLoader] Server fetch gagal untuk " + name + ":", err.message);
                return loader.fallback()
                    .then(function (data) {
                        var entry = { version: 1, data: data, fetchedAt: Date.now() };
                        memoryCache[name] = entry;
                        setCacheToStorage(name, entry);
                        return data;
                    })
                    .catch(function (e2) {
                        if (stored && stored.data) {
                            console.warn("[ConfigLoader] Pakai cache lama untuk " + name);
                            memoryCache[name] = stored;
                            return stored.data;
                        }
                        throw e2;
                    });
            })
            .finally(function () { delete pendingRequests[name]; });

        pendingRequests[name] = promise;
        return promise;
    }

    window.GroweraConfig = {
        get: fetchConfig,
        getAll: function () {
            var names = Object.keys(LOADERS);
            return Promise.all(names.map(function (n) {
                return fetchConfig(n).catch(function () { return null; });
            })).then(function (r) {
                var out = {};
                names.forEach(function (n, i) { out[n] = r[i]; });
                return out;
            });
        },
        clearCache: function () {
            Object.keys(LOADERS).forEach(function (n) {
                try { localStorage.removeItem(CACHE_KEY_PREFIX + n); } catch (e) {}
            });
            memoryCache = {};
        },
        refresh: function (name) {
            delete memoryCache[name];
            try { localStorage.removeItem(CACHE_KEY_PREFIX + name); } catch (e) {}
            return fetchConfig(name);
        },
        api: apiFetch,
        getToken: getToken
    };

    console.log("[ConfigLoader] Ready (GTPS server-driven).");
})();
