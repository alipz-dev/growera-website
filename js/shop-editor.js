/* =========================================
   GROWERA — SHOP EDITOR (v6, full server-driven)
   Full CRUD: categories + packages.
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

    var UI = { package: 1430, edit: 3494, trash: 856, save: 102, add: 1426 };

    var state = {
        mode: null,          // "category" | "package"
        categoryKey: null,
        packageId: null
    };

    var shopConfig = { version: 1, categories: [] };

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
        if (window.GroweraIcon) return window.GroweraIcon.img(id, size);
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size; img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size + "px;object-fit:contain;image-rendering:pixelated;display:block;pointer-events:none";
        img.alt = "";
        img.draggable = false;
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

    function loadConfigFromServer() {
        return apiFetch("/api/growera/admin/shop/config").then(function (r) {
            if (!r.ok || !r.data || r.data.success !== true) {
                throw new Error((r.data && r.data.message) || ("HTTP " + r.status));
            }
            shopConfig = r.data.config || { version: 1, categories: [] };
            if (!Array.isArray(shopConfig.categories)) shopConfig.categories = [];
            return shopConfig;
        });
    }

    function saveConfigToServer() {
        return apiFetch("/api/growera/admin/shop/config", {
            method: "PUT",
            body: JSON.stringify(shopConfig)
        }).then(function (r) {
            if (!r.ok || !r.data || r.data.success !== true) {
                throw new Error((r.data && r.data.message) || ("HTTP " + r.status));
            }
            return r.data;
        });
    }

    function findCategory(key) {
        for (var i = 0; i < shopConfig.categories.length; i++) {
            if (shopConfig.categories[i].key === key) return shopConfig.categories[i];
        }
        return null;
    }

    function reloadShop() {
        if (window.GroweraConfig) window.GroweraConfig.clearCache();
        if (window.GroweraShop && window.GroweraShop.reload) return window.GroweraShop.reload();
        return Promise.resolve();
    }

    /* ===== CATEGORY LIST ===== */

    function renderCategoryList() {
        var container = $("shopCategoryList");
        if (!container) return;
        container.replaceChildren();

        var cats = shopConfig.categories.slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });

        if (!cats.length) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:var(--muted);font-size:12px;text-align:center;padding:20px";
            empty.textContent = "Belum ada kategori. Klik '+ Kategori' untuk menambah.";
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
            if (cat.active === false) {
                var off = document.createElement("span");
                off.style.cssText = "margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(255,92,138,.1);color:#FF5C8A;font-size:10px";
                off.textContent = "OFF";
                t.appendChild(off);
            }
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

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "shop-editor-btn";
            editBtn.appendChild(iconEl(UI.edit, 16));
            editBtn.addEventListener("click", function () { openCategoryForm(cat.key); });
            actions.appendChild(editBtn);

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "shop-editor-btn danger";
            delBtn.appendChild(iconEl(UI.trash, 16));
            delBtn.addEventListener("click", function () {
                if (!confirm("Hapus kategori '" + (cat.title || cat.key) + "' dan semua paketnya?")) return;
                shopConfig.categories = shopConfig.categories.filter(function (c) { return c.key !== cat.key; });
                saveConfigToServer().then(function () {
                    renderCategoryList();
                    reloadShop();
                }).catch(function (err) { alert("Gagal: " + err.message); });
            });
            actions.appendChild(delBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    /* ===== CATEGORY FORM ===== */

    function openCategoryForm(key) {
        state.mode = "category";
        state.categoryKey = key || null;
        state.packageId = null;

        var cat = key ? findCategory(key) : null;
        var titleEl = $("shopFormTitle");
        if (titleEl) titleEl.textContent = cat ? "Edit Kategori" : "Buat Kategori Baru";

        setField("shopFormKey",    cat ? (cat.key || "") : "");
        setField("shopFormTier",   cat ? (cat.variant || "crystal") : "crystal");
        setField("shopFormIcon",   cat ? (cat.currencyIcon || 112) : 112);
        setField("shopFormValue",  cat ? (cat.currencyName || "GEMS") : "GEMS");
        setField("shopFormUnit",   cat ? (cat.subtitle || "") : "");
        setField("shopFormPrice",  cat ? (cat.eyebrow || "") : "");
        setField("shopFormOrder",  cat ? (cat.order || 0) : 0);
        setField("shopFormBadge",  cat ? (cat.title || "") : "");
        setField("shopFormActive", cat && cat.active === false ? "0" : "1");

        applyLabels({
            key:   "Kategori Key (unik, huruf kecil)",
            tier:  "Variant (tema warna)",
            icon:  "Currency Icon (item ID)",
            value: "Currency Name",
            unit:  "Subtitle",
            price: "Eyebrow",
            order: "Order",
            badge: "Judul (Title)",
            active: "Status"
        });

        var rewardsSection = $("shopFormRewardsSection");
        if (rewardsSection) rewardsSection.style.display = "none";

        showView("editorViewShopForm");

        var iconInput = $("shopFormIcon");
        if (iconInput) iconInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function saveCategoryForm() {
        var key = (getField("shopFormKey") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (!key) { alert("Kategori Key wajib diisi."); return; }

        var existing = state.categoryKey ? findCategory(state.categoryKey) : null;
        var currencyName = getField("shopFormValue").trim() || "GEMS";

        var newCat = {
            key: key,
            variant: getField("shopFormTier") || "crystal",
            currencyIcon: parseInt(getField("shopFormIcon"), 10) || 112,
            currencyName: currencyName,
            currencyKey: currencyName.toLowerCase() || key,
            subtitle: getField("shopFormUnit").trim(),
            eyebrow: getField("shopFormPrice").trim(),
            order: parseInt(getField("shopFormOrder"), 10) || 0,
            title: getField("shopFormBadge").trim() || key.toUpperCase(),
            showBalance: true,
            active: getField("shopFormActive") === "1",
            packages: existing ? (existing.packages || []) : []
        };

        if (existing) {
            var idx = shopConfig.categories.indexOf(existing);
            shopConfig.categories[idx] = newCat;
        } else {
            if (findCategory(key)) { alert("Kategori '" + key + "' sudah ada."); return; }
            shopConfig.categories.push(newCat);
        }

        saveConfigToServer().then(function () {
            showView("editorViewShopCategories");
            renderCategoryList();
            reloadShop();
            alert("Kategori disimpan!");
        }).catch(function (err) { alert("Gagal: " + err.message); });
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

        var cat = findCategory(state.categoryKey);
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

        pkgs.forEach(function (pkg, idx) {
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
            editBtn.addEventListener("click", function () { openPackageForm(idx); });
            actions.appendChild(editBtn);

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "shop-editor-btn danger";
            delBtn.appendChild(iconEl(UI.trash, 16));
            delBtn.addEventListener("click", function () {
                if (!confirm("Hapus paket '" + pkg.id + "'?")) return;
                cat.packages.splice(idx, 1);
                saveConfigToServer().then(function () {
                    renderPackageList();
                    reloadShop();
                }).catch(function (err) { alert("Gagal: " + err.message); });
            });
            actions.appendChild(delBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    /* ===== PACKAGE FORM ===== */

    function openPackageForm(editIdx) {
        state.mode = "package";
        state.packageId = (editIdx === undefined || editIdx === null) ? null : editIdx;

        var cat = findCategory(state.categoryKey);
        if (!cat) return;

        var pkg = state.packageId !== null
            ? (cat.packages || [])[state.packageId]
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
            key:    "Package Key (unik)",
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

    function parseBonusPercent(text) {
        if (isEmpty(text)) return 0;
        var m = String(text).match(/(\d+)\s*%/);
        return m ? (parseInt(m[1], 10) || 0) : 0;
    }

    function savePackageForm() {
        var key = (getField("shopFormKey") || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        if (!key) { alert("Package Key wajib diisi."); return; }

        var cat = findCategory(state.categoryKey);
        if (!cat) return;

        var displayValue = getField("shopFormValue").trim();
        var displayUnit = getField("shopFormUnit").trim() || "GEMS";

        var newPkg = {
            id: key,
            iconId: parseInt(getField("shopFormIcon"), 10) || 112,
            price: parseInt(getField("shopFormPrice"), 10) || 0,
            tier: getField("shopFormTier") || "starter",
            badge: getField("shopFormBadge").trim() || null,
            order: parseInt(getField("shopFormOrder"), 10) || 0,
            active: getField("shopFormActive") === "1",
            displayValue: displayValue,
            displayUnit: displayUnit,
            bonusText: getField("shopFormBonus").trim() || null,
            rewards: [{
                type: "gems",
                amount: parseInt(displayValue, 10) || 0
            }]
        };

        if (state.packageId !== null) {
            cat.packages[state.packageId] = newPkg;
        } else {
            if ((cat.packages || []).some(function (p) { return p.id === key; })) {
                alert("Package Key '" + key + "' sudah dipakai.");
                return;
            }
            cat.packages = cat.packages || [];
            cat.packages.push(newPkg);
        }

        saveConfigToServer().then(function () {
            showView("editorViewShopPackages");
            renderPackageList();
            reloadShop();
            alert("Paket disimpan!");
        }).catch(function (err) { alert("Gagal: " + err.message); });
    }

    /* ===== FIELD HELPERS ===== */

    function setField(id, value) { var el = $(id); if (el) el.value = value; }
    function getField(id) { var el = $(id); return el ? el.value : ""; }

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

    function goBackFromForm() {
        if (state.mode === "package") {
            showView("editorViewShopPackages");
            renderPackageList();
        } else {
            showView("editorViewShopCategories");
            renderCategoryList();
        }
    }

    function wire() {
        document.querySelectorAll('[data-editor-module="topup"]').forEach(function (btn) {
            btn.addEventListener("click", function () {
                showView("editorViewShopCategories");
                loadConfigFromServer().then(renderCategoryList).catch(function (err) {
                    alert("Gagal load: " + err.message);
                });
            });
        });

        var back = $("shopEditorBackToRoadmap");
        if (back) back.addEventListener("click", function () { showView("editorViewRoadmap"); });

        var backCats = $("shopEditorBackToCategoriesBtn");
        if (backCats) backCats.addEventListener("click", function () {
            showView("editorViewShopCategories");
            renderCategoryList();
        });

        var createCat = $("shopEditorCreateCategoryBtn");
        if (createCat) createCat.addEventListener("click", function () { openCategoryForm(null); });

        var createPkg = $("shopEditorCreatePackageBtn");
        if (createPkg) createPkg.addEventListener("click", function () { openPackageForm(null); });

        var formBack = $("shopFormBackBtn");
        if (formBack) formBack.addEventListener("click", goBackFromForm);

        var formCancel = $("shopFormCancelBtn");
        if (formCancel) formCancel.addEventListener("click", goBackFromForm);

        var formSave = $("shopFormSaveBtn");
        if (formSave) formSave.addEventListener("click", function () {
            if (state.mode === "category") saveCategoryForm();
            else if (state.mode === "package") savePackageForm();
        });

        console.log("[ShopEditor] Ready.");
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
