"use strict";

const WINDOW_ASPECT_RATIO = 16 / 9;
// Keep the existing minimum usable height while matching the launcher's ratio.
const MAIN_WINDOW_GEOMETRY = Object.freeze({ width: 1280, height: 720, minWidth: 1184, minHeight: 666 });

function configureWindowGeometry(window) {
  window.setAspectRatio(WINDOW_ASPECT_RATIO);
  window.setMaximizable(false);
  window.setFullScreenable(false);
}

module.exports = { WINDOW_ASPECT_RATIO, MAIN_WINDOW_GEOMETRY, configureWindowGeometry };
