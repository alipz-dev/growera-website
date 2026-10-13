/* =========================================
   GROWERA — ITEM PICKER
   Reusable item picker untuk admin forms.

   Sumber data: /data/itemregister.json
   (struktur: { version, source, count, items: [{id, name}, ...] })

   Public API (window.GroweraItemPicker):
   - open(opts)    : buka picker
   - close()       : tutup picker
   - isOpen()      : cek status
   - preload()     : preload data (Promise)
   - getItem(id)   : ambil item by id
   - getAllItems() : ambil semua item

   opts:
   - title         : judul modal
   - onSelect      : callback(item) saat item dipilih
   - onCancel      : callback saat picker dibatalkan
   - filter        : function(item) -> bool
   - initialSearch : string pencarian awal

   Auto-attach:
   Tambahkan atribut data-item-picker="..." pada <input> untuk otomatis
   dapat tombol picker. Format output diatur lewat data-item-picker-format:
   - "name-id" (default) → "World Lock [#242]"
   - "name"              → "World Lock"
   - "id"                → "242"
   Contoh:
   <input data-item-picker="reward" data-item-picker-format="name">
========================================= */

(function () {
    "use strict";

    const DATA_URL  = "/data/itemregister.json";
    const PAGE_SIZE = 120;

    let allItems    = [];
    let idToItem    = new Map();
    let loadPromise = null;
    let isDataReady = false;

    const state = {
        open: false,
        onSelect: null,
        onCancel: null,
        filter: null,
        search: "",
        page: 1,
        filtered: [],
        title: "Pilih Item"
    };

    const dom = {};

    function cacheDom() {
        dom.modal       = document.getElementById("itemPickerModal");
        dom.title       = document.getElementById("itemPickerTitle");
        dom.closeBtn    = document.getElementById("itemPickerClose");
        dom.searchInput = document.getElementById("itemPickerSearch");
        dom.meta        = document.getElementById("itemPickerMeta");
        dom.grid        = document.getElementById("itemPickerGrid");
        dom.footer      = document.getElementById("itemPickerFooter");
    }

    /* ========= DATA ========= */

    function loadData() {
        if (loadPromise) return loadPromise;

        loadPromise = fetch(DATA_URL, { cache: "force-cache" })
            .then(function (res) {
                if (!res.ok) throw new Error("HTTP " + res.status);
                return res.json();
            })
            .then(function (json) {
                const raw = (json && Array.isArray(json.items)) ? json.items : [];
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

    /* ========= FILTER ========= */

    function applyFilter() {
        const q = (state.search || "").trim().toLowerCase();
        const filterFn = state.filter;

        let list = allItems;

        if (typeof filterFn === "function") {
            list = list.filter(filterFn);
        }

        if (q) {
            const isNumeric = /^\d+$/.test(q);
            list = list.filter(function (it) {
                if (isNumeric && String(it.id).indexOf(q) === 0) return true;
                return it.name.toLowerCase().indexOf(q) !== -1;
            });
        }

        state.filtered = list;
        state.page = 1;
    }

    /* ========= RENDER ========= */

    function getItemColor(id) {
        const palette = [
            "#55E6F5", "#9B7BFF", "#FFB347", "#58FFAD",
            "#FF5C8A", "#FFE066", "#79EFFF", "#C7B8FF"
        ];
        return palette[Math.abs(id) % palette.length];
    }

    function renderMeta() {
        if (!dom.meta) return;
        const total  = state.filtered.length;
        const shown  = Math.min(total, state.page * PAGE_SIZE);
        dom.meta.textContent =
            "Menampilkan " + shown + " dari " + total +
            " item · Sumber: " + DATA_URL;
    }

    function renderGrid() {
        if (!dom.grid) return;
        dom.grid.replaceChildren();

        if (!isDataReady) {
            const loading = document.createElement("div");
            loading.className = "item-picker-empty";
            loading.textContent = "Memuat data item...";
            dom.grid.appendChild(loading);
            return;
        }

        const list = state.filtered;
        if (list.length === 0) {
            const empty = document.createElement("div");
            empty.className = "item-picker-empty";
            empty.textContent = "Tidak ada item yang cocok.";
            dom.grid.appendChild(empty);
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE;
        const end   = Math.min(start + PAGE_SIZE, list.length);
        const frag  = document.createDocumentFragment();

        for (let i = start; i < end; i++) {
            const it = list[i];
            const color = getItemColor(it.id);

            const card = document.createElement("button");
            card.type = "button";
            card.className = "item-picker-card";
            card.title = it.name + " [#" + it.id + "]";

            const idBadge = document.createElement("div");
            idBadge.className = "item-picker-id";
            idBadge.textContent = "#" + it.id;

            const icon = document.createElement("div");
            icon.className = "item-picker-icon";
            icon.style.color = color;
            icon.style.background = color + "22";
            icon.textContent = (it.name.charAt(0) || "?").toUpperCase();

            const nameEl = document.createElement("div");
            nameEl.className = "item-picker-name";
            nameEl.textContent = it.name;

            card.appendChild(idBadge);
            card.appendChild(icon);
            card.appendChild(nameEl);
            card.addEventListener("click", function () { handleSelect(it); });

            frag.appendChild(card);
        }
        dom.grid.appendChild(frag);
    }

    function renderFooter() {
        if (!dom.footer) return;
        dom.footer.replaceChildren();

        const total      = state.filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const page       = state.page;

        const prev = document.createElement("button");
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

        const info = document.createElement("span");
        info.className = "item-picker-page-info";
        info.textContent = "Halaman " + page + " / " + totalPages;

        const next = document.createElement("button");
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

    /* ========= HANDLERS ========= */

    function handleSelect(item) {
        const cb = state.onSelect;
        close();
        if (typeof cb === "function") cb(item);
    }

    function handleSearchInput() {
        state.search = dom.searchInput.value || "";
        applyFilter();
        renderAll();
    }

    function handleClose() {
        const cb = state.onCancel;
        close();
        if (typeof cb === "function") cb();
    }

    /* ========= PUBLIC API ========= */

    function open(opts) {
        opts = opts || {};
        if (!dom.modal) {
            console.error("[ItemPicker] Modal #itemPickerModal tidak ada di DOM.");
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

        if (!isDataReady) {
            renderAll();
            loadData()
                .then(function () { applyFilter(); renderAll(); })
                .catch(function () {
                    if (dom.meta) dom.meta.textContent = "Gagal memuat data item.";
                });
        } else {
            applyFilter();
            renderAll();
        }

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

    function isOpen() { return state.open; }

    function preload() { return loadData(); }

    function getItem(id) {
        return idToItem.get(Number(id)) || null;
    }

    function getAllItems() { return allItems.slice(); }

    /* ========= AUTO-ATTACH ========= */

    function buildOutput(input, item) {
        const fmt = input.dataset.itemPickerFormat || "name-id";
        if (fmt === "id")   return String(item.id);
        if (fmt === "name") return item.name;
        return item.name + " [#" + item.id + "]";
    }

    function autoAttach() {
        const inputs = document.querySelectorAll("[data-item-picker]");
        inputs.forEach(function (input) {
            if (input.dataset.itemPickerAttached === "1") return;
            input.dataset.itemPickerAttached = "1";

            let wrap = input.parentElement;
            if (!wrap || !wrap.classList.contains("item-picker-wrap")) {
                const newWrap = document.createElement("div");
                newWrap.className = "item-picker-wrap";
                if (input.parentNode) {
                    input.parentNode.insertBefore(newWrap, input);
                    newWrap.appendChild(input);
                }
                wrap = newWrap;
            }

            const btn = document.createElement("button");
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
                        input.dispatchEvent(new Event("input",  { bubbles: true }));
                        input.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                });
            });

            wrap.appendChild(btn);
        });
    }

    /* ========= INIT ========= */

    function init() {
        cacheDom();
        if (!dom.modal) {
            console.warn("[ItemPicker] Modal tidak ditemukan. Tambahkan HTML-nya dulu.");
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

        if (typeof MutationObserver !== "undefined") {
            const observer = new MutationObserver(function () { autoAttach(); });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        // Preload supaya saat pertama buka langsung cepat
        preload().catch(function () {});

        console.log("[ItemPicker] Ready. Total item akan dimuat dari:", DATA_URL);
    }

    /* ========= EXPORT ========= */

    window.GroweraItemPicker = {
        init: init,
        open: open,
        close: close,
        isOpen: isOpen,
        preload: preload,
        getItem: getItem,
        getAllItems: getAllItems
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
