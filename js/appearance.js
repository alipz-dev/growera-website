/* =========================================
   GROWERA — APPEARANCE (v3, GTPS server-driven)
========================================= */

(function () {
    "use strict";

    var DEFAULTS = {
        version: 1,
        updatedAt: 0,
        colors: {
            cyan: "#65E7FF", violet: "#9B7BFF", gold: "#FFD966",
            success: "#58FFAD", danger: "#FF5C8A", bg: "#080D19",
            surface: "#0D1523", text: "#E8F1FF", muted: "#7186A4"
        },
        icons: {
            brandLogo: 112, sidebarHome: 224, sidebarProfile: 980,
            sidebarRewards: 1458, sidebarRoulette: 758, sidebarTopup: 112,
            sidebarMore: 1430, sidebarSettings: 32, sidebarLogout: 6,
            floatingBtn: 1360, appearanceIcon: 3494
        }
    };

    var COLOR_LABELS = {
        cyan: "Primary (Cyan)", violet: "Secondary (Violet)", gold: "Gold / Saldo",
        success: "Success / Hijau", danger: "Danger / Merah", bg: "Background Utama",
        surface: "Surface / Card", text: "Text Utama", muted: "Text Muted"
    };

    var ICON_LABELS = {
        brandLogo: "Logo / Brand",
        sidebarHome: "Nav: Home",
        sidebarProfile: "Nav: Profile",
        sidebarRewards: "Nav: Rewards",
        sidebarRoulette: "Nav: Roulette",
        sidebarTopup: "Nav: Top Up",
        sidebarMore: "Nav: More",
        sidebarSettings: "Nav: Settings",
        sidebarLogout: "Nav: Logout",
        floatingBtn: "Floating Button",
        appearanceIcon: "Ikon Menu Appearance"
    };

    var config = null;
    var styleEl = null;
    var currentUserIsAdmin = false;

    function $(id) { return document.getElementById(id); }
    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    function mergeDeep(t, s) {
        if (!s || typeof s !== "object") return t;
        Object.keys(s).forEach(function (k) {
            if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k])) {
                t[k] = mergeDeep(t[k] || {}, s[k]);
            } else {
                t[k] = s[k];
            }
        });
        return t;
    }

    function normalizeHex(v) {
        if (!v) return "#000000";
        v = String(v).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
        if (/^#[0-9a-fA-F]{3}$/.test(v)) return "#" + v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
        if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
        return "#000000";
    }

    function isValidHex(v) {
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v || "").trim());
    }

    function iconImg(id, size) {
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size;
        img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size +
            "px;object-fit:contain;image-rendering:pixelated;display:block";
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

    /* ===== API ===== */

    function apiFetch(url, opts) {
        opts = opts || {};
        opts.headers = opts.headers || {};
        opts.headers["Accept"] = "application/json";
        if (opts.body && !opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
        var token = null;
        try { token = localStorage.getItem("growera_token"); } catch (e) {}
        if (token) opts.headers["Authorization"] = "Bearer " + token;
        opts.cache = "no-store";
        return fetch(url, opts).then(function (res) {
            return res.text().then(function (t) {
                var d; try { d = JSON.parse(t); } catch (e) { d = {}; }
                return { ok: res.ok, status: res.status, data: d };
            });
        });
    }

    /* ===== APPLY ===== */

    function applyColors() {
        if (!styleEl) {
            styleEl = document.getElementById("growera-theme");
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = "growera-theme";
                document.head.appendChild(styleEl);
            }
        }
        var c = config.colors;
        styleEl.textContent = ":root{" +
            "--cyan:" + c.cyan + ";" +
            "--violet:" + c.violet + ";" +
            "--gold:" + c.gold + ";" +
            "--success:" + c.success + ";" +
            "--danger:" + c.danger + ";" +
            "--bg:" + c.bg + ";" +
            "--surface:" + c.surface + ";" +
            "--text:" + c.text + ";" +
            "--muted:" + c.muted + ";}";
    }

    function applyIcons() {
        var nodes = document.querySelectorAll("[data-theme-icon]");
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var key = el.dataset.themeIcon;
            var id = config.icons[key];
            if (typeof id !== "number") continue;
            var size = parseInt(el.dataset.itemIconSize || "20", 10);
            el.replaceChildren(iconImg(id, size));
        }
    }

    function apply() { applyColors(); applyIcons(); }

    /* ===== EDITOR UI ===== */

    function renderColorGrid() {
        var grid = $("appearanceColorGrid");
        if (!grid) return;
        grid.replaceChildren();

        Object.keys(COLOR_LABELS).forEach(function (key) {
            var value = config.colors[key] || "#000000";
            var row = document.createElement("div");
            row.className = "appearance-row";

            var label = document.createElement("label");
            label.className = "appearance-label";
            label.textContent = COLOR_LABELS[key];

            var wrap = document.createElement("div");
            wrap.className = "appearance-color-wrap";

            var picker = document.createElement("input");
            picker.type = "color";
            picker.className = "appearance-color-picker";
            picker.value = normalizeHex(value);

            var hexInput = document.createElement("input");
            hexInput.type = "text";
            hexInput.className = "appearance-hex";
            hexInput.maxLength = 9;
            hexInput.value = value;

            picker.addEventListener("input", function () {
                config.colors[key] = picker.value;
                hexInput.value = picker.value;
                applyColors();
            });

            hexInput.addEventListener("input", function () {
                var v = hexInput.value.trim();
                if (isValidHex(v)) {
                    config.colors[key] = v;
                    picker.value = normalizeHex(v);
                    applyColors();
                }
            });

            wrap.appendChild(picker);
            wrap.appendChild(hexInput);
            row.appendChild(label);
            row.appendChild(wrap);
            grid.appendChild(row);
        });
    }

    function renderIconGrid() {
        var grid = $("appearanceIconGrid");
        if (!grid) return;
        grid.replaceChildren();

        Object.keys(ICON_LABELS).forEach(function (key) {
            var currentId = config.icons[key];
            var row = document.createElement("div");
            row.className = "appearance-row";

            var label = document.createElement("label");
            label.className = "appearance-label";
            label.textContent = ICON_LABELS[key];

            var wrap = document.createElement("div");
            wrap.className = "appearance-icon-wrap";

            var preview = document.createElement("div");
            preview.className = "appearance-icon-preview";
            preview.appendChild(iconImg(currentId, 28));

            var input = document.createElement("input");
            input.type = "text";
            input.className = "appearance-icon-input";
            input.maxLength = 8;
            input.value = currentId;
            input.setAttribute("data-item-picker", "appearance-" + key);
            input.setAttribute("data-item-picker-format", "id");
            input.setAttribute("data-item-picker-title", "Pilih Icon: " + ICON_LABELS[key]);

            input.addEventListener("input", function () {
                var v = parseInt(input.value, 10);
                if (!isNaN(v)) {
                    config.icons[key] = v;
                    preview.replaceChildren(iconImg(v, 28));
                    applyIcons();
                }
            });

            wrap.appendChild(preview);
            wrap.appendChild(input);
            row.appendChild(label);
            row.appendChild(wrap);
            grid.appendChild(row);
        });

        if (window.GroweraItemPicker && window.GroweraItemPicker.renderIcons) {
            window.GroweraItemPicker.renderIcons(document);
        }
    }

    function renderEditor() { renderColorGrid(); renderIconGrid(); }

    /* ===== SAVE / RESET ===== */

    function saveToServer() {
        if (!currentUserIsAdmin) { alert("Hanya admin yang bisa menyimpan."); return; }

        var payload = {
            version: (config.version || 0) + 1,
            updatedAt: Math.floor(Date.now() / 1000),
            colors: config.colors,
            icons: config.icons
        };

        apiFetch("/api/growera/admin/theme", { method: "PUT", body: JSON.stringify(payload) })
            .then(function (r) {
                if (!r.ok || !r.data || r.data.success !== true) {
                    throw new Error((r.data && r.data.message) || ("HTTP " + r.status));
                }
                if (window.GroweraConfig) window.GroweraConfig.clearCache();
                alert("Tema tersimpan di server!");
            })
            .catch(function (err) {
                console.error("[Appearance] Save error:", err);
                alert("Gagal simpan: " + err.message);
            });
    }

    function resetToDefault() {
        if (!confirm("Reset tema ke default? Perubahan akan langsung diterapkan ke preview (belum tersimpan).")) return;
        config = deepClone(DEFAULTS);
        apply();
        renderEditor();
    }

    /* ===== WIRE ===== */

    function wire() {
        document.querySelectorAll('[data-editor-module="appearance"]').forEach(function (btn) {
            btn.addEventListener("click", function () {
                if (typeof window.showEditorView === "function") {
                    window.showEditorView("appearance");
                }
                renderEditor();
            });
        });

        var back = $("appearanceBackToRoadmap");
        if (back) back.addEventListener("click", function () {
            if (typeof window.showEditorView === "function") {
                window.showEditorView("roadmap");
            }
        });

        var saveBtn = $("appearanceSaveBtn");
        if (saveBtn) saveBtn.addEventListener("click", saveToServer);

        var resetBtn = $("appearanceResetBtn");
        if (resetBtn) resetBtn.addEventListener("click", resetToDefault);

        console.log("[Appearance] Ready.");
    }

    /* ===== INIT ===== */

    function init() {
        if (!window.GroweraConfig) {
            console.error("[Appearance] ConfigLoader tidak tersedia.");
            return;
        }
        window.GroweraConfig.get("theme")
            .then(function (data) {
                if (data && data.colors && data.icons) {
                    config = mergeDeep(deepClone(DEFAULTS), data);
                } else {
                    config = deepClone(DEFAULTS);
                }
                applyColors();
                applyIcons();
                if (document.readyState === "loading") {
                    document.addEventListener("DOMContentLoaded", wire);
                } else {
                    wire();
                }
                console.log("[Appearance] Ready.");
            })
            .catch(function () {
                config = deepClone(DEFAULTS);
                applyColors();
                applyIcons();
                wire();
            });
    }

    window.GroweraAppearance = {
        init: init,
        apply: apply,
        render: renderEditor,
        getConfig: function () { return deepClone(config); },
        setConfig: function (cfg) {
            config = mergeDeep(deepClone(DEFAULTS), cfg || {});
            apply();
        },
        setAdmin: function (v) { currentUserIsAdmin = !!v; },
        isAdmin: function () { return currentUserIsAdmin; }
    };

    init();
})();
