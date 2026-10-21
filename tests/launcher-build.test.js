"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { prepareLauncherBuild, main } = require("../scripts/build-launcher");
const { getConfig } = require("app-builder-lib/out/util/config/config");

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "betterlauncher-build-"));
  t.after(() => {
    assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith("betterlauncher-build-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const directory of ["src", "lib", "vendor", "node_modules", ".private"]) fs.mkdirSync(path.join(root, directory));
  for (const file of ["main.js", "preload.js", "src/index.html", "lib/example.js", "vendor/example.js"]) fs.writeFileSync(path.join(root, file), "fixture");
  const config = { defaultProject: "example", projects: [{ id: "example", server: { host: "server.example" }, modpack: { manifestUrl: "https://packs.example/example/latest.json" } }],
    github: { owner: "old-owner", repo: "old-repo", enabled: false } };
  fs.writeFileSync(path.join(root, ".private", "modpack.config.json"), JSON.stringify(config));
  fs.writeFileSync(path.join(root, "modpack.config.json"), JSON.stringify({ projects: [] }));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "betterlauncher", version: "0.0.1", devDependencies: {},
    build: { productName: "BetterLauncher", publish: [{ provider: "github", owner: "example", repo: "launcher", releaseType: "release" }] } }));
  return { root, config };
}

test("one launcher build includes the operating pack and a common update feed, never the empty catalog or old disable flag", async t => {
  const { root, config } = await fixture(t);
  const result = prepareLauncherBuild(root);
  const staged = JSON.parse(fs.readFileSync(path.join(result.appDir, "modpack.config.json")));
  assert.deepEqual(staged.projects, config.projects);
  assert.deepEqual(staged.github, { owner: "example", repo: "launcher", timeoutMs: 7000 });
  assert.equal(result.output, path.join(root, ".private", "releases", "0.0.1"));
  const effective = await getConfig(root, null, result.builderConfig);
  assert.deepEqual(effective.publish, [{ provider: "github", owner: "example", repo: "launcher", releaseType: "release" }]);
  const packaged = JSON.parse(fs.readFileSync(path.join(result.appDir, "package.json")));
  assert.equal(packaged.name, "betterlauncher");
  assert.equal(packaged.build, undefined);
  assert.equal(packaged.devDependencies, undefined);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".private", "modpack.config.json"))), config);
  assert.equal(fs.existsSync(path.join(result.appDir, ".private")), false);
});

test("missing, empty, multiple or invalid operating packs fail before a launcher is staged", async t => {
  const { root, config } = await fixture(t);
  const configPath = path.join(root, ".private", "modpack.config.json");
  for (const value of [null, { projects: [] }, { projects: [...config.projects, { ...config.projects[0], id: "second" }] },
    { ...config, projects: [{ ...config.projects[0], modpack: { manifestUrl: "http://packs.example/latest.json" } }] }]) {
    if (value) fs.writeFileSync(configPath, JSON.stringify(value)); else fs.unlinkSync(configPath);
    assert.throws(() => prepareLauncherBuild(root), /single-modpack configuration/);
    assert.equal(fs.existsSync(path.join(root, ".private", "builds")), false);
  }
});

test("builds cannot redirect artifacts through junctions and cannot accept upload options", async t => {
  const { root } = await fixture(t);
  const outside = path.join(root, "outside"); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(root, ".private", "releases"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => prepareLauncherBuild(root), /junction/);
  assert.equal(fs.readdirSync(outside).length, 0);
  await assert.rejects(main(["--publish", "always"]), /Uploading is a separate/);
});
