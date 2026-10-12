/* =========================================
           API CONFIGURATION
        ========================================= */

        const API_LOGIN_URL = "/api/growera/login";
        const API_PROFILE_URL = "/api/growera/me";
        const API_LOGOUT_URL = "/api/growera/logout";
        const API_INVENTORY_URL = "/api/growera/inventory";

        const SERVER_ID = "1791";

        const STORAGE_KEYS = {
            token: "growera_token",
            username: "growera_username",
            expiresAt: "growera_expires_at"
        };

        const loginScreen = document.getElementById("loginScreen");
        const dashboardScreen = document.getElementById("dashboardScreen");
        const loginForm = document.getElementById("loginForm");
        const loginButton = document.getElementById("loginButton");
        const loginMessage = document.getElementById("loginMessage");
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        let profileRequestID = 0;
        let inventoryRequestID = 0;
        let currentProfile = null;


        /* =========================================
           STORAGE HELPERS
        ========================================= */

        function saveSession(token, username, expiresAt) {
            const t = String(token || "");
            const u = String(username || "");
            const e = String(expiresAt || "");

            try {
                localStorage.setItem(STORAGE_KEYS.token, t);
                localStorage.setItem(STORAGE_KEYS.username, u);
                localStorage.setItem(STORAGE_KEYS.expiresAt, e);
            } catch (error) {
                console.warn("[GROWERA] localStorage gagal:", error);
            }

            try {
                sessionStorage.setItem(STORAGE_KEYS.token, t);
                sessionStorage.setItem(STORAGE_KEYS.username, u);
                sessionStorage.setItem(STORAGE_KEYS.expiresAt, e);
            } catch (error) {
                console.warn("[GROWERA] sessionStorage gagal:", error);
            }
        }

        function loadSession() {
            let token = null;
            let username = null;
            let expiresAt = null;

            try {
                token = localStorage.getItem(STORAGE_KEYS.token);
                username = localStorage.getItem(STORAGE_KEYS.username);
                expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
            } catch (error) {
                console.warn("[GROWERA] Baca localStorage gagal:", error);
            }

            if (!token || !username) {
                try {
                    token = token || sessionStorage.getItem(STORAGE_KEYS.token);
                    username = username || sessionStorage.getItem(STORAGE_KEYS.username);
                    expiresAt = expiresAt || sessionStorage.getItem(STORAGE_KEYS.expiresAt);
                } catch (error) {
                    console.warn("[GROWERA] Baca sessionStorage gagal:", error);
                }
            }

            return {
                token: token,
                username: username,
                expiresAt: expiresAt
            };
        }

        function clearSession() {
            try {
                localStorage.removeItem(STORAGE_KEYS.token);
                localStorage.removeItem(STORAGE_KEYS.username);
                localStorage.removeItem(STORAGE_KEYS.expiresAt);
            } catch (error) {
                console.warn("[GROWERA] Hapus localStorage gagal:", error);
            }

            try {
                sessionStorage.removeItem(STORAGE_KEYS.token);
                sessionStorage.removeItem(STORAGE_KEYS.username);
                sessionStorage.removeItem(STORAGE_KEYS.expiresAt);
            } catch (error) {
                console.warn("[GROWERA] Hapus sessionStorage gagal:", error);
            }
        }


        /* =========================================
           HELPERS
        ========================================= */

        function showLoginMessage(message, color) {
            loginMessage.textContent = message;
            loginMessage.style.color = color || "#9BAAC3";
        }

        function formatNumber(value) {
            if (value === null || value === undefined || value === "") {
                return "—";
            }

            const number = Number(value);

            if (!Number.isFinite(number)) {
                return "—";
            }

            return new Intl.NumberFormat("id-ID", {
                maximumFractionDigits: 0
            }).format(number);
        }

        function getInitial(username) {
            return String(username || "P")
                .trim()
                .charAt(0)
                .toUpperCase() || "P";
        }

        async function readJSONResponse(response) {
            const raw = await response.text();

            try {
                return JSON.parse(raw);
            } catch (error) {
                throw new Error(
                    "Respons API bukan JSON yang valid. HTTP " +
                    response.status
                );
            }
        }

        function setStatusElement(element, message, color) {
            if (!element) {
                return;
            }

            let dot = element.querySelector(".status-dot");

            if (!dot) {
                dot = document.createElement("span");
                dot.className = "status-dot";
                element.prepend(dot);
            }

            dot.style.background = color;
            element.style.color = color;

            Array.from(element.childNodes).forEach(function(node) {
                if (node !== dot) {
                    node.remove();
                }
            });

            element.appendChild(document.createTextNode(message));
        }

        function setPlayerStatus(message, color) {
            setStatusElement(
                document.getElementById("playerStatus"),
                message,
                color
            );
        }

        function setProfileStatus(message, color) {
            setStatusElement(
                document.getElementById("profileStatusMessage"),
                message,
                color
            );
        }


        /* =========================================
           SCREEN SWITCHERS
        ========================================= */

        function showLoginScreen() {
            loginScreen.classList.remove("hidden");
            dashboardScreen.classList.add("hidden");
        }

        function hideLoginScreen() {
            loginScreen.classList.add("hidden");
        }


        /* =========================================
           LOGIN REQUEST
        ========================================= */

        async function loginRequest(username, password) {
            const response = await fetch(API_LOGIN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                }),
                cache: "no-store"
            });

            const data = await readJSONResponse(response);

            if (!response.ok || data.success !== true) {
                throw new Error(
                    data.message ||
                    "Login gagal. Periksa username dan password."
                );
            }

            if (!data.user || typeof data.user.username !== "string") {
                throw new Error(
                    "Respons login tidak memiliki identitas pengguna."
                );
            }

            if (typeof data.token !== "string" || !data.token) {
                throw new Error(
                    "Token sesi tidak ditemukan pada respons API."
                );
            }

            return {
                username: data.user.username,
                token: data.token,
                expiresAt: data.expiresAt
            };
        }


        /* =========================================
           SHOW DASHBOARD
        ========================================= */

        function showDashboard(username) {
            const initial = getInitial(username);

            document.getElementById("headerUsername").textContent = username;
            document.getElementById("playerUsername").textContent = username;
            document.getElementById("profileUsername").textContent = username;

            document.getElementById("headerAvatar").textContent = initial;
            document.getElementById("playerAvatar").textContent = initial;

            hideLoginScreen();
            dashboardScreen.classList.remove("hidden");

            window.scrollTo({
                top: 0,
                behavior: "auto"
            });

            navigateTo("home");
        }


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

            document.getElementById("rightPlayerUsername").textContent =
                "Memuat...";

            document.getElementById("rightPlayerRole").textContent =
                "Memuat role...";

            document.getElementById("rightPlayerAvatar").textContent = "P";

            document.getElementById("rightPlayerLevel").textContent = "—";
            document.getElementById("rightPlayerUserID").textContent = "—";
            document.getElementById("rightPlayerGems").textContent = "—";
            document.getElementById("rightPlayerPlaytime").textContent = "—";

            resetPlayerOverview();
        }


        /* =========================================
           RENDER PROFILE
        ========================================= */

        function renderProfileDetails(profile) {
            const container = document.getElementById("profileDetails");
            container.replaceChildren();

            const heading = document.createElement("h3");
            heading.textContent = "Account Information";
            heading.style.color = "#65E7FF";
            container.appendChild(heading);

            const roleName = profile.role && profile.role.name
                ? profile.role.name
                : "Player";

            const roleID = profile.role && profile.role.id !== undefined
                ? profile.role.id
                : 0;

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

            fields.forEach(function(field) {
                const row = document.createElement("div");
                row.className = "profile-details-row";

                const label = document.createElement("span");
                label.className = "profile-details-label";
                label.textContent = field[0];

                const value = document.createElement("span");
                value.className = "profile-details-value";
                value.textContent =
                    field[1] === null || field[1] === undefined
                        ? "—"
                        : String(field[1]);

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

                value.textContent = new Date(
                    createdAt * 1000
                ).toLocaleString("id-ID");

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
           PLAYER OVERVIEW
        ========================================= */

        function resetPlayerOverview() {
            document.getElementById("playerLevel").textContent = "—";
            document.getElementById("playerGems").textContent = "—";
            document.getElementById("levelProgressXP").textContent =
                "— / — XP";
            document.getElementById("levelProgressFill").style.width = "0%";
            document.getElementById("levelProgressPercent").textContent = "0%";
            document.getElementById("levelProgressRemaining").textContent =
                "Memuat...";
        }

        function updatePlayerOverview(profile) {
            if (!profile) return;

            const level = Number(profile.level) || 0;
            const xp = Number(profile.xp) || 0;
            const requiredXP = Number(profile.requiredXP) || 0;

            document.getElementById("playerLevel").textContent =
                formatNumber(level);

            document.getElementById("playerGems").textContent =
                formatNumber(profile.gems);

            if (requiredXP > 0) {
                const percent = Math.min(
                    100,
                    Math.max(0, (xp / requiredXP) * 100)
                );

                document.getElementById("levelProgressXP").textContent =
                    formatNumber(xp) + " / " + formatNumber(requiredXP) + " XP";

                document.getElementById("levelProgressFill").style.width =
                    percent.toFixed(2) + "%";

                document.getElementById("levelProgressPercent").textContent =
                    percent.toFixed(1) + "%";

                const remaining = Math.max(0, requiredXP - xp);

                document.getElementById("levelProgressRemaining").textContent =
                    remaining === 0
                        ? "Siap naik level"
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

            document.getElementById("rightPlayerRole").textContent =
                "Gagal memuat profil";

            resetPlayerOverview();
        }


        /* =========================================
           FETCH PLAYER PROFILE
           Return:
             "ok"           → berhasil
             "unauthorized" → 401 / token tidak ada
             "error"        → network / server error (JANGAN hapus sesi)
        ========================================= */

        async function fetchPlayerProfile() {
            const session = loadSession();

            if (!session.token) {
                showProfileError(
                    "Token login tidak ditemukan. Silakan login kembali."
                );
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

                if (requestID !== profileRequestID) {
                    return "error";
                }

                if (response.status === 401) {
                    showProfileError(
                        "Sesi tidak valid atau telah berakhir. " +
                        "Silakan login kembali."
                    );
                    return "unauthorized";
                }

                const data = await readJSONResponse(response);

                if (requestID !== profileRequestID) {
                    return "error";
                }

                if (!response.ok || data.success !== true) {
                    throw new Error(
                        data.message ||
                        "Gagal mengambil profil. HTTP " + response.status
                    );
                }

                if (!data.user || typeof data.user !== "object") {
                    throw new Error(
                        "Respons API tidak memiliki data user."
                    );
                }

                const profile = data.user;

                if (!profile.username) {
                    throw new Error(
                        "Username tidak ditemukan pada data profil."
                    );
                }

                currentProfile = profile;

                const roleName = profile.role && profile.role.name
                    ? profile.role.name
                    : "Player";

                document.getElementById("rightPlayerUsername").textContent =
                    profile.username || "Player";

                document.getElementById("rightPlayerRole").textContent =
                    roleName;

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

                document.getElementById("profileError").classList.add("hidden");

                setPlayerStatus("Profil berhasil dimuat", "#58FFAD");
                setProfileStatus("Profil berhasil dimuat", "#58FFAD");

                return "ok";

            } catch (error) {
                if (requestID !== profileRequestID) {
                    return "error";
                }

                console.error("[GROWERA PROFILE ERROR]", error);

                showProfileError(
                    error.message ||
                    "Tidak dapat mengambil data profil dari server."
                );

                return "error";
            }
        }


        /* =========================================
           INVENTORY
        ========================================= */

        function itemTextureURL(itemId) {
            return "https://api.gtps.cloud/api/item/texture/" +
                SERVER_ID + "/" + itemId;
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
                note.textContent =
                    "Token tidak ditemukan. Silakan login ulang.";
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

                if (requestID !== inventoryRequestID) {
                    return;
                }

                if (response.status === 401) {
                    note.textContent =
                        "Sesi tidak valid. Silakan login ulang.";
                    grid.replaceChildren();
                    return;
                }

                if (!response.ok || data.success !== true) {
                    throw new Error(
                        data.message || "HTTP " + response.status
                    );
                }

                const items = Array.isArray(data.items) ? data.items : [];

                const sourceLabel = data.source === "live"
                    ? "live scan"
                    : "cache server";

                const updatedAt = Number(data.updatedAt);

                let updatedLabel = "";
                if (Number.isFinite(updatedAt) && updatedAt > 0) {
                    updatedLabel = " · update: " + new Date(
                        updatedAt * 1000
                    ).toLocaleString("id-ID");
                }

                note.textContent =
                    "Sumber: " + sourceLabel +
                    " · " + items.length + " jenis item" +
                    updatedLabel;

                renderInventory(items);

            } catch (error) {
                if (requestID !== inventoryRequestID) {
                    return;
                }

                console.error("[GROWERA INVENTORY ERROR]", error);

                note.textContent =
                    "Gagal memuat inventory: " +
                    (error.message || "unknown error");

                grid.replaceChildren();

                const errorLine = document.createElement("p");
                errorLine.textContent =
                    "Tidak dapat mengambil inventory dari server.";
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

                    if (icon.parentNode === card) {
                        card.replaceChild(fallback, icon);
                    }
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
           NEWS MODAL
        ========================================= */

        function openNewsModal() {
            const modal = document.getElementById("newsModal");
            if (!modal) return;

            modal.classList.add("open");
        }

        function closeNewsModal() {
            const modal = document.getElementById("newsModal");
            if (!modal) return;
            modal.classList.remove("open");
        }


        /* =========================================
           PAGE NAVIGATION
        ========================================= */

        function navigateTo(pageName) {
            const validPages = [
                "home",
                "profile",
                "rewards",
                "events",
                "history",
                "more"
            ];

            if (!validPages.includes(pageName)) {
                pageName = "home";
            }

            document.querySelectorAll(".app-page").forEach(
                function(page) {
                    page.classList.add("hidden");
                }
            );

            let targetPage = document.getElementById(pageName + "Page");

            if (!targetPage) {
                pageName = "more";
                targetPage = document.getElementById("morePage");
            }

            if (!targetPage) {
                return;
            }

            targetPage.classList.remove("hidden");

            document.querySelectorAll(
                ".sidebar-nav .nav-button, .sidebar-bottom .nav-button"
            ).forEach(function(button) {
                button.classList.toggle(
                    "active",
                    button.dataset.page === pageName
                );
            });

            const content = document.querySelector(".content");

            if (content) {
                content.scrollTo({
                    top: 0,
                    behavior: "auto"
                });
            }
        }

        document.querySelectorAll("[data-page]").forEach(
            function(button) {
                button.addEventListener("click", function() {
                    navigateTo(button.dataset.page);
                });
            }
        );


        /* =========================================
           HANDLE LOGIN
        ========================================= */

        loginForm.addEventListener("submit", async function(event) {
            event.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value;

            if (!username || !password) {
                showLoginMessage(
                    "Username dan password wajib diisi.",
                    "#FF8585"
                );
                return;
            }

            loginButton.disabled = true;
            loginButton.textContent = "SIGNING IN...";

            showLoginMessage(
                "Memeriksa kredensial akun...",
                "#65E7FF"
            );

            try {
                const result = await loginRequest(username, password);

                saveSession(
                    result.token,
                    result.username,
                    result.expiresAt
                );

                passwordInput.value = "";

                showDashboard(result.username);

                await fetchPlayerProfile();

            } catch (error) {
                console.error("[GROWERA LOGIN ERROR]", error);

                showLoginMessage(
                    error.message ||
                    "Tidak dapat menghubungi API GROWERA.",
                    "#FF8585"
                );

            } finally {
                loginButton.disabled = false;
                loginButton.textContent = "SIGN IN";
            }
        });


        /* =========================================
           RETRY PROFILE
        ========================================= */

        document.getElementById("retryProfileButton").addEventListener(
            "click",
            function() {
                fetchPlayerProfile();
            }
        );


        /* =========================================
           ACCOUNT BUTTON
        ========================================= */

        document.getElementById("accountButton").addEventListener(
            "click",
            function() {
                navigateTo("profile");
            }
        );


        /* =========================================
           NEWS EVENTS
        ========================================= */

        document.getElementById("newsReadMoreBtn").addEventListener(
            "click",
            openNewsModal
        );

        document.getElementById("newsModalCloseBtn").addEventListener(
            "click",
            closeNewsModal
        );

        document.getElementById("newsModal").addEventListener(
            "click",
            function (event) {
                if (event.target === event.currentTarget) {
                    closeNewsModal();
                }
            }
        );


        /* =========================================
           INVENTORY EVENTS
        ========================================= */

        document.getElementById("viewInventoryBtn").addEventListener(
            "click",
            openInventoryModal
        );

        document.getElementById("inventoryCloseBtn").addEventListener(
            "click",
            closeInventoryModal
        );

        document.getElementById("inventoryModal").addEventListener(
            "click",
            function (event) {
                if (event.target === event.currentTarget) {
                    closeInventoryModal();
                }
            }
        );


        /* =========================================
           GLOBAL KEYDOWN (Escape closes modals)
        ========================================= */

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeInventoryModal();
                closeNewsModal();
            }
        });


        /* =========================================
           LOGOUT
        ========================================= */

        document.getElementById("logoutButton").addEventListener(
            "click",
            async function() {
                const session = loadSession();

                profileRequestID++;
                inventoryRequestID++;
                currentProfile = null;

                if (session.token) {
                    try {
                        await fetch(API_LOGOUT_URL, {
                            method: "POST",
                            headers: {
                                "Authorization": "Bearer " + session.token,
                                "Accept": "application/json"
                            },
                            cache: "no-store"
                        });
                    } catch (error) {
                        console.warn(
                            "[GROWERA LOGOUT] Request server gagal."
                        );
                    }
                }

                clearSession();

                closeInventoryModal();
                closeNewsModal();

                dashboardScreen.classList.add("hidden");
                loginScreen.classList.remove("hidden");

                loginForm.reset();

                showLoginMessage(
                    "Kamu telah keluar dari dashboard.",
                    "#65E7FF"
                );

                window.scrollTo({
                    top: 0,
                    behavior: "auto"
                });
            }
        );


        /* =========================================
           SIDEBAR LOGOUT BUTTON
        ========================================= */

        document.getElementById("sidebarLogoutButton").addEventListener(
            "click",
            function() {
                document.getElementById("logoutButton").click();
            }
        );


        /* =========================================
           BOOTSTRAP / AUTO-RESTORE SESSION
        ========================================= */

        async function bootstrap() {
            const session = loadSession();
            const dbg = document.getElementById("sessionDebug");

            if (!session.token || !session.username) {
                if (dbg) {
                    dbg.textContent =
                        "Tidak ada sesi tersimpan di browser.";
                }
                showLoginScreen();
                return;
            }

            if (dbg) {
                dbg.textContent =
                    "Sesi ditemukan untuk: " + session.username +
                    " · mencoba memulihkan...";
            }

            showDashboard(session.username);

            const result = await fetchPlayerProfile();

            if (result === "unauthorized") {
                // Sesi benar-benar tidak valid (401 atau token kosong).
                clearSession();
                showLoginScreen();
                showLoginMessage(
                    "Sesi sebelumnya telah berakhir. Silakan login kembali.",
                    "#FF8585"
                );
                if (dbg) {
                    dbg.textContent =
                        "Sesi ditolak oleh server (401).";
                }
            } else if (result === "error") {
                // Network / server error. JANGAN hapus sesi.
                if (dbg) {
                    dbg.textContent =
                        "Sesi tersimpan, tapi server tidak merespons. " +
                        "Coba refresh lagi nanti.";
                }
            } else {
                // "ok"
                if (dbg) {
                    dbg.textContent = "Sesi valid: " + session.username;
                }
            }
        }

        bootstrap();
