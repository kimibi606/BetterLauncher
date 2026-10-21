"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { repairModpackPaths, normalizePathRenames } = require("../lib/modpack-path-renames");

test("corrupt folder repairs preserve player edits, skip existing targets and are repeatable", async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "betterlauncher-path-repair-"));
  t.after(() => {
    assert.ok(root.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith("betterlauncher-path-repair-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const rename = { from: "resourcepacks/Example \ufffd", to: "resourcepacks/예제 팩" };
  fs.mkdirSync(path.join(root, rename.from), { recursive: true });
  fs.writeFileSync(path.join(root, rename.from, "player-edited.txt"), "keep player edits");
  assert.equal(await repairModpackPaths(root, [rename]), 1);
  assert.equal(fs.readFileSync(path.join(root, rename.to, "player-edited.txt"), "utf8"), "keep player edits");
  assert.equal(fs.existsSync(path.join(root, rename.from)), false);
  assert.equal(await repairModpackPaths(root, [rename]), 0);
  fs.mkdirSync(path.join(root, rename.from));
  fs.writeFileSync(path.join(root, rename.from, "other.txt"), "keep conflict");
  assert.equal(await repairModpackPaths(root, [rename]), 0);
  assert.equal(fs.readFileSync(path.join(root, rename.from, "other.txt"), "utf8"), "keep conflict");
  const bad = { from: "config/Bad \ufffd", to: "config/복구" };
  fs.mkdirSync(path.join(root, bad.from), { recursive: true });
  fs.symlinkSync(path.join(root, rename.to), path.join(root, bad.from, "link"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(repairModpackPaths(root, [bad]), /link|junction/);
});

test("folder repairs cannot rename worlds, normal names, parent paths or Windows aliases", () => {
  for (const entry of [
    { from: "saves/Bad \ufffd", to: "saves/World" },
    { from: "resourcepacks/normal", to: "resourcepacks/other" },
    { from: "resourcepacks/Bad \ufffd", to: "resourcepacks/../outside" },
    { from: "resourcepacks/Bad \ufffd", to: "resourcepacks/CON" },
    { from: "resourcepacks/Bad \ufffd", to: "config/other" }
  ]) assert.throws(() => normalizePathRenames([entry]), /Unsafe/);
});
