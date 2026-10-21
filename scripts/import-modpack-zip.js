"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Zip = require("adm-zip");
const { safeRuntimePath } = require("../lib/neoforge-runtime");
const { decodeZipEntryName } = require("../lib/zip-entry-names");

const ALLOWED_DIRECTORIES = new Set(["mods", "config", "defaultconfigs", "resourcepacks", "shaderpacks", "cobblemon"]);

function normalizeArchivePath(value) {
  const name = String(value).replace(/\\/g, "/").replace(/\/$/, "");
  if (!name || name.includes("\ufffd") || name.startsWith("/") || name.split("/").some(part => !part || part === "." || part === ".." ||
      /[<>:"|?*\x00-\x1f\x7f]/.test(part) || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error("Unsafe path in modpack archive.");
  }
  return name;
}

async function importModpackZip({ archive, destination }) {
  if (!archive || !destination) throw new Error("Archive and empty destination directory are required.");
  const root = path.resolve(destination);
  if (fs.existsSync(root) && (fs.lstatSync(root).isSymbolicLink() || (await fs.promises.readdir(root)).length)) {
    throw new Error("Modpack import destination must be an empty directory without links.");
  }
  if (fs.statSync(archive).size > 2 * 1024 ** 3) throw new Error("Modpack archive exceeds the import limit.");
  const zip = new Zip(archive);
  const entries = zip.getEntries();
  if (entries.length > 20000) throw new Error("Modpack archive has too many files.");
  const seen = new Set(), plan = [];
  let totalBytes = 0, skipped = 0;
  for (const entry of entries) {
    const relative = normalizeArchivePath(decodeZipEntryName(entry));
    if (((entry.header.attr >>> 16) & 0xf000) === 0xa000) throw new Error("Modpack archives cannot contain symbolic links.");
    const top = relative.split("/")[0];
    if (!ALLOWED_DIRECTORIES.has(top) && relative !== "options.txt") { skipped++; continue; }
    const key = relative.toLowerCase();
    if (seen.has(key)) throw new Error("Modpack archive contains duplicate Windows paths.");
    seen.add(key);
    if (entry.isDirectory) continue;
    if (entry.header.size > 512 * 1024 ** 2) throw new Error("Modpack file exceeds the import limit.");
    totalBytes += entry.header.size;
    if (totalBytes > 8 * 1024 ** 3) throw new Error("Unpacked modpack exceeds the import limit.");
    plan.push({ entry, relative });
  }
  if (!plan.some(file => file.relative.startsWith("mods/") && file.relative.endsWith(".jar"))) throw new Error("Modpack archive has no mod files.");
  await fs.promises.mkdir(root, { recursive: true });
  const files = [];
  for (const { entry, relative } of plan) {
    const target = safeRuntimePath(root, relative);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    const data = entry.getData();
    if (data.length !== entry.header.size) throw new Error("Modpack ZIP entry size mismatch.");
    await fs.promises.writeFile(target, data, { flag: "wx" });
    files.push({ path: relative, size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex") });
  }
  return { files, fileCount: files.length, modCount: files.filter(file => file.path.startsWith("mods/") && file.path.endsWith(".jar")).length, totalBytes, skipped };
}

module.exports = { importModpackZip, normalizeArchivePath };
