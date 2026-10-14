/* =========================================
   GROWERA — SHOP EDITOR (v3, clean rewrite)
========================================= */

(function () {
    "use strict";

    /* ===== VIEW IDS ===== */

    var VIEWS = [
        "editorViewRoadmap",
        "editorViewNewsList",
        "editorViewNewsForm",
        "editorViewRewardsList",
        "editorViewRewardsForm",
        "editorViewShopCategories",
        "editorViewShopPackages",
        "editorViewShopForm"
    ];

    /* ===== STATE ===== */

    var state = {
        mode: null,              // "category" | "package"
        categoryKey: null,       // kategori yang sedang dibuka
        packageId: null,         // paket yang sedang di-edit (null = baru)
        rewards: []              // rewards sementara saat edit paket
    };

    /* ===== HELPERS ===== */

    function $(id) { return document.getElementById(id); }

    function showView(id) {
        VIEWS.forEach(function (v) {
            var el = $(v);
            if (!el) return;
            el.classList.toggle("hidden", v !== id);
        });
    }

    function fmtNum(n) {
        if (typeof window.formatNumber === "function") return window.formatNumber(n);
        return (n || 0).toLocaleString("id-ID");
    }

    function fmtRp(n) {
        if (typeof window.formatRupiah === "function") return window.formatRupiah(n);
        return "Rp " + (n || 0).toLocaleString("id-ID");
    }

    function createIcon(id, size) {
        var img = document.createElement("img");
        img.src = "/assets/itemimage/" + id + ".png";
        img.width = size;
        img.height = size;
        img.style.cssText = "width:" + size + "px;height:" + size +
            "px;object-fit:contain;image-rendering:pixelated;display:block";
        img.alt = "";
        return img;
    }

    function getConfig() {
        if (!window.GroweraShop || !window.GroweraShop.getConfig) {
            return { version: 1, categories: [] };
        }
        return window.GroweraShop.getConfig();
    }

    function saveConfig(cfg) {
        if (window.GroweraShop && window.GroweraShop.setConfig) {
            window.GroweraShop.setConfig(cfg);
        }
    }

    function slugify(str) {
        return String(str || "").toLowerCase()
            .replace(/[^a-z0-9_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function findCategory(cfg, key) {
        for (var i = 0; i < (cfg.categories || []).length; i++) {
            if (cfg.categories[i].key === key) return cfg.categories[i];
        }
        return null;
    }

    function triggerItemPickerRefresh() {
        if (window.GroweraItemPicker && window.GroweraItemPicker.renderIcons) {
            window.GroweraItemPicker.renderIcons(document);
        }
        // Trigger MutationObserver
        setTimeout(function () {
            var d = document.createElement("span");
            d.style.display = "none";
            document.body.appendChild(d);
            document.body.removeChild(d);
        }, 20);
    }

    /* ============================================================
       VIEW: CATEGORY LIST
       ============================================================ */

    function renderCategoryList() {
        var container = $("shopCategoryList");
        if (!container) return;

        container.replaceChildren();

        var cfg = getConfig();
        var cats = (cfg.categories || []).slice().sort(function (a, b) {
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

            var iconWrap = document.createElement("div");
            iconWrap.className = "shop-editor-item-icon";
            iconWrap.appendChild(createIcon(cat.currencyIcon || 112, 32));
            row.appendChild(iconWrap);

            var info = document.createElement("div");
            info.className = "shop-editor-item-info";

            var title = document.createElement("div");
            title.className = "shop-editor-item-title";
            title.textContent = cat.title || cat.key;
            if (cat.active === false) {
                var off = document.createElement("span");
                off.style.cssText = "margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(255,92,138,.1);color:#FF5C8A;font-size:10px";
                off.textContent = "OFF";
                title.appendChild(off);
            }
            info.appendChild(title);

            var meta = document.createElement("div");
            meta.className = "shop-editor-item-meta";
            meta.innerHTML =
                '<span class="badge">' + (cat.key || "-") + '</span>' +
                '<span>' + (cat.packages ? cat.packages.length : 0) + ' paket</span>' +
                '<span>·</span>' +
                '<span>order: ' + (cat.order || 0) + '</span>';
            info.appendChild(meta);

            row.appendChild(info);

            var actions = document.createElement("div");
            actions.className = "shop-editor-actions";

            var pkgBtn = document.createElement("button");
            pkgBtn.type = "button";
            pkgBtn.className = "shop-editor-btn";
            pkgBtn.textContent = "📦 Paket";
            pkgBtn.addEventListener("click", function () { openPackageList(cat.key); });
            actions.appendChild(pkgBtn);

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "shop-editor-btn";
            editBtn.textContent = "✏️";
            editBtn.addEventListener("click", function () { openCategoryForm(cat.key); });
            actions.appendChild(editBtn);

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "shop-editor-btn danger";
            delBtn.textContent = "🗑";
            delBtn.addEventListener("click", function () {
                if (!confirm("Hapus kategori '" + (cat.title || cat.key) + "' dan semua paketnya?")) return;
                var newCfg = getConfig();
                newCfg.categories = newCfg.categories.filter(function (c) { return c.key !== cat.key; });
                saveConfig(newCfg);
                renderCategoryList();
            });
            actions.appendChild(delBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    /* ============================================================
       VIEW: CATEGORY FORM
       ============================================================ */

    function openCategoryForm(key) {
        state.mode = "category";
        state.categoryKey = key || null;
        state.packageId = null;

        var cfg = getConfig();
        var cat = key ? findCategory(cfg, key) : null;

        var titleEl = $("shopFormTitle");
        if (titleEl) titleEl.textContent = cat ? "Edit Kategori" : "Buat Kategori Baru";

        setField("shopFormKey",    cat ? (cat.key || "") : "");
        setField("shopFormTier",   cat ? (cat.variant || "crystal") : "crystal");
        setField("shopFormIcon",   cat ? (cat.currencyIcon || 112) : 112);
        setField("shopFormValue",  cat ? (cat.currencyName || "") : "GEMS");
        setField("shopFormUnit",   cat ? (cat.subtitle || "") : "");
        setField("shopFormPrice",  cat ? (cat.eyebrow || "") : "");
        setField("shopFormOrder",  cat ? (cat.order || 0) : 0);
        setField("shopFormBadge",  cat ? (cat.title || "") : "");
        setField("shopFormActive", cat && cat.active === false ? "0" : "1");

        applyLabels({
            key:   "Kategori Key (unik, huruf kecil)",
            tier:  "Variant (tema warna)",
            icon:  "Currency Icon (item ID)",
            value: "Currency Name (mis. GEMS)",
            unit:  "Subtitle",
            price: "Eyebrow (kecil di atas judul)",
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
        var key = slugify(getField("shopFormKey"));
        if (!key) { alert("Kategori Key wajib diisi."); return; }

        var cfg = getConfig();
        var existing = state.categoryKey ? findCategory(cfg, state.categoryKey) : null;

        var newCat = {
            key: key,
            variant: getField("shopFormTier") || "crystal",
            currencyIcon: parseInt(getField("shopFormIcon"), 10) || 112,
            currencyName: (getField("shopFormValue") || "GEMS").trim(),
            currencyKey: (getField("shopFormValue") || "gems").trim().toLowerCase() || "gems",
            subtitle: (getField("shopFormUnit") || "").trim(),
            eyebrow: (getField("shopFormPrice") || "").trim(),
            order: parseInt(getField("shopFormOrder"), 10) || 0,
            title: (getField("shopFormBadge") || "").trim() || key.toUpperCase(),
            showBalance: true,
            active: getField("shopFormActive") === "1",
            packages: existing ? (existing.packages || []) : []
        };

        if (existing) {
            var idx = cfg.categories.indexOf(existing);
            cfg.categories[idx] = newCat;
        } else {
            if (findCategory(cfg, key)) {
                alert("Kategori '" + key + "' sudah ada.");
                return;
            }
            cfg.categories.push(newCat);
        }

        saveConfig(cfg);
        alert("Kategori disimpan!");
        showView("editorViewShopCategories");
        renderCategoryList();
    }

    /* ============================================================
       VIEW: PACKAGE LIST
       ============================================================ */

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

        var cfg = getConfig();
        var cat = findCategory(cfg, state.categoryKey);
        if (!cat) {
            alert("Kategori tidak ditemukan.");
            showView("editorViewShopCategories");
            renderCategoryList();
            return;
        }

        if (titleEl) titleEl.textContent = "📦 Paket: " + (cat.title || cat.key);

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

            var iconWrap = document.createElement("div");
            iconWrap.className = "shop-editor-item-icon";
            iconWrap.appendChild(createIcon(pkg.iconId || 112, 32));
            row.appendChild(iconWrap);

            var info = document.createElement("div");
            info.className = "shop-editor-item-info";

            var title = document.createElement("div");
            title.className = "shop-editor-item-title";
            title.textContent = fmtNum(pkg.displayValue || 0) + " " + (pkg.displayUnit || "");
            if (pkg.active === false) {
                var off = document.createElement("span");
                off.style.cssText = "margin-left:6px;padding:1px 6px;border-radius:4px;background:rgba(255,92,138,.1);color:#FF5C8A;font-size:10px";
                off.textContent = "OFF";
                title.appendChild(off);
            }
            info.appendChild(title);

            var meta = document.createElement("div");
            meta.className = "shop-editor-item-meta";
            meta.innerHTML =
                '<span class="badge">' + (pkg.id || "-") + '</span>' +
                '<span>' + fmtRp(pkg.price) + '</span>' +
                '<span>·</span>' +
                '<span>' + (pkg.rewards ? pkg.rewards.length : 0) + ' rewards</span>';
            info.appendChild(meta);

            row.appendChild(info);

            var actions = document.createElement("div");
            actions.className = "shop-editor-actions";

            var editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "shop-editor-btn";
            editBtn.textContent = "✏️";
            editBtn.addEventListener("click", function () { openPackageForm(pkg.id); });
            actions.appendChild(editBtn);

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "shop-editor-btn danger";
            delBtn.textContent = "🗑";
            delBtn.addEventListener("click", function () {
                if (!confirm("Hapus paket '" + pkg.id + "'?")) return;
                var newCfg = getConfig();
                var c = findCategory(newCfg, cat.key);
                c.packages = c.packages.filter(function (p) { return p.id !== pkg.id; });
                saveConfig(newCfg);
                renderPackageList();
            });
            actions.appendChild(delBtn);

            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    /* ============================================================
       VIEW: PACKAGE FORM
       ============================================================ */

    function openPackageForm(editId) {
        state.mode = "package";
        state.packageId = editId || null;

        var cfg = getConfig();
        var cat = findCategory(cfg, state.categoryKey);
        if (!cat) return;

        var pkg = editId
            ? (cat.packages || []).filter(function (p) { return p.id === editId; })[0]
            : null;

        var titleEl = $("shopFormTitle");
        if (titleEl) titleEl.textContent = pkg ? "Edit Paket" : "Buat Paket Baru";

        setField("shopFormKey",    pkg ? (pkg.id || "") : "");
        setField("shopFormTier",   pkg ? (pkg.tier || "starter") : "starter");
        setField("shopFormIcon",   pkg ? (pkg.iconId || 112) : 112);
        setField("shopFormValue",  pkg ? (pkg.displayValue || 0) : "");
        setField("shopFormUnit",   pkg ? (pkg.displayUnit || "GEMS") : "GEMS");
        setField("shopFormPrice",  pkg ? (pkg.price || 0) : "");
        setField("shopFormOrder",  pkg ? (pkg.order || 0) : 0);
        setField("shopFormBadge",  pkg ? (pkg.badge || "") : "");
        setField("shopFormActive", pkg && pkg.active === false ? "0" : "1");

        state.rewards = pkg ? JSON.parse(JSON.stringify(pkg.rewards || [])) : [];
        renderRewards();

        applyLabels({
            key:   "Package ID (unik, huruf kecil)",
            tier:  "Tier (starter/basic/popular/best/mega/divine)",
            icon:  "Icon Item ID",
            value: "Display Value",
            unit:  "Display Unit (GEMS, HARI, dll)",
            price: "Harga (Rp)",
            order: "Order",
            badge: "Badge (opsional, mis. ⭐ POPULER)",
            active: "Status"
        });

        var rewardsSection = $("shopFormRewardsSection");
        if (rewardsSection) rewardsSection.style.display = "";

        showView("editorViewShopForm");

        var iconInput = $("shopFormIcon");
        if (iconInput) iconInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function savePackageForm() {
        var id = slugify(getField("shopFormKey"));
        if (!id) { alert("Package ID wajib diisi."); return; }

        var cfg = getConfig();
        var cat = findCategory(cfg, state.categoryKey);
        if (!cat) return;

        var newPkg = {
            id: id,
            iconId: parseInt(getField("shopFormIcon"), 10) || 112,
            price: parseInt(getField("shopFormPrice"), 10) || 0,
            tier: getField("shopFormTier") || "starter",
            badge: (getField("shopFormBadge") || "").trim() || null,
            order: parseInt(getField("shopFormOrder"), 10) || 0,
            active: getField("shopFormActive") === "1",
            displayValue: parseInt(getField("shopFormValue"), 10) || 0,
            displayUnit: (getField("shopFormUnit") || "GEMS").trim(),
            rewards: state.rewards.slice()
        };

        if (state.packageId) {
            for (var i = 0; i < cat.packages.length; i++) {
                if (cat.packages[i].id === state.packageId) {
                    cat.packages[i] = newPkg;
                    break;
                }
            }
        } else {
            if ((cat.packages || []).some(function (p) { return p.id === id; })) {
                alert("Package ID '" + id + "' sudah dipakai.");
                return;
            }
            cat.packages = cat.packages || [];
            cat.packages.push(newPkg);
        }

        saveConfig(cfg);
        alert("Paket disimpan!");
        showView("editorViewShopPackages");
        renderPackageList();
    }

    /* ============================================================
       REWARDS BUILDER
       ============================================================ */

    function renderRewards() {
        var container = $("shopFormRewardsList");
        if (!container) return;
        container.replaceChildren();

        if (!state.rewards.length) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:var(--muted);font-size:11px;padding:10px 0";
            empty.textContent = "Belum ada hadiah. Klik '+ Tambah Hadiah' untuk menambahkan.";
            container.appendChild(empty);
            return;
        }

        state.rewards.forEach(function (r, idx) {
            container.appendChild(buildRewardRow(r, idx));
        });

        triggerItemPickerRefresh();
    }

    function buildRewardRow(reward, index) {
        var row = document.createElement("div");
        row.className = "reward-row";

        var typeSel = document.createElement("select");
        [
            { v: "gems",     t: "💎 Gems" },
            { v: "item",     t: "📦 Item" },
            { v: "role",     t: "👑 Role" },
            { v: "currency", t: "🪙 Custom Currency" }
        ].forEach(function (opt) {
            var o = document.createElement("option");
            o.value = opt.v;
            o.textContent = opt.t;
            typeSel.appendChild(o);
        });
        typeSel.value = reward.type || "gems";
        typeSel.addEventListener("change", function () {
            state.rewards[index] = { type: typeSel.value, amount: 0 };
            renderRewards();
        });
        row.appendChild(typeSel);

        if (reward.type === "gems") {
            row.appendChild(numInput(reward, "amount", "Jumlah"));
        } else if (reward.type === "item") {
            var itemInput = document.createElement("input");
            itemInput.type = "text";
            itemInput.placeholder = "Item ID";
            itemInput.value = reward.itemId || "";
            itemInput.setAttribute("data-item-picker", "reward-item");
            itemInput.setAttribute("data-item-picker-format", "id");
            itemInput.setAttribute("data-item-picker-title", "Pilih Item");
            itemInput.addEventListener("input", function () {
                reward.itemId = parseInt(itemInput.value, 10) || 0;
            });
            row.appendChild(itemInput);
            row.appendChild(numInput(reward, "amount", "Jumlah", 1));
        } else if (reward.type === "role") {
            row.appendChild(numInput(reward, "roleId", "Role ID"));
            row.appendChild(numInput(reward, "durationDays", "Durasi (hari, 0=perm)"));
        } else if (reward.type === "currency") {
            var curInput = document.createElement("input");
            curInput.type = "text";
            curInput.placeholder = "Currency key";
            curInput.value = reward.currencyKey || "";
            curInput.addEventListener("input", function () {
                reward.currencyKey = curInput.value.trim();
            });
            row.appendChild(curInput);
            row.appendChild(numInput(reward, "amount", "Jumlah"));
        }

        var rmBtn = document.createElement("button");
        rmBtn.type = "button";
        rmBtn.className = "reward-remove";
        rmBtn.textContent = "✕";
        rmBtn.addEventListener("click", function () {
            state.rewards.splice(index, 1);
            renderRewards();
        });
        row.appendChild(rmBtn);

        return row;
    }

    function numInput(reward, key, placeholder, defaultValue) {
        var inp = document.createElement("input");
        inp.type = "number";
        inp.placeholder = placeholder;
        inp.value = (reward[key] != null) ? reward[key] : (defaultValue || 0);
        inp.addEventListener("input", function () {
            reward[key] = parseInt(inp.value, 10) || 0;
        });
        return inp;
    }

    function addReward() {
        state.rewards.push({ type: "gems", amount: 0 });
        renderRewards();
    }

    /* ============================================================
       FIELD HELPERS
       ============================================================ */

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
            key: "shopFormKey",
            tier: "shopFormTier",
            icon: "shopFormIcon",
            value: "shopFormValue",
            unit: "shopFormUnit",
            price: "shopFormPrice",
            order: "shopFormOrder",
            badge: "shopFormBadge",
            active: "shopFormActive"
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

    /* ============================================================
       WIRE
       ============================================================ */

    function wire() {
        // Modul shop di roadmap
        document.querySelectorAll('[data-editor-module="topup"]').forEach(function (btn) {
            btn.addEventListener("click", function () {
                showView("editorViewShopCategories");
                renderCategoryList();
            });
        });

        // Category list
        var back = $("shopEditorBackToRoadmap");
        if (back) back.addEventListener("click", function () { showView("editorViewRoadmap"); });

        var createCat = $("shopEditorCreateCategoryBtn");
        if (createCat) createCat.addEventListener("click", function () { openCategoryForm(null); });

        var exportBtn = $("shopEditorExportBtn");
        if (exportBtn) exportBtn.addEventListener("click", openExportModal);

        var importBtn = $("shopEditorImportBtn");
        if (importBtn) importBtn.addEventListener("click", openImportModal);

        var resetBtn = $("shopEditorResetBtn");
        if (resetBtn) resetBtn.addEventListener("click", function () {
            if (!confirm("Reset config ke default? Semua perubahan akan hilang.")) return;
            if (window.GroweraShop && window.GroweraShop.resetConfig) {
                window.GroweraShop.resetConfig();
                renderCategoryList();
                alert("Config direset.");
            }
        });

        // Package list
        var backCats = $("shopEditorBackToCategoriesBtn");
        if (backCats) backCats.addEventListener("click", function () {
            showView("editorViewShopCategories");
            renderCategoryList();
        });

        var createPkg = $("shopEditorCreatePackageBtn");
        if (createPkg) createPkg.addEventListener("click", function () { openPackageForm(null); });

        // Form
        var formBack = $("shopFormBackBtn");
        if (formBack) formBack.addEventListener("click", goBackFromForm);

        var formCancel = $("shopFormCancelBtn");
        if (formCancel) formCancel.addEventListener("click", goBackFromForm);

        var formSave = $("shopFormSaveBtn");
        if (formSave) formSave.addEventListener("click", function () {
            if (state.mode === "category") saveCategoryForm();
            else if (state.mode === "package") savePackageForm();
        });

        var addRewardBtn = $("shopFormAddRewardBtn");
        if (addRewardBtn) addRewardBtn.addEventListener("click", addReward);

        // Export modal
        var copyBtn = $("shopExportCopyBtn");
        if (copyBtn) copyBtn.addEventListener("click", function () {
            var ta = $("shopExportTextarea");
            if (!ta) return;
            ta.select();
            try { document.execCommand("copy"); alert("Tersalin!"); }
            catch (e) { alert("Gagal copy, pilih manual."); }
        });

        var dlBtn = $("shopExportDownloadBtn");
        if (dlBtn) dlBtn.addEventListener("click", function () {
            var ta = $("shopExportTextarea");
            if (!ta) return;
            var blob = new Blob([ta.value], { type: "application/json" });
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "shop-config.json";
            a.click();
        });

        // Import modal
        var applyBtn = $("shopImportApplyBtn");
        if (applyBtn) applyBtn.addEventListener("click", function () {
            var ta = $("shopImportTextarea");
            if (!ta) return;
            applyImport(ta.value);
            var modal = $("shopImportModal");
            if (modal) modal.hidden = true;
        });

        console.log("[ShopEditor] Ready.");
    }

    function goBackFromForm() {
        if (state.mode === "package") {
            showView("editorViewShopPackages");
            renderPackageList();
        } else {
            showView("editorViewShopCategories");
            renderCategoryList();
        }
    }

    /* ============================================================
       EXPORT / IMPORT
       ============================================================ */

    function openExportModal() {
        var cfg = getConfig();
        var json = JSON.stringify(cfg, null, 2);
        var modal = $("shopExportModal");
        var ta = $("shopExportTextarea");
        if (modal && ta) {
            ta.value = json;
            modal.hidden = false;
        }
    }

    function openImportModal() {
        var modal = $("shopImportModal");
        var ta = $("shopImportTextarea");
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
            if (!parsed || !Array.isArray(parsed.categories)) {
                alert("Format JSON tidak valid. Harus ada 'categories' array.");
                return;
            }
            saveConfig(parsed);
            renderCategoryList();
            alert("Config di-import!");
        } catch (e) {
            alert("JSON tidak valid: " + e.message);
        }
    }

    /* ============================================================
       INIT
       ============================================================ */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", wire);
    } else {
        wire();
    }

    window.GroweraShopEditor = {
        openExportModal: openExportModal,
        openImportModal: openImportModal,
        applyImport: applyImport,
        renderCategoryList: renderCategoryList,
        renderPackageList: renderPackageList
    };

})();
