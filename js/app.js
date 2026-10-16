(() => {
  "use strict";

  // =========================================================
  // GROWERA API CONFIGURATION
  // Menggunakan Vercel Rewrite:
  // /api/growera/* -> server Lua
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
  // Data profil hanya berasal dari API server.
  // =========================================================

  const player = {
    username: "Player",
    displayName: "Player",
    role: "player",
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

  function safeName(value) {
    return String(value ?? "Player")
      .trim()
      .slice(0, 24) || "Player";
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }

  function fmt(value) {
    return Math.max(
      0,
      toNumber(value)
    ).toLocaleString("en-US");
  }

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function saveToken(token) {
    if (typeof token !== "string" || !token.trim()) {
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
      // Storage mungkin tidak tersedia.
    }
  }

  function setMessage(message, type = "error") {
    if (!formMessage) return;

    formMessage.textContent = message;
    formMessage.dataset.type = type;
  }

  function setBusy(busy) {
    isBusy = Boolean(busy);

    if (loginButton) {
      loginButton.disabled = isBusy;

      if (loginButton.tagName === "INPUT") {
        loginButton.value = isBusy
          ? "PLEASE WAIT..."
          : "SIGN IN";
      } else {
        loginButton.textContent = isBusy
          ? "PLEASE WAIT..."
          : "SIGN IN";
      }
    }

    if (loginForm) {
      loginForm.setAttribute(
        "aria-busy",
        String(isBusy)
      );
    }
  }

  function setLoginVisible() {
    isAuthenticated = false;

    loginView?.classList.remove("hidden");
    profileView?.classList.add("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function setProfileVisible() {
    if (!isAuthenticated) return;

    renderProfile();

    loginView?.classList.add("hidden");
    profileView?.classList.remove("hidden");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function updateFooterYear() {
    const year = String(new Date().getFullYear());

    if ($("#year")) {
      $("#year").textContent = year;
    }

    if ($("#yearProfile")) {
      $("#yearProfile").textContent = year;
    }
  }

  // =========================================================
  // API REQUEST
  // =========================================================

  async function apiRequest(path, options = {}) {
    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.startsWith("//")
    ) {
      throw new Error("Path API tidak valid.");
    }

    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response;

    try {
      response = await fetch(
        API_BASE_URL.replace(/\/+$/, "") +
          API_PREFIX +
          path,
        {
          ...options,
          headers,
          cache: "no-store",
          credentials: "same-origin"
        }
      );
    } catch (error) {
      const networkError = new Error(
        "Tidak dapat terhubung ke server. Periksa koneksi, Vercel Rewrite, dan server Lua."
      );

      networkError.cause = error;

      throw networkError;
    }

    const rawText = await response.text();

    let data = {};

    if (rawText) {
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("[GROWERA] Respons bukan JSON:", {
      status: response.status,
      url: response.url,
      contentType: response.headers.get("content-type"),
      body: rawText.slice(0, 2000)
    });

    throw new Error(
      `Respons server bukan JSON (HTTP ${response.status}). Periksa Console browser untuk melihat respons aslinya.`
    );
  }
}

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `Permintaan gagal (HTTP ${response.status}).`;

      const error = new Error(String(message));

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  }

  // =========================================================
  // RESPONSE NORMALIZATION
  // Mendukung respons:
  // { player: {...} }
  // { data: {...} }
  // { data: { player: {...} } }
  // =========================================================

  function normalizePlayer(data) {
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
      toNumber(source.level, 1)
    );

    const xp = Math.max(
      0,
      toNumber(source.xp, 0)
    );

    const nextLevelXp = Math.max(
      1,
      toNumber(
        source.nextLevelXp ??
        source.requiredXP ??
        source.requiredXp ??
        source.xpRequired,
        1
      )
    );

    const gems = Math.max(
      0,
      toNumber(source.gems, 0)
    );

    const role = String(source.role || "player")
      .trim()
      .toLowerCase() === "admin"
      ? "admin"
      : "player";

    return {
      username,
      displayName,
      role,
      level,
      xp,
      nextLevelXp,
      gems
    };
  }

  // =========================================================
  // PROFILE RENDERING
  // =========================================================

  function renderProfile() {
    const name = safeName(
      player.displayName || player.username
    );

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
      avatarInitial.textContent =
        name.charAt(0).toUpperCase();
    }

    if (levelValue) {
      levelValue.textContent = fmt(player.level);
    }

    if (gemsValue) {
      gemsValue.textContent = fmt(player.gems);
    }

    const xp = Math.max(
      0,
      toNumber(player.xp)
    );

    const next = Math.max(
      1,
      toNumber(player.nextLevelXp, 1)
    );

    const percent = Math.min(
      100,
      Math.round((xp / next) * 100)
    );

    if (xpPercent) {
      xpPercent.textContent = `${percent}%`;
    }

    if (xpFill) {
      xpFill.style.width = `${percent}%`;
    }

    if (xpCurrent) {
      xpCurrent.textContent = `${fmt(xp)} XP`;
    }

    if (xpNext) {
      xpNext.textContent = `${fmt(next)} XP`;
    }

    // Role berasal dari server, bukan input pengguna.
    document.documentElement.dataset.groweraRole =
      player.role;
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
      clearToken();

      const result = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({
          username,
          password
        })
      });

      const token =
        result?.token ||
        result?.accessToken ||
        result?.data?.token ||
        result?.data?.accessToken;

      saveToken(token);

      // Profil harus dikonfirmasi melalui server.
      await loadCurrentPlayer();

      if ($("#password")) {
        $("#password").value = "";
      }

      setMessage("", "success");
      setProfileVisible();
    } catch (error) {
      clearToken();
      setLoginVisible();

      console.error("[GROWERA] Login gagal:", error);

      setMessage(
        error.message || "Login gagal. Silakan coba lagi."
      );
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
      throw new Error(
        "Sesi tidak ditemukan. Silakan login kembali."
      );
    }

    const result = await apiRequest("/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
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
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error(
        "[GROWERA] Logout API gagal:",
        error
      );
    } finally {
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
  // SESSION RESTORE
  // =========================================================

  async function restoreSession() {
    if (!getToken()) {
      setLoginVisible();
      return;
    }

    setBusy(true);

    try {
      await loadCurrentPlayer();
      setProfileVisible();
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

  loginForm?.addEventListener(
    "submit",
    handleLogin
  );

  $("#logoutButton")?.addEventListener(
    "click",
    handleLogout
  );

  $("#editPreviewButton")?.addEventListener(
    "click",
    () => {
      setMessage(
        "Pengubahan level dan gems harus dilakukan melalui sistem server."
      );
    }
  );

  $("#editForm")?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      if (editDialog?.open) {
        editDialog.close();
      }

      setMessage(
        "Edit preview tidak tersedia. Data pemain mengikuti server GROWERA."
      );
    }
  );

  $("#exploreButton")?.addEventListener(
    "click",
    () => {
      $("#editPreviewButton")?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  );

  // =========================================================
  // INITIALIZATION
  // =========================================================

  updateFooterYear();
  restoreSession();
})();
