/* =========================================
   GROWERA — CONFIG LOADER
   Fetch semua config dari server (data/*.json),
   cache dengan version check untuk hindari re-fetch.
========================================= */

(function () {
    "use strict";

    var CACHE_KEY_PREFIX = "growera_config_cache_";
    var CACHE_TTL = 5 * 60 * 1000; // 5 menit

    var memoryCache = {};
    var pendingRequests = {};

    var CONFIG_FILES = {
        shop:     "/data/shop-config.json",
        theme:    "/data/theme-config.json",
        news:     "/data/news-config.json",
        rewards:  "/data/rewards-config.json"
    };

    /* ===== HELPERS ===== */

    function getCacheFromStorage(key) {
        try {
            var raw = localStorage.getItem(CACHE_KEY_PREFIX + key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) { return null; }
    }

    function setCacheToStorage(key, entry) {
        try {
            localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify(entry));
        } catch (e) { /* quota */ }
    }

    function isCacheStale(entry) {
        if (!entry || !entry.fetchedAt) return true;
        return (Date.now() - entry.fetchedAt) > CACHE_TTL;
    }

    /* ===== FETCH SATU CONFIG ===== */

    function fetchConfig(name) {
        if (pendingRequests[name]) return pendingRequests[name];

        var url = CONFIG_FILES[name];
        if (!url) return Promise.reject(new Error("Config tidak dikenal: " + name));

        var cached = memoryCache[name];
        if (cached && !isCacheStale(cached)) {
            return Promise.resolve(cached.data);
        }

        var stored = getCacheFromStorage(name);
        if (stored && stored.data && !isCacheStale(stored)) {
            memoryCache[name] = stored;
            return Promise.resolve(stored.data);
        }

        var promise = fetch(url + "?_t=" + Date.now(), {
            method: "GET",
            headers: { "Accept": "application/json" },
            cache: "no-store"
        })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status + " untuk " + url);
                return res.json();
            })
            .then(function (data) {
                var entry = {
                    version: data.version || 1,
                    updatedAt: data.updatedAt || 0,
                    data: data,
                    fetchedAt: Date.now()
                };
                memoryCache[name] = entry;
                setCacheToStorage(name, entry);
                return data;
            })
            .catch(function (err) {
                console.error("[ConfigLoader] Gagal fetch " + name + ":", err);
                if (stored && stored.data) {
                    console.warn("[ConfigLoader] Pakai cache lama untuk " + name);
                    memoryCache[name] = stored;
                    return stored.data;
                }
                throw err;
            })
            .finally(function () {
                delete pendingRequests[name];
            });

        pendingRequests[name] = promise;
        return promise;
    }

    function fetchAll() {
        var names = Object.keys(CONFIG_FILES);
        return Promise.all(names.map(function (n) {
            return fetchConfig(n).catch(function () { return null; });
        })).then(function (results) {
            var out = {};
            names.forEach(function (n, i) { out[n] = results[i]; });
            return out;
        });
    }

    /* ===== PUBLIC API ===== */

    window.GroweraConfig = {
        get: function (name) { return fetchConfig(name); },
        getAll: fetchAll,

        clearCache: function () {
            Object.keys(CONFIG_FILES).forEach(function (n) {
                try { localStorage.removeItem(CACHE_KEY_PREFIX + n); } catch (e) {}
            });
            memoryCache = {};
        },

        refresh: function (name) {
            delete memoryCache[name];
            try { localStorage.removeItem(CACHE_KEY_PREFIX + name); } catch (e) {}
            return fetchConfig(name);
        },

        paths: CONFIG_FILES
    };

    console.log("[ConfigLoader] Ready. Sources:", CONFIG_FILES);
})();
