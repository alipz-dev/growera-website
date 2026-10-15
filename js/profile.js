/* =========================================
   GROWERA — PROFILE + INVENTORY (v3, item icons)
========================================= */

console.log("[GROWERA] profile.js v3 loading...");

(function () {
    "use strict";

    const SERVER_ID = "1791";
    const API_PROFILE_URL = "/api/growera/me";
    const API_INVENTORY_URL = "/api/growera/inventory";

    const WORLD_ICONS = {
        owned:  242,
        recent: 7162,
        access: 204,
        locked: 202
    };

    let profileRequestID = 0;
    let inventoryRequestID = 0;
    let currentProfile = null;

    function iconImg(id, size) {
        if (window.GroweraIcon) return window.GroweraIcon.img(id, size);
        var i = document.createElement("img");
        i.src = "/assets/itemimage/" + id + ".png";
        i.width = size; i.height = size;
        i.style.cssText = "width:" + size + "px;height:" + size + "px;object-fit:contain;image-rendering:pixelated";
        return i;
    }

    function asArray(value) {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") return Object.keys(value).map(k => value[k]);
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
        return raw.split(/[\n\r,;]+/).map(s => s.trim()).filter(s => s !== "");
    }

    function resetProfileDisplay() {
        currentProfile = null;
        const heroAvatar = document.getElementById("profileHeroAvatar"); if (heroAvatar) heroAvatar.textContent = "P";
        const heroRole = document.getElementById("profileHeroRole"); if (heroRole) heroRole.textContent = "Memuat role...";
        const onlineValue = document.getElementById("profileOnlineValue"); if (onlineValue) onlineValue.textContent = "—";
        const onlineBadge = document.getElementById("profileOnlineBadge"); if (onlineBadge) onlineBadge.classList.remove("online");
        const pingValue = document.getElementById("profilePingValue"); if (pingValue) pingValue.textContent = "—";
        const pingBadge = document.getElementById("profilePingBadge"); if (pingBadge) pingBadge.classList.remove("ping-excellent", "ping-good", "ping-fair", "ping-poor");
        ["profileStatLevel", "profileStatGems", "profileStatUserID", "profileStatPlaytime"].forEach(function (id) {
            const el = document.getElementById(id); if (el) el.textContent = "—";
        });
        const errorBox = document.getElementById("profileError"); if (errorBox) errorBox.classList.add("hidden");
        const details = document.getElementById("profileDetails");
        if (details) {
            details.replaceChildren();
            const p = document.createElement("p");
            p.style.cssText = "color:var(--muted);font-size:12px;margin:0";
            p.textContent = "Sedang mengambil data profil...";
            details.appendChild(p);
        }
        const worldsGrid = document.getElementById("profileWorldsGrid");
        if (worldsGrid) {
            worldsGrid.replaceChildren();
            const l = document.createElement("p");
            l.className = "profile-loading"; l.textContent = "Menunggu data...";
            worldsGrid.appendChild(l);
        }
        const securityContent = document.getElementById("profileSecurityContent");
        if (securityContent) {
            securityContent.replaceChildren();
            const l = document.createElement("p");
            l.className = "profile-loading"; l.textContent = "Menunggu data...";
            securityContent.appendChild(l);
        }
        setPlayerStatus("Memuat...", "#65E7FF");
        setProfileStatus("Memuat profil pemain...", "#65E7FF");
        ["rightPlayerUsername"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = "Memuat..."; });
        ["rightPlayerRole"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = "Memuat role..."; });
        ["rightPlayerAvatar"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = "P"; });
        ["rightPlayerLevel", "rightPlayerUserID", "rightPlayerGems", "rightPlayerPlaytime"].forEach(function (id) {
            const e = document.getElementById(id); if (e) e.textContent = "—";
        });
        resetPlayerOverview();
        if (window.GroweraShop) window.GroweraShop.updateBalance(null);
    }

    function renderProfileHero(profile) {
        const username = String(profile.username || "Player");
        const initial = getInitial(username);
        const roleName = (profile.role && profile.role.name) || "Player";
        const heroAvatar = document.getElementById("profileHeroAvatar"); if (heroAvatar) heroAvatar.textContent = initial;
        const heroRole = document.getElementById("profileHeroRole"); if (heroRole) heroRole.textContent = roleName;
        const heroName = document.getElementById("profileUsername"); if (heroName) heroName.textContent = username;

        const isOnline = profile.online === true;
        const pingNum = Number(profile.ping);
        const hasPing = Number.isFinite(pingNum) && pingNum >= 0;
        const bothUnavailable = !isOnline && !hasPing;

        const onlineValue = document.getElementById("profileOnlineValue");
        const onlineBadge = document.getElementById("profileOnlineBadge");
        const pingValue = document.getElementById("profilePingValue");
        const pingBadge = document.getElementById("profilePingBadge");

        if (onlineBadge) onlineBadge.classList.remove("online");
        if (pingBadge) pingBadge.classList.remove("ping-excellent", "ping-good", "ping-fair", "ping-poor");

        if (onlineValue) {
            if (bothUnavailable) onlineValue.textContent = "—";
            else if (isOnline) { onlineValue.textContent = "Online"; if (onlineBadge) onlineBadge.classList.add("online"); }
            else onlineValue.textContent = "Offline";
        }
        if (pingValue && pingBadge) {
            if (bothUnavailable) pingValue.textContent = "—";
            else if (hasPing) {
                pingValue.textContent = Math.floor(pingNum) + " ms · " + getPingLabel(pingNum);
                pingBadge.classList.add(getPingClass(pingNum));
            } else pingValue.textContent = "—";
        }
    }

    function renderProfileStats(profile) {
        const levelEl = document.getElementById("profileStatLevel"); if (levelEl) levelEl.textContent = formatNumber(profile.level);
        const gemsEl = document.getElementById("profileStatGems"); if (gemsEl) gemsEl.textContent = formatNumber(profile.gems);
        const uidEl = document.getElementById("profileStatUserID"); if (uidEl) uidEl.textContent = formatNumber(profile.userID);
        const playEl = document.getElementById("profileStatPlaytime"); if (playEl) playEl.textContent = formatNumber(profile.playtime);
    }

    function renderProfileDetails(profile) {
        const container = document.getElementById("profileDetails");
        if (!container) return;
        container.replaceChildren();
        const roleName = (profile.role && profile.role.name) || "Player";
        const roleID = profile.role && profile.role.id !== undefined ? profile.role.id : 0;
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
            fields.push(["Account Created", new Date(createdAt * 1000).toLocaleString("id-ID")]);
        }
        fields.forEach(function (field) {
            const row = document.createElement("div");
            row.className = "profile-details-row";
            const label = document.createElement("span");
            label.className = "profile-details-label";
            label.textContent = field[0];
            const value = document.createElement("span");
            value.className = "profile-details-value";
            value.textContent = field[1] === null || field[1] === undefined ? "—" : String(field[1]);
            row.appendChild(label);
            row.appendChild(value);
            container.appendChild(row);
        });
    }

    function renderProfileWorlds(profile) {
        const container = document.getElementById("profileWorldsGrid");
        if (!container) return;
        container.replaceChildren();

        const groups = [
            { title: "Owned Worlds", iconId: WORLD_ICONS.owned, chipClass: "owned", data: asArray(profile.ownedWorlds), ids: asArray(profile.ownedWorldIDs) },
            { title: "Recent Worlds", iconId: WORLD_ICONS.recent, chipClass: "recent", data: asArray(profile.recentWorlds), ids: asArray(profile.recentWorldIDs) },
            { title: "Access Worlds", iconId: WORLD_ICONS.access, chipClass: "access", data: asArray(profile.accessWorlds), ids: asArray(profile.accessWorldIDs) },
            { title: "Small Locked Worlds", iconId: WORLD_ICONS.locked, chipClass: "locked", data: asArray(profile.smallLockedWorlds), ids: asArray(profile.smallLockedWorldIDs) }
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
            icon.appendChild(iconImg(group.iconId, 18));
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
                group.data.forEach(function (worldName, i) {
                    const chip = document.createElement("span");
                    chip.className = "profile-world-chip " + group.chipClass;
                    chip.textContent = String(worldName);
                    const rawId = group.ids[i];
                    const looksLikeFallback = String(worldName).indexOf("World #") === 0;
                    chip.title = (rawId !== undefined && !looksLikeFallback) ? ("ID: " + rawId) : String(worldName);
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

    function renderProfileSecurity(profile) {
        const container = document.getElementById("profileSecurityContent");
        if (!container) return;
        container.replaceChildren();
        const ipList = parseHistoryString(profile.ipHistory);
        const ridList = parseHistoryString(profile.ridHistory);
        container.appendChild(buildSecurityBlock({ title: "IP History", iconId: 6746, chipClass: "ip", items: ipList, emptyText: "Tidak ada riwayat IP." }));
        container.appendChild(buildSecurityBlock({ title: "RID History", iconId: 980, chipClass: "rid", items: ridList, emptyText: "Tidak ada riwayat RID." }));
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
        icon.appendChild(iconImg(config.iconId, 18));
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

    function resetPlayerOverview() {
        const ids = ["playerLevel", "playerGems"];
        ids.forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = "—"; });
        const xpEl = document.getElementById("levelProgressXP"); if (xpEl) xpEl.textContent = "— / — XP";
        const fillEl = document.getElementById("levelProgressFill"); if (fillEl) fillEl.style.width = "0%";
        const pctEl = document.getElementById("levelProgressPercent"); if (pctEl) pctEl.textContent = "0%";
        const remEl = document.getElementById("levelProgressRemaining"); if (remEl) remEl.textContent = "Memuat...";
    }

    function updatePlayerOverview(profile) {
        if (!profile) return;
        const level = Number(profile.level) || 0;
        const xp = Number(profile.xp) || 0;
        const requiredXP = Number(profile.requiredXP) || 0;
        const playerLevel = document.getElementById("playerLevel"); if (playerLevel) playerLevel.textContent = formatNumber(level);
        const playerGems = document.getElementById("playerGems"); if (playerGems) playerGems.textContent = formatNumber(profile.gems);

        if (requiredXP > 0) {
            const percent = Math.min(100, Math.max(0, (xp / requiredXP) * 100));
            const xpEl = document.getElementById("levelProgressXP"); if (xpEl) xpEl.textContent = formatNumber(xp) + " / " + formatNumber(requiredXP) + " XP";
            const fillEl = document.getElementById("levelProgressFill"); if (fillEl) fillEl.style.width = percent.toFixed(2) + "%";
            const pctEl = document.getElementById("levelProgressPercent"); if (pctEl) pctEl.textContent = percent.toFixed(1) + "%";
            const remaining = Math.max(0, requiredXP - xp);
            const remEl = document.getElementById("levelProgressRemaining");
            if (remEl) remEl.textContent = remaining === 0 ? "Siap naik level" : "Butuh " + formatNumber(remaining) + " XP lagi";
        } else {
            const xpEl = document.getElementById("levelProgressXP"); if (xpEl) xpEl.textContent = formatNumber(xp) + " XP";
            const fillEl = document.getElementById("levelProgressFill"); if (fillEl) fillEl.style.width = "0%";
            const pctEl = document.getElementById("levelProgressPercent"); if (pctEl) pctEl.textContent = "—";
            const remEl = document.getElementById("levelProgressRemaining"); if (remEl) remEl.textContent = "Data required XP belum tersedia dari server";
        }
    }

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
        const rightRole = document.getElementById("rightPlayerRole"); if (rightRole) rightRole.textContent = "Gagal memuat profil";
        resetPlayerOverview();
    }

    async function fetchPlayerProfile() {
        const session = loadSession();
        if (!session.token) { showProfileError("Token login tidak ditemukan."); return "unauthorized"; }
        const requestID = ++profileRequestID;
        resetProfileDisplay();
        try {
            const response = await fetch(API_PROFILE_URL, {
                method: "GET",
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            if (requestID !== profileRequestID) return "error";
            if (response.status === 401) { showProfileError("Sesi tidak valid atau telah berakhir."); return "unauthorized"; }
            const data = await readJSONResponse(response);
            if (requestID !== profileRequestID) return "error";
            if (!response.ok || data.success !== true) throw new Error(data.message || "Gagal mengambil profil.");
            if (!data.user || typeof data.user !== "object") throw new Error("Respons API tidak memiliki data user.");
            const profile = data.user;
            if (!profile.username) throw new Error("Username tidak ditemukan.");

            currentProfile = profile;
            const roleName = (profile.role && profile.role.name) || "Player";
            const username = String(profile.username);
            const initial = getInitial(username);

            ["rightPlayerUsername"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = profile.username || "Player"; });
            ["rightPlayerRole"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = roleName; });
            ["rightPlayerAvatar"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = initial; });
            ["rightPlayerLevel"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = formatNumber(profile.level); });
            ["rightPlayerUserID"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = formatNumber(profile.userID); });
            ["rightPlayerGems"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = formatNumber(profile.gems); });
            ["rightPlayerPlaytime"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = formatNumber(profile.playtime); });

            ["headerUsername", "playerUsername", "profileUsername"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = username; });
            ["headerAvatar", "playerAvatar"].forEach(function (id) { const e = document.getElementById(id); if (e) e.textContent = initial; });

            const statPlaytime = document.getElementById("statPlaytime"); if (statPlaytime) statPlaytime.textContent = formatNumber(profile.playtime);
            const statPlaytimeNote = document.getElementById("statPlaytimeNote"); if (statPlaytimeNote) statPlaytimeNote.textContent = "Nilai playtime dari server";

            updatePlayerOverview(profile);
            renderProfileHero(profile);
            renderProfileStats(profile);
            renderProfileDetails(profile);
            renderProfileWorlds(profile);
            renderProfileSecurity(profile);

            if (window.GroweraShop) window.GroweraShop.updateBalance(profile);
            const errorBox = document.getElementById("profileError"); if (errorBox) errorBox.classList.add("hidden");
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
        if (modal) modal.classList.remove("open");
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
        if (!session.token) { note.textContent = "Token tidak ditemukan."; grid.replaceChildren(); return; }
        const requestID = ++inventoryRequestID;

        try {
            const response = await fetch(API_INVENTORY_URL, {
                method: "GET",
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (requestID !== inventoryRequestID) return;
            if (response.status === 401) { note.textContent = "Sesi tidak valid."; grid.replaceChildren(); return; }
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);

            const items = Array.isArray(data.items) ? data.items : [];
            const sourceLabel = data.source === "live" ? "live scan" : "cache server";
            const updatedAt = Number(data.updatedAt);
            let updatedLabel = "";
            if (Number.isFinite(updatedAt) && updatedAt > 0) {
                updatedLabel = " · update: " + new Date(updatedAt * 1000).toLocaleString("id-ID");
            }
            note.textContent = "Sumber: " + sourceLabel + " · " + items.length + " jenis item" + updatedLabel;
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
                fallback.appendChild(iconImg(102, 32));
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

    function reset() {
        profileRequestID++;
        inventoryRequestID++;
        currentProfile = null;
    }

    function init() {
        const retryBtn = document.getElementById("retryProfileButton");
        if (retryBtn) retryBtn.addEventListener("click", fetchPlayerProfile);
        const viewInvBtn = document.getElementById("viewInventoryBtn");
        if (viewInvBtn) viewInvBtn.addEventListener("click", openInventoryModal);
        const invCloseBtn = document.getElementById("inventoryCloseBtn");
        if (invCloseBtn) invCloseBtn.addEventListener("click", closeInventoryModal);
        const invModal = document.getElementById("inventoryModal");
        if (invModal) invModal.addEventListener("click", function (event) {
            if (event.target === event.currentTarget) closeInventoryModal();
        });
    }

    window.GroweraProfile = {
        init: init, fetch: fetchPlayerProfile, reset: reset,
        closeInventory: closeInventoryModal,
        get current() { return currentProfile; },
        _version: "3.0"
    };

    console.log("[GROWERA] profile.js v3 ready.");
    init();
})();
