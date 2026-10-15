/* =========================================
   GROWERA — SHOP EDITOR (v5, GTPS CRUD)
========================================= */

(function () {
    "use strict";

    var VIEWS = [
        "editorViewRoadmap",
        "editorViewNewsList",
        "editorViewNewsForm",
        "editorViewRewardsList",
        "editorViewRewardsForm",
        "editorViewShopCategories",
        "editorViewShopPackages",
        "editorViewShopForm",
        "editorViewAppearance"
    ];

    var UI = {
        package: 1430,
        edit: 3494,
        trash: 856,
        save: 102,
        add: 1426,
        shop: 1430
    };

    var state = {
        categoryKey: "topup",
        packageId: null
    };

    function $(id) { return document.getElementById(id); }

    function showView(id) {
        VIEWS.forEach(function (v) {
            var el = $(v);
            if (!el) return;
            el.classList.toggle("hidden", v !== id);
        });
    }

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

    function reloadShop() {
        if (window.GroweraShop && window.GroweraShop.reload) return window.GroweraShop.reload();
        return Promise.resolve();
    }

    /* ===== CATEGORY LIST ===== */

    function renderCategoryList() {
        var container = $("shopCategoryList");
        if (!container) return;
        container.replaceChildren();

        var cfg = window.GroweraShop ? window.GroweraShop.getConfig() : { categories: [] };
        var cats = (cfg.categories || []).slice();

        if (!cats.length) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:var(--muted);font-size:12px;text-align:center;padding:20px";
            empty.textContent = "Belum ada kategori.";
            container.appendChild(empty);
            return;
        }

        cats.forEach(function (cat) {
            var row = document.createElement("div");
            row.className = "shop-editor-item";

            var iw = document.createElement("div");
            iw.className = "shop-editor-item-icon";
            if (!isEmpty(cat.currencyIcon)) iw.appendChild(iconEl(cat.currencyIcon, 32));
            row.appendChild(iw);

            var info = document.createElement("div");
            info.className = "shop-editor-item-info";

            var t = document.createElement("div");
            t.className = "shop-editor-item-title";
            t.textContent = !isEmpty(cat.title) ? cat.title : cat.key;
            info.appendChild(t);

            var meta = document.createElement("div");
            meta.className = "shop-editor-item-meta";
            meta.innerHTML = '<span class="badge">' + (cat.key || "-") + '</span>' +
                '<span>' + (cat.packages ? cat.packages.length : 0) + ' paket</span>';
            info.appendChild(meta);
            row.appendChild(info);

            var actions = document.createElement("div");
            actions.className = "shop-editor-actions";

            var pkgBtn = document.createElement("button");
            pkgBtn.type = "button";
            pkgBtn.className = "shop-editor-btn";
            pkgBtn.appendChild(iconEl(UI.package, 16));
            pkgBtn.appendChild(document.createTextNode(" Paket"));
            pkgBtn.addEventListener("click", function () { openPackageList(cat.key); });
            actions.appendChild(pkgBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    /* ===== PACKAGE LIST ===== */

    function openPackageList(categoryKey) {
        state.categoryKey = categoryKey;
        state.packageId = null;
        showView("editorViewShopPackages");
        renderPackageList();
    }

    function renderPackageList() {
        var container = $("shopPackageList");
        var titleEl = $("shopPackagesTitle");
        if (!container) return;

        var cfg = window.GroweraShop ? window.GroweraShop.getConfig() : { categories: [] };
        var cat = (cfg.categories || []).filter(function (c) { return c.key === state.categoryKey; })[0];

        if (!cat) {
            alert("Kategori tidak ditemukan.");
            showView("editorViewShopCategories");
            renderCategoryList();
            return;
        }

        if (titleEl) {
            titleEl.replaceChildren();
            titleEl.appendChild(iconEl(UI.package, 20));
            titleEl.appendChild(document.createTextNode(" Paket: " + (cat.title || cat.key)));
        }

        container.replaceChildren();

        var pkgs = (cat.packages || []).slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });

        if (!pkgs.length) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:var(--muted);font-size:12px;text-align:center;padding:20px";
            empty.textContent = "Belum ada paket. Klik '+ Paket' untuk menambah.";
            container.appendChild(empty);
            return;
        }

        pkgs.forEach(function (pkg) {
            var row = document.createElement("div");
            row.className = "shop-editor-item";

            var iw = document.createElement("div");
            iw.className = "shop-editor-item-icon";
            if (!isEmpty(pkg.iconId)) iw.appendChild(iconEl(pkg.iconId, 32));
            row.appendChild(iw);

            var info = document.createElement("div");
            info.className = "shop-editor-item-info";

            var t = document.createElement("div");
            t.className = "shop-editor-item-title";
            var valStr = isEmpty(pkg.displayValue) ? "" : String(pkg.displayValue).trim();
            var unitStr = isEmpty(pkg.displayUnit) ? "" : pkg.displayUnit;
            t.textContent = (valStr + " " + unitStr).trim() || (pkg.id || "-");
            if (pkg.active === false) {
                var off = document.createElement("span");
                off.style.cssText = "margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(255,92,138,.1);color:#FF5C8A;font-size:10px";
                off.textContent = "OFF";
                t.appendChild(off);
            }
            info.appendChild(t);

            var meta = document.createElement("div");
            meta.className = "shop-editor-item-meta";
            var html = '<span class="badge">' + (pkg.id || "-") + '</span>';
            if (hasNumber(pkg.price)) html += '<span>' + fmtRp(pkg.price) + '</span><span>·</span>';
            html += '<span>' + (pkg.rewards ? pkg.rewards.length : 0) + ' rewards</span>';
            meta.innerHTML = html;
            info.appendChild(meta);
            row.appendChild(info);

            var actions = document.createElement("div");
            actions.className = "shop-editor-actions";

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "shop-editor-btn";
            editBtn.appendChild(iconEl(UI.edit, 16));
            editBtn.addEventListener("click", function () { openPackageForm(pkg.backendId); });
            actions.appendChild(editBtn);

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "shop-editor-btn danger";
            delBtn.appendChild(iconEl(UI.trash, 16));
            delBtn.addEventListener("click", function () {
                if (!confirm("Hapus paket '" + pkg.id + "'?")) return;
                deletePackage(pkg.backendId);
            });
            actions.appendChild(delBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    /* ===== PACKAGE FORM ===== */

    function openPackageForm(backendId) {
        state.packageId = backendId || null;

        var cfg = window.GroweraShop ? window.GroweraShop.getConfig() : { categories: [] };
        var cat = (cfg.categories || []).filter(function (c) { return c.key === state.categoryKey; })[0];
        if (!cat) return;

        var pkg = backendId
            ? (cat.packages || []).filter(function (p) { return p.backendId === backendId; })[0]
            : null;

        var titleEl = $("shopFormTitle");
        if (titleEl) titleEl.textContent = pkg ? "Edit Paket" : "Buat Paket Baru";

        setField("shopFormKey",    pkg ? (pkg.id || "") : "");
        setField("shopFormTier",   pkg ? (pkg.tier || "starter") : "starter");
        setField("shopFormIcon",   pkg ? (pkg.iconId || 112) : 112);
        setField("shopFormValue",  pkg ? (pkg.displayValue || "") : "");
        setField("shopFormUnit",   pkg ? (pkg.displayUnit || "GEMS") : "GEMS");
        setField("shopFormPrice",  pkg && pkg.price ? pkg.price : "");
        setField("shopFormOrder",  pkg ? (pkg.order || 0) : 0);
        setField("shopFormBadge",  pkg ? (pkg.badge || "") : "");
        setField("shopFormBonus",  pkg && pkg.bonusText ? pkg.bonusText : "");
        setField("shopFormActive", pkg && pkg.active === false ? "0" : "1");

        applyLabels({
            key:    "Package Key (unik, huruf kecil)",
            tier:   "Tier",
            icon:   "Icon Item ID",
            value:  "Display Value",
            unit:   "Display Unit",
            price:  "Harga (Rp)",
            order:  "Order",
            badge:  "Badge",
            active: "Status",
            bonus:  "Bonus Text (opsional)"
        });

        var rewardsSection = $("shopFormRewardsSection");
        if (rewardsSection) rewardsSection.style.display = "none";

        showView("editorViewShopForm");

        var iconInput = $("shopFormIcon");
        if (iconInput) iconInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    /* ===== CRUD ===== */

    function parseBonusPercent(text) {
        if (isEmpty(text)) return 0;
        var m = String(text).match(/(\d+)\s*%/);
        return m ? (parseInt(m[1], 10) || 0) : 0;
    }

    function savePackage() {
        var key = (getField("shopFormKey") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (!key) { alert("Package Key wajib diisi (huruf kecil, angka, -, _)."); return; }

        var payload = {
            package_key: key,
            gems: parseInt(getField("shopFormValue"), 10) || 0,
            bonus_percent: parseBonusPercent(getField("shopFormBonus")),
            price: parseInt(getField("shopFormPrice"), 10) || 0,
            tier: getField("shopFormTier") || "starter",
            badge: (getField("shopFormBadge") || "").trim(),
            order: parseInt(getField("shopFormOrder"), 10) || 0,
            active: getField("shopFormActive") === "1"
        };

        var url, method;
        if (state.packageId) {
            url = "/api/growera/admin/topup/" + state.packageId;
            method = "PUT";
        } else {
            url = "/api/growera/admin/topup";
            method = "POST";
        }

        apiFetch(url, { method: method, body: JSON.stringify(payload) })
            .then(function (r) {
                if (!r.ok || !r.data || r.data.success !== true) {
                    throw new Error((r.data && r.data.message) || ("HTTP " + r.status));
                }
                return reloadShop();
            })
            .then(function () {
                showView("editorViewShopPackages");
                renderPackageList();
                alert("Paket disimpan!");
            })
            .catch(function (err) {
                console.error("[ShopEditor] Save error:", err);
                alert("Gagal simpan: " + err.message);
            });
    }

    function deletePackage(backendId) {
        if (!backendId) { alert("Package ID tidak valid."); return; }
        apiFetch("/api/growera/admin/topup/" + backendId, { method: "DELETE" })
            .then(function (r) {
                if (!r.ok || !r.data || r.data.success !== true) {
                    throw new Error((r.data && r.data.message) || ("HTTP " + r.status));
                }
                return reloadShop();
            })
            .then(function () { renderPackageList(); })
            .catch(function (err) {
                console.error("[ShopEditor] Delete error:", err);
                alert("Gagal hapus: " + err.message);
            });
    }

    /* ===== FIELD HELPERS ===== */

    function setField(id, value) {
        var el = $(id);
        if (el) el.value = value;
    }
    function getField(id) {
        var el = $(id);
        return el ? el.value : "";
    }
    function applyLabels(map) {
        var ids = {
            key: "shopFormKey", tier: "shopFormTier", icon: "shopFormIcon",
            value: "shopFormValue", unit: "shopFormUnit", price: "shopFormPrice",
            order: "shopFormOrder", badge: "shopFormBadge", active: "shopFormActive",
            bonus: "shopFormBonus"
        };
        Object.keys(map).forEach(function (k) {
            var input = $(ids[k]);
            if (!input) return;
            var group = input.closest(".editor-form-group");
            if (!group) return;
            var label = group.querySelector("label");
            if (label) label.textContent = map[k];
        });
    }

    /* ===== WIRE ===== */

    function wire() {
        document.querySelectorAll('[data-editor-module="topup"]').forEach(function (btn) {
            btn.addEventListener("click", function () {
                showView("editorViewShopCategories");
                renderCategoryList();
            });
        });

        var back = $("shopEditorBackToRoadmap");
        if (back) back.addEventListener("click", function () { showView("editorViewRoadmap"); });

        var backCats = $("shopEditorBackToCategoriesBtn");
        if (backCats) backCats.addEventListener("click", function () {
            showView("editorViewShopCategories");
            renderCategoryList();
        });

        var createPkg = $("shopEditorCreatePackageBtn");
        if (createPkg) createPkg.addEventListener("click", function () { openPackageForm(null); });

        var formBack = $("shopFormBackBtn");
        if (formBack) formBack.addEventListener("click", goBack);

        var formCancel = $("shopFormCancelBtn");
        if (formCancel) formCancel.addEventListener("click", goBack);

        var formSave = $("shopFormSaveBtn");
        if (formSave) formSave.addEventListener("click", savePackage);

        console.log("[ShopEditor] Ready.");
    }

    function goBack() {
        showView("editorViewShopPackages");
        renderPackageList();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wire);
    } else {
        wire();
    }

    window.GroweraShopEditor = {
        renderCategoryList: renderCategoryList,
        renderPackageList: renderPackageList
    };
})();
