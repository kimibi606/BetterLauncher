"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const vm = require("vm");
const http = require("http");
const { createRequire } = require("module");
const { buildDistribution } = require("../scripts/build-modpack-distribution");

const mainPath = path.resolve(__dirname, "..", "main.js");
const nodeRequire = createRequire(mainPath);

function loadMain(root) {
  const handlers = new Map();
  const appPaths = { appData: root, userData: path.join(root, ".betterlauncher"), sessionData: path.join(root, "session") };
  const app = { getVersion: () => "0.3.14", getName: () => "BetterLauncher", getPath: (name) => appPaths[name], setPath: (name, value) => { appPaths[name] = value; }, requestSingleInstanceLock: () => false, on() {}, quit() {}, isPackaged: false };
  const context = vm.createContext({
    require: (name) => name === "electron" ? { app, ipcMain: { handle: (channel, fn) => handlers.set(channel, fn), on() {} } }
      : name === "electron-updater" ? { autoUpdater: {} } : nodeRequire(name),
    __dirname: path.dirname(mainPath), process: { ...process, cwd: () => root },
    console, Buffer, URL, AbortSignal, fetch, setTimeout, clearTimeout, setInterval, clearInterval
  });
  vm.runInContext(fs.readFileSync(mainPath, "utf8") + "\nglobalThis.testApi = { projectContext, getCurrentProject, readServerStatusConfig, isProjectFabricVersionId, migrateLegacyUserDataIfNeeded, migrateLegacyStateLayoutIfNeeded, verifyLaunchIntegrity };", context);
  return { handlers, api: context.testApi, appPaths };
}

async function setup(t) {
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
  return { root, output, config, ...loadMain(root) };
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
  });
  assert.equal((await handlers.get("launcher:get-defaults")({}, { projectId: "missing" })).ok, false);
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
