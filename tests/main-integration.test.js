"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
const http = require("http");
const { createRequire } = require("module");
const { pathToFileURL } = require("url");
const { buildDistribution } = require("../scripts/build-modpack-distribution");

const mainPath = path.resolve(__dirname, "..", "main.js");
const nodeRequire = createRequire(mainPath);

function loadMain(root, safeStorage) {
  const handlers = new Map();
  const appPaths = { appData: root, userData: path.join(root, ".betterlauncher"), sessionData: path.join(root, "session") };
  const app = { getVersion: () => "0.3.14", getName: () => "BetterLauncher", getPath: (name) => appPaths[name], setPath: (name, value) => { appPaths[name] = value; }, requestSingleInstanceLock: () => false, on() {}, quit() {}, isPackaged: false };
  const context = vm.createContext({
    require: (name) => name === "electron" ? { app, safeStorage, ipcMain: { handle: (channel, fn) => handlers.set(channel, fn), on() {} } }
      : name === "electron-updater" ? { autoUpdater: {} } : nodeRequire(name),
    __dirname: path.dirname(mainPath), process: { ...process, cwd: () => root },
    console, Buffer, URL, AbortSignal, fetch, setTimeout, clearTimeout, setInterval, clearInterval
  });
  vm.runInContext(fs.readFileSync(mainPath, "utf8") + "\nglobalThis.testApi = { projectContext, getCurrentProject, readLauncherConfig, readGitHubReleaseConfig, isUpdaterEnabled, queryMinecraftServerStatus, readServerStatusConfig, buildAutoConnectTarget, buildProjectConnectionOptions, getModpackConfigCandidatePaths, isProjectFabricVersionId, migrateLegacyUserDataIfNeeded, migrateLegacyStateLayoutIfNeeded, verifyLaunchIntegrity };", context);
  const mainFrame = { url: pathToFileURL(path.join(path.dirname(mainPath), "src", "index.html")).href };
  const webContents = { mainFrame, send() {} };
  context.testWindow = { webContents, isDestroyed: () => false };
  vm.runInContext("mainWindow = testWindow;", context);
  const trustedEvent = { sender: webContents, senderFrame: mainFrame };
  const authenticatedHandlers = new Map([...handlers].map(([channel, callback]) => [channel,
    (event, payload) => callback(Object.keys(event || {}).length ? event : trustedEvent, payload)]));
  return { handlers: authenticatedHandlers, api: context.testApi, appPaths, webContents, context };
}

async function setup(t, safeStorage) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "betterlauncher-integration-"));
  const output = path.join(root, "distribution");
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.resolve(output, "." + new URL(req.url, "http://localhost").pathname);
      if (!file.startsWith(path.resolve(output) + path.sep)) { res.writeHead(403); res.end(); return; }
      const data = await fs.promises.readFile(file);
      res.writeHead(200); res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith("betterlauncher-integration-"));
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = { defaultProject: "alpha", projects: [
    { id: "alpha", name: "Alpha", minecraftVersion: "1.20.1", javaMajor: 17, modpack: { manifestUrl: `${base}/alpha/latest.json` }, serverStatus: { host: "alpha.test" }, news: { items: ["Alpha news"] } },
    { id: "beta", name: "Beta", minecraftVersion: "1.21.1", javaMajor: 21, modpack: { manifestUrl: `${base}/beta/latest.json` }, news: { items: ["Beta news"] } }
  ] };
  await fs.promises.writeFile(path.join(root, "modpack.config.json"), JSON.stringify(config));
  for (const project of config.projects) {
    const source = path.join(root, project.id + "-source");
    await fs.promises.mkdir(path.join(source, "mods"), { recursive: true });
    await fs.promises.writeFile(path.join(source, "mods", "shared-name.jar"), project.name.repeat(5));
    await buildDistribution({ source, output, project: project.id, version: "1", chunkBytes: 6 }, config);
  }
  return { root, output, config, ...loadMain(root, safeStorage) };
}

test("two HTTP modpacks install concurrently with separate state, chunks and runtime versions", async (t) => {
  const fixture = await setup(t);
  const { handlers, appPaths } = fixture;
  const results = await Promise.all(fixture.config.projects.map(async (project) => {
    const defaults = await handlers.get("launcher:get-defaults")({}, { projectId: project.id });
    assert.equal(defaults.version, project.minecraftVersion);
    assert.equal(defaults.javaMajor, project.javaMajor);
    const payload = { projectId: project.id, minecraftDirectory: defaults.minecraftDirectory };
    assert.equal((await handlers.get("launcher:check-modpack-update")({}, payload)).pending, true);
    const result = await handlers.get("launcher:sync-modpack")({}, payload);
    assert.equal(result.ok, true, result.error);
    assert.equal((await handlers.get("launcher:check-modpack-update")({}, payload)).pending, false);
    assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "mods", "shared-name.jar"), "utf8"), project.name.repeat(5));
    const state = JSON.parse(await fs.promises.readFile(path.join(defaults.minecraftDirectory, ".betterlauncher", "modpack-state.json")));
    assert.equal(state.projectId, project.id);
    return result;
  }));
  assert.equal(results.length, 2);
  const forbidden = await handlers.get("launcher:sync-modpack")({}, { projectId: "beta", minecraftDirectory: path.join(appPaths.userData, "instances", "alpha") });
  assert.equal(forbidden.ok, false);
  assert.match(forbidden.error, /another modpack project/);
});

test("project context isolates server/news configuration and exact Fabric versions", async (t) => {
  const { handlers, api, config } = await setup(t);
  const news = await Promise.all(config.projects.map((project) => handlers.get("launcher:get-news")({}, { projectId: project.id })));
  assert.equal(news[0].items[0].text, "Alpha news");
  assert.equal(news[1].items[0].text, "Beta news");
  api.projectContext.run(config.projects[1], () => {
    assert.equal(api.readServerStatusConfig().host, "");
    assert.equal(api.isProjectFabricVersionId("fabric-loader-0.16.0-1.21.1"), true);
    assert.equal(api.isProjectFabricVersionId("fabric-loader-0.16.0-1.21.10"), false);
    assert.equal(api.isProjectFabricVersionId("fabric-loader-0.16.0-1.20.1"), false);
    assert.equal(api.isProjectFabricVersionId("fabric-loader-../../../outside-1.21.1"), false);
    assert.equal(api.isProjectFabricVersionId("fabric-loader-0.16.0:stream-1.21.1"), false);
  });
  assert.equal((await handlers.get("launcher:get-defaults")({}, { projectId: "missing" })).ok, false);
});

test("administrator catalogs isolate server targets from global environment and user payloads", async (t) => {
  const { handlers, api, config, context, root } = await setup(t);
  config.projects[0].server = { host: "alpha.example", port: 25565 };
  config.projects[1].server = { host: "beta.example", port: 25566 };
  await fs.promises.writeFile(path.join(root, "modpack.config.json"), JSON.stringify(config));
  context.process.env = { ...context.process.env, BETTERLAUNCHER_SERVER_HOST: "wrong.example", BETTERMON_SERVER_PORT: "9999" };
  const defaults = await Promise.all(config.projects.map((project) => handlers.get("launcher:get-defaults")({}, {
    projectId: project.id, serverHost: "user.example", serverPort: 1234
  })));
  assert.ok(defaults.every(entry => entry.projects.every(project => !("serverAddress" in project) && !("server" in project) && !("serverStatus" in project) && !("modpack" in project))));
  const targets = await Promise.all(config.projects.map((project) => api.projectContext.run(project, async () => {
    await Promise.resolve();
    const target = api.buildAutoConnectTarget();
    const status = api.readServerStatusConfig();
    const connection = api.buildProjectConnectionOptions(api.getCurrentProject());
    assert.equal(status.host, target.host);
    assert.equal(status.port, target.port);
    assert.equal(connection.quickPlay.identifier, target.identifier);
    return target.identifier;
  })));
  assert.deepEqual(targets, ["alpha.example:25565", "beta.example:25566"]);
  vm.runInContext("require('electron').app.isPackaged = true", context);
  assert.deepEqual(Array.from(api.getModpackConfigCandidatePaths()), [path.join(path.dirname(mainPath), "modpack.config.json")]);
});

test("private operating config stays local and can disable packaged updates", async (t) => {
  const { api, config, context, root } = await setup(t);
  const privatePath = path.join(root, ".private", "modpack.config.json");
  await fs.promises.mkdir(path.dirname(privatePath));
  config.github = { owner: "example", repo: "launcher", enabled: false };
  await fs.promises.writeFile(privatePath, JSON.stringify(config));
  assert.equal(api.readLauncherConfig().__configPath, privatePath);
  assert.equal(api.readGitHubReleaseConfig().configured, false);
  vm.runInContext("require('electron').app.isPackaged = true; readLauncherConfig = () => ({ github: { enabled: false } });", context);
  assert.equal(api.isUpdaterEnabled(), false);
});

test("skin IPC only retrieves signed-in or saved accounts without exposing credentials", async (t) => {
  const { handlers, context } = await setup(t);
  const skin = handlers.get("launcher:get-account-skin");
  assert.equal((await skin({}, { uuid: "a".repeat(32) })).ok, false);
  vm.runInContext("microsoftAccount = { uuid: '0123456789abcdef0123456789abcdef', access_token: 'private-token' }; accountSkinService.get = async uuid => ({ ok: true, uuid, model: 'slim', textureDataUrl: 'fixture' });", context);
  const result = await skin({}, { uuid: "01234567-89ab-cdef-0123-456789abcdef" });
  assert.equal(result.ok, true);
  assert.equal(result.model, "slim");
  assert.equal(JSON.stringify(result).includes("private-token"), false);
  assert.equal((await skin({}, { uuid: "https://evil.example/" })).ok, false);
});

test("server status never sends targets to third-party services", async (t) => {
  const { api, context } = await setup(t);
  vm.runInContext("queryMinecraftServerStatusDirect = async (host, port) => ({ address: host + ':' + port, online: false, playerNames: [] }); fetchWithTimeout = () => { throw new Error('external status query forbidden'); };", context);
  const result = await api.queryMinecraftServerStatus("private.example", 25565);
  assert.equal(result.address, "private.example:25565");
  assert.equal(result.online, false);
});

test("server status IPC excludes targets and raw errors in success and failure replies", async (t) => {
  const { handlers, context } = await setup(t);
  vm.runInContext("queryMinecraftServerStatus = async () => ({ address: 'alpha.test:25565', online: null, playersOnline: null, playersMax: null, playerNames: ['Friend_1', '203.0.113.42', 'alpha.test', '0123456789abcdef0123456789abcdef'], error: 'connect ECONNREFUSED 203.0.113.42:25565 alpha.test' });", context);
  const status = await handlers.get("launcher:get-server-status")({}, { projectId: "alpha" });
  assert.equal(status.ok, true);
  assert.deepEqual(Array.from(status.server.playerNames), ["Friend_1"]);
  assert.equal("config" in status, false);
  assert.equal("address" in status.server, false);
  assert.equal("error" in status.server, false);
  assert.doesNotMatch(JSON.stringify(status), /alpha\.test|203\.0\.113\.42|25565/);
  vm.runInContext("queryMinecraftServerStatus = async () => { throw new Error('connect alpha.test:25565 203.0.113.42:25565'); };", context);
  const failure = await handlers.get("launcher:get-server-status")({}, { projectId: "alpha" });
  assert.equal(failure.ok, false);
  assert.doesNotMatch(failure.error, /alpha\.test|203\.0\.113\.42|25565/);
});

test("IPC and pushed diagnostics hide addresses, credentials and local paths while dropping raw game logs", async (t) => {
  const { handlers, context, webContents } = await setup(t);
  const messages = [];
  webContents.send = (channel, payload) => messages.push({ channel, payload });
  // Single-label LAN hosts need configuration-aware filtering as well as the
  // generic URL, IPv4/IPv6 and domain filters.
  vm.runInContext("cachedModpackConfigValue = { server: { host: 'lan' } }; microsoftAccount = { access_token: 'runtime-sensitive' };", context);
  const sensitive = 'connect LAN:25565 203.0.113.42 [2001:db8::42]:25565 https://cdn.example/secret?sig=signed-secret C:\\Users\\Friend Name\\instance runtime-sensitive accessToken=game-secret';
  context.diagnosticFixture = sensitive;
  vm.runInContext("sendLog({ level: 'debug', message: diagnosticFixture }); sendLog({ level: 'game', message: 'private chat' }); sendLog({ level: 'error', message: diagnosticFixture, raw: diagnosticFixture }); patchUpdaterState({ lastError: diagnosticFixture });", context);
  assert.equal(messages.filter(entry => entry.channel === "launcher:log").length, 1);
  assert.equal("raw" in messages[0].payload, false);
  const updater = await handlers.get("updater:get-state")({});
  for (const output of [JSON.stringify(messages), JSON.stringify(updater)]) {
    assert.doesNotMatch(output, /203\.0\.113\.42|2001:db8|cdn\.example|signed-secret|Friend Name|runtime-sensitive|game-secret|LAN/i);
    assert.match(output, /REDACTED|PRIVATE/);
  }
});

test("mismatched manifest identity preserves installed files", async (t) => {
  const { handlers, output } = await setup(t);
  const defaults = await handlers.get("launcher:get-defaults")({}, { projectId: "alpha" });
  const payload = { projectId: "alpha", minecraftDirectory: defaults.minecraftDirectory };
  assert.equal((await handlers.get("launcher:sync-modpack")({}, payload)).ok, true);
  const manifestPath = path.join(output, "alpha", "latest.json");
  const manifest = JSON.parse(await fs.promises.readFile(manifestPath));
  manifest.id = "beta";
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest));
  const mismatch = await handlers.get("launcher:sync-modpack")({}, payload);
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /does not match/);
  assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "mods", "shared-name.jar"), "utf8"), "Alpha".repeat(5));
});

test("a project cannot reuse a custom directory claimed by an earlier concurrent install", async (t) => {
  const { handlers, root } = await setup(t);
  const minecraftDirectory = path.join(root, "custom-instance");
  const results = await Promise.all(["alpha", "beta"].map((projectId) =>
    handlers.get("launcher:sync-modpack")({}, { projectId, minecraftDirectory })));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.match(results.find((result) => !result.ok).error, /another modpack project/);
});

test("updated manifest replaces changed mods and removes obsolete files", async (t) => {
  const { handlers, output, root, config } = await setup(t);
  const defaults = await handlers.get("launcher:get-defaults")({}, { projectId: "alpha" });
  const payload = { projectId: "alpha", minecraftDirectory: defaults.minecraftDirectory };
  assert.equal((await handlers.get("launcher:sync-modpack")({}, payload)).ok, true);
  const source = path.join(root, "alpha-source");
  await fs.promises.unlink(path.join(source, "mods", "shared-name.jar"));
  await fs.promises.writeFile(path.join(source, "mods", "new.jar"), "updated mod contents");
  await buildDistribution({ source, output, project: "alpha", version: "2", chunkBytes: 5 }, config);
  assert.equal((await handlers.get("launcher:check-modpack-update")({}, payload)).pending, true);
  const updated = await handlers.get("launcher:sync-modpack")({}, payload);
  assert.equal(updated.ok, true, updated.error);
  assert.equal(updated.version, "2");
  assert.equal(fs.existsSync(path.join(defaults.minecraftDirectory, "mods", "shared-name.jar")), false);
  assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "mods", "new.jar"), "utf8"), "updated mod contents");
});

test("distribution migration and updates preserve player preferences", async (t) => {
  const { handlers, output, root, config, api } = await setup(t);
  const source = path.join(root, "alpha-source");
  await fs.promises.mkdir(path.join(source, "config"));
  await fs.promises.writeFile(path.join(source, "options.txt"), "pack-defaults");
  await fs.promises.writeFile(path.join(source, "config", "client.json"), "pack-config");
  await buildDistribution({ source, output, project: "alpha", version: "2" }, config);
  const defaults = await handlers.get("launcher:get-defaults")({}, { projectId: "alpha" });
  const payload = { projectId: "alpha", minecraftDirectory: defaults.minecraftDirectory };
  await fs.promises.mkdir(path.join(defaults.minecraftDirectory, "config"), { recursive: true });
  await fs.promises.writeFile(path.join(defaults.minecraftDirectory, "options.txt"), "player-controls");
  assert.equal((await handlers.get("launcher:sync-modpack")({}, payload)).ok, true);
  assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "options.txt"), "utf8"), "player-controls");
  assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "config", "client.json"), "utf8"), "pack-config");
  await fs.promises.writeFile(path.join(defaults.minecraftDirectory, "config", "client.json"), "player-config");
  const project = { ...config.projects[0], modLoader: "fabric" };
  const integrity = await api.projectContext.run(project, () => api.verifyLaunchIntegrity(payload));
  assert.equal(integrity.ok, true, integrity.error);
  await fs.promises.unlink(path.join(source, "options.txt"));
  await fs.promises.unlink(path.join(source, "config", "client.json"));
  await buildDistribution({ source, output, project: "alpha", version: "3" }, config);
  assert.equal((await handlers.get("launcher:sync-modpack")({}, payload)).ok, true);
  assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "config", "client.json"), "utf8"), "player-config");
  assert.equal(await fs.promises.readFile(path.join(defaults.minecraftDirectory, "options.txt"), "utf8"), "player-controls");
});

test("legacy auth/session migration excludes existing modpack installations", async (t) => {
  const { root, api, appPaths } = await setup(t);
  const oldRoot = path.join(root, ".bettermonlauncher");
  await fs.promises.mkdir(path.join(oldRoot, "minecraft", ".bettermon"), { recursive: true });
  await fs.promises.mkdir(path.join(oldRoot, "Local Storage"), { recursive: true });
  await fs.promises.writeFile(path.join(oldRoot, "microsoft_auth.json"), "cached-auth");
  await fs.promises.writeFile(path.join(oldRoot, "minecraft", "options.txt"), "player-preferences");
  await fs.promises.mkdir(appPaths.userData, { recursive: true });
  api.migrateLegacyUserDataIfNeeded();
  api.migrateLegacyStateLayoutIfNeeded();
  assert.equal(await fs.promises.readFile(path.join(appPaths.userData, "state", "auth", "microsoft_auth.json"), "utf8"), "cached-auth");
  assert.equal(fs.existsSync(path.join(appPaths.userData, "instances", "bettermon")), false);
  assert.equal(fs.existsSync(path.join(appPaths.userData, "minecraft")), false);
  assert.equal(fs.existsSync(path.join(appPaths.sessionData, "Local Storage")), true);
  assert.equal(fs.existsSync(path.join(oldRoot, "minecraft", "options.txt")), true);
});

test("a migration marker created between check and write is never overwritten", async (t) => {
  const { root, api, appPaths } = await setup(t);
  const oldRoot = path.join(root, ".bettermonlauncher");
  const marker = path.join(appPaths.userData, "state", "legacy-data-migrated.json");
  await fs.promises.mkdir(oldRoot, { recursive: true });
  await fs.promises.writeFile(path.join(oldRoot, "preferences.json"), "old-preferences");
  const existsSync = fs.existsSync;
  let injected = false;
  fs.existsSync = (file) => {
    if (file === marker && !injected) {
      injected = true;
      fs.mkdirSync(path.dirname(marker), { recursive: true });
      fs.writeFileSync(marker, "created-by-another-instance", { flag: "wx" });
      return false;
    }
    return existsSync(file);
  };
  try { api.migrateLegacyUserDataIfNeeded(); } finally { fs.existsSync = existsSync; }
  assert.equal(await fs.promises.readFile(marker, "utf8"), "created-by-another-instance");
});

test("an empty catalog returns usable launcher defaults and disables pack operations", async (t) => {
  const { root } = await setup(t);
  await fs.promises.writeFile(path.join(root, "modpack.config.json"), JSON.stringify({ projects: [] }));
  const { handlers } = loadMain(root);
  const defaults = await handlers.get("launcher:get-defaults")({}, {});
  assert.equal(defaults.projectId, "");
  assert.equal(defaults.projects.length, 0);
  assert.equal(defaults.minecraftDirectory, "");
  assert.equal((await handlers.get("launcher:check-modpack-update")({}, {})).ok, false);
});

test("IPC rejects foreign windows, frames and navigated documents", async (t) => {
  const { handlers, webContents } = await setup(t);
  const defaults = handlers.get("launcher:get-defaults");
  assert.throws(() => defaults({ sender: {}, senderFrame: webContents.mainFrame }), /Untrusted/);
  assert.throws(() => defaults({ sender: webContents, senderFrame: { url: webContents.mainFrame.url } }), /Untrusted/);
  webContents.mainFrame.url = "https://evil.example/";
  assert.throws(() => defaults({ sender: webContents, senderFrame: webContents.mainFrame }), /Untrusted/);
});

test("malicious manifest paths, weak hashes and destructive resets preserve local files", async (t) => {
  const { handlers, output } = await setup(t);
  const defaults = await handlers.get("launcher:get-defaults")({}, { projectId: "alpha" });
  const payload = { projectId: "alpha", minecraftDirectory: defaults.minecraftDirectory };
  const manifestPath = path.join(output, "alpha", "latest.json");
  const original = JSON.parse(await fs.promises.readFile(manifestPath));
  await fs.promises.mkdir(path.join(defaults.minecraftDirectory, "saves"), { recursive: true });
  const save = path.join(defaults.minecraftDirectory, "saves", "world.txt");
  await fs.promises.writeFile(save, "keep-my-world");
  const variants = [
    ...["../outside.jar", "mods/CON.jar", "mods/a.jar:stream", "mods/../options.txt", ".betterlauncher./state.json", "saves/world.txt"].map(filePath => {
      const manifest = structuredClone(original); manifest.files[0].path = filePath; return manifest;
    }),
    { ...original, resetMinecraftDirectory: true },
    { ...original, delete: ["saves/world.txt"] },
    { ...original, files: [{ path: "mods/weak.jar", md5: "a".repeat(32), url: "https://example.com/weak.jar" }] }
  ];
  for (const manifest of variants) {
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest));
    const result = await handlers.get("launcher:sync-modpack")({}, payload);
    assert.equal(result.ok, false, JSON.stringify(manifest));
    assert.equal(await fs.promises.readFile(save, "utf8"), "keep-my-world");
  }
});

test("modpack writes cannot follow a directory junction outside the instance", async (t) => {
  const { handlers, root } = await setup(t);
  const defaults = await handlers.get("launcher:get-defaults")({}, { projectId: "alpha" });
  const outside = path.join(root, "outside");
  await fs.promises.mkdir(outside, { recursive: true });
  await fs.promises.mkdir(defaults.minecraftDirectory, { recursive: true });
  await fs.promises.symlink(outside, path.join(defaults.minecraftDirectory, "mods"), "junction");
  await fs.promises.writeFile(path.join(outside, "shared-name.jar"), "outside-file");
  const result = await handlers.get("launcher:sync-modpack")({}, { projectId: "alpha", minecraftDirectory: defaults.minecraftDirectory });
  assert.equal(result.ok, false);
  assert.match(result.error, /symbolic link|junction/);
  assert.equal(await fs.promises.readFile(path.join(outside, "shared-name.jar"), "utf8"), "outside-file");
});

test("OS encryption failure never writes a plaintext login token", async (t) => {
  const { context } = await setup(t, { isEncryptionAvailable: () => true, encryptString: () => { throw new Error("OS encryption failure"); } });
  context.testToken = { access_token: "sensitive-access-token", refreshToken: "sensitive-refresh-token" };
  vm.runInContext("writeMicrosoftAuthCachePayload(testToken);", context);
  const cachePath = vm.runInContext("getMicrosoftAuthCachePath()", context);
  await assert.rejects(fs.promises.readFile(cachePath), { code: "ENOENT" });
  await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.promises.writeFile(cachePath, JSON.stringify(context.testToken), { flag: "wx" });
  assert.equal(vm.runInContext("readMicrosoftAuthCachePayload()", context), null);
  assert.equal(fs.existsSync(cachePath), false);
});

test("legacy plaintext login caches become encrypted envelopes and remain readable", async (t) => {
  const token = { access_token: "sensitive-access-token", refreshToken: "sensitive-refresh-token" };
  const { context } = await setup(t, { isEncryptionAvailable: () => true,
    encryptString: () => Buffer.from("opaque-ciphertext"), decryptString: () => JSON.stringify(token) });
  const cachePath = vm.runInContext("getMicrosoftAuthCachePath()", context);
  await fs.promises.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.promises.writeFile(cachePath, JSON.stringify(token));
  vm.runInContext("readMicrosoftAuthCachePayload()", context);
  const stored = await fs.promises.readFile(cachePath, "utf8");
  assert.equal(stored.includes(token.access_token), false);
  assert.equal(JSON.parse(stored).format, "safe-storage-v1");
  assert.equal(vm.runInContext("readMicrosoftAuthCachePayload()", context).refreshToken, token.refreshToken);
});

test("downloads stop when the response exceeds the manifest size", async (t) => {
  const { context, root, config } = await setup(t);
  const target = path.join(root, "oversized.download");
  const download = vm.runInContext("downloadFile", context);
  await assert.rejects(download(config.projects[0].modpack.manifestUrl, target, { maxBytes: 4 }), /declared file size/);
  assert.equal(fs.existsSync(target), false);
});

test("patched ZIP library and Windows extraction accept normal files and reject ADS", async (t) => {
  if (process.platform !== "win32") return t.skip("Windows extraction");
  const { context, root } = await setup(t);
  const Zip = require("adm-zip");
  const zip = new Zip();
  zip.addFile("mods/native.jar", Buffer.from("native-content"));
  zip.addFile("version.json", Buffer.from('{"id":"test"}'));
  assert.equal(JSON.parse(zip.readAsText("version.json")).id, "test");
  const archive = path.join(root, "native.zip"), destination = path.join(root, "extracted");
  zip.writeZip(archive);
  await vm.runInContext("validateZipArchiveForExtraction", context)(archive);
  const extract = vm.runInContext("extractManagedZipArchive", context);
  await extract(archive, destination);
  assert.equal(await fs.promises.readFile(path.join(destination, "mods", "native.jar"), "utf8"), "native-content");
  const malicious = new Zip();
  malicious.addFile("mods/native.jar:stream", Buffer.from("payload"));
  malicious.writeZip(archive);
  await assert.rejects(extract(archive, destination), /Unsafe Windows path/);
});
