(function () {
  "use strict";

  const MARKUP =
    '<div class="pw-viewer">' +
      '<div class="pw-canvas-panel">' +
        '<div class="pw-stage-tag" id="stageTag">TRAJECTORY 0%</div>' +
        '<canvas id="shapeCanvas" width="900" height="700" aria-label="Rotating geometric form"></canvas>' +
        '<div class="pw-canvas-note" id="canvasNote">Move the master slider or isolate each transformation below.</div>' +
      "</div>" +
      '<div class="pw-info">' +
        '<div class="pw-phase" id="phase">Modernist Centre</div>' +
        '<div class="pw-descriptor" id="descriptor">2 real dimensions · 4 vertices</div>' +
        '<h3 class="pw-title" id="shapeTitle">Square</h3>' +
        '<p class="pw-desc" id="description">The square is a unified planar sign: regular, orthogonal, and stripped of inherited ornament.</p>' +
        '<dl class="pw-metrics">' +
          "<div><dt>Spatial condition</dt><dd id=\"dimensionMetric\">2D plane</dd></div>" +
          "<div><dt>Visible vertices</dt><dd id=\"vertexMetric\">4</dd></div>" +
          "<div><dt>Structural units</dt><dd id=\"unitMetric\">1 face</dd></div>" +
          "<div><dt>Formal condition</dt><dd id=\"conditionMetric\">Orthogonal reduction</dd></div>" +
        "</dl>" +
        '<div class="pw-formula">' +
          '<div class="pw-formula-label">Formal trajectory</div>' +
          "<p>Square → cube → rectangular prism → truncated pyramid → complex polygon</p>" +
        "</div>" +
        '<div class="pw-essay-note" id="essayNote">Complexity returns without abandoning abstraction.</div>' +
      "</div>" +
    "</div>" +
    '<div class="pw-controls">' +
      '<div class="pw-control-block">' +
        '<div class="pw-control-heading"><label for="trajectorySlider">Master trajectory</label><output id="trajectoryOutput">0%</output></div>' +
        '<input id="trajectorySlider" type="range" min="0" max="100" step="1" value="0">' +
        '<div class="pw-stage-labels" id="stageLabels"><span>Square</span><span>Cube</span><span>Rectangle</span><span>Frustum</span><span>4{4}2</span></div>' +
      "</div>" +
      '<div class="pw-param-grid">' +
        '<div class="pw-control-block">' +
          '<div class="pw-control-heading"><label for="dimensionSlider">1. Dimension / depth</label><output id="dimensionOutput">0%</output></div>' +
          '<input id="dimensionSlider" type="range" min="0" max="100" step="1" value="0">' +
          '<div class="pw-param-axis"><span>Square</span><span>Cube</span></div>' +
        "</div>" +
        '<div class="pw-control-block">' +
          '<div class="pw-control-heading"><label for="extensionSlider">2. Orthogonal extension</label><output id="extensionOutput">0%</output></div>' +
          '<input id="extensionSlider" type="range" min="0" max="100" step="1" value="0">' +
          '<div class="pw-param-axis"><span>Cube</span><span>Rectangle</span></div>' +
        "</div>" +
        '<div class="pw-control-block">' +
          '<div class="pw-control-heading"><label for="recombinationSlider">3. Faceting / recombination</label><output id="recombinationOutput">0%</output></div>' +
          '<input id="recombinationSlider" type="range" min="0" max="100" step="1" value="0">' +
          '<div class="pw-param-axis three"><span>Prism</span><span>Frustum</span><span>Complex</span></div>' +
        "</div>" +
      "</div>" +
      '<div class="pw-buttons">' +
        '<button id="rotateButton" type="button">Pause rotation</button>' +
        '<button id="resetButton" type="button">Reset</button>' +
      "</div>" +
    "</div>";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-polygon-engine="1"]')) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.dataset.polygonEngine = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window.PolygonWidget = {
    init: function (container) {
      container.innerHTML = MARKUP;
      container.classList.add("polygon-widget");
      window.__polygonRoot = container;
      return loadScript("./interactives/columns/polygon.js").then(function () {
        window.__polygonRoot = null;
      }).catch(function (err) {
        window.__polygonRoot = null;
        container.innerHTML = '<p class="figure-note">Interactive figure could not be loaded.</p>';
        console.error(err);
      });
    },
  };
})();
