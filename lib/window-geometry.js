"use strict";

const WINDOW_ASPECT_RATIO = 16 / 9;
// Keep the existing minimum usable height while matching the launcher's ratio.
const MAIN_WINDOW_GEOMETRY = Object.freeze({ width: 1280, height: 720, minWidth: 1184, minHeight: 666 });

function getWindowGeometry(workArea) {
  const units = Math.max(1, Math.min(Math.floor(workArea.width / 16), Math.floor(workArea.height / 9)));
  return {
    width: Math.min(MAIN_WINDOW_GEOMETRY.width, units * 16),
    height: Math.min(MAIN_WINDOW_GEOMETRY.height, units * 9),
    minWidth: Math.min(MAIN_WINDOW_GEOMETRY.minWidth, units * 16),
    minHeight: Math.min(MAIN_WINDOW_GEOMETRY.minHeight, units * 9)
  };
}

function configureWindowGeometry(window) {
  window.setAspectRatio(WINDOW_ASPECT_RATIO);
  window.setMaximizable(false);
  window.setFullScreenable(false);
}

module.exports = { WINDOW_ASPECT_RATIO, MAIN_WINDOW_GEOMETRY, getWindowGeometry, configureWindowGeometry };
