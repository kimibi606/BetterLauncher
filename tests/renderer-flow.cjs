"use strict";

// Exercise the real renderer and preload with isolated IPC fixtures. No account,
// download, server connection or production configuration is touched.
const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist", "ui-flow");
app.setPath("userData", path.join(output, `session-${process.pid}`));
app.on("window-all-closed", () => {});
const fixtures = [
  { id: "alpha", name: "Forest Adventure", description: "숲과 마을을 탐험하는 모험 모드팩", minecraftVersion: "1.20.1", modLoader: "fabric", javaMajor: 17, manifestConfigured: true },
  { id: "beta", name: "Sky Workshop", description: "하늘에서 시작하는 새로운 제작과 탐험", minecraftVersion: "1.21.1", modLoader: "fabric", javaMajor: 21, manifestConfigured: true },
  { id: "coming", name: "다음 모험", description: "새로운 모드팩을 준비하고 있습니다.", minecraftVersion: "1.21.1", modLoader: "fabric", javaMajor: 21, manifestConfigured: false }
];
let catalog = fixtures;
let signedIn = true;
let failDefaults = false;
let defaultProjectId = "alpha";
let instanceRevision = 0;
let pendingUpdate = false;
let blockUpdate = false;
let releaseUpdate;
let releaseJava;
let blockJava = false;
let expireLaunch = false;
let activeAccountUuid = "0123456789abcdef0123456789abcdef";
let extraAccount = null;
let accountSwitchCount = 0;
let blockLaunch = false;
let releaseLaunch;
let launchResult = { ok: false, error: "테스트 실행 요청 확인 완료" };
let delayedSkinUuid = "";
let failedSkinUuid = "";
let failServerStatus = false;
let releaseSkin;
const skinRequests = [];
const { skinPng } = require("./skin-fixture.cjs");
const calls = [];
const removedFeatureRequests = [];
const defaultsRequests = [];
let updaterFixture = { enabled: false, currentVersion: require("../package.json").version };
let updaterResult = { ok: true };
let loginFailure = null;
let loginThrows = false;
let blockLogin = false;
let releaseLogin;
let loginCalls = 0;
const mediaRequests = [];
const auth = () => ({ signedIn, profileName: signedIn ? (extraAccount?.uuid === activeAccountUuid ? extraAccount.profileName : "Tester") : "", uuid: signedIn ? activeAccountUuid : "",
  accounts: signedIn ? (extraAccount ? [
    { id: "0123456789abcdef0123456789abcdef", uuid: "0123456789abcdef0123456789abcdef", profileName: "Tester" }, extraAccount
  ].map(account => ({ ...account, selected: account.uuid === activeAccountUuid }))
    : [{ id: activeAccountUuid, uuid: activeAccountUuid, profileName: "Tester", selected: true }]) : [] });
const handle = (name, fn) => ipcMain.handle(name, (_event, payload = {}) => fn(payload));
handle("launcher:get-defaults", ({ projectId }) => {
  defaultsRequests.push(projectId);
  if (failDefaults) return { ok: false, error: "모드팩 설정 읽기 실패 테스트" };
  const project = catalog.find((entry) => entry.id === projectId) || catalog.find((entry) => entry.id === defaultProjectId) || catalog[0];
  const instanceName = instanceRevision ? `${project?.id}.rev-${instanceRevision}` : project?.id;
  return { projectId: project?.id || "", projects: catalog, instanceRevision, minecraftDirectory: project ? path.join(output, "instances", instanceName) : "", javaPath: "", ramMin: 6144, ramMax: 6144, jvmArgs: "" };
});
handle("launcher:get-auth-state", auth);
handle("launcher:microsoft-select-account", (accountId) => {
  assert.ok(auth().accounts.some(account => account.id === accountId));
  activeAccountUuid = accountId;
  accountSwitchCount++;
  return { ok: true, status: auth() };
});
handle("launcher:get-account-skin", async ({ uuid }) => {
  skinRequests.push(uuid);
  if (uuid === delayedSkinUuid) await new Promise((resolve) => { releaseSkin = resolve; });
  if (uuid === failedSkinUuid) return { ok: false };
  return { ok: true, uuid, model: uuid.startsWith("2") ? "slim" : "classic",
    textureDataUrl: "data:image/png;base64," + skinPng({ color: uuid.startsWith("2") ? [152, 60, 172] : [48, 152, 172],
      faceColor: [188, 137, 106].map((value, index) => value - (parseInt(uuid[0], 16) % 7) * (index + 1) * 2) }).toString("base64") };
});
handle("launcher:microsoft-login", async () => {
  loginCalls++;
  if (blockLogin) await new Promise(resolve => { releaseLogin = resolve; });
  if (loginThrows) throw new Error("Test login IPC failure");
  if (loginFailure) return { ...loginFailure, status: { ...auth(), signedIn: false, loggingIn: false } };
  signedIn = true; return { ok: true, status: auth() };
});
handle("window:get-state", () => ({ maximized: false }));
handle("launcher:get-system-profile", () => ({ totalMemoryGb: 32, preset: "high" }));
handle("launcher:load-profiles", () => ({ ok: true, profiles: [] }));
handle("updater:get-state", () => updaterFixture);
handle("updater:ensure-latest", () => updaterResult);
handle("updater:check", () => updaterResult);
handle("launcher:get-github-release", () => ({ ok: true, configured: false }));
handle("launcher:auto-select-java", async (payload) => {
  calls.push({ type: "java", ...payload });
  if (blockJava) await new Promise((resolve) => { releaseJava = resolve; });
  return { ok: true, javaPath: path.join(output, payload.projectId, "java.exe") };
});
handle("launcher:check-modpack-update", async (payload) => {
  calls.push({ type: "check", ...payload });
  if (blockUpdate) await new Promise((resolve) => { releaseUpdate = resolve; });
  return { ok: true, pending: pendingUpdate };
});
handle("launcher:sync-modpack", (payload) => { calls.push({ type: "sync", ...payload }); pendingUpdate = false; return { ok: true, version: "1.0.1" }; });
handle("launcher:reinstall-modpack", (payload) => { calls.push({ type: "reinstall", ...payload }); return { ok: true, version: "1.0.1" }; });
handle("launcher:get-news", (payload) => { removedFeatureRequests.push({ type: "news", ...payload }); return { ok: true, items: [], configured: false }; });
handle("launcher:get-server-status", (payload) => {
  calls.push({ type: "server", ...payload });
  if (failServerStatus) throw new Error("connect 203.0.113.42:25565 alpha.example");
  return { ok: true, hasServerTarget: false };
});
handle("launcher:launch", async (payload) => {
  calls.push({ type: "launch", ...payload });
  if (blockLaunch) await new Promise(resolve => { releaseLaunch = resolve; });
  if (expireLaunch) {
    signedIn = false;
    return { ok: false, code: "auth-session-expired", status: auth(), error: "로그인이 만료되었습니다." };
  }
  return launchResult;
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
async function openWindow({ webgl = true } = {}) {
  const win = new BrowserWindow({ width: 1280, height: 720, show: false, frame: false, webPreferences: {
    preload: path.join(root, "preload.js"), contextIsolation: true, nodeIntegration: false,
    offscreen: true, webgl, partition: `renderer-test-${Date.now()}`
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
  signedIn = false;
  loginFailure = { ok: false, ...require("../lib/microsoft-login-errors").describeMicrosoftLoginFailure(new Error("Xbox account does not have an Xbox profile")) };
  let loginWin = await openWindow();
  await js(loginWin, "gateMicrosoftLoginButton.click()");
  await waitFor(loginWin, "!authState.loggingIn && !gateMicrosoftLoginButton.disabled");
  assert.equal(await js(loginWin, "gateAuthStatus.textContent"), loginFailure.error);
  assert.equal(await js(loginWin, "gateAuthStatus.classList.contains('is-error')"), true);
  loginWin.webContents.send("launcher:auth-state", auth());
  await delay(50);
  assert.equal(await js(loginWin, "gateAuthStatus.textContent"), loginFailure.error, "later signed-out state must not erase the failure");
  await screenshot(loginWin, "login-failure-visible");
  loginFailure = null;
  loginThrows = true;
  await js(loginWin, "gateMicrosoftLoginButton.click()");
  await waitFor(loginWin, "!authState.loggingIn && !gateMicrosoftLoginButton.disabled");
  assert.match(await js(loginWin, "gateAuthStatus.textContent"), /다시/);
  assert.equal(await js(loginWin, "currentScreen"), "login");
  loginThrows = false;
  blockLogin = true;
  releaseLogin = null;
  const callsBefore = loginCalls;
  await js(loginWin, "for(let i=0;i<10;i++) gateMicrosoftLoginButton.click()");
  while (!releaseLogin) await delay(20);
  assert.equal(loginCalls, callsBefore + 1);
  assert.equal(await js(loginWin, "gateAuthStatus.classList.contains('is-error')"), false);
  loginWin.webContents.send("launcher:auth-state", { ...auth(), loggingIn: true, loginStage: "minecraft-session" });
  await waitFor(loginWin, "loginWaitingState.classList.contains('is-active')");
  assert.match(await js(loginWin, "document.querySelector('.login-waiting-text').textContent"), /게임 계정/);
  releaseLogin();
  await waitFor(loginWin, "currentScreen === 'launch' && hasActiveModpack && !isModpackPreparing");
  assert.equal(await js(loginWin, "gateAuthStatus.classList.contains('is-error')"), false);
  blockLogin = false;
  loginWin.destroy();
  skinRequests.length = 0;
  calls.length = 0;
  defaultsRequests.length = 0;
  let win = await openWindow();
  assert.equal(await js(win, "currentScreen"), "launch");
  assert.equal(await js(win, "document.querySelector('#projectsScreen, #changeProjectButton, .project-cards')"), null);
  assert.equal(await js(win, "loginScreen.inert && !launchScreen.inert && settingsScreen.inert"), true);
  assert.equal(await js(win, "hasActiveModpack && !isModpackPreparing && activeProjectId === 'alpha'"), true);
  assert.equal(calls.find((entry) => entry.type === "java").projectId, "alpha");
  assert.equal(calls.find((entry) => entry.type === "check").projectId, "alpha");
  assert.equal(await js(win, "document.querySelector('.modpack-info, #currentProjectName, #currentProjectServer, #projectDescription')"), null);
  assert.equal(await js(win, "'serverAddress' in activeModpack"), false);
  assert.equal(await js(win, "document.querySelectorAll('audio, #bgmControl').length"), 0);
  assert.equal(await js(win, "document.querySelector('#newsPanel, #settingsAboutNewsList, .launcher-footer, .start-launch-logo')"), null);
  assert.equal(await js(win, "typeof launcherApi.getNews === 'undefined' && typeof launcherApi.getServerStatus === 'function'"), true);
  assert.equal(await js(win, "document.querySelector('#launchStatus, .start-launch-status, #windowMinimize, #windowMaximize, #settingsTabLauncher, #settingsTabUpdate, [data-settings-tab=settingsTabLauncher], [data-settings-tab=settingsTabUpdate]')"), null);
  assert.equal(await js(win, "launchProgress.textContent"), "100%");
  assert.equal(await js(win, "launchProgress.hidden"), true, "ready-to-play state must not show a percentage");
  await waitFor(win, "accountModelImage.dataset.skinState === 'ready'");
  assert.equal(await js(win, "accountModelImage.src.startsWith('data:image/png;base64,') && accountModelImage.naturalHeight === 576"), true);
  assert.equal(await js(win, "window.minecraftSkinModel.renderer"), "webgl");
  const facePixels = [];
  for (const height of [32, 64]) {
    const texture = "data:image/png;base64," + skinPng({ height, opaqueHat: true }).toString("base64");
    const image = nativeImage.createFromDataURL(await js(win, "window.minecraftSkinModel.render(" + JSON.stringify(texture) + ")"));
    const pixels = image.toBitmap();
    assert.equal(pixels[3], 0, "3D portrait background must remain transparent");
    let visibleFace = 0;
    for (let pixel = 0; pixel < 320 * 190; pixel++) if (pixels[pixel * 4 + 2] > 100 && pixels[pixel * 4 + 3] > 128) visibleFace++;
    facePixels.push(visibleFace);
  }
  assert.ok(facePixels[0] > 1000 && facePixels[1] < facePixels[0] * 0.2, "legacy opaque hat regions must not cover the face; modern hats stay visible");
  const modelTexture = "data:image/png;base64," + skinPng().toString("base64");
  const paintedPixels = [];
  for (const model of ["classic", "slim"]) {
    const image = nativeImage.createFromDataURL(await js(win, "window.minecraftSkinModel.render(" + JSON.stringify(modelTexture) + "," + JSON.stringify(model) + ")"));
    const bitmap = image.toBitmap();
    let painted = 0;
    for (let pixel = 3; pixel < bitmap.length; pixel += 4) if (bitmap[pixel] > 0) painted++;
    paintedPixels.push(painted);
  }
  assert.ok(paintedPixels[0] > paintedPixels[1], "slim arms are narrower than classic arms for the same texture");
  await screenshot(win, "single-modpack-launch");

  // Pending, failed, offline and thrown status results must not expose network
  // diagnostics through visible text, custom tooltips or native title hovers.
  const privateError = "connect 203.0.113.42:25565 alpha.example https://cdn.example/private?token=secret";
  const statusFixtures = [
    { ok: true, hasServerTarget: true, server: { online: null, error: privateError } },
    { ok: false, error: privateError },
    { ok: true, hasServerTarget: false, server: { error: privateError } },
    { ok: true, hasServerTarget: true, server: { online: false, error: privateError } }
  ];
  for (const snapshot of statusFixtures) {
    await js(win, "playerCountPanel.title = 'old target'; playerCountValue.title = 'old target'; applyPlayerCountUi(" + JSON.stringify(snapshot) + ")");
    assert.equal(await js(win, "playerCountTooltip.textContent === '' && !playerCountPanel.hasAttribute('title') && !playerCountValue.hasAttribute('title')"), true);
  }
  await js(win, "applyPlayerCountUi({ ok: true, hasServerTarget: true, server: { online: true, playersOnline: 2, playersMax: 20, playerNames: ['Friend_1', 'alpha.example', '203.0.113.42'] } })");
  assert.equal(await js(win, "playerCountTooltip.textContent"), "Friend_1\n외 1명");
  failServerStatus = true;
  await js(win, "refreshPlayerCount()");
  assert.equal(await js(win, "playerCountTooltip.textContent"), "");
  failServerStatus = false;
  const privateDiagnostic = privateError + " accessToken=game-secret C:\\Users\\Friend Name\\instance 01234567-89ab-cdef-0123-456789abcdef";
  for (const setter of ["setLaunchStatus", "setSettingsStatus", "setStartupStatus"]) {
    await js(win, setter + "(" + JSON.stringify(privateDiagnostic) + ", true)");
  }
  assert.doesNotMatch(await js(win, "launchStatusMessage + (startLaunchButton.title || '')"), /203\.0\.113\.42|alpha\.example|cdn\.example|game-secret|Friend Name|01234567/);
  for (const element of ["settingsStatus", "startupStatus"]) {
    assert.doesNotMatch(await js(win, element + ".textContent"), /203\.0\.113\.42|alpha\.example|cdn\.example|game-secret|Friend Name|01234567/);
  }
  await js(win, "setLaunchStatus('모드팩이 최신 상태입니다.');");

  await js(win, "settingsButton.click()");
  assert.equal(await js(win, "currentScreen"), "settings");
  assert.equal(await js(win, "document.querySelector('[data-settings-tab=settingsTabJava]').disabled"), false);
  await waitFor(win, "settingsAccountList.querySelector('img').dataset.skinState === 'ready' && settingsAccountList.querySelector('img').naturalHeight === 8");
  assert.equal(await js(win, "settingsAccountList.querySelector('img').naturalHeight === 8 && accountModelImage.naturalHeight === 576"), true);
  assert.equal(await js(win, "settingsAccountList.textContent.includes(authState.uuid) || !!settingsAccountList.querySelector('.settings-account-uuid-value')"), false);
  assert.equal(skinRequests.length, 1, "menu and settings reuse the same skin request");
  await screenshot(win, "single-modpack-settings");
  assert.equal(await js(win, "!launchScreen.hidden && launchScreen.inert && settingsScreen.querySelector('[role=dialog][aria-modal=true]') !== null"), true);
  for (const [width, height] of [[1280, 720], [860, 660]]) {
    win.setSize(width, height);
    await delay(120);
    for (const tab of ["Account", "Minecraft", "Java", "About"]) {
      await js(win, `document.querySelector('[data-settings-tab=settingsTab${tab}]').click()`);
      const geometry = await js(win, `(() => {
        const dialog = document.querySelector('.settings-container').getBoundingClientRect();
        const panel = document.querySelector('.settings-content-panel');
        const close = settingsCloseButton.getBoundingClientRect();
        return { fits: dialog.left >= 0 && dialog.top >= 0 && dialog.right <= innerWidth && dialog.bottom <= innerHeight,
          noHorizontalOverflow: panel.scrollWidth <= panel.clientWidth,
          closeClickable: document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2)?.id === 'settingsCloseButton' };
      })()`);
      assert.ok(geometry.fits && geometry.noHorizontalOverflow && geometry.closeClickable, `${width}px ${tab} settings must fit and remain usable`);
      if (["Account", "Minecraft", "Java"].includes(tab)) await screenshot(win, `settings-${tab.toLowerCase()}-${width}`);
      if (tab === "Java") {
        assert.equal(await js(win, `(() => {
          const panel = document.querySelector('.settings-content-panel');
          panel.scrollTop = panel.scrollHeight;
          const close = settingsCloseButton.getBoundingClientRect();
          const clickable = document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2)?.id === 'settingsCloseButton';
          panel.scrollTop = 0;
          return clickable;
        })()`), true, "closing the modal must remain possible after scrolling");
      }
    }
  }
  win.setSize(1280, 720);
  const originalDirectories = await js(win, "[launcherSettings.minecraftDirectory, launcherSettings.dataDirectory]");
  await js(win, "launcherSettings.minecraftDirectory += '-custom'; launcherSettings.dataDirectory += '-custom'");
  await js(win, "selectSettingsTab('settingsTabMinecraft'); settingsGameWidthInput.value = '1440'; settingsFullscreenInput.checked = true; settingsCloseButton.click()");
  assert.equal(await js(win, "launcherSettings.gameWidth === 1440 && launcherSettings.fullscreen"), true);
  assert.deepEqual(await js(win, "[launcherSettings.minecraftDirectory, launcherSettings.dataDirectory]"), originalDirectories.map(value => value + '-custom'));
  await js(win, "[launcherSettings.minecraftDirectory, launcherSettings.dataDirectory] = " + JSON.stringify(originalDirectories));

  await js(win, "settingsButton.click()");
  assert.equal(await js(win, "settingsGameWidthInput.value === '1440' && settingsFullscreenInput.checked"), true);
  await js(win, "selectSettingsTab('settingsTabMinecraft'); settingsReinstallModpack.click()");
  await waitFor(win, "settingsStatus.textContent.includes('최신 모드팩을 재설치했습니다')");
  assert.equal(calls.find(({ type }) => type === "reinstall").minecraftDirectory, originalDirectories[0]);
  await js(win, "settingsGameWidthInput.value = '1280'; settingsFullscreenInput.checked = false; selectSettingsTab('settingsTabAccount')");
  extraAccount = { id: "2".repeat(32), uuid: "2".repeat(32), profileName: "SecondPlayer" };
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "settingsAccountList.querySelectorAll('.settings-account-card').length === 2");
  await js(win, "settingsAccountList.querySelector('.settings-account-card:not(.is-selected)').click()");
  await waitFor(win, "authState.profileName === 'SecondPlayer' && !isModpackPreparing");
  assert.equal(accountSwitchCount, 1);
  assert.equal(await js(win, "settingsAccountList.querySelector('.is-selected').getAttribute('aria-pressed')"), "true");
  await js(win, "const firstAccountCard = settingsAccountList.querySelector('.settings-account-card:not(.is-selected)'); firstAccountCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))");
  await waitFor(win, "authState.profileName === 'Tester' && !isModpackPreparing");
  assert.equal(accountSwitchCount, 2);
  extraAccount = null;
  win.webContents.send("launcher:auth-state", auth());
  await js(win, "settingsMicrosoftAddButton.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))");
  assert.equal(await js(win, "document.activeElement === settingsNavItems[0]"), true);
  await js(win, "settingsCloseButton.click()");
  assert.equal(await js(win, "currentScreen"), "launch");

  // A new account gets its own model; delayed requests cannot repaint a newer account.
  activeAccountUuid = "2".repeat(32);
  const firstSkin = await js(win, "accountModelImage.src");
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "accountModelImage.dataset.skinState === 'ready'");
  assert.notEqual(await js(win, "accountModelImage.src"), firstSkin);
  activeAccountUuid = delayedSkinUuid = "3".repeat(32);
  releaseSkin = null;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "accountModelImage.dataset.skinState === 'loading'");
  while (!releaseSkin) await delay(20);
  activeAccountUuid = "4".repeat(32);
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "accountModelImage.dataset.skinState === 'ready'");
  const currentSkin = await js(win, "accountModelImage.src");
  releaseSkin();
  await delay(100);
  assert.equal(await js(win, "accountModelImage.src"), currentSkin);
  activeAccountUuid = failedSkinUuid = "5".repeat(32);
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "accountModelImage.dataset.skinState === 'retry'");
  assert.equal(await js(win, "accountModelImage.src.endsWith('default-skin.svg')"), true);
  failedSkinUuid = "";
  await js(win, "updateAccountModelUi()");
  await waitFor(win, "accountModelImage.dataset.skinState === 'ready'");
  activeAccountUuid = delayedSkinUuid = "6".repeat(32);
  releaseSkin = null;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "accountModelImage.dataset.skinState === 'loading'");
  while (!releaseSkin) await delay(20);
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  releaseSkin();
  await delay(100);
  assert.equal(await js(win, "accountModelPanel.hidden && accountModelImage.src.endsWith('default-skin.svg')"), true);
  delayedSkinUuid = "";
  activeAccountUuid = "0123456789abcdef0123456789abcdef";
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'launch' && hasActiveModpack && !isModpackPreparing");
  await screenshot(win, "account-skin-loaded");
  blockLaunch = true;
  releaseLaunch = null;
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "isLaunchRequestPending && !launchProgress.hidden && launchProgress.textContent === '5%'");
  while (!releaseLaunch) await delay(20);
  const firstProgress = calls.filter(entry => entry.type === "launch").at(-1);
  const sendProgress = (percent, overrides = {}) => win.webContents.send("launcher:progress", {
    id: firstProgress.progressId, projectId: firstProgress.projectId, percent, ...overrides
  });
  sendProgress(37.6);
  await waitFor(win, "launchProgress.textContent === '37%'");
  sendProgress(10);
  sendProgress(95, { id: "previous-operation" });
  sendProgress(95, { projectId: "beta" });
  sendProgress(NaN);
  await delay(40);
  assert.equal(await js(win, "launchProgress.textContent"), "37%");
  win.webContents.send("launcher:log", { level: "warn", message: "Retrying modpack download verification" });
  await delay(40);
  assert.equal(await js(win, "launchProgressState.active && !launchProgressState.failed"), true, "recoverable warnings must not stop overall progress");
  const placement = await js(win, `(() => {
    const button = startLaunchButton.getBoundingClientRect();
    const percent = launchProgress.getBoundingClientRect();
    const gap = percent.left - button.right;
    return gap > 0 && gap <= 8 && Math.abs(percent.bottom - button.bottom) < 2;
  })()`);
  assert.ok(placement, "overall progress sits close to the play button and aligns with its bottom edge");
  await screenshot(win, "launch-progress");
  releaseLaunch();
  await waitFor(win, "!isLaunchRequestPending && launchProgress.classList.contains('is-error')");
  assert.equal(await js(win, "launchProgress.hidden"), true, "failed launches return to a play button without progress");
  sendProgress(100);
  await delay(40);
  assert.equal(await js(win, "launchProgress.textContent"), "37%", "a failed operation must never become complete");
  releaseLaunch = null;
  launchResult = { ok: true };
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "isLaunchRequestPending && launchProgress.textContent === '5%'");
  while (!releaseLaunch) await delay(20);
  const retry = calls.filter(entry => entry.type === "launch").at(-1);
  assert.notEqual(retry.progressId, firstProgress.progressId);
  sendProgress(99);
  win.webContents.send("launcher:progress", { id: retry.progressId, projectId: retry.projectId, percent: 99.9 });
  await waitFor(win, "launchProgress.textContent === '99%'");
  releaseLaunch();
  await waitFor(win, "!isLaunchRequestPending && launchProgress.textContent === '100%'");
  blockLaunch = false;
  launchResult = { ok: false, error: "Launch fixture failed" };
  const launch = calls.find((entry) => entry.type === "launch");
  assert.equal(launch.projectId, "alpha");
  assert.equal(launch.minecraftDirectory, path.join(output, "instances", "alpha"));
  assert.equal("autoConnect" in launch, false);
  win.webContents.send("launcher:state", { launching: true });
  await waitFor(win, "startLaunchButton.disabled && !launchProgress.hidden");
  const launchCount = calls.filter((entry) => entry.type === "launch").length;
  await js(win, "startLaunchButton.click()");
  assert.equal(calls.filter((entry) => entry.type === "launch").length, launchCount);
  win.webContents.send("launcher:state", { launching: false });
  await waitFor(win, "!startLaunchButton.disabled && launchProgress.hidden");

  pendingUpdate = true;
  await js(win, "refreshModpackUpdateStatus({ forceRefresh: true })");
  assert.equal(await js(win, "startLaunchButton.textContent"), "업데이트");
  assert.equal(await js(win, "launchProgress.hidden"), true, "an available update is not an active update");
  const updateStart = calls.length;
  blockLaunch = true;
  releaseLaunch = null;
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "isLaunchRequestPending && !isModpackUpdateApplyRunning && !modpackUpdateState.pending");
  while (!releaseLaunch) await delay(20);
  const updateAndLaunch = calls.slice(updateStart).filter(({ type }) => type === "sync" || type === "launch");
  assert.deepEqual(updateAndLaunch.map(({ type, projectId }) => [type, projectId]), [["sync", "alpha"], ["launch", "alpha"]]);
  releaseLaunch();
  blockLaunch = false;
  await waitFor(win, "!isLaunchRequestPending");
  assert.equal(await js(win, "startLaunchButton.textContent"), "게임 시작");
  assert.equal(await js(win, "launchProgress.hidden"), true);

  // Session expiry returns to login; signing back in prepares the same pack automatically.
  expireLaunch = true;
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "currentScreen === 'login' && !isLaunchRequestPending");
  assert.equal(await js(win, "hasActiveModpack"), false);
  expireLaunch = false;
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'launch' && hasActiveModpack && !isModpackPreparing");

  // Logging out during automatic Java preparation must never reopen the launch screen.
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  blockJava = true;
  releaseJava = null;
  await js(win, "launcherSettings.javaPath = ''; gateMicrosoftLoginButton.click()");
  await waitFor(win, "isModpackPreparing");
  while (!releaseJava) await delay(20);
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  releaseJava();
  await waitFor(win, "!isModpackPreparing");
  assert.equal(await js(win, "currentScreen === 'login' && !hasActiveModpack"), true);
  blockJava = false;
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'launch' && hasActiveModpack && !isModpackPreparing");

  // A new login while an old preparation is finishing must resume automatically.
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  blockJava = true;
  releaseJava = null;
  await js(win, "launcherSettings.javaPath = ''; gateMicrosoftLoginButton.click()");
  await waitFor(win, "isModpackPreparing");
  while (!releaseJava) await delay(20);
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'launch'");
  blockJava = false;
  releaseJava();
  await waitFor(win, "hasActiveModpack && !isModpackPreparing && !startLaunchButton.disabled");

  // Ignore update replies from an earlier signed-out session.
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  blockUpdate = true;
  releaseUpdate = null;
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "isStartupModpackSyncRunning");
  while (!releaseUpdate) await delay(20);
  signedIn = false;
  win.webContents.send("launcher:auth-state", auth());
  await waitFor(win, "currentScreen === 'login'");
  pendingUpdate = true;
  releaseUpdate();
  await waitFor(win, "!isModpackPreparing");
  assert.equal(await js(win, "modpackUpdateState === null && currentScreen === 'login'"), true);
  blockUpdate = false;
  pendingUpdate = false;
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'launch' && hasActiveModpack && !isModpackPreparing");

  // Preserve existing game settings while ignoring the removed remembered-pack preference.
  await js(win, "localStorage.setItem('betterlauncher.selected-project.v1', 'beta'); localStorage.setItem('betterlauncher.project.alpha.settings.v1', JSON.stringify({ ...launcherSettings, jvmArgs: '-XX:+UseZGC', gameWidth: 1600, bgmVolume: 80, bgmMuted: false, autoConnect: false }))");
  calls.length = 0;
  await new Promise((resolve) => { win.webContents.once("did-finish-load", resolve); win.reload(); });
  await waitFor(win, "startupOverlayDismissed && startupOverlay.hidden");
  assert.equal(await js(win, "currentScreen === 'launch' && activeProjectId === 'alpha' && hasActiveModpack"), true);
  assert.equal(await js(win, "launcherSettings.gameWidth === 1600 && !('bgmVolume' in launcherSettings) && !('bgmMuted' in launcherSettings) && !('autoConnect' in launcherSettings)"), true);
  assert.equal(await js(win, "buildLaunchPayload().jvmArgs"), "");
  assert.ok(calls.some((entry) => entry.type === "check" && entry.projectId === "alpha"));
  await js(win, "const oldInstanceSettings = { ...launcherSettings, javaPath: launcherSettings.minecraftDirectory + '/runtime/bin/javaw.exe' }; localStorage.setItem('betterlauncher.project.alpha.settings.v1', JSON.stringify(oldInstanceSettings));");
  instanceRevision = 1;
  calls.length = 0;
  await new Promise((resolve) => { win.webContents.once("did-finish-load", resolve); win.reload(); });
  await waitFor(win, "startupOverlayDismissed && startupOverlay.hidden");
  const revisedDirectory = path.join(output, "instances", "alpha.rev-1");
  assert.equal(await js(win, "launcherSettings.minecraftDirectory"), revisedDirectory);
  assert.equal(await js(win, "launcherSettings.dataDirectory"), revisedDirectory);
  assert.equal(await js(win, "launcherSettings.gameWidth"), 1600);
  assert.ok(calls.some(entry => entry.type === "java" && entry.minecraftDirectory === revisedDirectory));
  assert.ok(calls.some(entry => entry.type === "check" && entry.minecraftDirectory === revisedDirectory));
  instanceRevision = 0;
  win.setSize(860, 660);
  await screenshot(win, "single-modpack-small");
  assert.equal(await js(win, "document.documentElement.scrollWidth <= innerWidth && startLaunchButton.getBoundingClientRect().right <= innerWidth"), true);
  win.destroy();

  // Honor the administrator's default even when older settings name a different pack.
  defaultProjectId = "beta";
  calls.length = 0;
  win = await openWindow();
  assert.equal(await js(win, "currentScreen === 'launch' && activeProjectId === 'beta'"), true);
  assert.equal(await js(win, "'serverAddress' in activeModpack"), false);
  assert.ok(calls.every((entry) => entry.projectId === "beta"));
  win.destroy();

  const { readProjects } = require("../lib/projects");
  catalog = readProjects({ projects: [{ id: "calendar", name: "Calendar", minecraftVersion: "26.3", modLoader: "fabric", javaMajor: 25, server: { host: "calendar.example", port: 25565 }, modpack: { manifestUrl: "https://cdn.example/calendar/latest.json" } }] })
    .map(({ id, name, minecraftVersion, modLoader, javaMajor, modpack }) => ({ id, name, minecraftVersion, modLoader, javaMajor, manifestConfigured: Boolean(modpack.manifestUrl) }));
  win = await openWindow();
  assert.equal(await js(win, "activeProjectId"), "calendar");
  assert.equal(await js(win, "'serverAddress' in activeModpack"), false);
  assert.equal(await js(win, "activeModpack.minecraftVersion === '26.3' && activeModpack.javaMajor === 25"), true);
  await screenshot(win, "single-modpack-calendar");
  win.destroy();

  catalog = [{ id: "new-loader", name: "Example", minecraftVersion: "1.21.1", modLoader: "neoforge", javaMajor: 21, manifestConfigured: true }];
  win = await openWindow();
  assert.equal(await js(win, "currentScreen === 'launch' && activeModpack.modLoader === 'neoforge' && activeModpack.javaMajor === 21"), true);
  assert.equal(await js(win, "localizeStatusMessage('Installing NeoForge runtime...')"), "NeoForge 실행 환경 설치 중...");
  await js(win, "startLaunchButton.click()");
  await waitFor(win, "!isLaunchRequestPending");
  assert.ok(calls.some(entry => entry.type === "launch" && entry.projectId === "new-loader" && entry.version === ""));
  win.destroy();

  // Removing the update settings page must preserve automatic launcher updates.
  updaterFixture = { enabled: true, unavailable: true, currentVersion: require("../package.json").version };
  updaterResult = { ok: true, unavailable: true, message: "Current version remains usable." };
  catalog = [fixtures[0]];
  calls.length = 0;
  win = await openWindow();
  assert.equal(await js(win, "!startLaunchButton.disabled && !launchStatusIsError"), true);
  await js(win, "setLaunchStatus('Ready');");
  win.webContents.send("launcher:log", { scope: "updater", level: "error", message: '404 https://updates.example/private?token=secret' });
  await delay(40);
  assert.equal(await js(win, "launchStatusMessage"), "Ready");
  await js(win, "settingsButton.click()");
  assert.deepEqual(await js(win, "settingsNavItems.map(item => item.dataset.settingsTab)"),
    ["settingsTabAccount", "settingsTabMinecraft", "settingsTabJava", "settingsTabAbout"]);
  await js(win, "settingsCloseButton.click()");
  win.webContents.send("updater:state", { enabled: true, downloading: true, available: true, progressPercent: 33.7 });
  await waitFor(win, "!launchProgress.hidden && launchProgress.textContent === '33%' && startLaunchButton.disabled");
  await screenshot(win, "launcher-update-progress");
  win.webContents.send("updater:state", { enabled: true, downloading: true, available: true, progressPercent: 100 });
  await waitFor(win, "launchProgress.textContent === '99%'");
  win.webContents.send("updater:state", { enabled: true, downloaded: true, progressPercent: 100 });
  await waitFor(win, "launchProgress.hidden && launchProgress.textContent === '100%' && !startLaunchButton.disabled");
  win.webContents.send("updater:state", { enabled: true, downloading: true, available: true, progressPercent: 12 });
  await waitFor(win, "launchProgress.textContent === '12%'");
  win.webContents.send("updater:state", { enabled: true, downloading: false, lastError: "Download fixture failed" });
  await waitFor(win, "launchProgress.classList.contains('is-error')");
  win.webContents.send("updater:state", { enabled: true, downloading: true, available: true, progressPercent: 3 });
  await waitFor(win, "launchProgress.textContent === '3%' && !launchProgress.classList.contains('is-error')");
  win.destroy();
  updaterFixture = { enabled: false, currentVersion: require("../package.json").version };
  updaterResult = { ok: true };

  // An unconfigured or unpublished pack stays on the same launch screen without downloads.
  catalog = [fixtures[2]];
  calls.length = 0;
  win = await openWindow();
  assert.equal(await js(win, "currentScreen === 'launch' && startLaunchButton.disabled"), true);
  assert.match(await js(win, "launchStatusMessage"), /배포 준비/);
  assert.equal(await js(win, "modpackUpdatePollTimer === null"), true);
  assert.equal(calls.some((entry) => ["java", "check", "launch"].includes(entry.type)), false);
  win.destroy();
  catalog = [];
  calls.length = 0;
  win = await openWindow();
  assert.equal(await js(win, "currentScreen === 'launch' && startLaunchButton.disabled"), true);
  assert.match(await js(win, "launchStatusMessage"), /모드팩 설정/);
  assert.equal(calls.length, 0);
  await js(win, "settingsButton.click(); settingsCloseButton.click()");
  assert.equal(await js(win, "currentScreen"), "launch");
  await screenshot(win, "single-modpack-empty");
  win.destroy();

  signedIn = false;
  catalog = [fixtures[0]];
  calls.length = 0;
  win = await openWindow();
  assert.equal(await js(win, "currentScreen"), "login");
  assert.equal(calls.length, 0, "logged-out startup must not prepare or query the modpack");
  await screenshot(win, "single-modpack-login");
  await js(win, "gateMicrosoftLoginButton.click()");
  await waitFor(win, "currentScreen === 'launch' && hasActiveModpack && !isModpackPreparing");
  assert.ok(calls.some((entry) => entry.type === "check"));
  win.destroy();

  win = await openWindow({ webgl: false });
  await waitFor(win, "accountModelImage.dataset.skinState === 'ready'");
  assert.equal(await js(win, "window.minecraftSkinModel.renderer"), "canvas");
  assert.equal(await js(win, "currentScreen === 'launch' && !startLaunchButton.disabled"), true);
  win.destroy();

  failDefaults = true;
  win = await openWindow();
  assert.match(await js(win, "startupStatus.textContent"), /모드팩 설정 읽기 실패/);
  assert.equal(await js(win, "startLaunchButton.disabled"), true);
  win.destroy();
  assert.ok(defaultsRequests.every((id) => !id), "UI must always use the administrator's default");
  assert.equal(removedFeatureRequests.length, 0, "removed news feature must not request updates");
  assert.equal(mediaRequests.length, 0, "the launcher must not load BGM in any screen");
  console.log("Renderer flow passed: restored main screen, news removed, responsive settings modal, avatar cards, account switching, saved settings, skin cache/races and launch/update flow.");
  app.quit();
}).catch((error) => { console.error(error); app.exit(1); });
setTimeout(() => { console.error("Renderer test timed out"); app.exit(1); }, 100000).unref();
