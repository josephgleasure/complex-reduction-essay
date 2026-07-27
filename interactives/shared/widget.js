(function () {
  "use strict";

  function assetBase(slug) {
    return "./interactives/" + slug + "/";
  }

  function buildWidgetMarkup(data) {
    const count = data.works.length;
    const labelsStyle = "grid-template-columns:repeat(" + count + ",1fr)";
    let axisHtml = "";
    if (data.axis && data.axis.length) {
      axisHtml =
        '<div class="iw-axis">' +
        data.axis.map(function (label) {
          return "<span>" + label + "</span>";
        }).join("") +
        "</div>";
    }
    const noteHtml = data.note
      ? '<div class="iw-note">' + data.note + "</div>"
      : "";

    return (
      '<div class="iw-viewer">' +
        '<div class="iw-image-wrap">' +
          '<div class="iw-stage-tag"></div>' +
          '<div class="iw-hero-media single"></div>' +
        "</div>" +
        '<div class="iw-info">' +
          '<div class="iw-phase"></div>' +
          '<div class="iw-artist"></div>' +
          '<h3 class="iw-title"></h3>' +
          '<p class="iw-desc"></p>' +
          '<div class="iw-source"></div>' +
          noteHtml +
        "</div>" +
      "</div>" +
      '<div class="iw-controls">' +
        '<div class="iw-control-row">' +
          '<button type="button" class="iw-prev" aria-label="Previous stage">←</button>' +
          '<input class="iw-slider" type="range" min="1" max="' + count + '" step="1" value="1" aria-label="' + (data.sliderLabel || "Move through stages") + '">' +
          '<button type="button" class="iw-next" aria-label="Next stage">→</button>' +
        "</div>" +
        '<div class="iw-labels" style="' + labelsStyle + '"></div>' +
        axisHtml +
      "</div>"
    );
  }

  function mountWidget(container, data, slug) {
    const base = assetBase(slug);
    container.innerHTML = buildWidgetMarkup(data);
    container.classList.add("interactive-widget");

    const works = data.works;
    const hero = container.querySelector(".iw-hero-media");
    const slider = container.querySelector(".iw-slider");
    const labels = container.querySelector(".iw-labels");
    const stageTag = container.querySelector(".iw-stage-tag");
    const phase = container.querySelector(".iw-phase");
    const artist = container.querySelector(".iw-artist");
    const title = container.querySelector(".iw-title");
    const desc = container.querySelector(".iw-desc");
    const source = container.querySelector(".iw-source");
    const imageWrap = container.querySelector(".iw-image-wrap");

    function fitHeroImages() {
      if (!imageWrap || !hero) return;
      var maxH = hero.clientHeight || imageWrap.clientHeight;
      var maxW = hero.clientWidth || imageWrap.clientWidth;
      var isSplit = hero.classList.contains("split");
      var imgs = hero.querySelectorAll("img");
      var gap = isSplit && imgs.length > 1 ? 14 * (imgs.length - 1) : 0;
      var stacked = isSplit && window.matchMedia("(max-width: 560px)").matches;
      var slotW = isSplit && !stacked ? (maxW - gap) / imgs.length : maxW;
      var slotH = isSplit && stacked ? (maxH - gap) / imgs.length : maxH;
      imgs.forEach(function (img) {
        img.removeAttribute("style");
        if (!img.complete || !img.naturalWidth) return;
        var scale = Math.min(slotW / img.naturalWidth, slotH / img.naturalHeight, 1);
        img.style.width = Math.round(img.naturalWidth * scale) + "px";
        img.style.height = Math.round(img.naturalHeight * scale) + "px";
      });
    }

    works.forEach(function (_, i) {
      const span = document.createElement("span");
      span.textContent = String(i + 1);
      labels.appendChild(span);
    });

    function show(index) {
      const i = Math.max(0, Math.min(works.length - 1, index));
      const w = works[i];
      hero.style.opacity = "0";
      setTimeout(function () {
        if (w.img2) {
          hero.className = "iw-hero-media split";
          hero.innerHTML =
            '<img src="' + base + w.img + '" alt="' + w.title + '">' +
            '<img src="' + base + w.img2 + '" alt="Additional view of ' + w.title + '">';
        } else {
          hero.className = "iw-hero-media single";
          hero.innerHTML =
            '<img src="' + base + w.img + '" alt="' + w.title + ' by ' + w.artist + '">';
        }
        hero.style.opacity = "1";
        hero.querySelectorAll("img").forEach(function (img) {
          if (img.complete) {
            fitHeroImages();
          } else {
            img.addEventListener("load", fitHeroImages, { once: true });
          }
        });
        fitHeroImages();
      }, 70);

      stageTag.textContent = "Stage " + (i + 1) + " / " + works.length;
      phase.textContent = w.phase;
      artist.textContent = w.artist + ", " + w.year;
      title.textContent = w.title;
      desc.textContent = w.desc;
      source.textContent = "Image source: " + w.source;
      Array.from(labels.children).forEach(function (el, n) {
        el.classList.toggle("active", n === i);
      });
      slider.value = String(i + 1);
    }

    slider.addEventListener("input", function (e) {
      show(Number(e.target.value) - 1);
    });
    container.querySelector(".iw-prev").addEventListener("click", function () {
      show(Number(slider.value) - 2);
    });
    container.querySelector(".iw-next").addEventListener("click", function () {
      show(Number(slider.value));
    });

    window.addEventListener("resize", fitHeroImages);

    container.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        show(Number(slider.value) - 2);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        show(Number(slider.value));
      }
    });

    show(0);
  }

  window.InteractiveWidget = {
    init: function (container) {
      const slug = container.dataset.slug;
      if (!slug) return Promise.resolve();

      function loadData() {
        if (window.__interactiveData && window.__interactiveData[slug]) {
          return Promise.resolve(window.__interactiveData[slug]);
        }
        return fetch(assetBase(slug) + "data.json")
          .then(function (res) {
            if (!res.ok) throw new Error("Failed to load " + slug + " data");
            return res.json();
          });
      }

      return loadData()
        .then(function (data) {
          if (data.widgetType === "polygon") {
            if (!window.PolygonWidget) {
              throw new Error("PolygonWidget not loaded");
            }
            return window.PolygonWidget.init(container);
          }
          mountWidget(container, data, slug);
        })
        .catch(function (err) {
          container.innerHTML =
            '<p class="figure-note">Interactive figure could not be loaded. Open this page via a local server, or ensure interactives/data-bundle.js is included.</p>';
          console.error(err);
        });
    },
  };
})();
