/* =========================================
   GROWERA — NEWS MODULE (v2, item icons)
========================================= */

(function () {
    "use strict";

    const API_NEWS_PUBLIC_URL = "/api/growera/news";
    const API_NEWS_ADMIN_URL = "/api/growera/admin/news";

    const newsState = { articles: [], mode: "create", editingId: null };

    function iconImg(id, size) {
        if (window.GroweraIcon) return window.GroweraIcon.img(id, size);
        var i = document.createElement("img");
        i.src = "/assets/itemimage/" + id + ".png";
        i.width = size; i.height = size;
        i.style.cssText = "width:" + size + "px;height:" + size + "px;object-fit:contain;image-rendering:pixelated";
        return i;
    }

    async function loadHomeNews() {
        try {
            const response = await fetch(API_NEWS_PUBLIC_URL, { cache: "no-store" });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) return;
            const articles = Array.isArray(data.articles) ? data.articles : [];
            if (articles.length === 0) {
                document.getElementById("newsListSection").classList.add("hidden");
                return;
            }
            setHeroNews(articles[0]);
            renderNewsList(articles.slice(1, 5));
        } catch (err) {
            console.warn("[GROWERA] Load home news failed:", err);
        }
    }

    function setHeroNews(article) {
        if (!article) return;
        document.getElementById("newsTitle").textContent = article.title || "Untitled";
        document.getElementById("newsExcerpt").textContent = article.excerpt || "";
        document.getElementById("newsBadge").textContent = article.badge || "GROWERA NEWS";
        const dateEl = document.getElementById("newsDate");
        if (dateEl && article.updatedAt) {
            dateEl.textContent = "Update " + new Date(article.updatedAt * 1000).toLocaleDateString("id-ID");
        }
        window.__currentHomeArticle = article;
    }

    function renderNewsList(articles) {
        const section = document.getElementById("newsListSection");
        const container = document.getElementById("newsListContainer");
        if (!section || !container) return;
        if (!Array.isArray(articles) || articles.length === 0) {
            section.classList.add("hidden");
            return;
        }
        section.classList.remove("hidden");
        container.replaceChildren();

        articles.forEach(function (article) {
            const item = document.createElement("button");
            item.className = "news-list-mini";
            item.type = "button";

            const info = document.createElement("div");
            info.className = "news-list-mini-info";

            const title = document.createElement("div");
            title.className = "news-list-mini-title";
            title.textContent = article.title || "Untitled";

            const date = document.createElement("div");
            date.className = "news-list-mini-date";
            date.textContent = article.updatedAt
                ? new Date(article.updatedAt * 1000).toLocaleDateString("id-ID")
                : "—";

            info.appendChild(title);
            info.appendChild(date);

            const arrow = document.createElement("span");
            arrow.className = "news-list-mini-arrow";
            arrow.textContent = "→";

            item.appendChild(info);
            item.appendChild(arrow);

            item.addEventListener("click", function () { openNewsModalWith(article); });
            container.appendChild(item);
        });
    }

    function openNewsModalWith(article) {
        const modal = document.getElementById("newsModal");
        if (!modal || !article) return;
        document.getElementById("newsModalBadge").textContent = article.badge || "CRYSTAL ERA";
        document.getElementById("newsModalTitle").textContent = article.title || "Untitled";
        document.getElementById("newsModalMeta").textContent =
            "Dipublikasikan oleh " + (article.author || "GROWERA") + " · " +
            (article.updatedAt ? new Date(article.updatedAt * 1000).toLocaleDateString("id-ID") : "—");

        const bodyEl = document.getElementById("newsModalBody");
        bodyEl.replaceChildren();
        const body = String(article.body || "").trim();

        if (body === "") {
            const emptyPara = document.createElement("p");
            emptyPara.textContent = "(Artikel ini belum memiliki isi.)";
            emptyPara.style.color = "var(--muted)";
            emptyPara.style.fontStyle = "italic";
            bodyEl.appendChild(emptyPara);
        } else {
            const paragraphs = body.split(/\n\s*\n/);
            paragraphs.forEach(function (raw) {
                const text = raw.trim();
                if (!text) return;
                const para = document.createElement("p");
                para.textContent = text;
                bodyEl.appendChild(para);
            });
        }
        modal.classList.add("open");
    }

    function openNewsModal() {
        if (window.__currentHomeArticle) openNewsModalWith(window.__currentHomeArticle);
        else {
            const modal = document.getElementById("newsModal");
            if (modal) modal.classList.add("open");
        }
    }

    function closeNewsModal() {
        const modal = document.getElementById("newsModal");
        if (modal) modal.classList.remove("open");
    }

    function resetNewsForm() {
        document.getElementById("newsFormTitleInput").value = "";
        document.getElementById("newsFormBadge").value = "GROWERA NEWS";
        document.getElementById("newsFormExcerpt").value = "";
        document.getElementById("newsFormBody").value = "";
        newsState.mode = "create";
        newsState.editingId = null;
        document.getElementById("newsFormTitle").textContent = "Buat Artikel Baru";
    }

    function fillNewsForm(article) {
        document.getElementById("newsFormTitleInput").value = article.title || "";
        document.getElementById("newsFormBadge").value = article.badge || "GROWERA NEWS";
        document.getElementById("newsFormExcerpt").value = article.excerpt || "";
        document.getElementById("newsFormBody").value = article.body || "";
        newsState.mode = "edit";
        newsState.editingId = article.id;
        document.getElementById("newsFormTitle").textContent = "Edit Artikel";
    }

    async function loadNewsList() {
        const container = document.getElementById("newsAdminListContainer");
        if (!container) return;
        container.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:20px">Memuat artikel...</p>';

        const session = loadSession();
        if (!session.token) {
            container.innerHTML = '<p style="color:var(--danger);font-size:12px">Token tidak ditemukan.</p>';
            return;
        }

        try {
            const response = await fetch(API_NEWS_ADMIN_URL, {
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            newsState.articles = Array.isArray(data.articles) ? data.articles : [];
            renderNewsListAdmin(newsState.articles);
        } catch (err) {
            container.innerHTML = '<p style="color:var(--danger);font-size:12px;text-align:center;padding:20px">Gagal memuat: ' + err.message + '</p>';
        }
    }

    function renderNewsListAdmin(articles) {
        const container = document.getElementById("newsAdminListContainer");
        if (!container) return;

        if (articles.length === 0) {
            container.innerHTML = '<p style="color:var(--muted);font-size:12px;text-align:center;padding:30px">Belum ada artikel.<br>Klik "+ Baru" untuk mulai.</p>';
            return;
        }

        container.innerHTML = "";

        articles.forEach(function (article) {
            const item = document.createElement("div");
            item.className = "news-list-item";

            const content = document.createElement("div");
            content.className = "news-list-item-content";

            const header = document.createElement("div");
            header.className = "news-list-item-header";

            const badge = document.createElement("span");
            badge.className = "news-status-badge " + (article.status === "published" ? "published" : "draft");
            badge.textContent = article.status;

            const titleWrap = document.createElement("h3");
            titleWrap.className = "news-list-item-title";
            titleWrap.appendChild(iconImg(5016, 16));
            titleWrap.appendChild(document.createTextNode(" " + (article.title || "")));

            header.appendChild(badge);
            header.appendChild(titleWrap);

            const excerpt = document.createElement("p");
            excerpt.className = "news-list-item-excerpt";
            excerpt.textContent = article.excerpt || "(tanpa excerpt)";

            const meta = document.createElement("div");
            meta.className = "news-list-item-meta";
            meta.textContent = formatDateTime(article.updatedAt) + " · " + (article.author || "unknown");

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
            editBtn.addEventListener("click", function () { editNews(article.id); });

            const delBtn = document.createElement("button");
            delBtn.className = "news-action-btn delete";
            delBtn.type = "button";
            delBtn.appendChild(iconImg(856, 14));
            delBtn.appendChild(document.createTextNode(" Hapus"));
            delBtn.addEventListener("click", function () { deleteNews(article.id, article.title); });

            actions.appendChild(editBtn);
            actions.appendChild(delBtn);

            item.appendChild(content);
            item.appendChild(actions);
            container.appendChild(item);
        });
    }

    async function editNews(id) {
        const session = loadSession();
        if (!session.token) return;
        try {
            const response = await fetch(API_NEWS_ADMIN_URL + "/" + id, {
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            fillNewsForm(data.article);
            showEditorView("form");
        } catch (err) {
            alert("Gagal memuat artikel: " + err.message);
        }
    }

    async function deleteNews(id, title) {
        if (!confirm('Hapus artikel "' + title + '"?\n\nTindakan ini tidak bisa dibatalkan.')) return;
        const session = loadSession();
        if (!session.token) return;
        try {
            const response = await fetch(API_NEWS_ADMIN_URL + "/" + id, {
                method: "DELETE",
                headers: { "Authorization": "Bearer " + session.token, "Accept": "application/json" },
                cache: "no-store"
            });
            const data = await readJSONResponse(response);
            if (!response.ok || data.success !== true) throw new Error(data.message || "HTTP " + response.status);
            alert("Artikel dihapus.");
            await loadNewsList();
            await loadHomeNews();
        } catch (err) {
            alert("Gagal menghapus: " + err.message);
        }
    }

    async function saveNews(status) {
        const title = document.getElementById("newsFormTitleInput").value.trim();
        const badge = document.getElementById("newsFormBadge").value.trim() || "GROWERA NEWS";
        const excerpt = document.getElementById("newsFormExcerpt").value.trim();
        const body = document.getElementById("newsFormBody").value.trim();

        if (!title) { alert("Title wajib diisi."); return; }
        if (status === "published" && !body) { alert("Body wajib diisi untuk publish."); return; }

        const session = loadSession();
        if (!session.token) return;

        const payload = { title, badge, excerpt, body, status };
        const isEdit = newsState.mode === "edit";
        const url = isEdit ? API_NEWS_ADMIN_URL + "/" + newsState.editingId : API_NEWS_ADMIN_URL;
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
            alert(status === "published" ? "Artikel dipublikasikan." : "Draft tersimpan.");
            showEditorView("list");
            await loadNewsList();
            await loadHomeNews();
        } catch (err) {
            alert("Gagal menyimpan: " + err.message);
        }
    }

    function init() {
        const roadmapNewsBtn = document.querySelector('[data-editor-module="news"]');
        if (roadmapNewsBtn) roadmapNewsBtn.addEventListener("click", function () { showEditorView("list"); loadNewsList(); });

        const backToRoadmap = document.getElementById("newsBackToRoadmap");
        if (backToRoadmap) backToRoadmap.addEventListener("click", function () { showEditorView("roadmap"); });

        const createBtn = document.getElementById("newsCreateBtn");
        if (createBtn) createBtn.addEventListener("click", function () { resetNewsForm(); showEditorView("form"); });

        const formBack = document.getElementById("newsFormBack");
        if (formBack) formBack.addEventListener("click", function () { showEditorView("list"); loadNewsList(); });

        const formCancel = document.getElementById("newsFormCancel");
        if (formCancel) formCancel.addEventListener("click", function () { showEditorView("list"); loadNewsList(); });

        const saveDraft = document.getElementById("newsFormSaveDraft");
        if (saveDraft) saveDraft.addEventListener("click", function () { saveNews("draft"); });

        const publish = document.getElementById("newsFormPublish");
        if (publish) publish.addEventListener("click", function () { saveNews("published"); });

        const newsReadMoreBtn = document.getElementById("newsReadMoreBtn");
        if (newsReadMoreBtn) newsReadMoreBtn.addEventListener("click", openNewsModal);

        const newsModalCloseBtn = document.getElementById("newsModalCloseBtn");
        if (newsModalCloseBtn) newsModalCloseBtn.addEventListener("click", closeNewsModal);

        const newsModal = document.getElementById("newsModal");
        if (newsModal) newsModal.addEventListener("click", function (event) {
            if (event.target === event.currentTarget) closeNewsModal();
        });
    }

    window.GroweraNews = { init: init, loadHome: loadHomeNews, closeModal: closeNewsModal, _state: newsState };
    init();
})();
