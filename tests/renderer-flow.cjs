"use strict";

// Exercise the real renderer and preload with isolated IPC fixtures. No account,
// download, server connection or production configuration is touched.
const { app, BrowserWindow, ipcMain } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist", "ui-flow");
app.setPath("userData", path.join(output, `session-${process.pid}`));
app.on("window-all-closed", () => {});
const fixtures = [
  { id: "alpha", name: "Forest Adventure", description: "숲과 마을을 탐험하는 모험 모드팩", minecraftVersion: "1.20.1", modLoader: "fabric", javaMajor: 17, serverAddress: "forest.example:25565", manifestConfigured: true },
  { id: "beta", name: "Sky Workshop", description: "하늘에서 시작하는 새로운 제작과 탐험", minecraftVersion: "1.21.1", modLoader: "fabric", javaMajor: 21, serverAddress: "sky.example:25566", manifestConfigured: true },
  { id: "coming", name: "다음 모험", description: "새로운 모드팩을 준비하고 있습니다.", minecraftVersion: "1.21.1", modLoader: "fabric", javaMajor: 21, manifestConfigured: false }
];
let catalog = fixtures;
let signedIn = true;
let failProject = "";
let releaseJava;
let blockJava = false;
let expireLaunch = false;
const calls = [];
const mediaRequests = [];
const auth = () => ({ signedIn, profileName: signedIn ? "Tester" : "", uuid: signedIn ? "0123456789abcdef0123456789abcdef" : "" });
const handle = (name, fn) => ipcMain.handle(name, (_event, payload = {}) => fn(payload));
handle("launcher:get-defaults", ({ projectId }) => {
  if (projectId === failProject && failProject) return { ok: false, error: "선택 준비 실패 테스트" };
  const project = catalog.find((entry) => entry.id === projectId) || catalog[0];
  return { projectId: project?.id || "", projects: catalog, minecraftDirectory: project ? path.join(output, "instances", project.id) : "", javaPath: "", ramMin: 6144, ramMax: 6144, jvmArgs: "-XX:+UseZGC" };
});
handle("launcher:get-auth-state", auth);
handle("launcher:microsoft-login", () => { signedIn = true; return { ok: true, status: auth() }; });
handle("window:get-state", () => ({ maximized: false }));
handle("launcher:get-system-profile", () => ({ totalMemoryGb: 32, preset: "high" }));
handle("launcher:load-profiles", () => ({ ok: true, profiles: [] }));
handle("updater:get-state", () => ({ enabled: false, currentVersion: require("../package.json").version }));
handle("updater:ensure-latest", () => ({ ok: true }));
handle("launcher:get-github-release", () => ({ ok: true, configured: false }));
handle("launcher:auto-select-java", async (payload) => {
  calls.push({ type: "java", ...payload });
  if (blockJava) await new Promise((resolve) => { releaseJava = resolve; });
  return { ok: true, javaPath: path.join(output, payload.projectId, "java.exe") };
});
handle("launcher:check-modpack-update", (payload) => { calls.push({ type: "check", ...payload }); return { ok: true, pending: false }; });
handle("launcher:get-news", (payload) => { calls.push({ type: "news", ...payload }); return { ok: true, items: [], configured: false }; });
handle("launcher:get-server-status", (payload) => { calls.push({ type: "server", ...payload }); return { ok: true, hasServerTarget: false }; });
handle("launcher:launch", (payload) => {
  calls.push({ type: "launch", ...payload });
  if (expireLaunch) {
    signedIn = false;
    return { ok: false, code: "auth-session-expired", status: auth(), error: "로그인이 만료되었습니다." };
  }
  return { ok: false, error: "테스트 실행 요청 확인 완료" };
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const js = (win, code) => win.webContents.executeJavaScript(code);
async function waitFor(win, condition) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await js(win, condition)) return;
    await delay(40);
  }
  throw new Error(`UI condition timed out: ${condition}`);
}
async function screenshot(win, name) {
  await delay(360);
  fs.writeFileSync(path.join(output, name + ".png"), (await win.webContents.capturePage()).toPNG());
}
async function openWindow() {
  const win = new BrowserWindow({ width: 1280, height: 720, show: false, frame: false, webPreferences: {
    preload: path.join(root, "preload.js"), contextIsolation: true, nodeIntegration: false,
    offscreen: true, partition: `renderer-test-${Date.now()}`
  } });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    if (/\.(ogg|mp3|wav)(?:[?#]|$)/i.test(details.url)) mediaRequests.push(details.url);
    callback({ cancel: /^https?:/.test(details.url) });
  });
  await win.loadFile(path.join(root, "src", "index.html"));
  await waitFor(win, "startupOverlayDismissed && startupOverlay.hidden");
  return win;
}

app.whenReady().then(async () => {
  fs.mkdirSync(output, { recursive: true });
  let win = await openWindow();
  assert.equal(await js(win, "document.body.dataset.screen"), "projects");
  assert.equal(calls.length, 0, "opening the catalog must not download Java or query a default pack");
  assert.equal(await js(win, "projectCards.children.length"), 3);
  assert.equal(await js(win, "projectCards.querySelector('[data-project-id=coming]').disabled"), true);
  assert.equal(await js(win, "loginScreen.inert && launchScreen.inert && !projectsScreen.inert"), true);
  assert.equal(await js(win, "document.querySelectorAll('audio, #bgmControl').length"), 0);
  assert.equal(await js(win, "projectCards.querySelector('[data-project-id=alpha] .project-card-server').textContent"), "접속 서버 · forest.example:25565");
  await screenshot(win, "selection");
  await js(win, "projectsSettingsButton.click()");
  assert.equal(await js(win, "document.body.dataset.screen"), "settings");
  assert.equal(await js(win, "document.querySelector('[data-settings-tab=settingsTabJava]').disabled"), true);
  await js(win, "settingsCloseButton.click()");
  assert.equal(await js(win, "document.body.dataset.screen"), "projects");

  // Native buttons remain focusable; choosing the initial/default card works.
  await js(win, "projectCards.querySelector('[data-project-id=alpha]').focus()");
  assert.equal(await js(win, "document.activeElement.dataset.projectId"), "alpha");
  await js(win, "document.activeElement.click()");
  await waitFor(win, "hasConfirmedProject && !isProjectSwitching && currentScreen === 'launch'");
  assert.equal(calls.find((entry) => entry.type === "java").projectId, "alpha");
  assert.equal(await js(win, "currentProjectServer.textContent"), "접속 서버 · forest.example:25565");
  assert.equal(await js(win, "externalMedia.hidden"), true);
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "!isLaunchRequestPending");
  assert.equal(calls.find((entry) => entry.type === "launch").projectId, "alpha");
  await screenshot(win, "launch");
  await js(win, "settingsButton.click(); settingsCloseButton.click()");
  assert.equal(await js(win, "document.body.dataset.screen"), "launch");
  win.webContents.send("launcher:state", { launching: true });
  await waitFor(win, "changeProjectButton.disabled");
  await js(win, "changeProjectButton.click()");
  assert.equal(await js(win, "document.body.dataset.screen"), "launch");
  win.webContents.send("launcher:state", { launching: false });
  await waitFor(win, "!changeProjectButton.disabled");
  await js(win, "changeProjectButton.click()");
  assert.equal(await js(win, "document.body.dataset.screen"), "projects");
  failProject = "beta";
  await js(win, "projectCards.querySelector('[data-project-id=beta]').click()");
  await waitFor(win, "!isProjectSwitching && projectsStatus.classList.contains('is-error')");
  assert.equal(await js(win, "selectedProjectId"), "alpha");
  assert.equal(await js(win, "hasConfirmedProject"), false);
  failProject = "";
  await js(win, "projectCards.querySelector('[data-project-id=beta]').click()");
  await waitFor(win, "!isProjectSwitching && hasConfirmedProject");
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "!isLaunchRequestPending");
  const launches = calls.filter((entry) => entry.type === "launch");
  assert.equal(launches[1].projectId, "beta");
  assert.notEqual(launches[0].minecraftDirectory, launches[1].minecraftDirectory);
  assert.equal(await js(win, "currentProjectServer.textContent"), "접속 서버 · sky.example:25566");
  assert.equal("autoConnect" in launches[1], false);
  expireLaunch = true;
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "currentScreen === 'login' && !isLaunchRequestPending");
  assert.equal(await js(win, "hasConfirmedProject"), false);
  expireLaunch = false;
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'projects'");

  // Logout during Java preparation must never return to the launch screen.
  blockJava = true;
  await js(win, "launcherSettings.javaPath = ''; projectCards.querySelector('[data-project-id=beta]').click()");
  await waitFor(win, "isProjectSwitching");
  while (!releaseJava) await delay(20);
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  releaseJava();
  await waitFor(win, "!isProjectSwitching");
  assert.equal(await js(win, "currentScreen"), "login");
  blockJava = false;
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'projects'");
  await screenshot(win, "selection-recent");
  win.setSize(860, 660);
  await screenshot(win, "selection-small");
  assert.equal(await js(win, "document.documentElement.scrollWidth <= innerWidth && [...projectCards.children].every(card => card.getBoundingClientRect().right <= innerWidth)"), true);
  await js(win, "localStorage.setItem('betterlauncher.project.beta.settings.v1', JSON.stringify({ ...launcherSettings, gameWidth: 1600, bgmVolume: 80, bgmMuted: false, autoConnect: false }))");
  calls.length = 0;
  await new Promise((resolve) => { win.webContents.once("did-finish-load", resolve); win.reload(); });
  await waitFor(win, "startupOverlayDismissed && startupOverlay.hidden");
  assert.equal(await js(win, "currentScreen === 'projects' && selectedProjectId === 'beta' && !hasConfirmedProject"), true);
  assert.equal(await js(win, "projectCards.querySelector('[data-project-id=beta] .project-card-recent').textContent"), "최근 선택");
  assert.equal(calls.length, 0, "remembered packs still require explicit selection after restart");
  assert.equal(await js(win, "launcherSettings.gameWidth === 1600 && !('bgmVolume' in launcherSettings) && !('bgmMuted' in launcherSettings) && !('autoConnect' in launcherSettings)"), true);
  win.destroy();

  // Empty catalogs keep account and launcher update management accessible.
  catalog = [];
  calls.length = 0;
  win = await openWindow();
  assert.equal(await js(win, "currentScreen"), "projects");
  assert.equal(await js(win, "!projectsEmpty.hidden && startLaunchButton.disabled && projectCards.children.length === 0"), true);
  assert.equal(calls.length, 0);
  await screenshot(win, "empty");
  win.destroy();
  signedIn = false;
  win = await openWindow();
  assert.equal(await js(win, "currentScreen"), "login");
  await screenshot(win, "login");
  win.destroy();
  assert.equal(mediaRequests.length, 0, "the launcher must not load BGM in any screen");
  console.log("Renderer flow passed: administrator catalog, selected server address, no BGM, isolated launches, busy guard, auth expiry, logout race, remembered selection, empty state and 860px layout.");
  app.quit();
}).catch((error) => { console.error(error); app.exit(1); });
setTimeout(() => { console.error("Renderer test timed out"); app.exit(1); }, 45000).unref();
