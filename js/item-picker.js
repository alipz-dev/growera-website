/* =========================================
   GROWERA — ITEM PICKER (FINAL)
========================================= */

(function () {
    "use strict";

    /* ====== KONFIG ====== */

    var IMAGE = {
        localDir: "/assets/itemimage",
        ext: "png",
        fallbackUrl: function (id) { return "https://api.gtps.cloud/api/item/texture/" + id + "/"; },
        displaySize: 46,
        lazy: true
    };

    var DATA_URL  = "/data/itemregister.json";
    var PAGE_SIZE = 120;

    /* ====== STATE ====== */

    var allItems    = [];
    var idToItem    = new Map();
    var loadPromise = null;
    var isDataReady = false;

    var state = {
        open: false,
        onSelect: null,
        onCancel: null,
        filter: null,
        search: "",
        page: 1,
        filtered: [],
        title: "Pilih Item"
    };

    var dom = {};

    /* ====== DOM ====== */

    function cacheDom() {
        dom.modal       = document.getElementById("itemPickerModal");
        dom.title       = document.getElementById("itemPickerTitle");
        dom.closeBtn    = document.getElementById("itemPickerClose");
        dom.searchInput = document.getElementById("itemPickerSearch");
        dom.meta        = document.getElementById("itemPickerMeta");
        dom.grid        = document.getElementById("itemPickerGrid");
        dom.footer      = document.getElementById("itemPickerFooter");
    }

    /* ====== LOAD DATA ====== */

    function loadData() {
        if (loadPromise) return loadPromise;

        loadPromise = fetch(DATA_URL, { cache: "force-cache" })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (json) {
                var raw = (json && Array.isArray(json.items)) ? json.items : [];
                allItems = raw
                    .filter(function (it) {
                        return it && typeof it.id === "number" && typeof it.name === "string";
                    })
                    .map(function (it) { return { id: it.id, name: it.name }; })
                    .sort(function (a, b) { return a.id - b.id; });

                idToItem.clear();
                allItems.forEach(function (it) { idToItem.set(it.id, it); });

                isDataReady = true;
                return allItems;
            })
            .catch(function (err) {
                console.error("[ItemPicker] Gagal load data:", err);
                loadPromise = null;
                throw err;
            });

        return loadPromise;
    }

    /* ====== FILTER ====== */

    function applyFilter() {
        var q = (state.search || "").trim().toLowerCase();
        var filterFn = state.filter;
        var list = allItems;

        if (typeof filterFn === "function") list = list.filter(filterFn);

        if (q) {
            var isNumeric = /^\d+$/.test(q);
            list = list.filter(function (it) {
                if (isNumeric && String(it.id).indexOf(q) === 0) return true;
                return it.name.toLowerCase().indexOf(q) !== -1;
            });
        }

        state.filtered = list;
        state.page = 1;
    }

    /* ====== ICON HELPERS ====== */

    function getItemColor(id) {
        var palette = [
            "#55E6F5", "#9B7BFF", "#FFB347", "#58FFAD",
            "#FF5C8A", "#FFE066", "#79EFFF", "#C7B8FF"
        ];
        return palette[Math.abs(id) % palette.length];
    }

    function buildImageUrl(id) {
        return IMAGE.localDir + "/" + id + "." + IMAGE.ext;
    }

    function buildFallbackUrl(id) {
        if (typeof IMAGE.fallbackUrl !== "function") return null;
        try { return IMAGE.fallbackUrl(id); } catch (e) { return null; }
    }

    function createIconImg(id, size) {
        size = size || 20;

        var img = document.createElement("img");
        img.src = buildImageUrl(id);
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;
        img.width = size;
        img.height = size;
        img.style.width  = size + "px";
        img.style.height = size + "px";
        img.style.objectFit = "contain";
        img.style.imageRendering = "pixelated";
        img.style.pointerEvents = "none";
        img.style.userSelect = "none";
        img.style.verticalAlign = "middle";
        img.style.display = "block";

        var triedFallback = false;
        img.addEventListener("error", function onErr() {
            if (!triedFallback) {
                triedFallback = true;
                var fb = buildFallbackUrl(id);
                if (fb) { img.src = fb; return; }
            }
            img.removeEventListener("error", onErr);
            img.style.display = "none";
        });

        return img;
    }

    function createIconSpan(id, size) {
        size = size || 20;
        var span = document.createElement("span");
        span.className = "item-icon";
        span.style.width  = size + "px";
        span.style.height = size + "px";
        span.appendChild(createIconImg(id, size));
        return span;
    }

    function iconHTML(id, size) {
        size = size || 20;
        return '<img src="' + buildImageUrl(id) + '" '
            + 'width="' + size + '" height="' + size + '" '
            + 'style="width:' + size + 'px;height:' + size + 'px;object-fit:contain;'
            + 'image-rendering:pixelated;vertical-align:middle;'
            + 'pointer-events:none;display:inline-block" '
            + 'loading="lazy" decoding="async" draggable="false" alt="">';
    }

    /* ====== AUTO-INJECT ICONS ====== */

    function autoAttachIcons(root) {
        var scope = root || document;
        scope.querySelectorAll("[data-item-icon]").forEach(function (el) {
            if (el.dataset.itemIconAttached === "1") return;
            el.dataset.itemIconAttached = "1";

            var id = parseInt(el.dataset.itemIcon, 10);
            if (isNaN(id)) return;

            var size = parseInt(el.dataset.itemIconSize || "20", 10);
            el.replaceChildren(createIconImg(id, size));
        });
    }

    /* ====== PARSE ID ====== */

    function parseItemId(text) {
        if (!text) return null;
        var m = String(text).match(/\[#(\d+)\]/);
        if (m) return parseInt(m[1], 10);
        var n = String(text).trim();
        if (/^\d+$/.test(n)) return parseInt(n, 10);
        return null;
    }

    /* ====== PREVIEW DI FORM ====== */

    function updateFormPreview(input, item) {
        var wrap = input.parentElement;
        if (!wrap || !wrap.classList.contains("item-picker-wrap")) return;

        var preview = wrap.querySelector(".item-picker-preview");
        if (!preview) {
            preview = document.createElement("div");
            preview.className = "item-picker-preview";
            preview.hidden = true;
            var trigger = wrap.querySelector(".item-picker-trigger");
            if (trigger) {
                wrap.insertBefore(preview, trigger);
            } else {
                wrap.appendChild(preview);
            }
        }

        preview.replaceChildren();

        if (item && typeof item.id === "number") {
            preview.appendChild(createIconImg(item.id, 28));
            preview.hidden = false;
            preview.title = item.name || ("Item #" + item.id);
        } else {
            preview.hidden = true;
            preview.title = "";
        }
    }

    /* ====== RENDER PICKER ====== */

    function renderMeta() {
        if (!dom.meta) return;
        var total = state.filtered.length;
        var shown = Math.min(total, state.page * PAGE_SIZE);
        dom.meta.textContent =
            "Menampilkan " + shown + " dari " + total + " item · " + DATA_URL;
    }

    function buildIconElement(item) {
        var wrapper = document.createElement("div");
        wrapper.className = "item-picker-icon-wrap";
        wrapper.appendChild(createIconImg(item.id, 46));
        return wrapper;
    }

    function renderGrid() {
        if (!dom.grid) return;
        dom.grid.replaceChildren();

        if (!isDataReady) {
            var loading = document.createElement("div");
            loading.className = "item-picker-empty";
            loading.textContent = "Memuat data item...";
            dom.grid.appendChild(loading);
            return;
        }

        var list = state.filtered;
        if (list.length === 0) {
            var empty = document.createElement("div");
            empty.className = "item-picker-empty";
            empty.textContent = "Tidak ada item yang cocok.";
            dom.grid.appendChild(empty);
            return;
        }

        var start = (state.page - 1) * PAGE_SIZE;
        var end   = Math.min(start + PAGE_SIZE, list.length);
        var frag  = document.createDocumentFragment();

        for (var i = start; i < end; i++) {
            (function (it) {
                var card = document.createElement("button");
                card.type = "button";
                card.className = "item-picker-card";
                card.title = it.name + " [#" + it.id + "]";

                var idBadge = document.createElement("div");
                idBadge.className = "item-picker-id";
                idBadge.textContent = "#" + it.id;

                var iconEl = buildIconElement(it);

                var nameEl = document.createElement("div");
                nameEl.className = "item-picker-name";
                nameEl.textContent = it.name;

                card.appendChild(idBadge);
                card.appendChild(iconEl);
                card.appendChild(nameEl);
                card.addEventListener("click", function () { handleSelect(it); });

                frag.appendChild(card);
            })(list[i]);
        }
        dom.grid.appendChild(frag);
    }

    function renderFooter() {
        if (!dom.footer) return;
        dom.footer.replaceChildren();

        var total      = state.filtered.length;
        var totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        var page       = state.page;

        var prev = document.createElement("button");
        prev.type = "button";
        prev.className = "item-picker-page-btn";
        prev.textContent = "‹ Prev";
        prev.disabled = page <= 1;
        prev.addEventListener("click", function () {
            if (state.page > 1) {
                state.page -= 1;
                renderGrid(); renderFooter(); renderMeta();
                dom.grid.scrollTop = 0;
            }
        });

        var info = document.createElement("span");
        info.className = "item-picker-page-info";
        info.textContent = "Halaman " + page + " / " + totalPages;

        var next = document.createElement("button");
        next.type = "button";
        next.className = "item-picker-page-btn";
        next.textContent = "Next ›";
        next.disabled = page >= totalPages;
        next.addEventListener("click", function () {
            if (state.page < totalPages) {
                state.page += 1;
                renderGrid(); renderFooter(); renderMeta();
                dom.grid.scrollTop = 0;
            }
        });

        dom.footer.appendChild(prev);
        dom.footer.appendChild(info);
        dom.footer.appendChild(next);
    }

    function renderAll() {
        renderMeta();
        renderGrid();
        renderFooter();
    }

    /* ====== HANDLERS ====== */

    function handleSelect(item) {
        var cb = state.onSelect;
        close();
        if (typeof cb === "function") cb(item);
    }

    function handleSearchInput() {
        state.search = dom.searchInput.value || "";
        applyFilter();
        renderAll();
    }

    function handleClose() {
        var cb = state.onCancel;
        close();
        if (typeof cb === "function") cb();
    }

    /* ====== PUBLIC API ====== */

    function open(opts) {
        opts = opts || {};
        if (!dom.modal) {
            console.error("[ItemPicker] Modal tidak ada di DOM.");
            return;
        }

        state.open     = true;
        state.onSelect = opts.onSelect || null;
        state.onCancel = opts.onCancel || null;
        state.filter   = opts.filter   || null;
        state.search   = opts.initialSearch || "";
        state.title    = opts.title || "Pilih Item";
        state.page     = 1;

        if (dom.title) dom.title.textContent = state.title;
        if (dom.searchInput) dom.searchInput.value = state.search;

        dom.modal.hidden = false;
        document.body.classList.add("item-picker-open");

        loadData()
            .then(function () { applyFilter(); renderAll(); })
            .catch(function () {
                if (dom.meta) dom.meta.textContent = "Gagal memuat data item.";
            });

        setTimeout(function () {
            if (dom.searchInput) dom.searchInput.focus();
        }, 50);
    }

    function close() {
        if (!dom.modal) return;
        state.open = false;
        dom.modal.hidden = true;
        document.body.classList.remove("item-picker-open");
    }

    function isOpen()      { return state.open; }
    function preload()     { return loadData(); }
    function getItem(id)   { return idToItem.get(Number(id)) || null; }
    function getAllItems() { return allItems.slice(); }

    /* ====== AUTO-ATTACH ====== */

    function buildOutput(input, item) {
        var fmt = input.dataset.itemPickerFormat || "name-id";
        if (fmt === "id")   return String(item.id);
        if (fmt === "name") return item.name;
        return item.name + " [#" + item.id + "]";
    }

    function autoAttach(root) {
        var scope = root || document;
        scope.querySelectorAll("[data-item-picker]").forEach(function (input) {
            if (input.dataset.itemPickerAttached === "1") return;
            input.dataset.itemPickerAttached = "1";

            var wrap = input.parentElement;
            if (!wrap || !wrap.classList.contains("item-picker-wrap")) {
                var newWrap = document.createElement("div");
                newWrap.className = "item-picker-wrap";
                if (input.parentNode) {
                    input.parentNode.insertBefore(newWrap, input);
                    newWrap.appendChild(input);
                }
                wrap = newWrap;
            }

            var preview = document.createElement("div");
            preview.className = "item-picker-preview";
            preview.hidden = true;
            wrap.appendChild(preview);

            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "item-picker-trigger";
            btn.innerHTML = "🔍";
            btn.title = "Pilih item";
            btn.setAttribute("aria-label", "Pilih item");

            btn.addEventListener("click", function (ev) {
                ev.preventDefault();
                open({
                    title: input.dataset.itemPickerTitle || "Pilih Item",
                    onSelect: function (item) {
                        input.value = buildOutput(input, item);
                        updateFormPreview(input, item);
                        input.dispatchEvent(new Event("input",  { bubbles: true }));
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
            });

            wrap.appendChild(btn);

            var existingId = parseItemId(input.value);
            if (existingId !== null) {
                var item = idToItem.get(existingId);
                updateFormPreview(input, item || { id: existingId, name: "Item #" + existingId });
            }

            input.addEventListener("input", function () {
                var id = parseItemId(input.value);
                if (id === null) {
                    updateFormPreview(input, null);
                } else {
                    var it = idToItem.get(id);
                    updateFormPreview(input, it || { id: id, name: "Item #" + id });
                }
            });
        });
    }

    /* ====== INIT ====== */

    function init() {
        cacheDom();
        if (!dom.modal) {
            console.warn("[ItemPicker] Modal tidak ditemukan.");
            return;
        }

        if (dom.closeBtn)    dom.closeBtn.addEventListener("click", handleClose);
        if (dom.searchInput) dom.searchInput.addEventListener("input", handleSearchInput);

        dom.modal.addEventListener("click", function (ev) {
            if (ev.target === dom.modal) handleClose();
        });

        document.addEventListener("keydown", function (ev) {
            if (ev.key === "Escape" && isOpen()) handleClose();
        });

        autoAttach();
        autoAttachIcons();

        if (typeof MutationObserver !== "undefined") {
            var observer = new MutationObserver(function () {
                autoAttach();
                autoAttachIcons();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        loadData().catch(function () {});

        console.log("[ItemPicker] Ready. Images:", IMAGE.localDir);
    }

    /* ====== EXPORT ====== */

    window.GroweraItemPicker = {
        init: init,
        open: open,
        close: close,
        isOpen: isOpen,
        preload: preload,
        getItem: getItem,
        getAllItems: getAllItems,
        createIcon: createIconImg,
        createIconSpan: createIconSpan,
        iconHTML: iconHTML,
        parseItemId: parseItemId,
        renderIcons: autoAttachIcons,
        config: IMAGE,
        getImageUrl: buildImageUrl
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
