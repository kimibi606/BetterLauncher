"use strict";

const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { WINDOW_ASPECT_RATIO, MAIN_WINDOW_GEOMETRY, getWindowGeometry, configureWindowGeometry } = require("../lib/window-geometry");
const run = promisify(execFile);
app.setPath("userData", path.join(__dirname, "..", "dist", "window-geometry", `session-${process.pid}`));
app.on("window-all-closed", () => {});

app.whenReady().then(async () => {
  assert.deepEqual(getWindowGeometry({ width: 1920, height: 1040 }), MAIN_WINDOW_GEOMETRY);
  const compact = getWindowGeometry({ width: 1024, height: 560 });
  assert.deepEqual(compact, { width: 992, height: 558, minWidth: 992, minHeight: 558 });
  const window = new BrowserWindow({ ...compact, frame: false, thickFrame: false,
    show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  configureWindowGeometry(window);
  assert.equal(window.isMaximizable(), false);
  assert.equal(window.isFullScreenable(), false);
  assert.deepEqual(window.getMinimumSize(), [compact.minWidth, compact.minHeight]);
  if (process.platform === "win32") {
    const handle = window.getNativeWindowHandle().readBigUInt64LE().toString();
    const { stdout } = await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", path.join(__dirname, "window-geometry.ps1"), "-WindowHandle", handle], { windowsHide: true });
    const results = JSON.parse(stdout);
    assert.equal(results.length, 32);
    for (const result of results) {
      assert.ok(Math.abs(result.width / WINDOW_ASPECT_RATIO - result.height) <= 1,
        `Native resize edge ${result.edge} broke the aspect ratio: ${result.width}x${result.height}`);
      assert.ok(result.width >= compact.minWidth && result.height >= compact.minHeight);
    }
    console.log("Window geometry passed: 32 native Windows resize proposals retain 16:9, including minimum size and all eight resize edges.");
  }
  window.destroy();
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
setTimeout(() => { console.error("Window geometry test timed out."); app.exit(1); }, 30000).unref();
