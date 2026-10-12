/* =========================================
   GROWERA — PROFILE + INVENTORY MODULE
   Version: 2.1 (extended + layout baru)

   Dependensi (dari app.js):
   - loadSession(), readJSONResponse()
   - formatNumber(), getInitial()
   - setPlayerStatus(), setProfileStatus()

   Dependensi opsional:
   - window.GroweraShop.updateBalance(profile)

   Public API (window.GroweraProfile):
   - init(), fetch(), reset(), closeInventory()
   - current (getter)
========================================= */

console.log("[GROWERA] profile.js v2.1 loading...");

(function () {
    "use strict";


    /* =========================================
       CONFIG
    ========================================= */

    const SERVER_ID = "1791";
    const API_PROFILE_URL = "/api/growera/me";
    const API_INVENTORY_URL = "/api/growera/inventory";


    /* =========================================
       STATE
    ========================================= */

    let profileRequestID = 0;
    let inventoryRequestID = 0;
    let currentProfile = null;


    /* =========================================
       UTILITIES
    ========================================= */

    function asArray(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") {
            return Object.keys(value).map(function (k) { return value[k]; });
        }
        return [];
    }

    function getPingClass(ping) {
        if (ping < 60) return "ping-excellent";
        if (ping < 120) return "ping-good";
        if (ping < 200) return "ping-fair";
        return "ping-poor";
    }

    function getPingLabel(ping) {
        if (ping < 60) return "Excellent";
        if (ping < 120) return "Good";
        if (ping < 200) return "Fair";
        return "Poor";
    }

    function parseHistoryString(raw) {
        if (typeof raw !== "string" || raw.trim() === "") return [];
        return raw
            .split(/[\n\r,;]+/)
            .map(function (s) { return s.trim(); })
            .filter(function (s) { return s !== ""; });
    }


    /* =========================================
       RESET DISPLAY
    ========================================= */

    function resetProfileDisplay() {
        currentProfile = null;

        // Hero
        const heroAvatar = document.getElementById("profileHeroAvatar");
        if (heroAvatar) heroAvatar.textContent = "P";

        const heroRole = document.getElementById("profileHeroRole");
        if (heroRole) heroRole.textContent = "Memuat role...";

        const onlineValue = document.getElementById("profileOnlineValue");
        if (onlineValue) onlineValue.textContent = "—";

        const onlineBadge = document.getElementById("profileOnlineBadge");
        if (onlineBadge) onlineBadge.classList.remove("online");

        const pingValue = document.getElementById("profilePingValue");
        if (pingValue) pingValue.textContent = "—";

        const pingBadge = document.getElementById("profilePingBadge");
        if (pingBadge) {
            pingBadge.classList.remove("ping-excellent", "ping-good", "ping-fair", "ping-poor");
        }

        // Stats
        ["profileStatLevel", "profileStatGems", "profileStatUserID", "profileStatPlaytime"]
            .forEach(function (id) {
                const el = document.getElementById(id);
                if (el) el.textContent = "—";
            });

        // Error
        const errorBox = document.getElementById("profileError");
        if (errorBox) errorBox.classList.add("hidden");

        // Details
        const details = document.getElementById("profileDetails");
        if (details) {
            details.replaceChildren();
            const placeholder = document.createElement("p");
            placeholder.style.cssText = "color:var(--muted);font-size:12px;margin:0";
            placeholder.textContent = "Sedang mengambil data profil...";
            details.appendChild(placeholder);
        }

        // Worlds
        const worldsGrid = document.getElementById("profileWorldsGrid");
        if (worldsGrid) {
            worldsGrid.replaceChildren();
            const loading = document.createElement("p");
            loading.className = "profile-loading";
            loading.textContent = "Menunggu data...";
            worldsGrid.appendChild(loading);
        }

        // Security
        const securityContent = document.getElementById("profileSecurityContent");
        if (securityContent) {
            securityContent.replaceChildren();
            const loading = document.createElement("p");
            loading.className = "profile-loading";
            loading.textContent = "Menunggu data...";
            securityContent.appendChild(loading);
        }

        setPlayerStatus("Memuat...", "#65E7FF");
        setProfileStatus("Memuat profil pemain...", "#65E7FF");

        // Home card + right panel
        const rightUser = document.getElementById("rightPlayerUsername");
        if (rightUser) rightUser.textContent = "Memuat...";

        const rightRole = document.getElementById("rightPlayerRole");
        if (rightRole) rightRole.textContent = "Memuat role...";

        const rightAvatar = document.getElementById("rightPlayerAvatar");
        if (rightAvatar) rightAvatar.textContent = "P";

        const rightLevel = document.getElementById("rightPlayerLevel");
        if (rightLevel) rightLevel.textContent = "—";

        const rightUserID = document.getElementById("rightPlayerUserID");
        if (rightUserID) rightUserID.textContent = "—";

        const rightGems = document.getElementById("rightPlayerGems");
        if (rightGems) rightGems.textContent = "—";

        const rightPlaytime = document.getElementById("rightPlayerPlaytime");
        if (rightPlaytime) rightPlaytime.textContent = "—";

        resetPlayerOverview();

        if (window.GroweraShop) {
            window.GroweraShop.updateBalance(null);
        }
    }


    /* =========================================
       RENDER — HERO
    ========================================= */

    function renderProfileHero(profile) {
        const username = String(profile.username || "Player");
        const initial = getInitial(username);
        const roleName = (profile.role && profile.role.name) || "Player";

        const heroAvatar = document.getElementById("profileHeroAvatar");
        if (heroAvatar) heroAvatar.textContent = initial;

        const heroRole = document.getElementById("profileHeroRole");
        if (heroRole) heroRole.textContent = roleName;

        const heroName = document.getElementById("profileUsername");
        if (heroName) heroName.textContent = username;

        // Online
        const onlineValue = document.getElementById("profileOnlineValue");
        const onlineBadge = document.getElementById("profileOnlineBadge");

        if (onlineValue && onlineBadge) {
            if (profile.online === true) {
                onlineValue.textContent = "Online";
                onlineBadge.classList.add("online");
            } else {
                onlineValue.textContent = "Offline";
                onlineBadge.classList.remove("online");
            }
        }

        // Ping
        const pingValue = document.getElementById("profilePingValue");
        const pingBadge = document.getElementById("profilePingBadge");

        if (pingValue && pingBadge) {
            pingBadge.classList.remove("ping-excellent", "ping-good", "ping-fair", "ping-poor");

            const ping = Number(profile.ping);
            if (Number.isFinite(ping) && ping >= 0) {
                pingValue.textContent = ping + " ms · " + getPingLabel(ping);
                pingBadge.classList.add(getPingClass(ping));
            } else {
                pingValue.textContent = "—";
            }
        }
    }


    /* =========================================
       RENDER — STATS
    ========================================= */

    function renderProfileStats(profile) {
        const levelEl = document.getElementById("profileStatLevel");
        if (levelEl) levelEl.textContent = formatNumber(profile.level);

        const gemsEl = document.getElementById("profileStatGems");
        if (gemsEl) gemsEl.textContent = formatNumber(profile.gems);

        const uidEl = document.getElementById("profileStatUserID");
        if (uidEl) uidEl.textContent = formatNumber(profile.userID);

        const playEl = document.getElementById("profileStatPlaytime");
        if (playEl) playEl.textContent = formatNumber(profile.playtime);
    }


    /* =========================================
       RENDER — ACCOUNT DETAILS
       (heading dihapus — section sudah punya heading sendiri)
    ========================================= */

    function renderProfileDetails(profile) {
        const container = document.getElementById("profileDetails");
        if (!container) return;
        container.replaceChildren();

        const roleName = (profile.role && profile.role.name) || "Player";
        const roleID = profile.role && profile.role.id !== undefined
            ? profile.role.id : 0;

        const fields = [
            ["Username", profile.username],
            ["Display Name", profile.displayName],
            ["User ID", profile.userID],
            ["Level", formatNumber(profile.level)],
            ["XP", formatNumber(profile.xp)],
            ["Required XP", formatNumber(profile.requiredXP)],
            ["Gems", formatNumber(profile.gems)],
            ["Playtime (raw)", formatNumber(profile.playtime)],
            ["Role", roleName],
            ["Role ID", formatNumber(roleID)]
        ];

        const createdAt = Number(profile.accountCreatedAt);
        if (Number.isFinite(createdAt) && createdAt > 0) {
            fields.push([
                "Account Created",
                new Date(createdAt * 1000).toLocaleString("id-ID")
            ]);
        }

        fields.forEach(function (field) {
            const row = document.createElement("div");
            row.className = "profile-details-row";

            const label = document.createElement("span");
            label.className = "profile-details-label";
            label.textContent = field[0];

            const value = document.createElement("span");
            value.className = "profile-details-value";
            value.textContent = field[1] === null || field[1] === undefined
                ? "—" : String(field[1]);

            row.appendChild(label);
            row.appendChild(value);
            container.appendChild(row);
        });
    }


    /* =========================================
       RENDER — WORLDS
    ========================================= */

    function renderProfileWorlds(profile) {
        const container = document.getElementById("profileWorldsGrid");
        if (!container) return;
        container.replaceChildren();

        const groups = [
            {
                title: "Owned Worlds",
                icon: "🏠",
                chipClass: "owned",
                data: asArray(profile.ownedWorlds)
            },
            {
                title: "Recent Worlds",
                icon: "🕐",
                chipClass: "recent",
                data: asArray(profile.recentWorlds)
            },
            {
                title: "Access Worlds",
                icon: "🔓",
                chipClass: "access",
                data: asArray(profile.accessWorlds)
            },
            {
                title: "Small Locked Worlds",
                icon: "🔒",
                chipClass: "locked",
                data: asArray(profile.smallLockedWorlds)
            }
        ];

        let hasAnyData = false;

        groups.forEach(function (group) {
            const wrap = document.createElement("div");
            wrap.className = "profile-world-group";

            const header = document.createElement("div");
            header.className = "profile-world-header";

            const title = document.createElement("div");
            title.className = "profile-world-title";

            const icon = document.createElement("span");
            icon.className = "profile-world-icon";
            icon.textContent = group.icon;

            const titleText = document.createElement("span");
            titleText.textContent = group.title;

            title.appendChild(icon);
            title.appendChild(titleText);

            const count = document.createElement("span");
            count.className = "profile-world-count";
            count.textContent = group.data.length;

            header.appendChild(title);
            header.appendChild(count);
            wrap.appendChild(header);

            if (group.data.length === 0) {
                const empty = document.createElement("div");
                empty.className = "profile-world-empty";
                empty.textContent = "Tidak ada data.";
                wrap.appendChild(empty);
            } else {
                hasAnyData = true;

                const list = document.createElement("div");
                list.className = "profile-world-list";

                group.data.forEach(function (worldName) {
                    const chip = document.createElement("span");
                    chip.className = "profile-world-chip " + group.chipClass;
                    chip.textContent = String(worldName);
                    chip.title = String(worldName);
                    list.appendChild(chip);
                });

                wrap.appendChild(list);
            }

            container.appendChild(wrap);
        });

        if (!hasAnyData) {
            const hint = document.createElement("p");
            hint.className = "profile-loading";
            hint.style.textAlign = "center";
            hint.style.padding = "8px 0 0";
            hint.textContent = "Data world belum tersedia dari server.";
            container.appendChild(hint);
        }
    }


    /* =========================================
       RENDER — SECURITY & HISTORY
    ========================================= */

    function renderProfileSecurity(profile) {
        const container = document.getElementById("profileSecurityContent");
        if (!container) return;
        container.replaceChildren();

        const ipList = parseHistoryString(profile.ipHistory);
        const ridList = parseHistoryString(profile.ridHistory);

        container.appendChild(buildSecurityBlock({
            title: "IP History",
            icon: "🌐",
            chipClass: "ip",
            items: ipList,
            emptyText: "Tidak ada riwayat IP."
        }));

        container.appendChild(buildSecurityBlock({
            title: "RID History",
            icon: "🆔",
            chipClass: "rid",
            items: ridList,
            emptyText: "Tidak ada riwayat RID."
        }));
    }

    function buildSecurityBlock(config) {
        const block = document.createElement("div");
        block.className = "profile-security-block";

        const head = document.createElement("div");
        head.className = "profile-security-head";

        const title = document.createElement("div");
        title.className = "profile-security-title";

        const icon = document.createElement("span");
        icon.className = "profile-security-title-icon";
        icon.textContent = config.icon;

        const titleText = document.createElement("span");
        titleText.textContent = config.title;

        title.appendChild(icon);
        title.appendChild(titleText);

        const count = document.createElement("span");
        count.className = "profile-security-count";
        count.textContent = config.items.length;

        head.appendChild(title);
        head.appendChild(count);
        block.appendChild(head);

        if (config.items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "profile-world-empty";
            empty.textContent = config.emptyText;
            block.appendChild(empty);
        } else {
            const list = document.createElement("div");
            list.className = "profile-security-list";

            config.items.forEach(function (entry) {
                const chip = document.createElement("span");
                chip.className = "profile-history-chip " + config.chipClass;
                chip.textContent = entry;
                chip.title = entry;
                list.appendChild(chip);
            });

            block.appendChild(list);
        }

        return block;
    }


    /* =========================================
       PLAYER OVERVIEW (kartu Home)
    ========================================= */

    function resetPlayerOverview() {
        const el1 = document.getElementById("playerLevel");
        if (el1) el1.textContent = "—";

        const el2 = document.getElementById("playerGems");
        if (el2) el2.textContent = "—";

        const el3 = document.getElementById("levelProgressXP");
        if (el3) el3.textContent = "— / — XP";

        const el4 = document.getElementById("levelProgressFill");
        if (el4) el4.style.width = "0%";

        const el5 = document.getElementById("levelProgressPercent");
        if (el5) el5.textContent = "0%";

        const el6 = document.getElementById("levelProgressRemaining");
        if (el6) el6.textContent = "Memuat...";
    }

    function updatePlayerOverview(profile) {
        if (!profile) return;

        const level = Number(profile.level) || 0;
        const xp = Number(profile.xp) || 0;
        const requiredXP = Number(profile.requiredXP) || 0;

        const playerLevel = document.getElementById("playerLevel");
        if (playerLevel) playerLevel.textContent = formatNumber(level);

        const playerGems = document.getElementById("playerGems");
        if (playerGems) playerGems.textContent = formatNumber(profile.gems);

        if (requiredXP > 0) {
            const percent = Math.min(100, Math.max(0, (xp / requiredXP) * 100));

            const xpEl = document.getElementById("levelProgressXP");
            if (xpEl) xpEl.textContent =
                formatNumber(xp) + " / " + formatNumber(requiredXP) + " XP";

            const fillEl = document.getElementById("levelProgressFill");
            if (fillEl) fillEl.style.width = percent.toFixed(2) + "%";

            const pctEl = document.getElementById("levelProgressPercent");
            if (pctEl) pctEl.textContent = percent.toFixed(1) + "%";

            const remaining = Math.max(0, requiredXP - xp);
            const remEl = document.getElementById("levelProgressRemaining");
            if (remEl) remEl.textContent =
                remaining === 0 ? "Siap naik level"
                    : "Butuh " + formatNumber(remaining) + " XP lagi";
        } else {
            const xpEl = document.getElementById("levelProgressXP");
            if (xpEl) xpEl.textContent = formatNumber(xp) + " XP";

            const fillEl = document.getElementById("levelProgressFill");
            if (fillEl) fillEl.style.width = "0%";

            const pctEl = document.getElementById("levelProgressPercent");
            if (pctEl) pctEl.textContent = "—";

            const remEl = document.getElementById("levelProgressRemaining");
            if (remEl) remEl.textContent =
                "Data required XP belum tersedia dari server";
        }
    }


    /* =========================================
       ERROR
    ========================================= */

    function showProfileError(message) {
        const errorBox = document.getElementById("profileError");
        const errorMessage = document.getElementById("profileErrorMessage");

        if (errorMessage) errorMessage.textContent = message;
        if (errorBox) errorBox.classList.remove("hidden");

        const details = document.getElementById("profileDetails");
        if (details) {
            details.replaceChildren();
            const p = document.createElement("p");
            p.style.cssText = "color:var(--muted);font-size:12px;margin:0";
            p.textContent = "Data profil tidak dapat dimuat.";
            details.appendChild(p);
        }

        setPlayerStatus("Gagal memuat profil", "#FF8585");
        setProfileStatus("Gagal memuat profil", "#FF8585");

        const rightRole = document.getElementById("rightPlayerRole");
        if (rightRole) rightRole.textContent = "Gagal memuat profil";

        resetPlayerOverview();
    }


    /* =========================================
       FETCH PROFILE
    ========================================= */

    async function fetchPlayerProfile() {
        const session = loadSession();

        if (!session.token) {
            showProfileError("Token login tidak ditemukan. Silakan login kembali.");
            return "unauthorized";
        }

        const requestID = ++profileRequestID;
        resetProfileDisplay();

        try {
            const response = await fetch(API_PROFILE_URL, {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            if (requestID !== profileRequestID) return "error";

            if (response.status === 401) {
                showProfileError("Sesi tidak valid atau telah berakhir.");
                return "unauthorized";
            }

            const data = await readJSONResponse(response);
            if (requestID !== profileRequestID) return "error";

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "Gagal mengambil profil.");
            }

            if (!data.user || typeof data.user !== "object") {
                throw new Error("Respons API tidak memiliki data user.");
            }

            const profile = data.user;
            if (!profile.username) {
                throw new Error("Username tidak ditemukan pada data profil.");
            }

            currentProfile = profile;

            const roleName = (profile.role && profile.role.name) || "Player";
            const username = String(profile.username);
            const initial = getInitial(username);

            // Right panel
            const rightUser = document.getElementById("rightPlayerUsername");
            if (rightUser) rightUser.textContent = profile.username || "Player";

            const rightRole = document.getElementById("rightPlayerRole");
            if (rightRole) rightRole.textContent = roleName;

            const rightAvatar = document.getElementById("rightPlayerAvatar");
            if (rightAvatar) rightAvatar.textContent = initial;

            const rightLevel = document.getElementById("rightPlayerLevel");
            if (rightLevel) rightLevel.textContent = formatNumber(profile.level);

            const rightUserID = document.getElementById("rightPlayerUserID");
            if (rightUserID) rightUserID.textContent = formatNumber(profile.userID);

            const rightGems = document.getElementById("rightPlayerGems");
            if (rightGems) rightGems.textContent = formatNumber(profile.gems);

            const rightPlaytime = document.getElementById("rightPlayerPlaytime");
            if (rightPlaytime) rightPlaytime.textContent = formatNumber(profile.playtime);

            // Header + home card
            const headerUser = document.getElementById("headerUsername");
            if (headerUser) headerUser.textContent = username;

            const playerUser = document.getElementById("playerUsername");
            if (playerUser) playerUser.textContent = username;

            const profileUser = document.getElementById("profileUsername");
            if (profileUser) profileUser.textContent = username;

            const headerAvatar = document.getElementById("headerAvatar");
            if (headerAvatar) headerAvatar.textContent = initial;

            const playerAvatar = document.getElementById("playerAvatar");
            if (playerAvatar) playerAvatar.textContent = initial;

            const statPlaytime = document.getElementById("statPlaytime");
            if (statPlaytime) statPlaytime.textContent = formatNumber(profile.playtime);

            const statPlaytimeNote = document.getElementById("statPlaytimeNote");
            if (statPlaytimeNote) statPlaytimeNote.textContent = "Nilai playtime dari server";

            // Home card
            updatePlayerOverview(profile);

            // Profile page — semua section
            renderProfileHero(profile);
            renderProfileStats(profile);
            renderProfileDetails(profile);
            renderProfileWorlds(profile);
            renderProfileSecurity(profile);

            if (window.GroweraShop) {
                window.GroweraShop.updateBalance(profile);
            }

            const errorBox = document.getElementById("profileError");
            if (errorBox) errorBox.classList.add("hidden");

            setPlayerStatus("Profil berhasil dimuat", "#58FFAD");
            setProfileStatus("Profil berhasil dimuat", "#58FFAD");

            return "ok";
        } catch (error) {
            if (requestID !== profileRequestID) return "error";
            console.error("[GROWERA PROFILE ERROR]", error);
            showProfileError(error.message || "Tidak dapat mengambil data profil.");
            return "error";
        }
    }


    /* =========================================
       INVENTORY
    ========================================= */

    function itemTextureURL(itemId) {
        return "https://api.gtps.cloud/api/item/texture/" + SERVER_ID + "/" + itemId;
    }

    function openInventoryModal() {
        const modal = document.getElementById("inventoryModal");
        if (!modal) return;
        modal.classList.add("open");
        fetchInventory();
    }

    function closeInventoryModal() {
        const modal = document.getElementById("inventoryModal");
        if (!modal) return;
        modal.classList.remove("open");
    }

    async function fetchInventory() {
        const grid = document.getElementById("inventoryGrid");
        const note = document.getElementById("inventoryNote");
        if (!grid || !note) return;

        grid.replaceChildren();
        const loading = document.createElement("p");
        loading.textContent = "Memuat inventory...";
        loading.style.color = "var(--muted)";
        loading.style.fontSize = "12px";
        grid.appendChild(loading);

        note.textContent = "Menghubungi server...";

        const session = loadSession();
        if (!session.token) {
            note.textContent = "Token tidak ditemukan.";
            grid.replaceChildren();
            return;
        }

        const requestID = ++inventoryRequestID;

        try {
            const response = await fetch(API_INVENTORY_URL, {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            const data = await readJSONResponse(response);
            if (requestID !== inventoryRequestID) return;

            if (response.status === 401) {
                note.textContent = "Sesi tidak valid. Silakan login ulang.";
                grid.replaceChildren();
                return;
            }

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "HTTP " + response.status);
            }

            const items = Array.isArray(data.items) ? data.items : [];
            const sourceLabel = data.source === "live" ? "live scan" : "cache server";
            const updatedAt = Number(data.updatedAt);

            let updatedLabel = "";
            if (Number.isFinite(updatedAt) && updatedAt > 0) {
                updatedLabel = " · update: " + new Date(
                    updatedAt * 1000
                ).toLocaleString("id-ID");
            }

            note.textContent = "Sumber: " + sourceLabel +
                " · " + items.length + " jenis item" + updatedLabel;

            renderInventory(items);
        } catch (error) {
            if (requestID !== inventoryRequestID) return;
            console.error("[GROWERA INVENTORY ERROR]", error);
            note.textContent = "Gagal memuat inventory: " + (error.message || "unknown");
            grid.replaceChildren();
            const errorLine = document.createElement("p");
            errorLine.textContent = "Tidak dapat mengambil inventory dari server.";
            errorLine.style.color = "var(--danger)";
            errorLine.style.fontSize = "12px";
            grid.appendChild(errorLine);
        }
    }

    function renderInventory(items) {
        const grid = document.getElementById("inventoryGrid");
        if (!grid) return;
        grid.replaceChildren();

        if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement("p");
            empty.textContent = "Inventory kosong.";
            empty.style.color = "var(--muted)";
            empty.style.fontSize = "12px";
            grid.appendChild(empty);
            return;
        }

        items.forEach(function (item) {
            const itemID = Number(item.id);
            const itemName = String(item.name || ("Item #" + itemID));
            const itemCount = Number(item.count) || 0;

            const card = document.createElement("div");
            card.className = "inventory-item";
            card.title = itemName + " (ID: " + itemID + ")";

            const icon = document.createElement("img");
            icon.className = "inventory-item-icon";
            icon.alt = itemName;
            icon.loading = "lazy";
            icon.src = itemTextureURL(itemID);

            icon.addEventListener("error", function () {
                const fallback = document.createElement("span");
                fallback.className = "inventory-item-icon";
                fallback.textContent = "📦";
                fallback.title = "Texture tidak tersedia";
                if (icon.parentNode === card) card.replaceChild(fallback, icon);
            });

            const nameEl = document.createElement("div");
            nameEl.className = "inventory-item-name";
            nameEl.textContent = itemName;

            const countEl = document.createElement("div");
            countEl.className = "inventory-item-count";
            countEl.textContent = "× " + formatNumber(itemCount);

            card.appendChild(icon);
            card.appendChild(nameEl);
            card.appendChild(countEl);
            grid.appendChild(card);
        });
    }


    /* =========================================
       RESET (dari logout)
    ========================================= */

    function reset() {
        profileRequestID++;
        inventoryRequestID++;
        currentProfile = null;
    }


    /* =========================================
       INIT
    ========================================= */

    function init() {
        const retryBtn = document.getElementById("retryProfileButton");
        if (retryBtn) {
            retryBtn.addEventListener("click", function () {
                fetchPlayerProfile();
            });
        }

        const viewInvBtn = document.getElementById("viewInventoryBtn");
        if (viewInvBtn) {
            viewInvBtn.addEventListener("click", openInventoryModal);
        }

        const invCloseBtn = document.getElementById("inventoryCloseBtn");
        if (invCloseBtn) {
            invCloseBtn.addEventListener("click", closeInventoryModal);
        }

        const invModal = document.getElementById("inventoryModal");
        if (invModal) {
            invModal.addEventListener("click", function (event) {
                if (event.target === event.currentTarget) closeInventoryModal();
            });
        }
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.GroweraProfile = {
        init: init,
        fetch: fetchPlayerProfile,
        reset: reset,
        closeInventory: closeInventoryModal,
        get current() { return currentProfile; },
        _version: "2.1"
    };

    console.log("[GROWERA] profile.js v2.1 ready. window.GroweraProfile:", window.GroweraProfile);

    init();

})();
