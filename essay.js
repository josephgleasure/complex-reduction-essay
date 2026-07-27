document.addEventListener("DOMContentLoaded", function () {
  const widgets = document.querySelectorAll(".interactive-widget[data-slug]");
  if (!window.InteractiveWidget) return;

  Promise.all(
    Array.from(widgets).map(function (el) {
      return window.InteractiveWidget.init(el);
    })
  );
});
