/* =========================================
   GROWERA — PROFILE + INVENTORY MODULE
   Fetch profil pemain + kartu Home, render
   detail akun, dan modal inventory.

   Dependensi (dari app.js):
   - loadSession(), readJSONResponse()
   - formatNumber(), getInitial()
   - setPlayerStatus(), setProfileStatus()

   Dependensi opsional:
   - window.GroweraShop.updateBalance(profile)

   Public API (window.GroweraProfile):
   - init()           : wire event (auto dijalankan)
   - fetch()          : fetch profil, return "ok"|"unauthorized"|"error"
   - reset()          : batalkan request pending + null currentProfile
   - closeInventory() : tutup modal inventory dari luar
   - current (getter) : akses profile (read-only)
========================================= */

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
       RESET PROFILE DISPLAY
    ========================================= */

    function resetProfileDisplay() {
        currentProfile = null;

        document.getElementById("statPlaytime").textContent = "—";
        document.getElementById("statPlaytimeNote").textContent =
            "Memuat data dari server...";

        document.getElementById("profileError").classList.add("hidden");
        document.getElementById("profileDetails").replaceChildren();

        const placeholder = document.createElement("p");
        placeholder.textContent = "Sedang mengambil data profil...";
        document.getElementById("profileDetails").appendChild(placeholder);

        setPlayerStatus("Memuat...", "#65E7FF");
        setProfileStatus("Memuat profil pemain...", "#65E7FF");

        document.getElementById("rightPlayerUsername").textContent = "Memuat...";
        document.getElementById("rightPlayerRole").textContent = "Memuat role...";
        document.getElementById("rightPlayerAvatar").textContent = "P";
        document.getElementById("rightPlayerLevel").textContent = "—";
        document.getElementById("rightPlayerUserID").textContent = "—";
        document.getElementById("rightPlayerGems").textContent = "—";
        document.getElementById("rightPlayerPlaytime").textContent = "—";

        resetPlayerOverview();

        if (window.GroweraShop) {
            window.GroweraShop.updateBalance(null);
        }
    }


    /* =========================================
       RENDER PROFILE DETAILS
    ========================================= */

    function renderProfileDetails(profile) {
        const container = document.getElementById("profileDetails");
        container.replaceChildren();

        const heading = document.createElement("h3");
        heading.textContent = "Account Information";
        heading.style.color = "#65E7FF";
        container.appendChild(heading);

        const roleName = profile.role && profile.role.name
            ? profile.role.name : "Player";
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

        const createdAt = Number(profile.accountCreatedAt);

        if (Number.isFinite(createdAt) && createdAt > 0) {
            const row = document.createElement("div");
            row.className = "profile-details-row";

            const label = document.createElement("span");
            label.className = "profile-details-label";
            label.textContent = "Account Created";

            const value = document.createElement("span");
            value.className = "profile-details-value";
            value.textContent = new Date(createdAt * 1000).toLocaleString("id-ID");

            row.appendChild(label);
            row.appendChild(value);
            container.appendChild(row);
        }

        const note = document.createElement("p");
        note.textContent =
            "Playtime ditampilkan sesuai nilai mentah dari server. " +
            "Satuannya belum dikonfirmasi.";
        note.style.fontSize = "11px";
        note.style.color = "#7186A4";
        container.appendChild(note);
    }


    /* =========================================
       PLAYER OVERVIEW (kartu di Home)
    ========================================= */

    function resetPlayerOverview() {
        document.getElementById("playerLevel").textContent = "—";
        document.getElementById("playerGems").textContent = "—";
        document.getElementById("levelProgressXP").textContent = "— / — XP";
        document.getElementById("levelProgressFill").style.width = "0%";
        document.getElementById("levelProgressPercent").textContent = "0%";
        document.getElementById("levelProgressRemaining").textContent = "Memuat...";
    }

    function updatePlayerOverview(profile) {
        if (!profile) return;

        const level = Number(profile.level) || 0;
        const xp = Number(profile.xp) || 0;
        const requiredXP = Number(profile.requiredXP) || 0;

        document.getElementById("playerLevel").textContent = formatNumber(level);
        document.getElementById("playerGems").textContent = formatNumber(profile.gems);

        if (requiredXP > 0) {
            const percent = Math.min(100, Math.max(0, (xp / requiredXP) * 100));

            document.getElementById("levelProgressXP").textContent =
                formatNumber(xp) + " / " + formatNumber(requiredXP) + " XP";

            document.getElementById("levelProgressFill").style.width =
                percent.toFixed(2) + "%";

            document.getElementById("levelProgressPercent").textContent =
                percent.toFixed(1) + "%";

            const remaining = Math.max(0, requiredXP - xp);

            document.getElementById("levelProgressRemaining").textContent =
                remaining === 0 ? "Siap naik level"
                    : "Butuh " + formatNumber(remaining) + " XP lagi";
        } else {
            document.getElementById("levelProgressXP").textContent =
                formatNumber(xp) + " XP";
            document.getElementById("levelProgressFill").style.width = "0%";
            document.getElementById("levelProgressPercent").textContent = "—";
            document.getElementById("levelProgressRemaining").textContent =
                "Data required XP belum tersedia dari server";
        }
    }


    /* =========================================
       PROFILE ERROR
    ========================================= */

    function showProfileError(message) {
        const errorBox = document.getElementById("profileError");
        const errorMessage = document.getElementById("profileErrorMessage");

        errorMessage.textContent = message;
        errorBox.classList.remove("hidden");

        document.getElementById("profileDetails").replaceChildren();

        const heading = document.createElement("h3");
        heading.textContent = "Profile API Error";
        heading.style.color = "#FF8585";

        const detail = document.createElement("p");
        detail.textContent = message;

        document.getElementById("profileDetails").appendChild(heading);
        document.getElementById("profileDetails").appendChild(detail);

        setPlayerStatus("Gagal memuat profil", "#FF8585");
        setProfileStatus("Gagal memuat profil", "#FF8585");

        document.getElementById("rightPlayerRole").textContent = "Gagal memuat profil";

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

            const roleName = profile.role && profile.role.name
                ? profile.role.name : "Player";

            document.getElementById("rightPlayerUsername").textContent =
                profile.username || "Player";
            document.getElementById("rightPlayerRole").textContent = roleName;
            document.getElementById("rightPlayerAvatar").textContent =
                getInitial(profile.username);
            document.getElementById("rightPlayerLevel").textContent =
                formatNumber(profile.level);
            document.getElementById("rightPlayerUserID").textContent =
                formatNumber(profile.userID);
            document.getElementById("rightPlayerGems").textContent =
                formatNumber(profile.gems);
            document.getElementById("rightPlayerPlaytime").textContent =
                formatNumber(profile.playtime);

            const username = String(profile.username);
            const initial = getInitial(username);

            document.getElementById("headerUsername").textContent = username;
            document.getElementById("playerUsername").textContent = username;
            document.getElementById("profileUsername").textContent = username;

            document.getElementById("headerAvatar").textContent = initial;
            document.getElementById("playerAvatar").textContent = initial;

            document.getElementById("statPlaytime").textContent =
                formatNumber(profile.playtime);
            document.getElementById("statPlaytimeNote").textContent =
                "Nilai playtime dari server";

            updatePlayerOverview(profile);
            renderProfileDetails(profile);

            if (window.GroweraShop) {
                window.GroweraShop.updateBalance(profile);
            }

            document.getElementById("profileError").classList.add("hidden");

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
       RESET (dipanggil dari logout)
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
        get current() { return currentProfile; }
    };

    init();

})();
