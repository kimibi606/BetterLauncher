"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { safeRuntimePath } = require("./neoforge-runtime");
const PRESERVED = new Set(["config", "resourcepacks", "shaderpacks"]);

function normalizePathRenames(value = []) {
  if (!Array.isArray(value) || value.length > 128) throw new Error("Invalid modpack path repairs.");
  const seen = new Set();
  const validate = relative => typeof relative === "string" && relative.length <= 1024 &&
    relative.split("/").length >= 2 && PRESERVED.has(relative.split("/")[0]) &&
    !relative.split("/").some(part => !part || part === "." || part === ".." || /[<>:"|?*\\\x00-\x1f\x7f]/.test(part) ||
      /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
  return value.map(entry => {
    if (!entry || !validate(entry.from) || !validate(entry.to) || !entry.from.includes("\ufffd") || entry.to.includes("\ufffd") ||
      path.posix.dirname(entry.from) !== path.posix.dirname(entry.to)) throw new Error("Unsafe modpack path repair.");
    for (const name of [entry.from, entry.to]) {
      const key = name.toLowerCase();
      if (seen.has(key)) throw new Error("Conflicting modpack path repairs.");
      seen.add(key);
    }
    return { from: entry.from, to: entry.to };
  });
}

async function repairModpackPaths(root, value) {
  const renames = normalizePathRenames(value);
  const plan = [];
  for (const entry of renames) {
    const from = safeRuntimePath(root, entry.from), to = safeRuntimePath(root, entry.to);
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    if (!fs.statSync(from).isDirectory()) throw new Error("Modpack path repair requires a directory.");
    const pending = [entry.from];
    let count = 0;
    while (pending.length) {
      if (++count > 20000) throw new Error("Modpack path repair exceeds the file limit.");
      const relative = pending.pop(), current = safeRuntimePath(root, relative);
      if (fs.statSync(current).isDirectory()) {
        for (const name of fs.readdirSync(current)) pending.push(relative + "/" + name);
      }
    }
    plan.push({ from, to });
  }
  let renamed = 0;
  for (const entry of plan) {
    // Existing player data always wins. The launcher serializes pack syncs;
    // check again immediately before the same-parent directory rename.
    if (fs.existsSync(entry.to)) continue;
    await fs.promises.rename(entry.from, entry.to);
    renamed++;
  }
  return renamed;
}

module.exports = { normalizePathRenames, repairModpackPaths };
