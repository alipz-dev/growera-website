// js/markdown.js
// Lightweight markdown renderer — safe (DOM-based, no innerHTML injection)
// Support:
//   **bold**  *italic*  `code`  [link](url)  [item:123]
//   - bullet list  • bullet list
//   Line breaks (\n → <br> via block structure)

import { resolveItemName } from "./core.js";

/* ===== Public: render markdown text → DOM element ===== */
export function renderMarkdown(text, options = {}) {
    const container = document.createElement("div");
    container.className = "md-content";

    const lines = String(text || "").split("\n");
    let currentList = null;

    for (const rawLine of lines) {
        const line = rawLine;

        // Bullet list item: starts with "- " or "• " or "* "
        const listMatch = line.match(/^\s*[-•*]\s+(.*)$/);
        if (listMatch) {
            if (!currentList) {
                currentList = document.createElement("ul");
                container.appendChild(currentList);
            }
            const li = document.createElement("li");
            appendInline(li, listMatch[1], options);
            currentList.appendChild(li);
            continue;
        }

        // Empty line = paragraph break
        if (line.trim() === "") {
            currentList = null;
            // Optional: add spacer paragraph
            // skip empty (natural spacing from <p> margins)
            continue;
        }

        // Regular line = paragraph
        currentList = null;
        const p = document.createElement("p");
        appendInline(p, line, options);
        container.appendChild(p);
    }

    // Kalau kosong total
    if (!container.children.length) {
        const p = document.createElement("p");
        p.textContent = "(Tanpa konten)";
        p.style.color = "#4b5670";
        p.style.fontStyle = "italic";
        container.appendChild(p);
    }

    return container;
}

/* ===== Render markdown → HTML string (untuk innerHTML use case) ===== */
export function renderMarkdownHTML(text, options = {}) {
    const el = renderMarkdown(text, options);
    return el.outerHTML;
}

/* ===== Inline parser ===== */
function appendInline(parent, text, options) {
    const source = String(text || "");
    let i = 0;
    let textBuffer = "";

    function flushText() {
        if (textBuffer) {
            parent.appendChild(document.createTextNode(textBuffer));
            textBuffer = "";
        }
    }

    while (i < source.length) {
        const remaining = source.slice(i);

        // [item:123] — item image
        const itemMatch = remaining.match(/^\[item:(\d+)\]/);
        if (itemMatch) {
            flushText();
            const id = parseInt(itemMatch[1], 10);
            parent.appendChild(createItemChip(id, options));
            i += itemMatch[0].length;
            continue;
        }

        // **bold**
        const boldMatch = remaining.match(/^\*\*([^*\n]+?)\*\*/);
        if (boldMatch) {
            flushText();
            const strong = document.createElement("strong");
            strong.textContent = boldMatch[1];
            parent.appendChild(strong);
            i += boldMatch[0].length;
            continue;
        }

        // *italic*
        const italicMatch = remaining.match(/^\*([^*\n]+?)\*/);
        if (italicMatch) {
            flushText();
            const em = document.createElement("em");
            em.textContent = italicMatch[1];
            parent.appendChild(em);
            i += italicMatch[0].length;
            continue;
        }

        // `code`
        const codeMatch = remaining.match(/^`([^`\n]+?)`/);
        if (codeMatch) {
            flushText();
            const code = document.createElement("code");
            code.textContent = codeMatch[1];
            parent.appendChild(code);
            i += codeMatch[0].length;
            continue;
        }

        // [text](url)
        const linkMatch = remaining.match(/^\[([^\]\n]+?)\]\((https?:\/\/[^)\s]+?)\)/);
        if (linkMatch) {
            flushText();
            const a = document.createElement("a");
            a.href = linkMatch[2];
            a.textContent = linkMatch[1];
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            parent.appendChild(a);
            i += linkMatch[0].length;
            continue;
        }

        // Regular character — buffer it
        textBuffer += source[i];
        i += 1;
    }

    flushText();
}

/* ===== Item chip element ===== */
function createItemChip(id, options) {
    const span = document.createElement("span");
    span.className = "md-item";
    span.title = "Item #" + id;

    const img = document.createElement("img");
    img.className = "md-item-img";
    img.alt = "Item " + id;
    img.loading = "lazy";
    img.src = "assets/itemimage/" + id + ".png";
    img.addEventListener("error", () => {
        // Fallback: tampil sebagai kotak dengan "?"
        img.remove();
        const fallback = document.createElement("span");
        fallback.className = "md-item-fallback";
        fallback.textContent = "?";
        span.insertBefore(fallback, span.firstChild);
    }, { once: true });
    span.appendChild(img);

    const nameEl = document.createElement("span");
    nameEl.className = "md-item-name";
    let resolvedName = "";
    try {
        resolvedName = resolveItemName(id);
    } catch {
        resolvedName = "";
    }
    // resolveItemName return "Item #id" kalau tidak ada di cache — deteksi dan fallback ke "#id"
    if (!resolvedName || resolvedName === "Item #" + id) {
        nameEl.textContent = "#" + id;
    } else {
        nameEl.textContent = resolvedName;
    }
    span.appendChild(nameEl);

    return span;
}

/* ===== Utility: strip markdown untuk preview ===== */
export function stripMarkdown(text, maxLen = 140) {
    let s = String(text || "");

    // Ganti item refs dengan placeholder yang readable
    s = s.replace(/\[item:(\d+)\]/g, "[Item #$1]");

    // Link [text](url) → text
    s = s.replace(/\[([^\]]+?)\]\([^)]+?\)/g, "$1");

    // Bold, italic, code markers
    s = s.replace(/\*\*([^*]+?)\*\*/g, "$1");
    s = s.replace(/\*([^*]+?)\*/g, "$1");
    s = s.replace(/`([^`]+?)`/g, "$1");

    // Bullet markers di awal baris
    s = s.replace(/^\s*[-•*]\s+/gm, "");

    // Whitespace
    s = s.replace(/\s+/g, " ").trim();

    if (maxLen && s.length > maxLen) {
        s = s.slice(0, maxLen).trim() + "…";
    }

    return s;
}
