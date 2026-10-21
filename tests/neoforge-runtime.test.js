"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { readProjects } = require("../lib/projects");
const { createNeoForgeRuntime, createNeoForgeClient, validateNeoForgeProfile, safeRuntimePath } = require("../lib/neoforge-runtime");

const installer = Buffer.from("official-installer-fixture");
const hash = crypto.createHash("sha256").update(installer).digest("hex");
const project = { minecraftVersion: "1.21.1", modLoader: "neoforge", loaderVersion: "21.1.123", loaderInstallerSha256: hash };
const profile = () => ({ id: "neoforge-21.1.123", inheritsFrom: "1.21.1", mainClass: "cpw.mods.bootstraplauncher.BootstrapLauncher",
  arguments: { game: ["--launchTarget", "forgeclient", "--fml.mcVersion", "1.21.1"], jvm: ["-p", "${library_directory}/boot.jar${classpath_separator}${library_directory}/loader.jar", "-DignoreList=${version_name}.jar"] },
  libraries: [{ name: "example:boot:1", downloads: { artifact: { path: "boot.jar", url: "https://maven.example/boot.jar" } } }] });

async function fixture(t) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "betterlauncher-neoforge-"));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith("betterlauncher-neoforge-"));
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  let spawns = 0, downloads = 0, fail = false, captured;
  const write = (file, data) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data); };
  const spawnImpl = (java, args, options) => {
    spawns++;
    captured = { java, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
    setImmediate(() => {
      if (!fail) {
        write("versions/neoforge-21.1.123/neoforge-21.1.123.json", JSON.stringify(profile()));
        write("versions/1.21.1/1.21.1.json", JSON.stringify({ id: "1.21.1" }));
        write("versions/1.21.1/1.21.1.jar", "base-client");
        write("libraries/boot.jar", "boot-library");
      }
      child.stdout.end("installer output with a private path");
      child.emit("close", fail ? 1 : 0);
    });
    return child;
  };
  const fetchImpl = async url => { downloads++; assert.ok(url.startsWith("https://maven.neoforged.net/releases/")); return new Response(installer); };
  return { root, write, spawnImpl, fetchImpl, get spawns() { return spawns; }, get downloads() { return downloads; },
    get captured() { return captured; }, set fail(value) { fail = value; } };
}

test("NeoForge projects pin a matching loader and infer Java 21", () => {
  const result = readProjects({ projects: [{ id: "example", ...project }] })[0];
  assert.equal(result.javaMajor, 21);
  for (const loaderVersion of ["", "21.0.123", "21.1.123/../escape", "21.1.123:stream", "latest"]) {
    assert.throws(() => readProjects({ projects: [{ id: "example", ...project, loaderVersion }] }), /NeoForge|loader version/);
  }
  assert.throws(() => readProjects({ projects: [{ id: "example", ...project, loaderInstallerSha256: "invalid" }] }), /SHA-256/);
});

test("NeoForge installer verifies SHA-256 before execution, deduplicates and reuses complete installs", async t => {
  const state = await fixture(t), logs = [];
  const service = createNeoForgeRuntime({ fetchImpl: state.fetchImpl, spawnImpl: state.spawnImpl, log: entry => logs.push(entry) });
  const versions = await Promise.all([service.ensure(project, state.root, "java-fixture"), service.ensure(project, state.root, "java-fixture")]);
  assert.deepEqual(versions, ["neoforge-21.1.123", "neoforge-21.1.123"]);
  assert.equal(state.spawns, 1); assert.equal(state.downloads, 1);
  assert.equal(state.captured.options.windowsHide, true); assert.equal(state.captured.options.shell, false);
  assert.ok(state.captured.args.includes("--installClient")); assert.equal(state.captured.args.at(-1), state.root);
  assert.equal(fs.readFileSync(path.join(state.root, "versions/neoforge-21.1.123/neoforge-21.1.123.jar"), "utf8"), "base-client");
  assert.equal(JSON.stringify(logs).includes("private path"), false);
  await service.ensure(project, state.root, "java-fixture");
  assert.equal(state.spawns, 1);
  fs.unlinkSync(path.join(state.root, "libraries/boot.jar"));
  await service.ensure(project, state.root, "java-fixture");
  assert.equal(state.spawns, 2, "missing generated libraries must trigger repair");
});

test("bad installer hashes and failed installs never create a completion marker", async t => {
  const state = await fixture(t);
  const bad = createNeoForgeRuntime({ fetchImpl: async () => new Response("corrupt"), spawnImpl: state.spawnImpl });
  await assert.rejects(bad.ensure(project, state.root, "java-fixture"), /integrity/);
  assert.equal(state.spawns, 0);
  const service = createNeoForgeRuntime({ fetchImpl: state.fetchImpl, spawnImpl: state.spawnImpl });
  state.fail = true;
  await assert.rejects(service.ensure(project, state.root, "java-fixture"), /installation failed/);
  assert.equal(fs.existsSync(path.join(state.root, ".betterlauncher/runtime/neoforge/21.1.123/installed.json")), false);
  state.fail = false;
  assert.equal(await service.ensure(project, state.root, "java-fixture"), "neoforge-21.1.123");
});

test("NeoForge rejects profile mismatches, unsafe paths and symbolic links", async t => {
  for (const change of [{ id: "../escape" }, { inheritsFrom: "1.20.1" }, { mainClass: "untrusted.Main" }]) {
    assert.throws(() => validateNeoForgeProfile({ ...profile(), ...change }, project), /does not match/);
  }
  const unsafe = profile(); unsafe.libraries[0].downloads.artifact.path = "../outside.jar";
  assert.throws(() => validateNeoForgeProfile(unsafe, project), /library path/);
  const state = await fixture(t);
  for (const relative of ["../escape", "/outside", "C:/outside", "libraries/../outside"]) assert.throws(() => safeRuntimePath(state.root, relative), /Unsafe/);
  const outside = path.join(state.root, "separate"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(state.root, "libraries"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(createNeoForgeRuntime({ fetchImpl: state.fetchImpl, spawnImpl: state.spawnImpl }).ensure(project, state.root, "java-fixture"), /link|junction/);
  assert.equal(state.spawns, 0);
});

test("NeoForge launch merges base authentication args and expands module paths without splitting spaces", async () => {
  class FakeClient {
    constructor() { this.options = { root: path.resolve("path with spaces"), customArgs: ["-Xss2M"] }; this.handler = { version: { arguments: { game: ["--username", "${auth_player_name}", "--accessToken", "${auth_access_token}", "--assetsDir", "${assets_root}"] } } }; }
    async getModifyJson() { return profile(); }
  }
  const client = createNeoForgeClient(FakeClient, project);
  const launch = await client.getModifyJson();
  assert.ok(launch.arguments.game.includes("--accessToken") && launch.arguments.game.includes("--launchTarget"));
  assert.equal(launch.arguments.game.filter(arg => arg === "--username").length, 1);
  assert.ok(client.options.customArgs.includes("-Xss2M"));
  assert.ok(client.options.customArgs[1].includes("path with spaces"));
  assert.equal(client.options.customArgs.some(arg => /\$\{[^}]+\}/.test(arg)), false);
});
