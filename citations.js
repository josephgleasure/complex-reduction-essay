(function () {
  "use strict";

  let tooltip = null;
  let activeTarget = null;

  function ensureTooltip() {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "cite-tooltip";
      tooltip.setAttribute("role", "tooltip");
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function positionTooltip(target) {
    const tip = ensureTooltip();
    const rect = target.getBoundingClientRect();
    tip.style.left = "0";
    tip.style.top = "0";
    tip.style.visibility = "hidden";
    tip.classList.add("visible");

    const tipRect = tip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - 10;

    if (top < 8) top = rect.bottom + 10;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.style.visibility = "visible";
  }

  function showTooltip(target, html, isFootnote) {
    activeTarget = target;
    const tip = ensureTooltip();
    tip.innerHTML = html;
    tip.classList.toggle("is-footnote", !!isFootnote);
    positionTooltip(target);
  }

  function hideTooltip() {
    if (tooltip) {
      tooltip.classList.remove("visible", "is-footnote");
    }
    activeTarget = null;
  }

  function normalizeKey(author, year) {
    const surname = author
      .replace(/\s+et\s+al\.?/i, "")
      .replace(/[^A-Za-z\u00C0-\u024F'-]/g, "")
      .trim()
      .toLowerCase();
    const y = String(year).replace(/\s/g, "").toLowerCase().replace(/-\w+$/, "");
    return surname + "|" + y;
  }

  function addKeys(keys, author, year) {
    const yearClean = String(year).replace(/\s/g, "");
    const first = author.split(/\s+&\s|,\s*&\s|,\s+/)[0].trim();
    [author, first].forEach(function (name) {
      keys.push(normalizeKey(name, yearClean));
      if (yearClean.includes("/")) {
        keys.push(normalizeKey(name, yearClean.split("/").pop()));
        keys.push(normalizeKey(name, yearClean.split("/")[0]));
      }
    });
  }

  function parseReferenceText(text) {
    const yearPattern = "(\\d{4}[a-z]?|n\\.d\\.)";
    let match = text.match(
      new RegExp(
        "^(.+?),\\s*.+?\\.\\s*\\(" + yearPattern + "(?:,\\s*[^)]+)?(?:\\/(\\d{4}))?\\)",
        "i"
      )
    );
    if (!match) {
      match = text.match(
        new RegExp("^(.+?)\\.\\s*\\(" + yearPattern + "(?:,\\s*[^)]+)?(?:\\/(\\d{4}))?\\)", "i")
      );
    }
    if (!match) return null;

    const authorPart = match[1].trim();
    let year = match[2].toLowerCase();
    if (year.startsWith("n.d")) year = "n.d.";
    const reprintYear = match[3];
    const orig = text.match(/\(Original (?:work published|lecture delivered) (\d{4})\)/i);
    const surname = authorPart.split(/,\s*&|\s+&\s|,\s+/)[0].trim();
    const keys = [];
    addKeys(keys, surname, year);
    addKeys(keys, authorPart, year);
    if (reprintYear) {
      addKeys(keys, surname, reprintYear);
      addKeys(keys, authorPart, reprintYear);
    }
    if (orig) {
      addKeys(keys, surname, orig[1]);
      addKeys(keys, authorPart, orig[1]);
      addKeys(keys, surname, orig[1] + "/" + year);
    }
    return { keys: keys };
  }

  function buildReferenceIndex() {
    const index = new Map();
    document.querySelectorAll(".reference").forEach(function (el, i) {
      const id = "ref-" + i;
      el.id = id;
      el.dataset.refId = id;
      const parsed = parseReferenceText(el.textContent.trim());
      if (!parsed) return;
      parsed.keys.forEach(function (key) {
        if (!index.has(key)) index.set(key, { html: el.innerHTML, id: id });
      });
    });
    return index;
  }

  function decodeEntities(text) {
    const el = document.createElement("textarea");
    el.innerHTML = text;
    return el.value;
  }

  function parseCitationParts(inner) {
    const results = [];
    decodeEntities(inner)
      .split(";")
      .forEach(function (segment) {
      const trimmed = segment.trim();
      if (!trimmed) return;

      const etAl = trimmed.match(/^(.+?)\s+et\s+al\.,\s*(.+)$/i);
      if (etAl) {
        etAl[2].split(/,\s*/).forEach(function (y) {
          if (y.trim()) results.push({ author: etAl[1].trim(), year: y.trim() });
        });
        return;
      }

      const comma = trimmed.match(/^(.+?),\s*(.+)$/);
      if (!comma) return;
      const author = comma[1].trim();
      comma[2].split(/,\s*/).forEach(function (y) {
        const year = y.trim();
        if (year) results.push({ author: author, year: year });
      });
    });
    return results;
  }

  function lookupCitation(index, author, year) {
    const authors = [author];
    if (/\s&\s/.test(author)) {
      author.split(/\s&\s/).forEach(function (name) {
        authors.push(name.trim());
      });
    }
    for (let a = 0; a < authors.length; a++) {
      const keys = [];
      addKeys(keys, authors[a], year);
      for (let i = 0; i < keys.length; i++) {
        if (index.has(keys[i])) return index.get(keys[i]);
      }
    }
    return null;
  }

  function resolveCitationGroup(inner, index) {
    const parts = parseCitationParts(inner);
    const seen = new Set();
    const resolved = [];
    parts.forEach(function (part) {
      const hit = lookupCitation(index, part.author, part.year);
      if (hit && !seen.has(hit.id)) {
        seen.add(hit.id);
        resolved.push(hit);
      }
    });
    return resolved;
  }

  function isCitationLike(inner) {
    return /,\s*\d{4}[a-z]?|,\s*n\.d\.|\bet\s+al\./i.test(inner);
  }

  function getTextNodesIn(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.parentElement && node.parentElement.closest(".reference, .interactive-widget, .cite-ref")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function wrapTextRange(root, start, end, matchText, index) {
    const nodes = getTextNodesIn(root);
    let pos = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const len = node.textContent.length;
      if (startNode === null && pos + len > start) {
        startNode = node;
        startOffset = start - pos;
      }
      if (pos + len >= end) {
        endNode = node;
        endOffset = end - pos;
        break;
      }
      pos += len;
    }

    if (!startNode || !endNode) return;

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);

    const inner = matchText.slice(1, -1);
    const resolved = resolveCitationGroup(inner, index);

    const span = document.createElement("span");
    span.className = "cite-ref";
    span.tabIndex = 0;

    if (resolved.length) {
      span.dataset.refIds = resolved.map(function (r) { return r.id; }).join(",");
      span.dataset.tooltipHtml = resolved
        .map(function (r) { return r.html; })
        .join("<hr style='border:0;border-top:1px solid rgba(245,241,232,.25);margin:8px 0'>");
    }

    try {
      range.surroundContents(span);
    } catch (e) {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
  }

  function wrapCitationsInElement(el, index) {
    if (el.closest(".references, .interactive-widget")) return;
    if (el.matches(".cite-ref")) return;

    const text = el.textContent;
    const regex = /\(([^()]+(?:\([^)]*\)[^()]*)*)\)/g;
    const matches = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (!isCitationLike(m[1])) continue;
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        full: m[0],
      });
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      wrapTextRange(el, matches[i].start, matches[i].end, matches[i].full, index);
    }
  }

  function initFootnotes() {
    document.querySelectorAll(".footnote-ref a[data-fn]").forEach(function (link) {
      const fnId = "fn-" + link.dataset.fn;
      const fnEl = document.getElementById(fnId);
      if (!fnEl) return;

      link.addEventListener("mouseenter", function () {
        showTooltip(link, fnEl.innerHTML, true);
      });
      link.addEventListener("mouseleave", hideTooltip);
      link.addEventListener("focus", function () {
        showTooltip(link, fnEl.innerHTML, true);
      });
      link.addEventListener("blur", hideTooltip);
      link.addEventListener("click", function (e) {
        if (window.matchMedia("(hover: none)").matches) {
          e.preventDefault();
          if (activeTarget === link) hideTooltip();
          else showTooltip(link, fnEl.innerHTML, true);
        }
      });
    });
  }

  function bindCitationEvents() {
    document.querySelectorAll(".cite-ref").forEach(function (el) {
      if (!el.dataset.tooltipHtml) return;

      el.addEventListener("mouseenter", function () {
        showTooltip(el, el.dataset.tooltipHtml, false);
      });
      el.addEventListener("mouseleave", hideTooltip);
      el.addEventListener("focus", function () {
        showTooltip(el, el.dataset.tooltipHtml, false);
      });
      el.addEventListener("blur", hideTooltip);
      el.addEventListener("click", function (e) {
        const ids = (el.dataset.refIds || "").split(",").filter(Boolean);
        if (ids.length && !window.matchMedia("(hover: none)").matches) {
          const target = document.getElementById(ids[0]);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        if (window.matchMedia("(hover: none)").matches) {
          e.preventDefault();
          if (activeTarget === el) hideTooltip();
          else showTooltip(el, el.dataset.tooltipHtml, false);
        }
      });
    });
  }

  function initCitations() {
    const index = buildReferenceIndex();
    const article = document.querySelector("article");
    if (!article) return;

    article.querySelectorAll("p, .lead, .schema, .interactive-note, .figure-note").forEach(function (el) {
      wrapCitationsInElement(el, index);
    });

    bindCitationEvents();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hideTooltip();
  });

  window.addEventListener(
    "scroll",
    function () {
      if (activeTarget) positionTooltip(activeTarget);
    },
    { passive: true }
  );

  document.addEventListener("DOMContentLoaded", function () {
    initCitations();
    initFootnotes();
  });
})();
