/* =========================================
   GROWERA — REWARDS MODULE (v2, item icons)
========================================= */

(function () {
    "use strict";

    const API_REWARDS_PUBLIC_URL = "/api/growera/rewards";
    const API_REWARDS_ADMIN_URL  = "/api/growera/admin/rewards";
    const API_QUEST_CONFIG_URL   = "/api/growera/admin/quest-config";
    const API_QUESTS_URL         = "/api/growera/quests";
    const API_QUEST_CLAIM_URL    = "/api/growera/quests/claim";

    const CATEGORY_ICONS = {
        "milestone":     1458,
        "daily-login":   1360,
        "daily-quest":   94,
        "weekly-quest":  7162,
        "monthly-quest": 4820
    };

    const REWARD_CATEGORIES = {
        "milestone": {
            key: "milestone", eyebrow: "MILESTONE REWARDS", title: "Milestone",
            subtitle: "Reach new milestones and unlock your legacy.",
            iconId: 1458, variant: "milestone", actionLabel: "View Rewards",
            modalSubtitle: "Every achievement tells a story."
        },
        "daily-login": {
            key: "daily-login", eyebrow: "DAILY LOGIN", title: "Daily Login",
            subtitle: "Return every day. Discover new rewards.",
            iconId: 1360, variant: "daily-login", actionLabel: "View Rewards",
            modalSubtitle: "Return every day. Discover new rewards."
        },
        "daily-quest": {
            key: "daily-quest", eyebrow: "DAILY QUEST", title: "Daily Quest",
            subtitle: "Complete your daily challenges.",
            iconId: 94, variant: "daily-quest", actionLabel: "View Quests",
            modalSubtitle: "Crystal Challenges"
        },
        "weekly-quest": {
            key: "weekly-quest", eyebrow: "WEEKLY QUEST", title: "Weekly Quest",
            subtitle: "Take on greater challenges every week.",
            iconId: 7162, variant: "weekly-quest", actionLabel: "View Quests",
            modalSubtitle: "Weekly Trials"
        },
        "monthly-quest": {
            key: "monthly-quest", eyebrow: "MONTHLY QUEST", title: "Monthly Quest",
            subtitle: "One month. Greater challenges. Legendary rewards.",
            iconId: 4820, variant: "monthly-quest", actionLabel: "Explore Monthly",
            modalSubtitle: "Legendary Trials"
        }
    };

    const RARITY_LABELS = {
        common: "Common", rare: "Rare", epic: "Epic",
        legendary: "Legendary", divine: "Divine"
    };

    const RARITY_ICONS = {
        common: 164, rare: 174, epic: 262, legendary: 4820, divine: 3916
    };

    const rewardsState = { items: [], editingId: null, mode: "create", filter: "all", loaded: false };
    const questState = { progressByRewardId: {}, loaded: false, loading: false };

    function iconImg(id, size) {
        if (window.GroweraIcon) return window.GroweraIcon.img(id, size);
        var i = document.createElement("img");
        i.src = "/assets/itemimage/" + id + ".png";
        i.width = size; i.height = size;
        i.style.cssText = "width:" + size + "px;height:" + size + "px;object-fit:contain;image-rendering:pixelated";
        return i;
    }

    function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value; }
    function getVal(id) { const el = document.getElementById(id); return el ? String(el.value).trim() : ""; }
    function getProgressFor(rewardId) { if (!rewardId) return null; return questState.progressByRewardId[rewardId] || null; }

    function renderRewardsCards() {
        const grid = document.getElementById("rewardsGrid");
        if (!grid) return;
        grid.replaceChildren();

        Object.values(REWARD_CATEGORIES).forEach(function (cat) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "rewards-card";
            card.dataset.variant = cat.variant;

            const icon = document.createElement("div");
            icon.className = "rewards-card-icon";
            icon.appendChild(iconImg(cat.iconId, 40));

            const label = document.createElement("div");
            label.className = "rewards-card-label";
            label.textContent = cat.eyebrow;

            const title = document.createElement("h3");
            title.className = "rewards-card-title";
            title.textContent = cat.title;

            const desc = document.createElement("p");
            desc.className = "rewards-card-desc";
            desc.textContent = cat.subtitle;

            const action = document.createElement("div");
            action.className = "rewards-card-action";
            const actionLabel = document.createElement("span");
            actionLabel.textContent = cat.actionLabel;
            const arrow = document.createElement("span");
            arrow.className = "rewards-card-arrow";
            arrow.textContent = "→";
            action.appendChild(actionLabel);
            action.appendChild(arrow);

            card.appendChild(icon);
            card.appendChild(label);
            card.appendChild(title);
            card.appendChild(desc);
            card.appendChild(action);

            card.addEventListener("click", function () { openRewardsModal(cat.key); });
            grid.appendChild(card);
        });
    }

    async function loadPublicRewards() {
        try {
            const response = await fetch(API_REWARDS_PUBLIC_URL, { cache: "no-store" });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) {
                rewardsState.items = []; rewardsState.loaded = true; return;
            }
            rewardsState.items = Array.isArray(data.rewards) ? data.rewards : [];
            rewardsState.loaded = true;
        } catch (err) {
            console.warn("[GROWERA REWARDS] Load public rewards failed:", err);
            rewardsState.items = []; rewardsState.loaded = true;
        }
    }

    async function loadPlayerQuests() {
        const session = loadSession();
        if (!session || !session.token) {
            questState.progressByRewardId = {}; questState.loaded = true; return;
        }
        if (questState.loading) return;
        questState.loading = true;

        try {
            const response = await fetch(API_QUESTS_URL, {
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) {
                questState.progressByRewardId = {}; questState.loaded = true; return;
            }
            const map = {};
            (data.quests || []).forEach(function (q) {
                map[q.id] = {
                    current: Number(q.current) || 0,
                    completed: q.completed === true,
                    claimed: q.claimed === true,
                    targetValue: Number(q.targetValue) || 0
                };
            });
            questState.progressByRewardId = map;
            questState.loaded = true;
        } catch (err) {
            console.warn("[GROWERA REWARDS] Load player quests failed:", err);
            questState.progressByRewardId = {}; questState.loaded = true;
        } finally {
            questState.loading = false;
        }
    }

    function buildClaimButton(item) {
        const p = getProgressFor(item.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reward-claim-btn";

        if (p && p.claimed) {
            btn.classList.add("claimed");
            btn.disabled = true;
            btn.appendChild(iconImg(204, 14));
            btn.appendChild(document.createTextNode(" Claimed"));
            return btn;
        }

        if (p && p.completed) {
            btn.classList.add("ready");
            btn.appendChild(iconImg(1360, 14));
            btn.appendChild(document.createTextNode(" Claim"));
            btn.addEventListener("click", function (ev) { ev.stopPropagation(); claimQuest(item.id, btn); });
            return btn;
        }

        btn.classList.add("locked");
        btn.disabled = true;

        const target = Number(item.targetValue) || Number(p && p.targetValue) || Number(item.progress) || 0;
        const current = p ? Number(p.current) || 0 : 0;

        btn.appendChild(iconImg(202, 14));
        btn.appendChild(document.createTextNode(" " + (target > 0 ? (current + " / " + target) : "Locked")));
        return btn;
    }

    async function claimQuest(rewardId, btn) {
        const session = loadSession();
        if (!session || !session.token) return;
        if (btn) { btn.disabled = true; btn.textContent = "…"; }

        try {
            const response = await fetch(API_QUEST_CLAIM_URL, {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ rewardId: rewardId }),
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || ("HTTP " + response.status));

            await loadPlayerQuests();

            const modal = document.getElementById("rewardsModal");
            const content = document.getElementById("rewardsModalContent");
            if (modal && modal.classList.contains("open") && content) openRewardsModal(content.dataset.variant);

            alert(data.message || "Reward diklaim!");
        } catch (err) {
            alert("Gagal klaim: " + err.message);
            if (btn) {
                const p = getProgressFor(rewardId);
                if (p && p.completed && !p.claimed) { btn.disabled = false; btn.textContent = "🎁 Claim"; }
                else btn.disabled = true;
            }
        }
    }

    function openRewardsModal(categoryKey) {
        const cat = REWARD_CATEGORIES[categoryKey];
        if (!cat) return;
        const modal = document.getElementById("rewardsModal");
        const content = document.getElementById("rewardsModalContent");
        const icon = document.getElementById("rewardsModalIcon");
        const title = document.getElementById("rewardsModalTitle");
        const subtitle = document.getElementById("rewardsModalSubtitle");
        if (!modal || !content) return;

        content.dataset.variant = cat.variant;
        icon.replaceChildren(iconImg(cat.iconId, 32));
        title.textContent = cat.eyebrow;
        subtitle.textContent = cat.modalSubtitle;

        renderRewardsModalBody(categoryKey);
        modal.classList.add("open");
        const body = document.getElementById("rewardsModalBody");
        if (body) body.scrollTop = 0;
    }

    function closeRewardsModal() {
        const modal = document.getElementById("rewardsModal");
        if (modal) modal.classList.remove("open");
    }

    function getPublishedRewardsByCategory(categoryKey) {
        return rewardsState.items
            .filter(function (it) {
                return it && it.category === categoryKey && (it.status === "published" || !it.status);
            })
            .sort(function (a, b) {
                const oa = Number(a.order) || 0;
                const ob = Number(b.order) || 0;
                if (oa !== ob) return oa - ob;
                return String(a.name || "").localeCompare(String(b.name || ""));
            });
    }

    function renderRewardsModalBody(categoryKey) {
        const body = document.getElementById("rewardsModalBody");
        if (!body) return;
        body.replaceChildren();
        const items = getPublishedRewardsByCategory(categoryKey);
        if (items.length === 0) { body.appendChild(renderRewardsEmptyState()); return; }
        if (categoryKey === "milestone") { renderMilestoneBody(body, items); return; }
        if (categoryKey === "daily-login") { renderDailyLoginBody(body, items); return; }
        if (categoryKey === "monthly-quest") { renderMonthlyQuestBody(body, items); return; }
        renderRewardsListBody(body, items);
    }

    function renderRewardsEmptyState() {
        const wrap = document.createElement("div");
        wrap.className = "rewards-empty";
        const icon = document.createElement("span");
        icon.className = "rewards-empty-icon";
        icon.appendChild(iconImg(202, 40));
        const line1 = document.createElement("div");
        line1.textContent = "Belum ada reward untuk kategori ini.";
        const line2 = document.createElement("div");
        line2.style.marginTop = "6px";
        line2.style.fontSize = "10.5px";
        line2.style.letterSpacing = "1.5px";
        line2.style.textTransform = "uppercase";
        line2.style.fontFamily = "monospace";
        line2.textContent = "COMING SOON";
        wrap.appendChild(icon);
        wrap.appendChild(line1);
        wrap.appendChild(line2);
        return wrap;
    }

    function rewardRarityClass(rarity) {
        const valid = ["common", "rare", "epic", "legendary", "divine"];
        const r = valid.includes(rarity) ? rarity : "common";
        return "rarity-" + r;
    }

    function renderRewardsListBody(body, items) {
        const label = document.createElement("div");
        label.className = "rewards-modal-section-label";
        label.textContent = "Available Rewards";
        body.appendChild(label);
        items.forEach(function (item) { body.appendChild(buildRewardItemRow(item)); });
    }

    function buildRewardItemRow(item) {
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);

        const row = document.createElement("div");
        row.className = "reward-item " + rarityClass;

        const icon = document.createElement("div");
        icon.className = "reward-item-icon";
        var itemIconId = parseInt(item.icon, 10);
        if (isNaN(itemIconId) || itemIconId <= 0) itemIconId = 1458;
        icon.appendChild(iconImg(itemIconId, 36));

        const content = document.createElement("div");
        content.className = "reward-item-content";

        const name = document.createElement("h3");
        name.className = "reward-item-name";
        name.textContent = item.name || "Untitled Reward";

        const desc = document.createElement("p");
        desc.className = "reward-item-desc";
        desc.textContent = item.description || "";

        const p = getProgressFor(item.id);
        const targetVal = Number(item.targetValue) || Number(item.progress) || 0;

        if (targetVal > 0) {
            const progWrap = document.createElement("div");
            progWrap.className = "reward-item-progress-wrap";

            const bar = document.createElement("div");
            bar.className = "reward-item-progress-bar";
            const fill = document.createElement("div");
            fill.className = "reward-item-progress-fill";
            const current = p ? Number(p.current) || 0 : 0;
            fill.style.width = Math.min(100, (current / targetVal) * 100) + "%";
            if (p && p.claimed) fill.classList.add("claimed");
            else if (p && p.completed) fill.classList.add("completed");
            bar.appendChild(fill);

            const txt = document.createElement("div");
            txt.className = "reward-item-progress-text";
            txt.textContent = current + " / " + targetVal;

            progWrap.appendChild(bar);
            progWrap.appendChild(txt);
            content.appendChild(name);
            if (item.description) content.appendChild(desc);
            content.appendChild(progWrap);
        } else {
            content.appendChild(name);
            if (item.description) content.appendChild(desc);
        }

        const footer = document.createElement("div");
        footer.className = "reward-item-footer";

        const left = document.createElement("div");
        left.className = "reward-item-footer-left";

        const rarityBadge = document.createElement("span");
        rarityBadge.className = "reward-item-rarity";
        rarityBadge.appendChild(iconImg(RARITY_ICONS[rarity] || 164, 12));
        rarityBadge.appendChild(document.createTextNode(" " + (RARITY_LABELS[rarity] || "Common")));
        left.appendChild(rarityBadge);

        const right = document.createElement("div");
        right.className = "reward-item-footer-right";

        if (item.reward) {
            const rewardEl = document.createElement("span");
            rewardEl.className = "reward-item-reward";
            rewardEl.appendChild(iconImg(1360, 12));
            rewardEl.appendChild(document.createTextNode(" " + item.reward));
            right.appendChild(rewardEl);
        }

        right.appendChild(buildClaimButton(item));
        footer.appendChild(left);
        footer.appendChild(right);
        content.appendChild(footer);

        row.appendChild(icon);
        row.appendChild(content);
        return row;
    }

    function renderDailyLoginBody(body, items) {
        const label = document.createElement("div");
        label.className = "rewards-modal-section-label";
        label.textContent = "7-Day Login Calendar";
        body.appendChild(label);

        const grid = document.createElement("div");
        grid.className = "rewards-login-grid";

        const sorted = items.slice().sort(function (a, b) {
            const da = Number(a.day) || Number(a.order) || 0;
            const db = Number(b.day) || Number(b.order) || 0;
            return da - db;
        });

        sorted.forEach(function (item) {
            const rarity = item.rarity || "common";
            const rarityClass = rewardRarityClass(rarity);

            const day = document.createElement("div");
            day.className = "rewards-login-day " + rarityClass;

            const labelEl = document.createElement("div");
            labelEl.className = "rewards-login-day-label";
            labelEl.textContent = "Day " + (item.day || item.order || "?");

            const iconEl = document.createElement("div");
            iconEl.className = "rewards-login-day-icon";
            var itemIconId = parseInt(item.icon, 10);
            if (isNaN(itemIconId) || itemIconId <= 0) itemIconId = 1360;
            iconEl.appendChild(iconImg(itemIconId, 32));

            const nameEl = document.createElement("div");
            nameEl.className = "rewards-login-day-name";
            nameEl.textContent = item.name || "Reward";

            const rarityEl = document.createElement("div");
            rarityEl.className = "rewards-login-day-rarity";
            rarityEl.textContent = RARITY_LABELS[rarity] || "Common";

            const claimWrap = document.createElement("div");
            claimWrap.className = "rewards-login-day-claim";
            claimWrap.appendChild(buildClaimButton(item));

            day.appendChild(labelEl);
            day.appendChild(iconEl);
            day.appendChild(nameEl);
            day.appendChild(rarityEl);
            day.appendChild(claimWrap);
            grid.appendChild(day);
        });

        body.appendChild(grid);

        const note = document.createElement("p");
        note.style.margin = "14px 0 0";
        note.style.color = "var(--muted)";
        note.style.fontSize = "11px";
        note.style.lineHeight = "1.6";
        note.style.textAlign = "center";
        note.textContent = "Login streak dihitung otomatis saat kamu masuk server.";
        body.appendChild(note);
    }

    function renderMonthlyQuestBody(body, items) {
        const heroItem = items.find(function (it) { return it.featured; }) || items[0];
        const rest = items.filter(function (it) { return it !== heroItem; });

        if (heroItem) {
            const hero = document.createElement("div");
            hero.className = "rewards-monthly-hero";

            const label = document.createElement("div");
            label.className = "rewards-monthly-hero-label";
            label.textContent = "FEATURED MONTHLY REWARD";

            const title = document.createElement("h3");
            title.className = "rewards-monthly-hero-title";
            title.textContent = heroItem.name || "Crystal Sovereign";

            const desc = document.createElement("p");
            desc.className = "rewards-monthly-hero-desc";
            desc.textContent = heroItem.description || "";

            const emblem = document.createElement("div");
            emblem.className = "rewards-monthly-hero-emblem";
            emblem.appendChild(iconImg(4820, 56));

            const claimWrap = document.createElement("div");
            claimWrap.style.marginTop = "14px";
            claimWrap.appendChild(buildClaimButton(heroItem));

            hero.appendChild(label);
            hero.appendChild(title);
            if (heroItem.description) hero.appendChild(desc);
            hero.appendChild(emblem);
            hero.appendChild(claimWrap);
            body.appendChild(hero);
        }

        if (rest.length > 0) {
            const listLabel = document.createElement("div");
            listLabel.className = "rewards-modal-section-label";
            listLabel.textContent = "Legendary Challenges";
            body.appendChild(listLabel);
            rest.forEach(function (item) { body.appendChild(buildRewardItemRow(item)); });
        }
    }

    function renderMilestoneBody(body, items) {
        if (!items.length) { body.appendChild(renderRewardsEmptyState()); return; }

        const panel = document.createElement("div");
        panel.className = "milestone-panel";

        let unlockedCount = 0;
        items.forEach(function (it) {
            const p = getProgressFor(it.id);
            if (p && (p.completed || p.claimed)) unlockedCount++;
        });

        const header = document.createElement("div");
        header.className = "milestone-header";

        const left = document.createElement("div");
        left.className = "milestone-header-left";

        const hTitle = document.createElement("div");
        hTitle.className = "milestone-header-title";
        hTitle.textContent = "MILESTONE PROGRESS";

        const bar = document.createElement("div");
        bar.className = "milestone-progress-bar";
        const fill = document.createElement("div");
        fill.className = "milestone-progress-fill";
        const pct = items.length > 0 ? (unlockedCount / items.length) * 100 : 0;
        fill.style.width = pct + "%";
        bar.appendChild(fill);
        left.appendChild(hTitle);
        left.appendChild(bar);

        const count = document.createElement("div");
        count.className = "milestone-header-count";
        count.textContent = unlockedCount + " / " + items.length;

        header.appendChild(left);
        header.appendChild(count);
        panel.appendChild(header);

        const scroll = document.createElement("div");
        scroll.className = "milestone-track-scroll";

        const track = document.createElement("div");
        track.className = "milestone-track";

        const nodeRefs = [];

        items.forEach(function (item, idx) {
            const node = buildMilestoneNode(item, idx);
            nodeRefs.push(node);
            track.appendChild(node);
            if (idx < items.length - 1) {
                const connector = document.createElement("div");
                connector.className = "milestone-connector";
                const p = getProgressFor(item.id);
                if (p && (p.completed || p.claimed)) connector.classList.add("done");
                track.appendChild(connector);
            }
        });

        scroll.appendChild(track);
        panel.appendChild(scroll);

        const detail = document.createElement("div");
        detail.className = "milestone-detail";
        panel.appendChild(detail);

        function showDetail(index) {
            nodeRefs.forEach(function (n, i) { n.classList.toggle("active", i === index); });
            renderMilestoneDetail(detail, items[index]);
            const node = nodeRefs[index];
            if (node && scroll.scrollWidth > scroll.clientWidth) {
                const targetLeft = node.offsetLeft - (scroll.clientWidth / 2) + (node.offsetWidth / 2);
                scroll.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
            }
        }

        nodeRefs.forEach(function (n, i) { n.addEventListener("click", function () { showDetail(i); }); });
        showDetail(0);
        body.appendChild(panel);
    }

    function buildMilestoneNode(item, index) {
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);
        const p = getProgressFor(item.id);
        const unlocked = (p && (p.completed || p.claimed));
        const claimable = p && p.completed && !p.claimed;

        const node = document.createElement("button");
        node.type = "button";
        node.className = "milestone-node " + rarityClass + (unlocked ? " unlocked" : " locked") + (claimable ? " claimable" : "");

        const box = document.createElement("div");
        box.className = "milestone-node-box";
        var itemIconId = parseInt(item.icon, 10);
        if (isNaN(itemIconId) || itemIconId <= 0) itemIconId = 1458;
        box.appendChild(iconImg(itemIconId, 28));

        if (!unlocked) {
            const lock = document.createElement("div");
            lock.className = "milestone-node-lock";
            lock.appendChild(iconImg(202, 12));
            box.appendChild(lock);
        }

        const label = document.createElement("div");
        label.className = "milestone-node-label";
        label.textContent = (item.questType === "levelup" && item.targetValue) ? ("Lv " + item.targetValue) : ("M" + (index + 1));

        node.appendChild(box);
        node.appendChild(label);
        return node;
    }

    function renderMilestoneDetail(container, item) {
        container.replaceChildren();
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);
        container.className = "milestone-detail " + rarityClass;

        const p = getProgressFor(item.id);
        const unlocked = p && (p.completed || p.claimed);

        const badge = document.createElement("span");
        badge.className = "milestone-detail-badge";
        badge.textContent = RARITY_LABELS[rarity] || "Common";
        container.appendChild(badge);

        const title = document.createElement("h3");
        title.className = "milestone-detail-title";
        title.textContent = item.name || "Untitled Milestone";
        container.appendChild(title);

        if (item.description) {
            const desc = document.createElement("p");
            desc.className = "milestone-detail-desc";
            desc.textContent = item.description;
            container.appendChild(desc);
        }

        const targetVal = Number(item.targetValue) || 0;
        if (targetVal > 0) {
            const progWrap = document.createElement("div");
            progWrap.className = "reward-item-progress-wrap";
            const bar = document.createElement("div");
            bar.className = "reward-item-progress-bar";
            const fill = document.createElement("div");
            fill.className = "reward-item-progress-fill";
            const current = p ? Number(p.current) || 0 : 0;
            fill.style.width = Math.min(100, (current / targetVal) * 100) + "%";
            if (p && p.claimed) fill.classList.add("claimed");
            else if (p && p.completed) fill.classList.add("completed");
            bar.appendChild(fill);
            const txt = document.createElement("div");
            txt.className = "reward-item-progress-text";
            txt.textContent = current + " / " + targetVal;
            progWrap.appendChild(bar);
            progWrap.appendChild(txt);
            container.appendChild(progWrap);
        }

        if (item.reward) {
            const rewardWrap = document.createElement("div");
            rewardWrap.className = "milestone-detail-reward";
            rewardWrap.appendChild(iconImg(1360, 14));
            rewardWrap.appendChild(document.createTextNode(" " + item.reward));
            container.appendChild(rewardWrap);
        }

        const statusRow = document.createElement("div");
        statusRow.className = "milestone-detail-status-row";

        const status = document.createElement("span");
        status.className = "milestone-detail-status " + (unlocked ? "unlocked" : "locked");
        status.appendChild(iconImg(unlocked ? 204 : 202, 12));
        status.appendChild(document.createTextNode(unlocked ? " Unlocked" : " Locked"));

        statusRow.appendChild(status);
        statusRow.appendChild(buildClaimButton(item));
        container.appendChild(statusRow);
    }

    async function loadQuestConfig() {
        const session = loadSession();
        if (!session.token) return;
        try {
            const response = await fetch(API_QUEST_CONFIG_URL, {
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) return;
            const select = document.getElementById("rewardsFormQuestType");
            if (!select) return;
            const previous = select.value;
            select.replaceChildren();
            (data.groups || []).forEach(function (g) {
                const og = document.createElement("optgroup");
                og.label = g.group;
                (g.types || []).forEach(function (t) {
                    const opt = document.createElement("option");
                    opt.value = t.id;
                    opt.textContent = t.name;
                    og.appendChild(opt);
                });
                select.appendChild(og);
            });
            if (previous) select.value = previous;
        } catch (err) {
            console.warn("[GROWERA REWARDS] Quest config failed:", err);
        }
    }

    async function loadAdminRewards() {
        const container = document.getElementById("rewardsAdminList");
        if (!container) return;
        container.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Memuat reward...</p>';

        const session = loadSession();
        if (!session.token) {
            container.innerHTML = '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Token tidak ditemukan.</p>';
            return;
        }

        try {
            const response = await fetch(API_REWARDS_ADMIN_URL, {
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            rewardsState.items = Array.isArray(data.rewards) ? data.rewards : [];
            renderAdminRewardsList();
        } catch (err) {
            container.innerHTML = '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Gagal memuat: ' + err.message + '</p>';
        }
    }

    function renderAdminRewardsList() {
        const container = document.getElementById("rewardsAdminList");
        if (!container) return;

        const filter = rewardsState.filter || "all";
        const list = rewardsState.items
            .filter(function (it) { return filter === "all" || it.category === filter; })
            .sort(function (a, b) {
                const ca = String(a.category || "");
                const cb = String(b.category || "");
                if (ca !== cb) return ca.localeCompare(cb);
                return (Number(a.order) || 0) - (Number(b.order) || 0);
            });

        if (list.length === 0) {
            container.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:30px">Belum ada reward.<br>Klik "+ Baru" untuk mulai.</p>';
            return;
        }

        container.innerHTML = "";

        list.forEach(function (item) {
            const cat = REWARD_CATEGORIES[item.category];
            const rarity = item.rarity || "common";
            const rarityClass = rewardRarityClass(rarity);

            const row = document.createElement("div");
            row.className = "news-list-item";

            const content = document.createElement("div");
            content.className = "news-list-item-content";

            const header = document.createElement("div");
            header.className = "news-list-item-header";

            const statusBadge = document.createElement("span");
            statusBadge.className = "news-status-badge " + (item.status === "published" ? "published" : "draft");
            statusBadge.textContent = item.status || "draft";

            const catBadge = document.createElement("span");
            catBadge.className = "news-status-badge";
            catBadge.style.background = "rgba(155, 123, 255, 0.12)";
            catBadge.style.border = "1px solid rgba(155, 123, 255, 0.3)";
            catBadge.style.color = "#C7B8FF";
            catBadge.appendChild(iconImg(CATEGORY_ICONS[item.category] || 1458, 12));
            catBadge.appendChild(document.createTextNode(" " + (cat ? cat.title : item.category)));

            const rarityBadge = document.createElement("span");
            rarityBadge.className = "news-status-badge " + rarityClass;
            rarityBadge.style.background = "rgba(255,255,255,0.04)";
            rarityBadge.style.border = "1px solid var(--rarity-color, rgba(130,160,210,0.3))";
            rarityBadge.style.color = "var(--rarity-color, var(--muted))";
            rarityBadge.textContent = RARITY_LABELS[rarity] || "Common";

            const typeBadge = document.createElement("span");
            typeBadge.className = "news-status-badge";
            typeBadge.style.background = "rgba(101, 231, 255, 0.08)";
            typeBadge.style.border = "1px solid rgba(101, 231, 255, 0.25)";
            typeBadge.style.color = "var(--cyan)";
            typeBadge.textContent = item.questType || "custom";

            const title = document.createElement("h3");
            title.className = "news-list-item-title";
            var itemIconId = parseInt(item.icon, 10);
            if (!isNaN(itemIconId) && itemIconId > 0) title.appendChild(iconImg(itemIconId, 16));
            title.appendChild(document.createTextNode(" " + (item.name || "Untitled")));

            header.appendChild(statusBadge);
            header.appendChild(catBadge);
            header.appendChild(rarityBadge);
            header.appendChild(typeBadge);
            header.appendChild(title);

            const excerpt = document.createElement("p");
            excerpt.className = "news-list-item-excerpt";
            excerpt.textContent = item.description || "(tanpa deskripsi)";

            const meta = document.createElement("div");
            meta.className = "news-list-item-meta";
            const targetText = "target " + (item.targetName || "*") + " × " + (item.targetValue || 1);
            const rewardText = item.reward ? (" · " + item.reward) : "";
            meta.textContent = "order " + (item.order || 0) + " · " + targetText + rewardText + " · " + formatDateTime(item.updatedAt);

            content.appendChild(header);
            content.appendChild(excerpt);
            content.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "news-list-item-actions";

            const editBtn = document.createElement("button");
            editBtn.className = "news-action-btn edit";
            editBtn.type = "button";
            editBtn.appendChild(iconImg(3494, 14));
            editBtn.appendChild(document.createTextNode(" Edit"));
            editBtn.addEventListener("click", function () { editReward(item.id); });

            const delBtn = document.createElement("button");
            delBtn.className = "news-action-btn delete";
            delBtn.type = "button";
            delBtn.appendChild(iconImg(856, 14));
            delBtn.appendChild(document.createTextNode(" Hapus"));
            delBtn.addEventListener("click", function () { deleteReward(item.id, item.name); });

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);

            row.appendChild(content);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }

    function resetRewardsForm() {
        setVal("rewardsFormCategory", "milestone");
        setVal("rewardsFormName", "");
        setVal("rewardsFormDescription", "");
        setVal("rewardsFormIcon", "");
        setVal("rewardsFormRarity", "common");
        setVal("rewardsFormQuestType", "custom");
        setVal("rewardsFormDay", "");
        setVal("rewardsFormTarget", "");
        setVal("rewardsFormTargetValue", "1");
        setVal("rewardsFormRewardItem", "");
        setVal("rewardsFormRewardCount", "1");
        setVal("rewardsFormRewardGems", "0");
        setVal("rewardsFormOrder", "0");
        setVal("rewardsFormStatus", "draft");
        rewardsState.mode = "create";
        rewardsState.editingId = null;
        document.getElementById("rewardsFormTitle").textContent = "Buat Reward Baru";
    }

    function fillRewardsForm(item) {
        setVal("rewardsFormCategory", item.category || "milestone");
        setVal("rewardsFormName", item.name || "");
        setVal("rewardsFormDescription", item.description || "");
        setVal("rewardsFormIcon", item.icon || "");
        setVal("rewardsFormRarity", item.rarity || "common");
        setVal("rewardsFormQuestType", item.questType || "custom");
        setVal("rewardsFormDay", item.day ? item.day : "");
        setVal("rewardsFormTarget", item.targetName || "");
        setVal("rewardsFormTargetValue", item.targetValue || 1);
        setVal("rewardsFormRewardItem", item.rewardItem || "");
        setVal("rewardsFormRewardCount", item.rewardCount || 0);
        setVal("rewardsFormRewardGems", item.rewardGems || 0);
        setVal("rewardsFormOrder", item.order !== undefined && item.order !== null ? item.order : 0);
        setVal("rewardsFormStatus", item.status || "draft");
        rewardsState.mode = "edit";
        rewardsState.editingId = item.id;
        document.getElementById("rewardsFormTitle").textContent = "Edit Reward";
    }

    async function editReward(id) {
        const session = loadSession();
        if (!session.token) return;
        try {
            const response = await fetch(API_REWARDS_ADMIN_URL + "/" + id, {
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            await loadQuestConfig();
            fillRewardsForm(data.reward);
            showEditorView("rewards-form");
        } catch (err) {
            alert("Gagal memuat reward: " + err.message);
        }
    }

    async function deleteReward(id, name) {
        if (!confirm('Hapus reward "' + (name || "ini") + '"?\n\nTindakan ini tidak bisa dibatalkan.')) return;
        const session = loadSession();
        if (!session.token) return;
        try {
            const response = await fetch(API_REWARDS_ADMIN_URL + "/" + id, {
                method: "DELETE",
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            alert("Reward dihapus.");
            await loadAdminRewards();
            await loadPublicRewards();
        } catch (err) {
            alert("Gagal menghapus: " + err.message);
        }
    }

    async function saveReward(status) {
        const category = getVal("rewardsFormCategory");
        const name = getVal("rewardsFormName");
        if (!name) { alert("Name wajib diisi."); return; }

        const targetValue = Number(getVal("rewardsFormTargetValue")) || 1;
        if (targetValue < 1) { alert("Jumlah target minimal 1."); return; }

        const session = loadSession();
        if (!session.token) return;

        const payload = {
            category: category,
            name: name,
            description: getVal("rewardsFormDescription"),
            icon: getVal("rewardsFormIcon"),
            rarity: getVal("rewardsFormRarity"),
            quest_type: getVal("rewardsFormQuestType") || "custom",
            target_name: getVal("rewardsFormTarget"),
            target_value: targetValue,
            reward_item: getVal("rewardsFormRewardItem"),
            reward_count: Number(getVal("rewardsFormRewardCount")) || 0,
            reward_gems: Number(getVal("rewardsFormRewardGems")) || 0,
            order: Number(getVal("rewardsFormOrder")) || 0,
            status: status || getVal("rewardsFormStatus") || "draft"
        };

        const dayRaw = getVal("rewardsFormDay");
        if (dayRaw !== "") {
            const dayNum = Number(dayRaw);
            if (Number.isFinite(dayNum) && dayNum > 0) payload.day = dayNum;
        }

        const isEdit = rewardsState.mode === "edit";
        const url = isEdit ? API_REWARDS_ADMIN_URL + "/" + rewardsState.editingId : API_REWARDS_ADMIN_URL;
        const method = isEdit ? "PUT" : "POST";

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload),
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            alert(status === "published" ? "Reward dipublikasikan." : "Draft tersimpan.");
            showEditorView("rewards-list");
            await loadAdminRewards();
            await loadPublicRewards();
        } catch (err) {
            alert("Gagal menyimpan: " + err.message);
        }
    }

    function init() {
        const roadmapBtn = document.querySelector('[data-editor-module="rewards"]');
        if (roadmapBtn) roadmapBtn.addEventListener("click", function () {
            showEditorView("rewards-list");
            loadAdminRewards();
            loadQuestConfig();
        });

        const backToRoadmap = document.getElementById("rewardsBackToRoadmap");
        if (backToRoadmap) backToRoadmap.addEventListener("click", function () { showEditorView("roadmap"); });

        const createBtn = document.getElementById("rewardsCreateBtn");
        if (createBtn) createBtn.addEventListener("click", function () {
            resetRewardsForm();
            showEditorView("rewards-form");
        });

        const filterWrap = document.getElementById("rewardsFilter");
        if (filterWrap) {
            filterWrap.querySelectorAll("[data-filter]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    filterWrap.querySelectorAll("[data-filter]").forEach(function (b) {
                        b.classList.toggle("active", b === btn);
                    });
                    rewardsState.filter = btn.dataset.filter || "all";
                    renderAdminRewardsList();
                });
            });
        }

        const formBack = document.getElementById("rewardsFormBack");
        if (formBack) formBack.addEventListener("click", function () { showEditorView("rewards-list"); loadAdminRewards(); });

        const formCancel = document.getElementById("rewardsFormCancel");
        if (formCancel) formCancel.addEventListener("click", function () { showEditorView("rewards-list"); loadAdminRewards(); });

        const saveDraft = document.getElementById("rewardsFormSaveDraft");
        if (saveDraft) saveDraft.addEventListener("click", function () { saveReward("draft"); });

        const publish = document.getElementById("rewardsFormPublish");
        if (publish) publish.addEventListener("click", function () { saveReward("published"); });

        const modal = document.getElementById("rewardsModal");
        if (modal) modal.addEventListener("click", function (event) {
            if (event.target === event.currentTarget) closeRewardsModal();
        });

        const closeBtn = document.getElementById("rewardsModalCloseBtn");
        if (closeBtn) closeBtn.addEventListener("click", closeRewardsModal);

        renderRewardsCards();
    }

    function onNavigate() {
        if (!rewardsState.loaded) loadPublicRewards();
        loadPlayerQuests().then(function () {
            const modal = document.getElementById("rewardsModal");
            const content = document.getElementById("rewardsModalContent");
            if (modal && modal.classList.contains("open") && content) openRewardsModal(content.dataset.variant);
        });
    }

    window.GroweraRewards = {
        init: init, loadPublic: loadPublicRewards, loadQuests: loadPlayerQuests,
        onNavigate: onNavigate, closeModal: closeRewardsModal,
        _state: rewardsState, _questState: questState, _categories: REWARD_CATEGORIES
    };
    init();
})();
