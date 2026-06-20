#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function printUsage() {
  console.log("Usage:");
  console.log(
    "  node scripts/build-distribution-index.js --source-dir <dir> --base-url <https-url> --out <file> [--version <text>] [--delete-list <file>]"
  );
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || "");
    if (!current.startsWith("--")) {
      continue;
    }
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || String(next).startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = String(next);
    index += 1;
  }
  return args;
}

function ensureHttpBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("--base-url is required.");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid --base-url: ${raw}`);
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error("--base-url must be an http(s) URL.");
  }
  parsed.hash = "";
  parsed.search = "";
  if (!parsed.pathname.endsWith("/")) {
    parsed.pathname = `${parsed.pathname}/`;
  }
  return parsed.toString();
}

function normalizeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").trim();
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.startsWith("/")) {
    throw new Error(`Invalid relative path: ${value}`);
  }
  return path.posix.normalize(normalized);
}

function parseDeleteList(deleteListPath) {
  if (!deleteListPath) {
    return [];
  }
  const raw = fs.readFileSync(deleteListPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const unique = new Map();
  for (const line of lines) {
    const normalized = normalizeRelativePath(line);
    const key = normalized.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }
  return Array.from(unique.values()).sort();
}

async function walkFiles(directoryPath, output = []) {
  const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(entryPath, output);
      continue;
    }
    if (entry.isFile()) {
      output.push(entryPath);
    }
  }
  return output;
}

async function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function buildIndex({ sourceDir, baseUrl, version, deleteListPath }) {
  const sourceStats = await fs.promises.stat(sourceDir).catch(() => null);
  if (!sourceStats || !sourceStats.isDirectory()) {
    throw new Error(`--source-dir not found: ${sourceDir}`);
  }

  const files = await walkFiles(sourceDir);
  files.sort((left, right) => left.localeCompare(right));
  const entries = [];

  for (const absolutePath of files) {
    const stats = await fs.promises.stat(absolutePath);
    const relativeRaw = path.relative(sourceDir, absolutePath);
    const relativePath = normalizeRelativePath(relativeRaw);
    const sha256 = await computeFileSha256(absolutePath);
    entries.push({
      path: relativePath,
      sha256,
      size: Number(stats.size || 0)
    });
  }

  const distribution = {
    version: String(version || new Date().toISOString()).trim(),
    baseUrl,
    files: entries
  };

  const deleteEntries = parseDeleteList(deleteListPath);
  if (deleteEntries.length > 0) {
    distribution.delete = deleteEntries;
  }

  return distribution;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const sourceDir = path.resolve(String(args["source-dir"] || ""));
  const outPath = path.resolve(String(args.out || ""));
  const baseUrl = ensureHttpBaseUrl(args["base-url"]);
  const version = String(args.version || "").trim();
  const deleteListPath = args["delete-list"] ? path.resolve(String(args["delete-list"])) : "";

  if (!sourceDir || !outPath) {
    printUsage();
    throw new Error("--source-dir and --out are required.");
  }

  const index = await buildIndex({
    sourceDir,
    baseUrl,
    version,
    deleteListPath
  });

  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log("Distribution index written.");
  console.log(`Source: ${sourceDir}`);
  console.log(`Output: ${outPath}`);
  console.log(`Files: ${index.files.length}`);
  if (Array.isArray(index.delete)) {
    console.log(`Delete entries: ${index.delete.length}`);
  }
}

main().catch((error) => {
  console.error(`Failed to build distribution index: ${String(error?.message || error)}`);
  process.exit(1);
});
