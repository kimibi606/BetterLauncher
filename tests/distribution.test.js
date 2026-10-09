"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { buildDistribution, parseArgs, validatePagesOutput } = require("../scripts/build-modpack-distribution");
const { downloadDistributionFile } = require("../lib/distribution-download");

const config = { projects: [{ id: "alpha" }, { id: "beta" }] };

async function fixture(t) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "betterlauncher-test-"));
  t.after(async () => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("betterlauncher-test-"));
    await fs.promises.rm(resolved, { recursive: true, force: true });
  });
  const source = path.join(root, "source");
  const output = path.join(root, "distribution");
  await fs.promises.mkdir(path.join(source, "mods"), { recursive: true });
  return { root, source, output };
}

test("large assets split, reassemble byte-for-byte and stay under Pages limits", async (t) => {
  const { root, source, output } = await fixture(t);
  const original = crypto.randomBytes(26 * 1024 * 1024 + 7);
  await fs.promises.writeFile(path.join(source, "mods", "large.jar"), original);
  await fs.promises.writeFile(path.join(source, "options.txt"), "");
  const result = await buildDistribution({ source, output, project: "alpha", version: "1.0" }, config);
  const file = result.manifest.files.find((entry) => entry.path === "mods/large.jar");
  assert.equal(file.chunks.length, 2);
  assert.ok(file.chunks.every((chunk) => chunk.size < 25 * 1024 * 1024));
  const target = path.join(root, "reassembled.jar");
  const copy = async (url, destination) => fs.promises.copyFile(path.join(output, "alpha", url), destination);
  const download = await downloadDistributionFile(file, target, copy);
  assert.equal(download.bytesWritten, original.length);
  assert.deepEqual(await fs.promises.readFile(target), original);
  assert.equal(fs.existsSync(`${target}.chunk`), false);
  assert.ok(await validatePagesOutput(output) < 20000);
});

test("corrupt chunks fail closed and remove temporary downloads", async (t) => {
  const { root, source, output } = await fixture(t);
  await fs.promises.writeFile(path.join(source, "mods", "test.jar"), "a modpack file");
  const result = await buildDistribution({ source, output, project: "alpha", version: "1", chunkBytes: 4 }, config);
  const file = result.manifest.files[0];
  const target = path.join(root, "download.jar");
  await assert.rejects(downloadDistributionFile(file, target, async (_url, destination) => fs.promises.writeFile(destination, "bad!")), /integrity/);
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.existsSync(`${target}.chunk`), false);
});

test("building a second project and updates retains other projects and older assets", async (t) => {
  const { source, output } = await fixture(t);
  await fs.promises.writeFile(path.join(source, "mods", "test.jar"), "alpha");
  const first = await buildDistribution({ source, output, project: "alpha", version: "1" }, config);
  await fs.promises.writeFile(path.join(source, "mods", "test.jar"), "beta");
  await buildDistribution({ source, output, project: "beta", version: "1" }, config);
  await buildDistribution({ source, output, project: "alpha", version: "2" }, config);
  assert.equal(JSON.parse(await fs.promises.readFile(path.join(output, "beta", "latest.json"))).id, "beta");
  assert.equal(await fs.promises.readFile(path.join(output, "alpha", first.manifest.files[0].url), "utf8"), "alpha");
});

test("dry runs do not write output, include only managed files and support explicit URLs", async (t) => {
  const { source, output } = await fixture(t);
  await fs.promises.writeFile(path.join(source, "mods", "test.jar"), "mod");
  await fs.promises.mkdir(path.join(source, "saves"));
  await fs.promises.writeFile(path.join(source, "saves", "world.dat"), "player data");
  const result = await buildDistribution({ source, output, project: "beta", version: "1", dryRun: true, baseUrl: "https://packs.example.test/base" }, config);
  assert.equal(result.manifest.files.length, 1);
  assert.match(result.manifest.files[0].url, /^https:\/\/packs\.example\.test\/base\/beta\/files\//);
  assert.equal(fs.existsSync(output), false);
  await assert.rejects(buildDistribution({ source, output: path.join(source, "output"), version: "1" }, config), /separate/);
});

test("publisher rejects invalid size, missing arguments and obsolete GitHub arguments", () => {
  assert.throws(() => parseArgs(["--chunk-size-mib", "25"]), /less than 25/);
  assert.throws(() => parseArgs(["--source"]), /Missing/);
  assert.throws(() => parseArgs(["--repo", "owner/repo"]), /Unknown/);
  assert.equal(parseArgs(["--project=alpha", "--version=1"]).project, "alpha");
});

test("identical immutable assets are reused without replacing existing files", async (t) => {
  const { source, output } = await fixture(t);
  await fs.promises.writeFile(path.join(source, "mods", "first.jar"), "same contents");
  await fs.promises.writeFile(path.join(source, "mods", "second.jar"), "same contents");
  const first = await buildDistribution({ source, output, project: "alpha", version: "1" }, config);
  const asset = path.join(output, "alpha", first.manifest.files[0].url);
  const oldTime = new Date("2000-01-01T00:00:00Z");
  await fs.promises.utimes(asset, oldTime, oldTime);
  await buildDistribution({ source, output, project: "alpha", version: "2" }, config);
  assert.equal((await fs.promises.stat(asset)).mtimeMs, oldTime.getTime());
  assert.equal((await fs.promises.readdir(path.join(output, "alpha", "files"))).length, 1);
});

module.exports = { fixture };
