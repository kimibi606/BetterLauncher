"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const { safeRuntimePath } = require("./neoforge-runtime");
const { normalizePathRenames } = require("./modpack-path-renames");
const KEYS = ["resourcePacks", "incompatibleResourcePacks"];
const MAX_OPTIONS_BYTES = 1024 * 1024;

function normalizeResourcePackDefaults(value) {
  if (value == null) return null;
  const result = {};
  for (const key of KEYS) {
    const ids = value[key] ?? [];
    if (!Array.isArray(ids) || ids.length > 256) throw new Error("Invalid resource pack selection.");
    result[key] = [...new Set(ids.map(id => {
      if (typeof id !== "string" || !id || id.length > 1024 || /[\x00-\x1f\x7f]/.test(id)) {
        throw new Error("Invalid resource pack identifier.");
      }
      if (id.startsWith("file/")) {
        const leaf = id.slice(5);
        if (!leaf || leaf === "." || leaf === ".." || /[<>:"|?*\\/]/.test(leaf) || /[. ]$/.test(leaf) ||
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(leaf)) throw new Error("Unsafe resource pack identifier.");
      }
      return id;
    }))];
  }
  return result;
}

function readResourcePackDefaults(text) {
  const values = {};
  for (const key of KEYS) {
    const line = text.split(/\r?\n/).find(line => line.startsWith(key + ":"));
    if (line) {
      try { values[key] = JSON.parse(line.slice(key.length + 1)); }
      catch { throw new Error("Invalid resource pack selection in options.txt."); }
    }
  }
  return Object.keys(values).length ? normalizeResourcePackDefaults(values) : null;
}

function readOptions(file) {
  if (fs.statSync(file).size > MAX_OPTIONS_BYTES) throw new Error("Minecraft options.txt is too large.");
  const bytes = fs.readFileSync(file);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("euc-kr", { fatal: true }).decode(bytes); }
}

async function writeAtomic(root, relative, data) {
  const file = safeRuntimePath(root, relative);
  const tempRelative = relative + "." + crypto.randomUUID() + ".tmp";
  const temp = safeRuntimePath(root, tempRelative);
  await fs.promises.writeFile(temp, data, { flag: "wx" });
  try {
    // Recheck both paths immediately before replacement; never follow a linked options file.
    safeRuntimePath(root, relative);
    safeRuntimePath(root, tempRelative);
    await fs.promises.rename(temp, file);
  } finally { await fs.promises.rm(temp, { force: true }); }
}

async function repairResourcePackSettings(root, { defaults, pathRenames = [] } = {}) {
  const preset = normalizeResourcePackDefaults(defaults);
  const repairs = normalizePathRenames(pathRenames);
  const references = new Map(repairs.filter(entry => entry.from.split("/").length === 2 && entry.from.startsWith("resourcepacks/"))
    .map(entry => ["file/" + entry.from.slice(14), "file/" + entry.to.slice(14)]));
  if (!preset && !references.size) return { changed: false, initialized: false };
  const optionsPath = safeRuntimePath(root, "options.txt");
  const text = fs.existsSync(optionsPath) ? readOptions(optionsPath) : "";
  const original = fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath) : null;
  const current = readResourcePackDefaults(text) || { resourcePacks: [], incompatibleResourcePacks: [] };
  const rewrite = ids => [...new Set(ids.map(id => references.get(id) || id))];
  const next = Object.fromEntries(KEYS.map(key => [key, rewrite(current[key])]));
  const markerRelative = ".betterlauncher/resourcepack-settings.json";
  const marker = safeRuntimePath(root, markerRelative);
  const initialized = fs.existsSync(marker);
  let initialize = false;
  if (!initialized && preset) {
    const desired = Object.fromEntries(KEYS.map(key => [key, rewrite(preset[key])]));
    const available = [...desired.resourcePacks, ...desired.incompatibleResourcePacks].filter(id => id.startsWith("file/")).every(id => {
      const relative = "resourcepacks/" + id.slice(5);
      const target = safeRuntimePath(root, relative);
      if (!fs.existsSync(target)) return false;
      if (fs.statSync(target).isFile()) return /\.zip$/i.test(target);
      return fs.statSync(target).isDirectory() && fs.existsSync(safeRuntimePath(root, relative + "/pack.mcmeta"));
    });
    if (available) {
      // Apply the administrator's order once, retaining any additional player packs.
      for (const key of KEYS) next[key] = [...new Set([...desired[key], ...next[key]])];
      initialize = true;
    }
  }
  const changed = KEYS.some(key => JSON.stringify(current[key]) !== JSON.stringify(next[key]));
  if (changed) {
    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    const lines = text.split(/\r?\n/);
    for (const key of KEYS) {
      const replacement = key + ":" + JSON.stringify(next[key]);
      let found = false;
      for (let index = 0; index < lines.length; index++) {
        if (lines[index].startsWith(key + ":")) { lines[index] = replacement; found = true; }
      }
      if (!found) lines.splice(lines.length && lines.at(-1) === "" ? lines.length - 1 : lines.length, 0, replacement);
    }
    if (lines.at(-1) !== "") lines.push("");
    const backupDirectory = safeRuntimePath(root, ".betterlauncher/backups");
    await fs.promises.mkdir(backupDirectory, { recursive: true });
    if (original) await fs.promises.writeFile(safeRuntimePath(root, ".betterlauncher/backups/options-" + crypto.randomUUID() + ".txt"), original, { flag: "wx" });
    await writeAtomic(root, "options.txt", lines.join(newline));
  }
  if (initialize) {
    await fs.promises.mkdir(safeRuntimePath(root, ".betterlauncher"), { recursive: true });
    await writeAtomic(root, markerRelative, JSON.stringify({ schema: 1, initializedAt: new Date().toISOString() }) + "\n");
  }
  return { changed, initialized: initialize || initialized };
}

module.exports = { normalizeResourcePackDefaults, readResourcePackDefaults, repairResourcePackSettings };
