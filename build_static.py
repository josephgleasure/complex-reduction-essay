from __future__ import annotations

import json
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parent
WORKSPACE = ROOT.parent
DATA = WORKSPACE / "interactive-essay" / "app" / "essay-data.json"
FIGURES = WORKSPACE / "interactive-essay" / "public" / "figures"
SOURCE = Path(
    r"C:\Users\josep\Desktop\Personal\Fruit\Process\Writing\Complex Reduction"
)


def render_item(item: dict) -> str:
    kind = item["type"]
    if kind == "heading":
        return f'<h2 id="{item["id"]}">{item["text"]}</h2>'
    if kind == "paragraph":
        cls = ' class="lead"' if item.get("lead") else ""
        return f"<p{cls}>{item['html']}</p>"
    if kind == "schema":
        return f'<div class="schema">{item["html"]}</div>'
    if kind == "figure":
        count = max(1, len(item["images"]))
        images = "".join(
            f'<img src=".{src}" alt="{item["label"]}: {item["title"]}">'
            for src in item["images"]
        )
        return f"""
<figure class="figure">
  <div class="figure-images" style="--count:{min(count, 4)}">{images}</div>
  <figcaption class="figure-caption">
    <div class="figure-label">{item["label"]}</div>
    <div>
      <div class="figure-title">{item["title"]}</div>
      <div class="figure-note">{item["note"]}</div>
    </div>
  </figcaption>
</figure>"""
    if kind == "interactive":
        title = item["title"]
        return f"""
<figure class="interactive">
  <div class="interactive-widget" data-slug="{item["slug"]}" tabindex="0"
    aria-label="{title}"></div>
  <figcaption class="interactive-caption">
    <div class="interactive-label">{item["eyebrow"]}</div>
    <div>
      <div class="interactive-title">{title}</div>
      <div class="figure-note">{item["description"]}</div>
    </div>
  </figcaption>
</figure>"""
    if kind == "interactive-note":
        return f'<p class="interactive-note">{item["html"]}</p>'
    if kind == "reference":
        return f'<p class="reference">{item["html"]}</p>'
    return ""


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    sections = "".join(
        f'<a href="#{section["id"]}">{section["title"]}</a>'
        for section in data["sections"]
    )

    body_parts: list[str] = []
    references: list[str] = []
    in_references = False
    for item in data["items"]:
        if item["type"] == "heading" and item["id"] == "references":
            in_references = True
            body_parts.append(render_item(item))
            continue
        if in_references and item["type"] == "reference":
            references.append(render_item(item))
        else:
            body_parts.append(render_item(item))
    if references:
        body_parts.append(f'<div class="references">{"".join(references)}</div>')

    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="An interactive essay on complex reduction and postmodern design.">
  <title>{data["title"]}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
  <link rel="stylesheet" href="./style.css">
  <link rel="stylesheet" href="./interactives/shared/widget.css">
  <link rel="stylesheet" href="./interactives/shared/polygon-widget.css">
</head>
<body>
  <header class="site-header">Complex Reduction / Interactive essay prototype</header>
  <section class="hero">
    <div class="kicker">{data["kicker"]}</div>
    <h1>{data["title"]}</h1>
  </section>
  <main class="layout">
    <nav class="toc" aria-label="Essay sections">
      <strong>Contents</strong>
      {sections}
    </nav>
    <article>{"".join(body_parts)}</article>
  </main>
  <footer class="footer">Complex Reduction · Interactive essay prototype</footer>
  <aside id="footnotes" hidden>
    <p id="fn-1">Strictly speaking, the Getty Villa was modeled after the Villa dei Papiri at Herculaneum, not Pompeii; however, Jean Baudrillard’s description of the site in <em>America</em> called it Pompeiian, and interrogating the minute differences between both cities' vernacular architecture is beyond the scope of this work.</p>
  </aside>
  <script src="./interactives/data-bundle.js"></script>
  <script src="./interactives/shared/polygon-widget.js" defer></script>
  <script src="./interactives/shared/widget.js" defer></script>
  <script src="./citations.js" defer></script>
  <script src="./gallery.js" defer></script>
  <script src="./essay.js" defer></script>
</body>
</html>
"""
    (ROOT / "index.html").write_text(page, encoding="utf-8")

    target_figures = ROOT / "figures"
    if target_figures.exists():
        shutil.rmtree(target_figures)
    shutil.copytree(FIGURES, target_figures)

    target_interactives = ROOT / "interactives"
    target_interactives.mkdir(exist_ok=True)
    for slug, source_name in (
        ("cows", "10 Cows"),
        ("columns", "Coloumns"),
        ("concept", "Complex Reduction concept"),
    ):
        dest = target_interactives / slug
        data_backup = None
        if (dest / "data.json").exists():
            data_backup = (dest / "data.json").read_text(encoding="utf-8")
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(SOURCE / source_name, dest)
        if data_backup:
            (dest / "data.json").write_text(data_backup, encoding="utf-8")

    bundle_parts = {}
    for slug in ("concept", "cows", "columns"):
        data_path = target_interactives / slug / "data.json"
        if data_path.exists():
            bundle_parts[slug] = json.loads(data_path.read_text(encoding="utf-8"))
    if bundle_parts:
        bundle_js = "window.__interactiveData=" + json.dumps(bundle_parts, indent=2) + ";\n"
        (target_interactives / "data-bundle.js").write_text(bundle_js, encoding="utf-8")
    print(f"Built {ROOT / 'index.html'}")


if __name__ == "__main__":
    main()
