(() => {
  "use strict";

  // =========================================================
  // GROWERA API CONFIGURATION
  // Ganti dengan alamat server Lua yang sebenarnya.
  // Contoh: https://api.domainkamu.com
  // Jangan tambahkan /api/growera di bagian ini.
  // =========================================================

  const API_BASE_URL = "";

  const API_PREFIX = "/api/growera";
  const TOKEN_KEY = "growera_session_token";

  // =========================================================
  // ELEMENTS
  // =========================================================

  const $ = (selector) => document.querySelector(selector);

  const loginView = $("#loginView");
  const profileView = $("#profileView");
  const loginForm = $("#loginForm");
  const formMessage = $("#formMessage");
  const editDialog = $("#editDialog");

  const loginButton = loginForm?.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  // =========================================================
  // PLAYER DATA
  // Data ini hanya diisi dari API server.
  // =========================================================

  const player = {
    username: "Player",
    displayName: "Player",
    level: 1,
    gems: 0,
    xp: 0,
    nextLevelXp: 1
  };

  let isAuthenticated = false;
  let isBusy = false;

  // =========================================================
  // HELPERS
  // =========================================================

  const safeName = (value) =>
    String(value || "Player").trim().slice(0, 24) || "Player";

  const fmt = (value) =>
    Math.max(0, Number(value) || 0).toLocaleString("en-US");

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function saveToken(token) {
    if (!token) {
      throw new Error("Server tidak memberikan token sesi.");
    }

    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      throw new Error(
        "Browser tidak dapat menyimpan sesi. Periksa pengaturan browser."
      );
    }
  }

  function clearToken() {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Tidak ada tindakan tambahan jika storage tidak tersedia.
    }
  }

  function setMessage(message, type = "error") {
    if (!formMessage) return;

    formMessage.textContent = message;
    formMessage.dataset.type = type;
  }

  function setBusy(busy) {
    isBusy = busy;

    if (loginButton) {
      loginButton.disabled = busy;
      loginButton.textContent = busy ? "PLEASE WAIT..." : "SIGN IN";
    }

    if (loginForm) {
      loginForm.setAttribute("aria-busy", String(busy));
    }
  }

  function setLoginVisible() {
    isAuthenticated = false;

    profileView?.classList.add("hidden");
    loginView?.classList.remove("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // =========================================================
  // API REQUEST
  // =========================================================

  async function apiRequest(path, options = {}) {
    if (
      !API_BASE_URL ||
      API_BASE_URL.includes("ALAMAT-SERVER-LUA-KAMU")
    ) {
      throw new Error(
        "Alamat API belum dikonfigurasi. Atur API_BASE_URL di js/app.js."
      );
    }

    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
      API_BASE_URL.replace(/\/+$/, "") + API_PREFIX + path,
      {
        ...options,
        headers,
        mode: "cors",
        cache: "no-store"
      }
    );

    const rawText = await response.text();

    let data = {};

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          "Respons server bukan JSON yang valid. Periksa konfigurasi API Lua."
        );
      }
    }

    if (!response.ok) {
      const message =
        data.message ||
        data.error ||
        `Permintaan gagal (HTTP ${response.status}).`;

      const error = new Error(message);
      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  // =========================================================
  // PROFILE DATA
  // =========================================================

  function normalizePlayer(data) {
    // Mendukung respons yang dibungkus sebagai player atau data.
    const source =
      data?.player ||
      data?.data?.player ||
      data?.data ||
      data;

    if (!source || typeof source !== "object") {
      throw new Error("Data pemain dari server tidak valid.");
    }

    const username = safeName(
      source.username ||
      source.displayName ||
      source.name
    );

    const displayName = safeName(
      source.displayName ||
      source.username ||
      source.name
    );

    const level = Math.max(
      1,
      Number(source.level) || 1
    );

    const xp = Math.max(
      0,
      Number(source.xp) || 0
    );

    const nextLevelXp = Math.max(
      1,
      Number(
        source.nextLevelXp ??
        source.requiredXP ??
        source.requiredXp ??
        source.xpRequired
      ) || 1
    );

    const gems = Math.max(
      0,
      Number(source.gems) || 0
    );

    return {
      username,
      displayName,
      level,
      xp,
      nextLevelXp,
      gems
    };
  }

  function renderProfile() {
    const name = safeName(player.displayName || player.username);

    const welcomeName = $("#welcomeName");
    const profileName = $("#profileName");
    const profileHandle = $("#profileHandle");
    const avatarInitial = $("#avatarInitial");
    const levelValue = $("#levelValue");
    const gemsValue = $("#gemsValue");
    const xpPercent = $("#xpPercent");
    const xpFill = $("#xpFill");
    const xpCurrent = $("#xpCurrent");
    const xpNext = $("#xpNext");

    if (welcomeName) {
      welcomeName.textContent = name;
    }

    if (profileName) {
      profileName.textContent = name;
    }

    if (profileHandle) {
      profileHandle.textContent =
        "@" +
        String(player.username || name)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 24);
    }

    if (avatarInitial) {
      avatarInitial.textContent = name.charAt(0).toUpperCase();
    }

    if (levelValue) {
      levelValue.textContent = fmt(player.level);
    }

    if (gemsValue) {
      gemsValue.textContent = fmt(player.gems);
    }

    const xp = Math.max(0, Number(player.xp) || 0);
    const next = Math.max(1, Number(player.nextLevelXp) || 1);

    const percent = Math.min(
      100,
      Math.round((xp / next) * 100)
    );

    if (xpPercent) {
      xpPercent.textContent = percent + "%";
    }

    if (xpFill) {
      xpFill.style.width = percent + "%";
    }

    if (xpCurrent) {
      xpCurrent.textContent = fmt(xp) + " XP";
    }

    if (xpNext) {
      xpNext.textContent = fmt(next) + " XP";
    }
  }

  function showProfile() {
    if (!isAuthenticated) return;

    renderProfile();

    loginView?.classList.add("hidden");
    profileView?.classList.remove("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  // =========================================================
  // LOGIN
  // POST /api/growera/login
  // =========================================================

  async function handleLogin(event) {
    event.preventDefault();

    if (isBusy) return;

    const username = $("#username")?.value.trim() || "";
    const password = $("#password")?.value || "";

    if (!username || !password) {
      setMessage(
        "Masukkan username dan password untuk melanjutkan."
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const result = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password
        })
      });

      // Menyesuaikan beberapa bentuk respons API.
      const token =
        result.token ||
        result.accessToken ||
        result.data?.token ||
        result.data?.accessToken;

      saveToken(token);

      // Jangan menampilkan profil berdasarkan username input saja.
      // Ambil profil yang sudah diverifikasi oleh server.
      await loadCurrentPlayer();

      setMessage("");
      showProfile();
    } catch (error) {
      clearToken();
      setLoginVisible();

      console.error("[GROWERA] Login gagal:", error);

      if (error instanceof TypeError) {
        setMessage(
          "Tidak dapat terhubung ke server. Periksa alamat API, koneksi, dan konfigurasi CORS."
        );
      } else {
        setMessage(
          error.message || "Login gagal. Silakan coba lagi."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // CURRENT PLAYER
  // GET /api/growera/me
  // =========================================================

  async function loadCurrentPlayer() {
    const token = getToken();

    if (!token) {
      throw new Error("Sesi tidak ditemukan. Silakan login kembali.");
    }

    const result = await apiRequest("/me", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const normalized = normalizePlayer(result);

    Object.assign(player, normalized);

    isAuthenticated = true;

    return player;
  }

  // =========================================================
  // LOGOUT
  // POST /api/growera/logout
  // =========================================================

  async function handleLogout() {
    if (isBusy) return;

    const token = getToken();

    setBusy(true);

    try {
      if (token) {
        await apiRequest("/logout", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token
          }
        });
      }
    } catch (error) {
      console.error("[GROWERA] Logout API gagal:", error);
    } finally {
      // Hapus token lokal meskipun server tidak bisa dihubungi.
      clearToken();
      isAuthenticated = false;

      if ($("#password")) {
        $("#password").value = "";
      }

      setMessage("");
      setLoginVisible();
      setBusy(false);
    }
  }

  // =========================================================
  // RESTORE SESSION
  // Memulihkan sesi saat halaman dimuat ulang.
  // =========================================================

  async function restoreSession() {
    if (!getToken()) {
      setLoginVisible();
      return;
    }

    setBusy(true);

    try {
      await loadCurrentPlayer();
      showProfile();
    } catch (error) {
      console.warn(
        "[GROWERA] Sesi tidak dapat dipulihkan:",
        error
      );

      clearToken();
      setLoginVisible();
    } finally {
      setBusy(false);
    }
  }

  // =========================================================
  // EVENTS
  // =========================================================

  loginForm?.addEventListener("submit", handleLogin);

  $("#logoutButton")?.addEventListener("click", handleLogout);

  // Edit preview dihapus sebagai fungsi pengubah data.
  // Level dan gems harus diubah melalui sistem server yang sah.
  $("#editPreviewButton")?.addEventListener("click", () => {
    setMessage(
      "Pengubahan level dan gems harus dilakukan melalui sistem server."
    );
  });

  // Nonaktifkan formulir edit demo agar tidak mengubah data lokal.
  $("#editForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (editDialog?.open) {
      editDialog.close();
    }

    setMessage(
      "Edit preview tidak tersedia. Data pemain mengikuti server GROWERA."
    );
  });

  $("#exploreButton")?.addEventListener("click", () => {
    $("#editPreviewButton")?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });

  // Tahun footer.
  if ($("#year")) {
    $("#year").textContent = new Date().getFullYear();
  }

  if ($("#yearProfile")) {
    $("#yearProfile").textContent = new Date().getFullYear();
  }

  // =========================================================
  // START
  // =========================================================

  restoreSession();
})();
