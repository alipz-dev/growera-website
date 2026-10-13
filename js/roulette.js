/* GROWERA Crystal Roulette — UI DEMO ONLY */
(function () {
  "use strict";
  const PREFIX = "growera_roulette_demo_v1:";
  const DEFAULT = { daily: 2, online: 3 };
  const PRIZES = [
    {icon:"💎",name:"Crystal",prize:"25 Gems (DEMO)"},
    {icon:"🎁",name:"Mystery",prize:"Mystery Box (DEMO)"},
    {icon:"🪙",name:"Coins",prize:"100 Coins (DEMO)"},
    {icon:"✨",name:"Bonus",prize:"Bonus Reward (DEMO)"},
    {icon:"🧊",name:"Ice",prize:"Ice Crystal (DEMO)"},
    {icon:"👑",name:"Royal",prize:"Royal Chest (DEMO)"},
    {icon:"🌌",name:"Cosmic",prize:"Cosmic Fragment (DEMO)"},
    {icon:"💠",name:"Shard",prize:"Crystal Shard (DEMO)"}
  ];
  const $ = id => document.getElementById(id);
  let launcher, panel, overlay, wheel, spinBtn, statusEl;
  let selected = "daily", spinning = false, rotation = 0, accountKey = "";
  let state = {...DEFAULT};

  function username() {
    const name = $("headerUsername")?.textContent.trim();
    return name && name !== "Player" ? name : ($("username")?.value.trim() || "demo-player");
  }
  function dashboardVisible() {
    const el = $("dashboardScreen");
    return !!el && !el.classList.contains("hidden");
  }
  function loadState() {
    const key = PREFIX + username().toLowerCase();
    if (key === accountKey) return;
    accountKey = key;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      state = saved && Number.isFinite(saved.daily) && Number.isFinite(saved.online)
        ? {daily:Math.max(0,Math.floor(saved.daily)),online:Math.max(0,Math.floor(saved.online))}
        : {...DEFAULT};
    } catch (_) { state = {...DEFAULT}; }
    saveState();
  }
  function saveState() {
    try { localStorage.setItem(accountKey || PREFIX + username().toLowerCase(), JSON.stringify(state)); } catch (_) {}
  }
  function total() { return Math.max(0,state.daily) + Math.max(0,state.online); }
  function render() {
    $("rouletteLauncherTotal").textContent = total();
    $("roulettePanelTotal").textContent = total();
    $("rouletteDailyBalance").textContent = state.daily + (state.daily === 1 ? " point" : " points");
    $("rouletteOnlineBalance").textContent = state.online + (state.online === 1 ? " point" : " points");
    launcher.hidden = !dashboardVisible() || total() <= 0;
    spinBtn.disabled = spinning || state[selected] <= 0;
    document.querySelectorAll(".roulette-type").forEach(b => {
      b.classList.toggle("is-selected", b.dataset.rouletteType === selected);
      b.setAttribute("aria-pressed", b.dataset.rouletteType === selected ? "true" : "false");
    });
  }
  function status(text) { statusEl.textContent = text; }
  function openPanel() {
    loadState();
    if (!dashboardVisible() || total() <= 0) return;
    render(); panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launcher.setAttribute("aria-expanded","true");
  }
  function closePanel() {
    if (!panel) return;
    panel.classList.remove("is-open"); panel.hidden = true;
    launcher?.setAttribute("aria-expanded","false");
  }
  function closeWin() {
    if (!overlay) return;
    overlay.classList.remove("is-open"); overlay.hidden = true;
    overlay.querySelectorAll(".roulette-particle").forEach(p => p.remove());
  }
  function particles() {
    const rect = $("rouletteWinCard").getBoundingClientRect();
    const colors = ["#65E7FF","#9B7BFF","#F1CC78","#58FFAD","#FFFFFF"];
    for (let i=0;i<30;i++) {
      const p=document.createElement("i"); p.className="roulette-particle";
      p.style.setProperty("--particle-x",(rect.left+rect.width/2)+"px");
      p.style.setProperty("--particle-y",(rect.top+rect.height/2)+"px");
      p.style.setProperty("--particle-dx",(Math.random()*360-180)+"px");
      p.style.setProperty("--particle-dy",(Math.random()*420-230)+"px");
      p.style.setProperty("--particle-color",colors[i%colors.length]);
      p.style.setProperty("--particle-duration",(.75+Math.random()*.8)+"s");
      overlay.appendChild(p); p.addEventListener("animationend",()=>p.remove(),{once:true});
    }
  }
  function win(prize) {
    $("rouletteWinIcon").textContent=prize.icon;
    $("rouletteWinPrize").textContent=prize.prize;
    overlay.hidden=false; overlay.classList.add("is-open"); particles();
  }
  function select(type) {
    if (spinning) return;
    selected=type;
    $("rouletteWheelHeading").textContent=type==="daily"?"DAILY ROULETTE":"ONLINE ROULETTE";
    status(type==="daily"?"Gunakan poin Daily untuk memutar roda.":"Gunakan poin Online untuk memutar roda.");
    render();
  }
  function spin() {
    if (spinning || state[selected] <= 0) return;
    spinning=true; state[selected]--; saveState(); render();
    status("Crystal wheel sedang berputar..."); spinBtn.textContent="SPINNING...";
    const winner=Math.floor(Math.random()*PRIZES.length), seg=360/PRIZES.length;
    const current=((rotation%360)+360)%360;
    const target=(360-winner*seg)%360;
    rotation += 360*6 + ((target-current+360)%360);
    wheel.style.transition="transform 5.2s cubic-bezier(.10,.72,.08,1)";
    wheel.style.transform="rotate("+rotation+"deg)";
    setTimeout(()=>{
      spinning=false; spinBtn.textContent="✦ SPIN ROULETTE · 1 POINT";
      status("Putaran selesai. Hadiah demo berhasil didapatkan!");
      render(); win(PRIZES[winner]);
      if(total()<=0) closePanel();
    },5350);
  }
  function drawLabels() {
    PRIZES.forEach((p,i)=>{
      const label=document.createElement("div"); label.className="roulette-wheel-label";
      label.style.transform="rotate("+(i*45)+"deg) translateY(-82px) rotate("+(-i*45)+"deg)";
      const icon=document.createElement("span"); icon.textContent=p.icon;
      const name=document.createElement("b"); name.textContent=p.name;
      label.append(icon,name); wheel.appendChild(label);
    });
  }
  function init() {
    launcher=$("rouletteLauncher"); panel=$("roulettePanel"); overlay=$("rouletteWinOverlay");
    wheel=$("rouletteWheel"); spinBtn=$("rouletteSpinBtn"); statusEl=$("rouletteWheelStatus");
    if(!launcher||!panel||!overlay||!wheel||!spinBtn) { console.error("[GROWERA ROULETTE] Markup belum lengkap."); return; }
    loadState(); drawLabels();
    launcher.addEventListener("click",()=>panel.classList.contains("is-open")?closePanel():openPanel());
    $("rouletteCloseBtn").addEventListener("click",closePanel);
    spinBtn.addEventListener("click",spin);
    $("rouletteWinCloseBtn").addEventListener("click",closeWin);
    overlay.addEventListener("click",e=>{if(e.target===overlay)closeWin();});
    document.querySelectorAll(".roulette-type").forEach(b=>b.addEventListener("click",()=>select(b.dataset.rouletteType)));
    document.addEventListener("keydown",e=>{if(e.key==="Escape"){closePanel();closeWin();}});
    ["logoutButton","sidebarLogoutButton"].forEach(id=>$(id)?.addEventListener("click",()=>{closePanel();closeWin();}));
    const dashboard=$("dashboardScreen");
    if(dashboard&&"MutationObserver"in window)new MutationObserver(()=>{
      if(!dashboardVisible()){closePanel();closeWin();launcher.hidden=true;}
      else {loadState();render();}
    }).observe(dashboard,{attributes:true,attributeFilter:["class","style"]});
    const nameEl=$("headerUsername");
    if(nameEl&&"MutationObserver"in window)new MutationObserver(()=>{if(dashboardVisible()){loadState();render();}}).observe(nameEl,{childList:true,characterData:true,subtree:true});
    window.addEventListener("storage",e=>{if(e.key===accountKey){loadState();render();}});
    select("daily");
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init); else init();
  window.GroweraRoulette={
    close:closePanel,closeWin:closeWin,refresh:function(){loadState();render();},
    setDemoPoints:function(daily,online){state.daily=Math.max(0,Math.floor(Number(daily)||0));state.online=Math.max(0,Math.floor(Number(online)||0));saveState();render();}
  };
})();
