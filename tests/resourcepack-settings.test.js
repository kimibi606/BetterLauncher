"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { normalizeResourcePackDefaults, repairResourcePackSettings } = require("../lib/resourcepack-settings");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "betterlauncher-pack-options-"));
  t.after(() => {
    assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith("betterlauncher-pack-options-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const pack = "resourcepacks/한글 팩";
  const defaults = { resourcePacks: ["vanilla", "mod_resources", "file/한글 팩"], incompatibleResourcePacks: [] };
  const addPack = () => {
    fs.mkdirSync(path.join(root, pack), { recursive: true });
    fs.writeFileSync(path.join(root, pack, "pack.mcmeta"), '{"pack":{"pack_format":34,"description":"Example"}}');
  };
  return { root, pack, defaults, addPack, options: path.join(root, "options.txt") };
}

test("initial selection waits for packs, preserves other settings and backs up original bytes", async t => {
  const { root, defaults, addPack, options } = fixture(t);
  const original = "fov:83\r\nresourcePacks:[]\r\nincompatibleResourcePacks:[]\r\nlang:ko_kr\r\n";
  fs.writeFileSync(options, original);
  assert.equal((await repairResourcePackSettings(root, { defaults })).initialized, false);
  assert.equal(fs.readFileSync(options, "utf8"), original);
  addPack();
  assert.equal((await repairResourcePackSettings(root, { defaults })).initialized, true);
  const result = fs.readFileSync(options, "utf8");
  assert.ok(result.includes("resourcePacks:" + JSON.stringify(defaults.resourcePacks) + "\r\n"));
  assert.ok(result.includes("fov:83\r\n") && result.includes("lang:ko_kr\r\n"));
  const backup = fs.readdirSync(path.join(root, ".betterlauncher/backups"));
  assert.equal(backup.length, 1);
  assert.equal(fs.readFileSync(path.join(root, ".betterlauncher/backups", backup[0]), "utf8"), original);
  fs.writeFileSync(options, "resourcePacks:[]\nincompatibleResourcePacks:[]\nfov:99\n");
  assert.equal((await repairResourcePackSettings(root, { defaults })).changed, false);
  assert.match(fs.readFileSync(options, "utf8"), /^resourcePacks:\[\]/);
});

test("repairs selected and incompatible Korean references after initialization without re-enabling packs", async t => {
  const { root, defaults, addPack, options } = fixture(t);
  addPack();
  await repairResourcePackSettings(root, { defaults });
  fs.writeFileSync(options, 'resourcePacks:["vanilla","file/Example \\ufffd","file/Personal.zip"]\nincompatibleResourcePacks:["file/Example \\ufffd"]\nfov:91\n');
  const pathRenames = [{ from: "resourcepacks/Example \ufffd", to: "resourcepacks/한글 팩" }];
  assert.equal((await repairResourcePackSettings(root, { defaults, pathRenames })).changed, true);
  const text = fs.readFileSync(options, "utf8");
  assert.ok(text.includes('resourcePacks:["vanilla","file/한글 팩","file/Personal.zip"]'));
  assert.ok(text.includes('incompatibleResourcePacks:["file/한글 팩"]'));
  assert.ok(!text.includes("mod_resources") && text.includes("fov:91"));
  assert.equal((await repairResourcePackSettings(root, { defaults, pathRenames })).changed, false);
});

test("fresh options are UTF-8 and initialized only after selection is written", async t => {
  const { root, defaults, addPack, options } = fixture(t);
  addPack();
  await repairResourcePackSettings(root, { defaults });
  assert.ok(new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(options)).includes("한글 팩"));
  assert.ok(fs.existsSync(path.join(root, ".betterlauncher/resourcepack-settings.json")));
});

test("resource pack settings reject unsafe IDs, linked packs, options and state", async t => {
  const { root, defaults, pack, options } = fixture(t);
  for (const id of ["file/../outside", "file/CON", "file/Bad:stream", "file/Bad\\outside", "file/Bad.", "file/Bad\n"]) {
    assert.throws(() => normalizeResourcePackDefaults({ resourcePacks: [id] }), /resource pack/);
  }
  const outside = path.join(root, "outside");
  fs.mkdirSync(outside);
  fs.mkdirSync(path.join(root, "resourcepacks"));
  fs.symlinkSync(outside, path.join(root, pack), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(repairResourcePackSettings(root, { defaults }), /link|junction/);
  fs.unlinkSync(path.join(root, pack));
  const other = path.join(outside, "other.txt");
  fs.writeFileSync(other, "keep");
  fs.symlinkSync(outside, options, process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(repairResourcePackSettings(root, { defaults }), /link|junction/);
  fs.unlinkSync(options);
  fs.symlinkSync(outside, path.join(root, ".betterlauncher"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(repairResourcePackSettings(root, { defaults }), /link|junction/);
  assert.equal(fs.readFileSync(other, "utf8"), "keep");
});
