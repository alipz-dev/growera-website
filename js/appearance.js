/* =========================================
   GROWERA — APPEARANCE EDITOR (v2, server-config)
========================================= */

(function () {
    "use strict";

    var ADMIN_DRAFT_KEY = "growera_theme_config_draft";

    var DEFAULTS = {
        version: 1,
        updatedAt: 0,
        colors: {
            cyan:    "#65E7FF",
            violet:  "#9B7BFF",
            gold:    "#FFD966",
            success: "#58FFAD",
            danger:  "#FF5C8A",
            bg:      "#080D19",
            surface: "#0D1523",
            text:    "#E8F1FF",
            muted:   "#7186A4"
        },
        icons: {
            brandLogo:       112,
            sidebarHome:     224,
            sidebarProfile:  980,
            sidebarRewards:  1458,
            sidebarRoulette: 758,
            sidebarTopup:    112,
            sidebarMore:     1430,
            sidebarSettings: 32,
            sidebarLogout:   6,
            floatingBtn:     1360,
            appearanceIcon:  3494
        }
    };

    var COLOR_LABELS = {
        cyan:    "Primary (Cyan)",
        violet:  "Secondary (Violet)",
        gold:    "Gold / Saldo",
        success: "Success / Hijau",
        danger:  "Danger / Merah",
        bg:      "Background Utama",
        surface: "Surface / Card",
        text:    "Text Utama",
        muted:   "Text Muted"
    };

    var ICON_LABELS = {
        brandLogo:      "Logo / Brand",
        sidebarHome:    "Nav: Home",
        sidebarProfile: "Nav: Profile",
        sidebarRewards: "Nav: Rewards",
        sidebarRoulette: "Nav: Roulette",
        sidebarTopup:   "Nav: Top Up",
        sidebarMore:    "Nav: More",
        sidebarSettings: "Nav: Settings",
        sidebarLogout:  "Nav: Logout",
        floatingBtn:    "Floating Button",
        appearanceIcon: "Ikon Menu Appearance"
    };

    var config = null;
    var styleEl = null;
    var currentUserIsAdmin = false;

    /* ===== HELPERS ===== */

    function $(id) { return document.getElementById(id); }
    function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

    function mergeDeep(target, source) {
        if (!source || typeof source !== "object") return target;
        Object.keys(source).forEach(function (k) {
            if (source[k] && typeof source[k] === "object" && !Array.isArray(source[k])) {
                target[k] = mergeDeep(target[k] || {}, source[k]);
            } else {
                target[k] = source[k];
            }
        });
        return target;
    }

    function normalizeHex(v) {
        if (!v) return "#000000";
        v = String(v).trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
        if (/^#[0-9a-fA-F]{3}$/.test(v)) {
            return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
        }
        if (/^#[0-9a-fA-F]{8}$/.test(v)) return v.slice(0, 7);
        return "#000000";
    }

    function isValidHex(v) {
        return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v || "").trim());
    }

    /* ===== ADMIN DRAFT ===== */

    function saveAdminDraft(cfg) {
        if (!currentUserIsAdmin) return false;
        try {
            cfg.updatedAt = Date.now();
            localStorage.setItem(ADMIN_DRAFT_KEY, JSON.stringify(cfg));
            return true;
        } catch (e) { return false; }
    }

    function loadAdminDraft() {
        if (!currentUserIsAdmin) return null;
        try {
            var raw = localStorage.getItem(ADMIN_DRAFT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function clearAdminDraft() {
        try { localStorage.removeItem(ADMIN_DRAFT_KEY); } catch (e) {}
    }

    /* ===== LOAD FROM SERVER ===== */

    function loadConfigFromServer() {
        if (window.GroweraConfig && window.GroweraConfig.get) {
            return window.GroweraConfig.get("theme")
                .then(function (data) {
                    if (data && data.colors && data.icons) {
                        return mergeDeep(deepClone(DEFAULTS), data);
                    }
                    return deepClone(DEFAULTS);
                })
                .catch(function () {
                    return deepClone(DEFAULTS);
                });
        }
        return Promise.resolve(deepClone(DEFAULTS));
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
        styleEl.textContent =
            ":root{" +
            "--cyan:" + c.cyan + ";" +
            "--violet:" + c.violet + ";" +
            "--gold:" + c.gold + ";" +
            "--success:" + c.success + ";" +
            "--danger:" + c.danger + ";" +
            "--bg:" + c.bg + ";" +
            "--surface:" + c.surface + ";" +
            "--text:" + c.text + ";" +
            "--muted:" + c.muted + ";" +
            "}";
    }

    function createIconImg(id, size) {
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size;
        img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size +
            "px;object-fit:contain;image-rendering:pixelated;display:block";
        img.alt = "";
        img.draggable = false;

        var triedFallback = false;
        img.addEventListener("error", function onErr() {
            if (!triedFallback) {
                triedFallback = true;
                img.src = "https://api.gtps.cloud/api/item/texture/" + id + "/";
                return;
            }
            img.removeEventListener("error", onErr);
            img.style.display = "none";
        });

        return img;
    }

    function applyIcons() {
        var nodes = document.querySelectorAll("[data-theme-icon]");
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            var key = el.dataset.themeIcon;
            var id = config.icons[key];
            if (typeof id !== "number") continue;
            var size = parseInt(el.dataset.itemIconSize || "20", 10);
            el.replaceChildren(createIconImg(id, size));
        }
    }

    function apply() {
        applyColors();
        applyIcons();
    }

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
                saveAdminDraft(config);
            });

            hexInput.addEventListener("input", function () {
                var v = hexInput.value.trim();
                if (isValidHex(v)) {
                    config.colors[key] = v;
                    picker.value = normalizeHex(v);
                    applyColors();
                    saveAdminDraft(config);
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
            preview.appendChild(createIconImg(currentId, 28));

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
                    preview.replaceChildren(createIconImg(v, 28));
                    applyIcons();
                    saveAdminDraft(config);
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

    function renderEditor() {
        renderColorGrid();
        renderIconGrid();
    }

    /* ===== ACTIONS ===== */

    function reset() {
        if (!confirm("Reset tema ke default? Draft akan dihapus.")) return;
        clearAdminDraft();
        config = deepClone(DEFAULTS);
        apply();
        renderEditor();
        alert("Tema direset ke default.");
    }

    function reloadFromServer() {
        clearAdminDraft();
        return loadConfigFromServer().then(function (serverConfig) {
            config = serverConfig;
            apply();
            renderEditor();
        });
    }

    function openExportModal() {
        var modal = $("appearanceExportModal");
        var ta = $("appearanceExportTextarea");
        if (modal && ta) {
            ta.value = JSON.stringify(config, null, 2);
            modal.hidden = false;
        }
    }

    function openImportModal() {
        var modal = $("appearanceImportModal");
        var ta = $("appearanceImportTextarea");
        if (modal && ta) {
            ta.value = "";
            modal.hidden = false;
            ta.focus();
        }
    }

    function applyImport(json) {
        if (!json) { alert("JSON kosong."); return; }
        try {
            var parsed = JSON.parse(json);
            if (!parsed || typeof parsed !== "object") {
                alert("JSON tidak valid.");
                return;
            }
            config = mergeDeep(deepClone(DEFAULTS), parsed);
            saveAdminDraft(config);
            apply();
            renderEditor();
            alert("Tema berhasil di-import!");
        } catch (e) {
            alert("JSON tidak valid: " + e.message);
        }
    }

    /* ===== WIRE ===== */

    function wire() {
        var mods = document.querySelectorAll('[data-editor-module="appearance"]');
        for (var i = 0; i < mods.length; i++) {
            mods[i].addEventListener("click", function () {
                if (typeof window.showEditorView === "function") {
                    window.showEditorView("appearance");
                }
                renderEditor();
            });
        }

        var back = $("appearanceBackToRoadmap");
        if (back) back.addEventListener("click", function () {
            if (typeof window.showEditorView === "function") {
                window.showEditorView("roadmap");
            }
        });

        var saveBtn = $("appearanceSaveBtn");
        if (saveBtn) saveBtn.addEventListener("click", function () {
            saveAdminDraft(config);
            alert("Draft tersimpan. Klik Export untuk dapat JSON, lalu push ke data/theme-config.json di repo.");
        });

        var resetBtn = $("appearanceResetBtn");
        if (resetBtn) resetBtn.addEventListener("click", reset);

        var exportBtn = $("appearanceExportBtn");
        if (exportBtn) exportBtn.addEventListener("click", openExportModal);

        var importBtn = $("appearanceImportBtn");
        if (importBtn) importBtn.addEventListener("click", openImportModal);

        var copyBtn = $("appearanceExportCopyBtn");
        if (copyBtn) copyBtn.addEventListener("click", function () {
            var ta = $("appearanceExportTextarea");
            if (!ta) return;
            ta.select();
            try { document.execCommand("copy"); alert("Tersalin!"); }
            catch (e) { alert("Gagal copy, pilih manual."); }
        });

        var dlBtn = $("appearanceExportDownloadBtn");
        if (dlBtn) dlBtn.addEventListener("click", function () {
            var ta = $("appearanceExportTextarea");
            if (!ta) return;
            var blob = new Blob([ta.value], { type: "application/json" });
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "theme-config.json";
            a.click();
        });

        var applyBtn = $("appearanceImportApplyBtn");
        if (applyBtn) applyBtn.addEventListener("click", function () {
            var ta = $("appearanceImportTextarea");
            if (!ta) return;
            applyImport(ta.value);
            var modal = $("appearanceImportModal");
            if (modal) modal.hidden = true;
        });

        console.log("[Appearance] Ready.");
    }

    /* ===== INIT ===== */

    function init() {
        loadConfigFromServer().then(function (serverConfig) {
            config = serverConfig;

            if (currentUserIsAdmin) {
                var draft = loadAdminDraft();
                if (draft) {
                    config = mergeDeep(deepClone(DEFAULTS), draft);
                }
            }

            applyColors();
            applyIcons();

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", wire);
            } else {
                wire();
            }

            console.log("[Appearance] Ready.");
        });
    }

    /* ===== PUBLIC API ===== */

    window.GroweraAppearance = {
        init: init,
        apply: apply,
        applyColors: applyColors,
        applyIcons: applyIcons,
        render: renderEditor,

        getConfig: function () { return deepClone(config); },
        setConfig: function (cfg) {
            config = mergeDeep(deepClone(DEFAULTS), cfg || {});
            saveAdminDraft(config);
            apply();
        },
        resetConfig: reset,
        reloadFromServer: reloadFromServer,

        openExportModal: openExportModal,
        openImportModal: openImportModal,
        applyImport: applyImport,

        setAdmin: function (val) {
            var wasAdmin = currentUserIsAdmin;
            currentUserIsAdmin = !!val;

            if (currentUserIsAdmin && !wasAdmin) {
                var draft = loadAdminDraft();
                if (draft) {
                    config = mergeDeep(deepClone(DEFAULTS), draft);
                    apply();
                }
            }
            if (!currentUserIsAdmin && wasAdmin) {
                return reloadFromServer();
            }
        },

        isAdmin: function () { return currentUserIsAdmin; }
    };

    init();

})();
