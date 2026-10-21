"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Zip = require("adm-zip");
const { importModpackZip, normalizeArchivePath } = require("../scripts/import-modpack-zip");
const { decodeZipEntryName } = require("../lib/zip-entry-names");
const { crc32 } = require("adm-zip/util");

function unicodeExtra(raw, name, validCrc = true) {
  const text = Buffer.from(name), extra = Buffer.alloc(9 + text.length);
  extra.writeUInt16LE(0x7075); extra.writeUInt16LE(5 + text.length, 2); extra[4] = 1;
  extra.writeUInt32LE(((crc32(raw) >>> 0) ^ (validCrc ? 0 : 1)) >>> 0, 5); text.copy(extra, 9);
  return extra;
}

function legacyZip() {
  return new Zip({ decoder: { efs: false, encode: value => Buffer.from(value, "utf8"), decode: value => value.toString("utf8") } });
}

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

test("ZIP import restores Korean Unicode extra names and CP949 filenames without changing file contents", async t => {
  const state = await fixture(t), zip = legacyZip();
  zip.addFile("mods/example.jar", Buffer.from("mod"));
  const raw = Buffer.concat([Buffer.from("resourcepacks/"), Buffer.from("c7d1b1db", "hex"), Buffer.from("/pack.mcmeta")]);
  zip.addFile("resourcepacks/placeholder/pack.mcmeta", Buffer.from("original pack content"));
  const entry = zip.getEntry("resourcepacks/placeholder/pack.mcmeta");
  entry.entryName = raw; entry.header.flags_efs = false;
  entry.extra = unicodeExtra(raw, "resourcepacks/한글/pack.mcmeta");
  zip.writeZip(state.archive);
  const result = await importModpackZip(state);
  assert.equal(result.fileCount, 2);
  assert.equal(fs.readFileSync(path.join(state.destination, "resourcepacks/한글/pack.mcmeta"), "utf8"), "original pack content");
  assert.equal(result.files.some(file => file.path.includes("\ufffd")), false);
  assert.equal(decodeZipEntryName({ rawEntryName: raw, extra: Buffer.alloc(0), header: { flags: 0 } }), "resourcepacks/한글/pack.mcmeta");
  assert.equal(decodeZipEntryName({ rawEntryName: raw, extra: unicodeExtra(raw, "wrong", false), header: { flags: 0 } }), "resourcepacks/한글/pack.mcmeta");
  assert.throws(() => decodeZipEntryName({ rawEntryName: raw, header: { flags: 0x800 } }), /encoded data/);
});

test("Unicode ZIP names are still checked for traversal, duplicates and irreversible replacement characters", async t => {
  const state = await fixture(t), zip = legacyZip();
  zip.addFile("mods/example.jar", Buffer.from("mod"));
  const entry = zip.getEntry("mods/example.jar");
  entry.extra = unicodeExtra(entry.rawEntryName, "../outside.jar"); entry.header.flags_efs = false;
  zip.writeZip(state.archive);
  await assert.rejects(importModpackZip(state), /Unsafe path/);
  assert.equal(fs.existsSync(state.destination), false);
  assert.throws(() => normalizeArchivePath("resourcepacks/손상\ufffd/file"), /Unsafe path/);
  const raw = Buffer.from("config/example.json");
  assert.throws(() => decodeZipEntryName({ rawEntryName: raw, header: { flags: 0 }, extra: Buffer.concat([unicodeExtra(raw, "config/a.json"), unicodeExtra(raw, "config/b.json")]) }), /Conflicting/);
});
