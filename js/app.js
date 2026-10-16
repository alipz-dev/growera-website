(() => {
"use strict";
const $ = (s) => document.querySelector(s);
const loginView = $("#loginView"), profileView = $("#profileView"), loginForm = $("#loginForm");
const formMessage = $("#formMessage"), editDialog = $("#editDialog");
const player = { ...(window.GROWERA_DEMO_PLAYER || {}) };
const safeName = (v) => String(v || "Player").trim().slice(0, 24) || "Player";
const fmt = (v) => Number(v || 0).toLocaleString("en-US");
function renderProfile() {
 const name = safeName(player.username);
 $("#welcomeName").textContent = name; $("#profileName").textContent = name;
 $("#profileHandle").textContent = "@" + name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0,24);
 $("#avatarInitial").textContent = name.charAt(0).toUpperCase();
 $("#levelValue").textContent = fmt(player.level); $("#gemsValue").textContent = fmt(player.gems);
 const xp = Math.max(0, Number(player.xp) || 0), next = Math.max(1, Number(player.nextLevelXp) || 1);
 const percent = Math.min(100, Math.round(xp / next * 100));
 $("#xpPercent").textContent = percent + "%"; $("#xpFill").style.width = percent + "%";
 $("#xpCurrent").textContent = fmt(xp) + " XP"; $("#xpNext").textContent = fmt(next) + " XP";
}
function showProfile(username) {
 if (username) player.username = safeName(username);
 renderProfile(); loginView.classList.add("hidden"); profileView.classList.remove("hidden");
 window.scrollTo({top:0,behavior:"smooth"});
}
loginForm.addEventListener("submit", (e) => {
 e.preventDefault(); const username = $("#username").value.trim(), password = $("#password").value;
 if (!username || !password) { formMessage.textContent = "Please enter a username and password to continue."; return; }
 formMessage.textContent = ""; showProfile(username);
});
$("#logoutButton").addEventListener("click", () => {
 profileView.classList.add("hidden"); loginView.classList.remove("hidden"); $("#password").value = ""; formMessage.textContent = "";
 window.scrollTo({top:0,behavior:"smooth"});
});
$("#editPreviewButton").addEventListener("click", () => {
 $("#editUsername").value = player.username; $("#editLevel").value = player.level; $("#editGems").value = player.gems; editDialog.showModal();
});
$("#editForm").addEventListener("submit", (e) => {
 e.preventDefault(); const name = $("#editUsername").value.trim(), level = Number($("#editLevel").value), gems = Number($("#editGems").value);
 if (!name || !Number.isFinite(level) || !Number.isFinite(gems)) return;
 player.username = safeName(name); player.level = Math.max(1,Math.min(999,Math.floor(level)));
 player.gems = Math.max(0,Math.min(999999999,Math.floor(gems))); renderProfile(); editDialog.close();
});
$("#exploreButton").addEventListener("click", () => { $("#editPreviewButton").scrollIntoView({behavior:"smooth",block:"center"}); $("#editPreviewButton").focus({preventScroll:true}); });
$("#year").textContent = new Date().getFullYear(); $("#yearProfile").textContent = new Date().getFullYear();
})();
