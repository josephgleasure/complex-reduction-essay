"""Build index.html from the formatted docx, preserving existing figure assets."""
from __future__ import annotations

import html
import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parent
DOCX = Path(
    r"C:\Users\josep\Desktop\Personal\Fruit\Process\Writing\Complex Reduction\Complex_Reduction_Final_Formatted.docx"
)
FIGURES = ROOT / "figures"
INDEX = ROOT / "index.html"

INTERACTIVES = {
    "concept": {
        "eyebrow": "Interactive figure 01",
        "title": "The basic movement of postmodernism",
        "description": "Move through the three stages to compare premodern articulation, modernist reduction, and postmodern rearticulation.",
        "note": "",
    },
    "cows": {
        "eyebrow": "Interactive figure 02",
        "title": "Ten cows: from pastoral image to postmodern object",
        "description": "Use the slider or arrow controls to follow the cow through naturalistic depiction, modernist abstraction, and postmodern recombination.",
        "note": "",
    },
    "columns": {
        "eyebrow": "Interactive figure 03",
        "title": "The rectangle becoming a polygon",
        "description": "Compare the column as articulated ornament, reduced structure, and postmodern geometric sign.",
        "note": '<p class="interactive-note"><em>Note.</em> The rectangle becoming a polygon is a visual shorthand, not a diagnostic or totalizing theory of postmodernism. In other examples, this increase can be seen in surface, colour, material, quotation, function, or symbolism rather than through a literal increase in the number or complexity of vertices.</p>',
    },
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".jfif"}
COLLECTION_NAME = "This is not an apple"
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def run_element_to_html(r_el) -> str:
    text_parts = []
    rpr = r_el.find(qn("w:rPr"))
    bold = rpr is not None and rpr.find(qn("w:b")) is not None
    italic = rpr is not None and rpr.find(qn("w:i")) is not None
    for t in r_el.findall(qn("w:t")):
        if t.text:
            text_parts.append(html.escape(t.text))
    text = "".join(text_parts)
    if not text:
        return ""
    if italic and bold:
        return f"<em><strong>{text}</strong></em>"
    if italic:
        return f"<em>{text}</em>"
    if bold:
        return f"<strong>{text}</strong>"
    return text


def footnote_ref_html(fn_id: str) -> str:
    return (
        f'<sup class="footnote-ref"><a href="#fn-{fn_id}" data-fn="{fn_id}" '
        f'aria-label="Footnote {fn_id}">{fn_id}</a></sup>'
    )


def paragraph_to_html(p) -> str:
    parts = []
    for child in p._element:
        tag = child.tag.split("}")[-1]
        if tag == "r":
            parts.append(run_element_to_html(child))
        elif tag == "footnoteReference":
            fn_id = child.get(qn("w:id"))
            if fn_id:
                parts.append(footnote_ref_html(fn_id))
    return normalize_collection_casing("".join(parts))


def load_footnotes() -> dict[str, str]:
    import zipfile
    from xml.etree import ElementTree as ET

    footnotes: dict[str, str] = {}
    with zipfile.ZipFile(DOCX) as z:
        root = ET.fromstring(z.read("word/footnotes.xml"))
    for fn in root.findall(f".//{{{W_NS}}}footnote"):
        fn_id = fn.get(f"{{{W_NS}}}id")
        if not fn_id or fn_id in ("-1", "0"):
            continue
        parts = []
        for p_el in fn.findall(qn("w:p")):
            for child in p_el:
                tag = child.tag.split("}")[-1]
                if tag == "r":
                    parts.append(run_element_to_html(child))
        footnotes[fn_id] = normalize_collection_casing("".join(parts))
    return footnotes


def render_footnotes_block(footnotes: dict[str, str]) -> str:
    if not footnotes:
        return '<aside id="footnotes" hidden></aside>'
    items = "".join(
        f'<p id="fn-{fn_id}">{html_text}</p>'
        for fn_id, html_text in sorted(footnotes.items(), key=lambda item: int(item[0]))
    )
    return f'<aside id="footnotes" hidden>{items}</aside>'


def slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s[:80]


def runs_to_html(p) -> str:
    return paragraph_to_html(p)


def normalize_collection_casing(text: str) -> str:
    return re.sub(
        r"<em>This Is Not an Apple</em>",
        f"<em>{COLLECTION_NAME}</em>",
        text,
        flags=re.I,
    )


def format_note(note_html: str) -> str:
    if not note_html.strip():
        return ""
    cleaned = re.sub(
        r"^(<em>)?Note\.(</em>)?\s*",
        "",
        note_html.strip(),
        flags=re.I,
    )
    return f"<em>Note.</em> {cleaned}"


def render_interactive(slug: str) -> str:
    item = INTERACTIVES[slug]
    note = item["note"]
    return (
        '<figure class="interactive">\n'
        f'  <div class="interactive-widget" data-slug="{slug}" tabindex="0"\n'
        f'    aria-label="{html.escape(item["title"])}"></div>\n'
        '  <figcaption class="interactive-caption">\n'
        f'    <div class="interactive-label">{item["eyebrow"]}</div>\n'
        "    <div>\n"
        f'      <div class="interactive-title">{html.escape(item["title"])}</div>\n'
        f'      <div class="figure-note">{item["description"]}</div>\n'
        f"      {note}\n"
        "    </div>\n"
        "  </figcaption>\n"
        "</figure>"
    )


def render_figure(num: int, title: str, note_html: str, image_paths: list[str]) -> str:
    count = min(max(1, len(image_paths)), 4)
    label = f"Figure {num}"
    alt = html.escape(f"{label}: {title}")
    imgs = "".join(f'<img src="{src}" alt="{alt}">' for src in image_paths)
    note_block = format_note(note_html)
    return (
        '<figure class="figure">\n'
        f'  <div class="figure-images" style="--count:{count}">{imgs}</div>\n'
        '  <figcaption class="figure-caption">\n'
        f'    <div class="figure-label">{label}</div>\n'
        "    <div>\n"
        f'      <div class="figure-title">{html.escape(title)}</div>\n'
        f'      <div class="figure-note">{note_block}</div>\n'
        "    </div>\n"
        "  </figcaption>\n"
        "</figure>"
    )


def existing_figure_paths(num: int) -> list[str]:
    folder = FIGURES / f"figure-{num:02d}"
    if not folder.exists():
        return []
    files = sorted(
        f for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTENSIONS
    )
    return [f"./figures/figure-{num:02d}/{f.name}" for f in files]


def close_schema(body: list[str], schema_open: bool) -> bool:
    if schema_open:
        body.append("</div>")
        return False
    return schema_open


def main() -> None:
    doc = Document(str(DOCX))
    footnotes = load_footnotes()
    interactive_queue = ["concept", "cows", "columns"]
    body: list[str] = []
    toc: list[tuple[str, str]] = []
    references: list[str] = []
    in_refs = False
    schema_open = False
    doc_title = "Complex Reduction"

    figure_num = 0
    pending: dict = {}

    def flush_figure() -> None:
        nonlocal pending
        if not pending.get("title"):
            pending = {}
            return
        num = pending.get("num") or figure_num
        paths = existing_figure_paths(num)
        if paths:
            body.append(
                render_figure(
                    num,
                    pending["title"],
                    pending.get("note") or "",
                    paths,
                )
            )
        pending = {}

    for p in doc.paragraphs:
        style = (p.style.name if p.style else "") or "Normal"
        text = p.text.strip()

        if style == "Title" and text:
            doc_title = text
            continue

        if in_refs:
            if text == "References":
                continue
            if text:
                references.append(f'<p class="reference">{runs_to_html(p)}</p>')
            continue

        if text == "References":
            flush_figure()
            schema_open = close_schema(body, schema_open)
            in_refs = True
            body.append('<h2 id="references">References</h2>')
            toc.append(("references", "References"))
            continue

        if style == "Heading 1" and text:
            flush_figure()
            schema_open = close_schema(body, schema_open)
            sec_id = slugify(text)
            body.append(f'<h2 id="{sec_id}">{html.escape(text)}</h2>')
            toc.append((sec_id, text))
            continue

        if style == "Figure Label" and text:
            flush_figure()
            m = re.search(r"(\d+)", text)
            figure_num = int(m.group(1)) if m else figure_num + 1
            pending = {"num": figure_num}
            continue

        if style == "Figure Title" and text:
            pending["title"] = text
            continue

        if style == "Figure Note" and text:
            pending["note"] = runs_to_html(p)
            flush_figure()
            continue

        if style == "Figure Image":
            if pending.get("title") and pending.get("note"):
                flush_figure()
            continue

        if style == "Process Schema" and text:
            flush_figure()
            if not schema_open:
                body.append('<div class="schema-block">')
                schema_open = True
            body.append(f'<div class="schema">{runs_to_html(p)}</div>')
            continue

        if style == "Digital Placeholder":
            flush_figure()
            schema_open = close_schema(body, schema_open)
            lower = text.lower()
            if lower.startswith("note."):
                note_html = format_note(runs_to_html(p))
                INTERACTIVES["columns"]["note"] = (
                    f'<p class="interactive-note">{note_html}</p>'
                )
                continue
            if "iframe" in lower or "slider" in lower:
                slug = interactive_queue.pop(0) if interactive_queue else None
                if slug:
                    body.append(render_interactive(slug))
            continue

        if not text:
            continue

        if style == "Normal":
            flush_figure()
            schema_open = close_schema(body, schema_open)
            body.append(f"<p>{runs_to_html(p)}</p>")

    flush_figure()
    schema_open = close_schema(body, schema_open)

    toc_html = "".join(
        f'<a href="#{sec_id}">{html.escape(title)}</a>' for sec_id, title in toc
    )
    article_html = "".join(body)
    refs_html = "".join(references)

    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="An interactive essay on complex reduction, postmodern design, and the This is not an apple collection.">
  <title>{html.escape(doc_title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
  <link rel="stylesheet" href="./style.css">
  <link rel="stylesheet" href="./interactives/shared/widget.css">
  <link rel="stylesheet" href="./interactives/shared/polygon-widget.css">
</head>
<body>
  <header class="site-header">{html.escape(doc_title)} / Interactive essay</header>
  <section class="hero">
    <div class="kicker">An interactive essay on postmodern design</div>
    <h1>{html.escape(doc_title)}</h1>
  </section>
  <main class="layout">
    <nav class="toc" aria-label="Essay sections">
      <strong>Contents</strong>
      {toc_html}
    </nav>
    <article>{article_html}<div class="references">{refs_html}</div></article>
  </main>
  <footer class="footer">{html.escape(doc_title)} · Interactive essay</footer>
  {render_footnotes_block(footnotes)}
  <script src="./interactives/data-bundle.js"></script>
  <script src="./interactives/shared/polygon-widget.js" defer></script>
  <script src="./interactives/shared/widget.js" defer></script>
  <script src="./citations.js" defer></script>
  <script src="./gallery.js" defer></script>
  <script src="./essay.js" defer></script>
</body>
</html>
"""

    INDEX.write_text(page, encoding="utf-8")
    print(f"Wrote {INDEX}")
    print(f"Sections: {len(toc)}")
    print(f"References: {len(references)}")
    print(f"Figure folders: {len(list(FIGURES.glob('figure-*')))}")
    print(f"Remaining interactives: {interactive_queue}")


if __name__ == "__main__":
    main()
