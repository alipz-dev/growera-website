/* =========================================
   GROWERA — SHOP EDITOR (v3, FIXED)
   Editor lengkap: kategori + paket + rewards.
========================================= */

(function () {
    "use strict";

    var VIEW_IDS = [
        "editorViewRoadmap",
        "editorViewNewsList",
        "editorViewNewsForm",
        "editorViewRewardsList",
        "editorViewRewardsForm",
        "editorViewTopupList",
        "editorViewTopupPackages",   // ← FIX 1: tambah ini
        "editorViewTopupForm"
    ];

    var state = {
        editingCategoryKey: null,
        editingPackageId: null,
        editingCategoryKeyForPackage: null,
        editingRewards: []
    };

    /* ===== HELPERS ===== */

    function $(id) { return document.getElementById(id); }

    function showView(id) {
        VIEW_IDS.forEach(function (v) {
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
        if (window.GroweraItemPicker && window.GroweraItemPicker.createIcon) {
            return window.GroweraItemPicker.createIcon(id, size);
        }
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
        if (window.GroweraShop && window.GroweraShop.getConfig) {
            return window.GroweraShop.getConfig();
        }
        return { version: 1, categories: [] };
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

    /* ============================================================
       VIEW: CATEGORY LIST
       ============================================================ */

    function renderCategoryList() {
        var container = $("topupCategoryList"); // FIX 2
        if (!container) {
            console.warn("[ShopEditor] #topupCategoryList tidak ada di DOM.");
            return;
        }

        container.replaceChildren();

        var cfg = getConfig();
        var cats = (cfg.categories || []).slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });

        if (cats.length === 0) {
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
            pkgBtn.addEventListener("click", function () {
                state.editingCategoryKeyForPackage = cat.key;
                showView("editorViewTopupPackages");
                renderPackageList();
            });
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

    function openCategoryForm(editKey) {
        state.editingCategoryKey = editKey || null;
        state.editingPackageId = null;

        var cfg = getConfig();
        var cat = editKey
            ? cfg.categories.filter(function (c) { return c.key === editKey; })[0]
            : null;

        var titleEl = $("topupFormTitle");
        if (titleEl) titleEl.textContent = cat ? "Edit Kategori" : "Buat Kategori Baru";

        $("topupFormKey").value    = cat ? (cat.key || "") : "";
        $("topupFormTier").value   = cat ? (cat.variant || "crystal") : "crystal";
        $("topupFormIcon").value   = cat ? (cat.currencyIcon || 112) : 112;
        $("topupFormGems").value   = cat ? (cat.currencyName || "") : "GEMS";
        $("topupFormBonus").value  = cat ? (cat.subtitle || "") : "";
        $("topupFormPrice").value  = cat ? (cat.eyebrow || "") : "";
        $("topupFormOrder").value  = cat ? (cat.order || 0) : 0;
        $("topupFormBadge").value  = cat ? (cat.title || "") : "";
        $("topupFormActive").value = cat && cat.active === false ? "0" : "1";

        setFieldLabels({
            key: "Kategori Key (unik, huruf kecil)",
            tier: "Variant (tema warna)",
            icon: "Currency Icon (item ID)",
            gems: "Currency Name (mis. GEMS)",
            bonus: "Subtitle",
            price: "Eyebrow (kecil di atas judul)",
            order: "Order",
            badge: "Judul (Title)",
            active: "Status"
        });

        // Hide rewards section saat edit kategori
        var rewardsSection = $("topupFormRewardsSection");
        if (rewardsSection) rewardsSection.style.display = "none";

        showView("editorViewTopupForm");

        var iconInput = $("topupFormIcon");
        if (iconInput) iconInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function saveCategoryForm() {
        var key = slugify($("topupFormKey").value);
        if (!key) { alert("Kategori Key wajib diisi."); return; }

        var newCat = {
            key: key,
            variant: $("topupFormTier").value || "crystal",
            currencyIcon: parseInt($("topupFormIcon").value, 10) || 112,
            currencyName: ($("topupFormGems").value || "GEMS").trim(),
            currencyKey: ($("topupFormGems").value || "gems").trim().toLowerCase() || "gems",
            subtitle: ($("topupFormBonus").value || "").trim(),
            eyebrow: ($("topupFormPrice").value || "").trim(),
            order: parseInt($("topupFormOrder").value, 10) || 0,
            title: ($("topupFormBadge").value || "").trim() || key.toUpperCase(),
            showBalance: true,
            active: $("topupFormActive").value === "1",
            packages: []
        };

        var cfg = getConfig();

        if (state.editingCategoryKey) {
            var idx = cfg.categories.findIndex(function (c) {
                return c.key === state.editingCategoryKey;
            });
            if (idx >= 0) {
                // Pertahankan packages lama
                newCat.packages = cfg.categories[idx].packages || [];
                cfg.categories[idx] = newCat;
            }
        } else {
            if (cfg.categories.some(function (c) { return c.key === key; })) {
                alert("Kategori '" + key + "' sudah ada. Gunakan key lain.");
                return;
            }
            cfg.categories.push(newCat);
        }

        saveConfig(cfg);
        alert("Kategori disimpan!");
        showView("editorViewTopupList");
        renderCategoryList();
    }

    /* ============================================================
       VIEW: PACKAGE LIST
       ============================================================ */

    function renderPackageList() {
        var container = $("topupPackageList"); // FIX 3
        var titleEl = $("topupPackagesTitle");

        if (!container) {
            console.warn("[ShopEditor] #topupPackageList tidak ada di DOM.");
            return;
        }

        var cfg = getConfig();
        var cat = cfg.categories.filter(function (c) {
            return c.key === state.editingCategoryKeyForPackage;
        })[0];

        if (!cat) {
            alert("Kategori tidak ditemukan.");
            showView("editorViewTopupList");
            renderCategoryList();
            return;
        }

        if (titleEl) titleEl.textContent = "📦 Paket: " + (cat.title || cat.key);

        container.replaceChildren();

        var pkgs = (cat.packages || []).slice().sort(function (a, b) {
            return (a.order || 0) - (b.order || 0);
        });

        if (pkgs.length === 0) {
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
                var c = newCfg.categories.filter(function (x) { return x.key === cat.key; })[0];
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
        state.editingPackageId = editId || null;
        state.editingCategoryKey = null;

        var cfg = getConfig();
        var cat = cfg.categories.filter(function (c) {
            return c.key === state.editingCategoryKeyForPackage;
        })[0];
        if (!cat) return;

        var pkg = editId
            ? (cat.packages || []).filter(function (p) { return p.id === editId; })[0]
            : null;

        var titleEl = $("topupFormTitle");
        if (titleEl) titleEl.textContent = pkg ? "Edit Paket" : "Buat Paket Baru";

        $("topupFormKey").value    = pkg ? (pkg.id || "") : "";
        $("topupFormTier").value   = pkg ? (pkg.tier || "starter") : "starter";
        $("topupFormIcon").value   = pkg ? (pkg.iconId || 112) : 112;
        $("topupFormGems").value   = pkg ? (pkg.displayValue || 0) : "";
        $("topupFormBonus").value  = pkg ? (pkg.displayUnit || "GEMS") : "GEMS";
        $("topupFormPrice").value  = pkg ? (pkg.price || 0) : "";
        $("topupFormOrder").value  = pkg ? (pkg.order || 0) : 0;
        $("topupFormBadge").value  = pkg ? (pkg.badge || "") : "";
        $("topupFormActive").value = pkg && pkg.active === false ? "0" : "1";

        state.editingRewards = pkg ? JSON.parse(JSON.stringify(pkg.rewards || [])) : [];
        renderRewardsList();

        setFieldLabels({
            key: "Package ID (unik, huruf kecil)",
            tier: "Tier (starter/basic/popular/best/mega/divine)",
            icon: "Icon Item ID",
            gems: "Display Value (angka besar di card)",
            bonus: "Display Unit (mis. GEMS, HARI)",
            price: "Harga (Rp)",
            order: "Order",
            badge: "Badge (opsional, mis. ⭐ POPULER)",
            active: "Status"
        });

        // Show rewards section saat edit paket
        var rewardsSection = $("topupFormRewardsSection");
        if (rewardsSection) rewardsSection.style.display = "";

        showView("editorViewTopupForm");

        var iconInput = $("topupFormIcon");
        if (iconInput) iconInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function setFieldLabels(map) {
        var fields = {
            key: "topupFormKey",
            tier: "topupFormTier",
            icon: "topupFormIcon",
            gems: "topupFormGems",
            bonus: "topupFormBonus",
            price: "topupFormPrice",
            order: "topupFormOrder",
            badge: "topupFormBadge",
            active: "topupFormActive"
        };

        Object.keys(map).forEach(function (k) {
            var input = $(fields[k]);
            if (!input) return;
            var group = input.closest(".editor-form-group");
            if (!group) return;
            var label = group.querySelector("label");
            if (label) label.textContent = map[k];
        });
    }

    function savePackageForm() {
        var id = slugify($("topupFormKey").value);
        if (!id) { alert("Package ID wajib diisi."); return; }

        var cfg = getConfig();
        var cat = cfg.categories.filter(function (c) {
            return c.key === state.editingCategoryKeyForPackage;
        })[0];
        if (!cat) return;

        var newPkg = {
            id: id,
            iconId: parseInt($("topupFormIcon").value, 10) || 112,
            price: parseInt($("topupFormPrice").value, 10) || 0,
            tier: $("topupFormTier").value || "starter",
            badge: ($("topupFormBadge").value || "").trim() || null,
            order: parseInt($("topupFormOrder").value, 10) || 0,
            active: $("topupFormActive").value === "1",
            displayValue: parseInt($("topupFormGems").value, 10) || 0,
            displayUnit: ($("topupFormBonus").value || "GEMS").trim(),
            bonusText: null,
            rewards: state.editingRewards.slice()
        };

        if (state.editingPackageId) {
            var idx = cat.packages.findIndex(function (p) {
                return p.id === state.editingPackageId;
            });
            if (idx >= 0) cat.packages[idx] = newPkg;
        } else {
            if (cat.packages.some(function (p) { return p.id === id; })) {
                alert("Package ID '" + id + "' sudah dipakai.");
                return;
            }
            cat.packages.push(newPkg);
        }

        saveConfig(cfg);
        alert("Paket disimpan!");
        showView("editorViewTopupPackages");
        renderPackageList();
    }

    /* ============================================================
       REWARDS BUILDER
       ============================================================ */

    function renderRewardsList() {
        var container = $("topupFormRewardsList");
        if (!container) return;

        container.replaceChildren();

        if (state.editingRewards.length === 0) {
            var empty = document.createElement("p");
            empty.style.cssText = "color:var(--muted);font-size:11px;padding:10px 0";
            empty.textContent = "Belum ada hadiah. Klik '+ Tambah Hadiah' untuk menambahkan.";
            container.appendChild(empty);
            return;
        }

        state.editingRewards.forEach(function (r, idx) {
            container.appendChild(buildRewardRow(r, idx));
        });
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
        row.appendChild(typeSel);

        if (reward.type === "gems") {
            var amountInput = document.createElement("input");
            amountInput.type = "number";
            amountInput.placeholder = "Jumlah";
            amountInput.value = reward.amount || 0;
            amountInput.addEventListener("input", function () {
                reward.amount = parseInt(amountInput.value, 10) || 0;
            });
            row.appendChild(amountInput);

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

            var itemAmt = document.createElement("input");
            itemAmt.type = "number";
            itemAmt.placeholder = "Jumlah";
            itemAmt.value = reward.amount || 1;
            itemAmt.addEventListener("input", function () {
                reward.amount = parseInt(itemAmt.value, 10) || 1;
            });
            row.appendChild(itemAmt);

        } else if (reward.type === "role") {
            var roleInput = document.createElement("input");
            roleInput.type = "number";
            roleInput.placeholder = "Role ID";
            roleInput.value = reward.roleId || "";
            roleInput.addEventListener("input", function () {
                reward.roleId = parseInt(roleInput.value, 10) || 0;
            });
            row.appendChild(roleInput);

            var durInput = document.createElement("input");
            durInput.type = "number";
            durInput.placeholder = "Durasi (hari, 0=perm)";
            durInput.value = reward.durationDays != null ? reward.durationDays : 0;
            durInput.addEventListener("input", function () {
                reward.durationDays = parseInt(durInput.value, 10) || 0;
            });
            row.appendChild(durInput);

        } else if (reward.type === "currency") {
            var curInput = document.createElement("input");
            curInput.type = "text";
            curInput.placeholder = "Currency key (mis. assets)";
            curInput.value = reward.currencyKey || "";
            curInput.addEventListener("input", function () {
                reward.currencyKey = curInput.value.trim();
            });
            row.appendChild(curInput);

            var curAmt = document.createElement("input");
            curAmt.type = "number";
            curAmt.placeholder = "Jumlah";
            curAmt.value = reward.amount || 0;
            curAmt.addEventListener("input", function () {
                reward.amount = parseInt(curAmt.value, 10) || 0;
            });
            row.appendChild(curAmt);
        }

        var rmBtn = document.createElement("button");
        rmBtn.type = "button";
        rmBtn.className = "reward-remove";
        rmBtn.textContent = "✕";
        rmBtn.addEventListener("click", function () {
            state.editingRewards.splice(index, 1);
            renderRewardsList();
            reattachItemPickers();
        });
        row.appendChild(rmBtn);

        typeSel.addEventListener("change", function () {
            state.editingRewards[index] = { type: typeSel.value, amount: 0 };
            renderRewardsList();
            reattachItemPickers();
        });

        return row;
    }

    function addReward() {
        state.editingRewards.push({ type: "gems", amount: 0 });
        renderRewardsList();
        reattachItemPickers();
    }

    function reattachItemPickers() {
        if (window.GroweraItemPicker && window.GroweraItemPicker.renderIcons) {
            window.GroweraItemPicker.renderIcons(document);
        }
        // Trigger MutationObserver dengan menambahkan node dummy
        setTimeout(function () {
            var dummy = document.createElement("span");
            document.body.appendChild(dummy);
            document.body.removeChild(dummy);
        }, 30);
    }

    /* ============================================================
       WIRE VIEWS
       ============================================================ */

    function wire() {
        // Modul "Shop Editor" di roadmap
        document.querySelectorAll('[data-editor-module="topup"]').forEach(function (btn) {
            btn.addEventListener("click", function () {
                showView("editorViewTopupList");
                renderCategoryList();
            });
        });

        var back = $("topupBackToRoadmap");
        if (back) back.addEventListener("click", function () { showView("editorViewRoadmap"); });

        var backToCats = $("topupPackagesBack");
        if (backToCats) backToCats.addEventListener("click", function () {
            showView("editorViewTopupList");
            renderCategoryList();
        });

        var createBtn = $("topupCreateBtn");
        if (createBtn) createBtn.addEventListener("click", function () { openCategoryForm(null); });

        var createPkgBtn = $("topupCreatePkgBtn");
        if (createPkgBtn) createPkgBtn.addEventListener("click", function () { openPackageForm(null); });

        var formBack = $("topupFormBack");
        if (formBack) formBack.addEventListener("click", function () {
            if (state.editingPackageId !== null || state.editingCategoryKey === null && state.editingCategoryKeyForPackage) {
                showView("editorViewTopupPackages");
                renderPackageList();
            } else {
                showView("editorViewTopupList");
                renderCategoryList();
            }
        });

        var formCancel = $("topupFormCancel");
        if (formCancel) formCancel.addEventListener("click", function () {
            if (state.editingPackageId !== null || state.editingCategoryKey === null && state.editingCategoryKeyForPackage) {
                showView("editorViewTopupPackages");
                renderPackageList();
            } else {
                showView("editorViewTopupList");
                renderCategoryList();
            }
        });

        var formSave = $("topupFormSave");
        if (formSave) formSave.addEventListener("click", function () {
            // Deteksi: edit kategori atau paket?
            if (state.editingCategoryKey !== null) {
                saveCategoryForm();
            } else {
                savePackageForm();
            }
        });

        var addRewardBtn = $("topupFormAddReward");
        if (addRewardBtn) addRewardBtn.addEventListener("click", addReward);

        var exportBtn = $("topupExportBtn");
        if (exportBtn) exportBtn.addEventListener("click", openExportDialog);

        var importBtn = $("topupImportBtn");
        if (importBtn) importBtn.addEventListener("click", openImportDialog);

        var resetBtn = $("topupResetBtn");
        if (resetBtn) resetBtn.addEventListener("click", function () {
            if (!confirm("Reset semua config ke default? Perubahan akan hilang.")) return;
            if (window.GroweraShop && window.GroweraShop.resetConfig) {
                window.GroweraShop.resetConfig();
                renderCategoryList();
                alert("Config direset ke default.");
            }
        });

        // Tombol Export/Import modal
        var exportTextarea = $("shopExportTextarea");
        var importBtnModal = document.querySelector('#shopImportModal .primary-button');
        if (importBtnModal && !importBtnModal.dataset.wired) {
            importBtnModal.dataset.wired = "1";
            importBtnModal.addEventListener("click", function () {
                var json = ($("shopImportTextarea") || {}).value || "";
                applyImport(json);
                var modal = $("shopImportModal");
                if (modal) modal.hidden = true;
            });
        }

        console.log("[ShopEditor] Ready.");
    }

    /* ===== EXPORT / IMPORT ===== */

    function openExportDialog() {
        var cfg = getConfig();
        var json = JSON.stringify(cfg, null, 2);

        var modal = $("shopExportModal");
        var ta = $("shopExportTextarea");
        if (modal && ta) {
            ta.value = json;
            modal.hidden = false;
            ta.select();
        } else {
            prompt("Copy JSON config ini:", json);
        }
    }

    function openImportDialog() {
        var modal = $("shopImportModal");
        var ta = $("shopImportTextarea");
        if (modal && ta) {
            ta.value = "";
            modal.hidden = false;
            ta.focus();
        } else {
            var json = prompt("Paste JSON config di sini:");
            if (json) applyImport(json);
        }
    }

    function applyImport(json) {
        try {
            var parsed = JSON.parse(json);
            if (!parsed || !Array.isArray(parsed.categories)) {
                alert("Format JSON tidak valid. Harus punya 'categories' array.");
                return;
            }
            saveConfig(parsed);
            renderCategoryList();
            alert("Config berhasil di-import!");
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
        openExportDialog: openExportDialog,
        openImportDialog: openImportDialog,
        applyImport: applyImport,
        renderCategoryList: renderCategoryList,
        renderPackageList: renderPackageList
    };

})();
