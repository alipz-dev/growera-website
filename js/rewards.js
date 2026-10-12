/* =========================================
   GROWERA — REWARDS MODULE
   Rewards page (5 kategori kartu + modal),
   admin rewards editor, dan milestone track
   ala Starlight Pass ML.

   Dependensi (dari app.js):
   - loadSession(), readJSONResponse()
   - formatDateTime(), showEditorView()

   Public API (window.GroweraRewards):
   - init()          : wire event listener (auto dijalankan)
   - loadPublic()    : fetch rewards publik
   - onNavigate()    : dipanggil saat user buka halaman rewards
   - closeModal()    : tutup modal
========================================= */

(function () {
    "use strict";


    /* =========================================
       API CONFIG
    ========================================= */

    const API_REWARDS_PUBLIC_URL = "/api/growera/rewards";
    const API_REWARDS_ADMIN_URL = "/api/growera/admin/rewards";


    /* =========================================
       CATEGORY CONFIG
    ========================================= */

    const REWARD_CATEGORIES = {
        "milestone": {
            key: "milestone",
            eyebrow: "MILESTONE REWARDS",
            title: "Milestone",
            subtitle: "Reach new milestones and unlock your legacy.",
            icon: "💠",
            variant: "milestone",
            actionLabel: "View Rewards",
            modalSubtitle: "Every achievement tells a story."
        },
        "daily-login": {
            key: "daily-login",
            eyebrow: "DAILY LOGIN",
            title: "Daily Login",
            subtitle: "Return every day. Discover new rewards.",
            icon: "🎁",
            variant: "daily-login",
            actionLabel: "View Rewards",
            modalSubtitle: "Return every day. Discover new rewards."
        },
        "daily-quest": {
            key: "daily-quest",
            eyebrow: "DAILY QUEST",
            title: "Daily Quest",
            subtitle: "Complete your daily challenges.",
            icon: "⚔️",
            variant: "daily-quest",
            actionLabel: "View Quests",
            modalSubtitle: "Crystal Challenges"
        },
        "weekly-quest": {
            key: "weekly-quest",
            eyebrow: "WEEKLY QUEST",
            title: "Weekly Quest",
            subtitle: "Take on greater challenges every week.",
            icon: "📅",
            variant: "weekly-quest",
            actionLabel: "View Quests",
            modalSubtitle: "Weekly Trials"
        },
        "monthly-quest": {
            key: "monthly-quest",
            eyebrow: "MONTHLY QUEST",
            title: "Monthly Quest",
            subtitle: "One month. Greater challenges. Legendary rewards.",
            icon: "👑",
            variant: "monthly-quest",
            actionLabel: "Explore Monthly",
            modalSubtitle: "Legendary Trials"
        }
    };

    const RARITY_LABELS = {
        common:    "Common",
        rare:      "Rare",
        epic:      "Epic",
        legendary: "Legendary",
        divine:    "Divine"
    };

    const rewardsState = {
        items: [],
        editingId: null,
        mode: "create",
        filter: "all",
        loaded: false
    };


    /* =========================================
       PUBLIC PAGE — CARD GRID
    ========================================= */

    function renderRewardsCards() {
        const grid = document.getElementById("rewardsGrid");
        if (!grid) return;

        grid.replaceChildren();

        Object.values(REWARD_CATEGORIES).forEach(function (cat) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "rewards-card";
            card.dataset.variant = cat.variant;
            card.setAttribute("aria-label", cat.title + " — " + cat.actionLabel);

            const icon = document.createElement("div");
            icon.className = "rewards-card-icon";
            icon.textContent = cat.icon;

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

            card.addEventListener("click", function () {
                openRewardsModal(cat.key);
            });

            grid.appendChild(card);
        });
    }

    async function loadPublicRewards() {
        try {
            const response = await fetch(API_REWARDS_PUBLIC_URL, {
                cache: "no-store"
            });

            const data = await readJSONResponse(response);

            if (!response.ok || data.success !== true) {
                rewardsState.items = [];
                rewardsState.loaded = true;
                return;
            }

            rewardsState.items = Array.isArray(data.rewards) ? data.rewards : [];
            rewardsState.loaded = true;
        } catch (err) {
            console.warn("[GROWERA REWARDS] Load public rewards failed:", err);
            rewardsState.items = [];
            rewardsState.loaded = true;
        }
    }


    /* =========================================
       MODAL
    ========================================= */

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
        icon.textContent = cat.icon;
        title.textContent = cat.eyebrow;
        subtitle.textContent = cat.modalSubtitle;

        renderRewardsModalBody(categoryKey);

        modal.classList.add("open");

        const body = document.getElementById("rewardsModalBody");
        if (body) body.scrollTop = 0;
    }

    function closeRewardsModal() {
        const modal = document.getElementById("rewardsModal");
        if (!modal) return;
        modal.classList.remove("open");
    }

    function getPublishedRewardsByCategory(categoryKey) {
        return rewardsState.items
            .filter(function (it) {
                return it &&
                    it.category === categoryKey &&
                    (it.status === "published" || !it.status);
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

        if (items.length === 0) {
            body.appendChild(renderRewardsEmptyState());
            return;
        }

        if (categoryKey === "milestone") {
            renderMilestoneBody(body, items);
            return;
        }

        if (categoryKey === "daily-login") {
            renderDailyLoginBody(body, items);
            return;
        }

        if (categoryKey === "monthly-quest") {
            renderMonthlyQuestBody(body, items);
            return;
        }

        renderRewardsListBody(body, items);
    }

    function renderRewardsEmptyState() {
        const wrap = document.createElement("div");
        wrap.className = "rewards-empty";

        const icon = document.createElement("span");
        icon.className = "rewards-empty-icon";
        icon.textContent = "🔒";

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


    /* =========================================
       MODAL BODY RENDERERS
    ========================================= */

    function renderRewardsListBody(body, items) {
        const label = document.createElement("div");
        label.className = "rewards-modal-section-label";
        label.textContent = "Available Rewards";
        body.appendChild(label);

        items.forEach(function (item) {
            body.appendChild(buildRewardItemRow(item));
        });
    }

    function buildRewardItemRow(item) {
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);

        const row = document.createElement("div");
        row.className = "reward-item " + rarityClass;

        const icon = document.createElement("div");
        icon.className = "reward-item-icon";
        icon.textContent = item.icon || "◇";

        const content = document.createElement("div");
        content.className = "reward-item-content";

        const name = document.createElement("h3");
        name.className = "reward-item-name";
        name.textContent = item.name || "Untitled Reward";

        const desc = document.createElement("p");
        desc.className = "reward-item-desc";
        desc.textContent = item.description || "";

        const footer = document.createElement("div");
        footer.className = "reward-item-footer";

        const left = document.createElement("div");
        left.style.display = "flex";
        left.style.gap = "6px";
        left.style.alignItems = "center";
        left.style.flexWrap = "wrap";

        const rarityBadge = document.createElement("span");
        rarityBadge.className = "reward-item-rarity";
        rarityBadge.textContent = RARITY_LABELS[rarity] || "Common";
        left.appendChild(rarityBadge);

        if (item.progress) {
            const prog = document.createElement("span");
            prog.className = "reward-item-progress";
            prog.textContent = "PROGRESS " + item.progress;
            left.appendChild(prog);
        }

        footer.appendChild(left);

        if (item.reward) {
            const rewardEl = document.createElement("span");
            rewardEl.className = "reward-item-reward";
            rewardEl.textContent = "🎁 " + item.reward;
            footer.appendChild(rewardEl);
        }

        content.appendChild(name);
        if (item.description) content.appendChild(desc);
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
            iconEl.textContent = item.icon || "🎁";

            const nameEl = document.createElement("div");
            nameEl.className = "rewards-login-day-name";
            nameEl.textContent = item.name || "Reward";

            const rarityEl = document.createElement("div");
            rarityEl.className = "rewards-login-day-rarity";
            rarityEl.textContent = RARITY_LABELS[rarity] || "Common";

            day.appendChild(labelEl);
            day.appendChild(iconEl);
            day.appendChild(nameEl);
            day.appendChild(rarityEl);

            grid.appendChild(day);
        });

        body.appendChild(grid);

        const note = document.createElement("p");
        note.style.margin = "14px 0 0";
        note.style.color = "var(--muted)";
        note.style.fontSize = "11px";
        note.style.lineHeight = "1.6";
        note.style.textAlign = "center";
        note.textContent = "Kalender di atas masih dalam tahap desain. Sistem klaim harian belum aktif.";
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
            emblem.textContent = heroItem.icon || "👑";

            hero.appendChild(label);
            hero.appendChild(title);
            if (heroItem.description) hero.appendChild(desc);
            hero.appendChild(emblem);

            body.appendChild(hero);
        }

        if (rest.length > 0) {
            const listLabel = document.createElement("div");
            listLabel.className = "rewards-modal-section-label";
            listLabel.textContent = "Legendary Challenges";
            body.appendChild(listLabel);

            rest.forEach(function (item) {
                body.appendChild(buildRewardItemRow(item));
            });
        }
    }


    /* =========================================
       MILESTONE TRACK (Starlight Pass style)
    ========================================= */

    function renderMilestoneBody(body, items) {
        if (!items.length) {
            body.appendChild(renderRewardsEmptyState());
            return;
        }

        const panel = document.createElement("div");
        panel.className = "milestone-panel";

        // --- HEADER (progress summary) ---
        const unlockedCount = items.filter(function (it) {
            return it.unlocked === true || it.claimed === true;
        }).length;

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

        // --- TRACK (horizontal scroll) ---
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
                if (item.unlocked === true || item.claimed === true) {
                    connector.classList.add("done");
                }
                track.appendChild(connector);
            }
        });

        scroll.appendChild(track);
        panel.appendChild(scroll);

        // --- DETAIL PANEL ---
        const detail = document.createElement("div");
        detail.className = "milestone-detail";
        panel.appendChild(detail);

        function showDetail(index) {
            nodeRefs.forEach(function (n, i) {
                n.classList.toggle("active", i === index);
            });
            renderMilestoneDetail(detail, items[index]);

            // Auto-scroll node ke center (khusus mobile)
            const node = nodeRefs[index];
            if (node && scroll.scrollWidth > scroll.clientWidth) {
                const targetLeft = node.offsetLeft -
                    (scroll.clientWidth / 2) + (node.offsetWidth / 2);
                scroll.scrollTo({
                    left: Math.max(0, targetLeft),
                    behavior: "smooth"
                });
            }
        }

        nodeRefs.forEach(function (n, i) {
            n.addEventListener("click", function () { showDetail(i); });
        });

        showDetail(0);

        body.appendChild(panel);
    }

    function buildMilestoneNode(item, index) {
        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);
        const unlocked = item.unlocked === true || item.claimed === true;

        const node = document.createElement("button");
        node.type = "button";
        node.className = "milestone-node " + rarityClass +
            (unlocked ? " unlocked" : " locked");
        node.setAttribute("aria-label",
            "Milestone " + (index + 1) + ": " + (item.name || "Reward"));

        const box = document.createElement("div");
        box.className = "milestone-node-box";
        box.textContent = item.icon || "◇";

        const lock = document.createElement("div");
        lock.className = "milestone-node-lock";
        lock.textContent = "🔒";
        box.appendChild(lock);

        const label = document.createElement("div");
        label.className = "milestone-node-label";
        label.textContent = item.progress
            ? ("Lv " + item.progress)
            : ("M" + (index + 1));

        node.appendChild(box);
        node.appendChild(label);
        return node;
    }

    function renderMilestoneDetail(container, item) {
        container.replaceChildren();

        const rarity = item.rarity || "common";
        const rarityClass = rewardRarityClass(rarity);
        container.className = "milestone-detail " + rarityClass;

        const unlocked = item.unlocked === true || item.claimed === true;

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

        if (item.reward) {
            const rewardWrap = document.createElement("div");
            rewardWrap.className = "milestone-detail-reward";

            const ri = document.createElement("span");
            ri.className = "milestone-detail-reward-icon";
            ri.textContent = "🎁";

            const rt = document.createElement("span");
            rt.textContent = item.reward;

            rewardWrap.appendChild(ri);
            rewardWrap.appendChild(rt);
            container.appendChild(rewardWrap);
        }

        const status = document.createElement("span");
        status.className = "milestone-detail-status " +
            (unlocked ? "unlocked" : "locked");
        status.textContent = unlocked ? "✓ Unlocked" : "🔒 Locked";
        container.appendChild(status);
    }


    /* =========================================
       ADMIN EDITOR — LIST
    ========================================= */

    async function loadAdminRewards() {
        const container = document.getElementById("rewardsAdminList");
        if (!container) return;

        container.innerHTML =
            '<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Memuat reward...</p>';

        const session = loadSession();
        if (!session.token) {
            container.innerHTML =
                '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Token tidak ditemukan.</p>';
            return;
        }

        try {
            const response = await fetch(API_REWARDS_ADMIN_URL, {
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            const data = await readJSONResponse(response);

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "HTTP " + response.status);
            }

            rewardsState.items = Array.isArray(data.rewards) ? data.rewards : [];
            renderAdminRewardsList();
        } catch (err) {
            container.innerHTML =
                '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Gagal memuat: ' +
                err.message + '</p>';
        }
    }

    function renderAdminRewardsList() {
        const container = document.getElementById("rewardsAdminList");
        if (!container) return;

        const filter = rewardsState.filter || "all";
        const list = rewardsState.items
            .filter(function (it) {
                return filter === "all" || it.category === filter;
            })
            .sort(function (a, b) {
                const ca = String(a.category || "");
                const cb = String(b.category || "");
                if (ca !== cb) return ca.localeCompare(cb);
                const oa = Number(a.order) || 0;
                const ob = Number(b.order) || 0;
                return oa - ob;
            });

        if (list.length === 0) {
            container.innerHTML =
                '<p style="color:var(--muted);font-size:12px;text-align:center;padding:30px">' +
                'Belum ada reward untuk kategori ini.<br>Klik "+ Baru" untuk mulai.' +
                '</p>';
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
            statusBadge.className = "news-status-badge " +
                (item.status === "published" ? "published" : "draft");
            statusBadge.textContent = item.status || "draft";

            const catBadge = document.createElement("span");
            catBadge.className = "news-status-badge";
            catBadge.style.background = "rgba(155, 123, 255, 0.12)";
            catBadge.style.border = "1px solid rgba(155, 123, 255, 0.3)";
            catBadge.style.color = "#C7B8FF";
            catBadge.textContent = cat ? (cat.icon + " " + cat.title) : item.category;

            const rarityBadge = document.createElement("span");
            rarityBadge.className = "news-status-badge " + rarityClass;
            rarityBadge.style.background = "rgba(255,255,255,0.04)";
            rarityBadge.style.border = "1px solid var(--rarity-color, rgba(130,160,210,0.3))";
            rarityBadge.style.color = "var(--rarity-color, var(--muted))";
            rarityBadge.textContent = RARITY_LABELS[rarity] || "Common";

            const title = document.createElement("h3");
            title.className = "news-list-item-title";
            title.textContent = (item.icon || "") + " " + (item.name || "Untitled");

            header.appendChild(statusBadge);
            header.appendChild(catBadge);
            header.appendChild(rarityBadge);
            header.appendChild(title);

            const excerpt = document.createElement("p");
            excerpt.className = "news-list-item-excerpt";
            excerpt.textContent = item.description || "(tanpa deskripsi)";

            const meta = document.createElement("div");
            meta.className = "news-list-item-meta";
            meta.appendChild(document.createTextNode(
                "order " + (item.order || 0) + " · " + formatDateTime(item.updatedAt)
            ));

            content.appendChild(header);
            content.appendChild(excerpt);
            content.appendChild(meta);

            const actions = document.createElement("div");
            actions.className = "news-list-item-actions";

            const editBtn = document.createElement("button");
            editBtn.className = "news-action-btn edit";
            editBtn.type = "button";
            editBtn.textContent = "Edit";
            editBtn.addEventListener("click", function () { editReward(item.id); });

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "news-action-btn delete";
            deleteBtn.type = "button";
            deleteBtn.textContent = "Hapus";
            deleteBtn.addEventListener("click", function () {
                deleteReward(item.id, item.name);
            });

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);

            row.appendChild(content);
            row.appendChild(actions);
            container.appendChild(row);
        });
    }


    /* =========================================
       ADMIN EDITOR — FORM
    ========================================= */

    function resetRewardsForm() {
        document.getElementById("rewardsFormCategory").value = "milestone";
        document.getElementById("rewardsFormName").value = "";
        document.getElementById("rewardsFormDescription").value = "";
        document.getElementById("rewardsFormIcon").value = "";
        document.getElementById("rewardsFormRarity").value = "common";
        document.getElementById("rewardsFormProgress").value = "";
        document.getElementById("rewardsFormDay").value = "";
        document.getElementById("rewardsFormReward").value = "";
        document.getElementById("rewardsFormOrder").value = "0";
        document.getElementById("rewardsFormStatus").value = "draft";

        rewardsState.mode = "create";
        rewardsState.editingId = null;

        document.getElementById("rewardsFormTitle").textContent = "Buat Reward Baru";
    }

    function fillRewardsForm(item) {
        document.getElementById("rewardsFormCategory").value = item.category || "milestone";
        document.getElementById("rewardsFormName").value = item.name || "";
        document.getElementById("rewardsFormDescription").value = item.description || "";
        document.getElementById("rewardsFormIcon").value = item.icon || "";
        document.getElementById("rewardsFormRarity").value = item.rarity || "common";
        document.getElementById("rewardsFormProgress").value = item.progress || "";
        document.getElementById("rewardsFormDay").value =
            item.day !== undefined && item.day !== null ? item.day : "";
        document.getElementById("rewardsFormReward").value = item.reward || "";
        document.getElementById("rewardsFormOrder").value =
            item.order !== undefined && item.order !== null ? item.order : 0;
        document.getElementById("rewardsFormStatus").value = item.status || "draft";

        rewardsState.mode = "edit";
        rewardsState.editingId = item.id;

        document.getElementById("rewardsFormTitle").textContent = "Edit Reward";
    }

    async function editReward(id) {
        const session = loadSession();
        if (!session.token) return;

        try {
            const response = await fetch(API_REWARDS_ADMIN_URL + "/" + id, {
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            const data = await readJSONResponse(response);

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "HTTP " + response.status);
            }

            fillRewardsForm(data.reward);
            showEditorView("rewards-form");
        } catch (err) {
            alert("Gagal memuat reward: " + err.message);
        }
    }

    async function deleteReward(id, name) {
        if (!confirm('Hapus reward "' + (name || "ini") + '"?\n\nTindakan ini tidak bisa dibatalkan.')) {
            return;
        }

        const session = loadSession();
        if (!session.token) return;

        try {
            const response = await fetch(API_REWARDS_ADMIN_URL + "/" + id, {
                method: "DELETE",
                headers: {
                    "Authorization": "Bearer " + session.token,
                    "Accept": "application/json"
                },
                cache: "no-store"
            });

            const data = await readJSONResponse(response);

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "HTTP " + response.status);
            }

            alert("Reward dihapus.");
            await loadAdminRewards();
            await loadPublicRewards();
        } catch (err) {
            alert("Gagal menghapus: " + err.message);
        }
    }

    async function saveReward(status) {
        const category = document.getElementById("rewardsFormCategory").value;
        const name = document.getElementById("rewardsFormName").value.trim();
        const description = document.getElementById("rewardsFormDescription").value.trim();
        const icon = document.getElementById("rewardsFormIcon").value.trim();
        const rarity = document.getElementById("rewardsFormRarity").value;
        const progress = document.getElementById("rewardsFormProgress").value.trim();
        const dayRaw = document.getElementById("rewardsFormDay").value.trim();
        const reward = document.getElementById("rewardsFormReward").value.trim();
        const orderRaw = document.getElementById("rewardsFormOrder").value.trim();
        const formStatus = document.getElementById("rewardsFormStatus").value;

        if (!name) {
            alert("Name wajib diisi.");
            return;
        }

        const session = loadSession();
        if (!session.token) return;

        const payload = {
            category: category,
            name: name,
            description: description,
            icon: icon,
            rarity: rarity,
            progress: progress,
            reward: reward,
            order: Number(orderRaw) || 0,
            status: status || formStatus || "draft"
        };

        if (dayRaw !== "") {
            const dayNum = Number(dayRaw);
            if (Number.isFinite(dayNum) && dayNum > 0) payload.day = dayNum;
        }

        const isEdit = rewardsState.mode === "edit";
        const url = isEdit
            ? API_REWARDS_ADMIN_URL + "/" + rewardsState.editingId
            : API_REWARDS_ADMIN_URL;

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

            if (!response.ok || data.success !== true) {
                throw new Error(data.message || "HTTP " + response.status);
            }

            alert(status === "published"
                ? "Reward dipublikasikan."
                : "Draft tersimpan.");

            showEditorView("rewards-list");
            await loadAdminRewards();
            await loadPublicRewards();
        } catch (err) {
            alert("Gagal menyimpan: " + err.message);
        }
    }


    /* =========================================
       INIT & EVENT WIRING
    ========================================= */

    function init() {
        const roadmapBtn = document.querySelector('[data-editor-module="rewards"]');
        if (roadmapBtn) {
            roadmapBtn.addEventListener("click", function () {
                showEditorView("rewards-list");
                loadAdminRewards();
            });
        }

        const backToRoadmap = document.getElementById("rewardsBackToRoadmap");
        if (backToRoadmap) {
            backToRoadmap.addEventListener("click", function () {
                showEditorView("roadmap");
            });
        }

        const createBtn = document.getElementById("rewardsCreateBtn");
        if (createBtn) {
            createBtn.addEventListener("click", function () {
                resetRewardsForm();
                showEditorView("rewards-form");
            });
        }

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
        if (formBack) {
            formBack.addEventListener("click", function () {
                showEditorView("rewards-list");
                loadAdminRewards();
            });
        }

        const formCancel = document.getElementById("rewardsFormCancel");
        if (formCancel) {
            formCancel.addEventListener("click", function () {
                showEditorView("rewards-list");
                loadAdminRewards();
            });
        }

        const saveDraft = document.getElementById("rewardsFormSaveDraft");
        if (saveDraft) {
            saveDraft.addEventListener("click", function () {
                saveReward("draft");
            });
        }

        const publish = document.getElementById("rewardsFormPublish");
        if (publish) {
            publish.addEventListener("click", function () {
                saveReward("published");
            });
        }

        const modal = document.getElementById("rewardsModal");
        if (modal) {
            modal.addEventListener("click", function (event) {
                if (event.target === event.currentTarget) closeRewardsModal();
            });
        }

        const closeBtn = document.getElementById("rewardsModalCloseBtn");
        if (closeBtn) {
            closeBtn.addEventListener("click", closeRewardsModal);
        }

        renderRewardsCards();
    }


    /* =========================================
       NAVIGATION HOOK
    ========================================= */

    function onNavigate() {
        if (!rewardsState.loaded) {
            loadPublicRewards();
        }
    }


    /* =========================================
       PUBLIC API
    ========================================= */

    window.GroweraRewards = {
        init: init,
        loadPublic: loadPublicRewards,
        onNavigate: onNavigate,
        closeModal: closeRewardsModal,
        _state: rewardsState,
        _categories: REWARD_CATEGORIES
    };

    init();

})();
