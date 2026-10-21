"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Zip = require("adm-zip");
const { importModpackZip, normalizeArchivePath } = require("../scripts/import-modpack-zip");

async function fixture(t) {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "betterlauncher-import-"));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith("betterlauncher-import-"));
    await fs.promises.rm(root, { recursive: true, force: true });
  });
  const archive = path.join(root, "pack.zip"), destination = path.join(root, "source");
  return { root, archive, destination };
}

test("ZIP import preserves pack files while excluding servers, accounts, saves and document instructions", async t => {
  const state = await fixture(t), zip = new Zip();
  const mods = Buffer.from("mod-content");
  zip.addFile("mods/example.jar", mods); zip.addFile("config/example.json", Buffer.from('{"value":true}')); zip.addFile("options.txt", Buffer.from("lang:ko_kr"));
  for (const file of ["servers.dat", "accounts.json", "saves/world/level.dat", "README.md"]) zip.addFile(file, Buffer.from("private or untrusted content"));
  zip.writeZip(state.archive);
  const result = await importModpackZip(state);
  assert.equal(result.modCount, 1); assert.equal(result.fileCount, 3); assert.equal(result.skipped, 4);
  assert.deepEqual(fs.readFileSync(path.join(state.destination, "mods/example.jar")), mods);
  assert.equal(fs.existsSync(path.join(state.destination, "servers.dat")), false);
  assert.equal(fs.existsSync(path.join(state.destination, "README.md")), false);
  assert.equal(result.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)), true);
  await assert.rejects(importModpackZip(state), /empty directory/);
});

test("ZIP import rejects Windows traversal, ADS, reserved paths and duplicate case variants", async t => {
  for (const name of ["../escape", "/absolute", "C:/outside", "mods/file.jar:stream", "mods/CON.jar", "mods/name. ", "mods/../outside.jar"]) {
    assert.throws(() => normalizeArchivePath(name), /Unsafe/);
  }
  const state = await fixture(t), zip = new Zip();
  zip.addFile("mods/Example.jar", Buffer.from("one")); zip.addFile("mods/example.jar", Buffer.from("two")); zip.writeZip(state.archive);
  await assert.rejects(importModpackZip(state), /duplicate Windows paths/);
  assert.equal(fs.existsSync(state.destination), false);
});
