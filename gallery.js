(function () {
  "use strict";

  let lightbox = null;
  let currentFigure = null;
  let currentIndex = 0;
  let images = [];
  let lastFocus = null;

  function buildLightbox() {
    lightbox = document.createElement("div");
    lightbox.className = "lightbox";
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Figure gallery");
    lightbox.innerHTML =
      '<div class="lightbox-toolbar">' +
        '<span class="lightbox-caption"></span>' +
        '<button type="button" class="lightbox-close" aria-label="Close gallery">×</button>' +
      "</div>" +
      '<div class="lightbox-stage">' +
        '<button type="button" class="lightbox-nav prev" aria-label="Previous image">←</button>' +
        '<img class="lightbox-image" alt="">' +
        '<button type="button" class="lightbox-nav next" aria-label="Next image">→</button>' +
      "</div>" +
      '<div class="lightbox-dots"></div>';
    document.body.appendChild(lightbox);

    lightbox.querySelector(".lightbox-close").addEventListener("click", close);
    lightbox.querySelector(".lightbox-nav.prev").addEventListener("click", function () {
      showIndex(currentIndex - 1);
    });
    lightbox.querySelector(".lightbox-nav.next").addEventListener("click", function () {
      showIndex(currentIndex + 1);
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) close();
    });
  }

  function updateDots() {
    const dots = lightbox.querySelector(".lightbox-dots");
    dots.innerHTML = "";
    if (images.length <= 1) return;

    images.forEach(function (_, i) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "lightbox-dot" + (i === currentIndex ? " active" : "");
      dot.setAttribute("aria-label", "Image " + (i + 1));
      dot.addEventListener("click", function () { showIndex(i); });
      dots.appendChild(dot);
    });
  }

  function showIndex(index) {
    if (!images.length) return;
    currentIndex = (index + images.length) % images.length;
    const img = images[currentIndex];
    const stageImg = lightbox.querySelector(".lightbox-image");
    stageImg.src = img.src;
    stageImg.alt = img.alt;

    const prev = lightbox.querySelector(".lightbox-nav.prev");
    const next = lightbox.querySelector(".lightbox-nav.next");
    const multi = images.length > 1;
    prev.style.display = multi ? "" : "none";
    next.style.display = multi ? "" : "none";
    prev.disabled = !multi;
    next.disabled = !multi;

    updateDots();
  }

  function open(figure, index) {
    if (!lightbox) buildLightbox();

    currentFigure = figure;
    images = Array.from(figure.querySelectorAll(".figure-images img"));
    if (!images.length) return;

    lastFocus = document.activeElement;
    currentIndex = index;

    const label = figure.querySelector(".figure-label");
    const title = figure.querySelector(".figure-title");
    const caption = lightbox.querySelector(".lightbox-caption");
    caption.textContent =
      (label ? label.textContent + ": " : "") + (title ? title.textContent : "");

    showIndex(currentIndex);
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
    lightbox.querySelector(".lightbox-close").focus();
  }

  function close() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (!lightbox || !lightbox.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") showIndex(currentIndex - 1);
    if (e.key === "ArrowRight") showIndex(currentIndex + 1);
  });

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("figure.figure").forEach(function (figure) {
      figure.querySelectorAll(".figure-images img").forEach(function (img, index) {
        img.setAttribute("tabindex", "0");
        img.setAttribute("role", "button");
        img.setAttribute("aria-label", "View " + (img.alt || "figure image") + " at full size");

        function activate() {
          open(figure, index);
        }

        img.addEventListener("click", activate);
        img.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        });
      });
    });
  });
})();
