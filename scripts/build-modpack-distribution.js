#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { resolveProject } = require("../lib/projects");

const CHUNK_BYTES = 20 * 1024 * 1024;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_ASSETS = 20000;
const ALLOWED_DIRECTORIES = new Set(["mods", "cobblemon", "config", "defaultconfigs", "resourcepacks", "shaderpacks"]);
const ALLOWED_ROOT_FILES = new Set(["options.txt"]);

function parseArgs(argv) {
  const args = { output: "distribution", chunkBytes: CHUNK_BYTES };
  const fields = { "--source": "source", "--project": "project", "--output": "output", "--version": "version", "--base-url": "baseUrl", "--chunk-size-mib": "chunkMiB" };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--dry-run") { args.dryRun = true; continue; }
    if (arg === "--help" || arg === "-h") { args.help = true; continue; }
    const [flag, inline] = arg.split(/=(.*)/s);
    if (!fields[flag]) throw new Error(`Unknown argument: ${arg}`);
    const value = inline ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    args[fields[flag]] = value;
  }
  if (args.chunkMiB !== undefined) args.chunkBytes = Number(args.chunkMiB) * 1024 * 1024;
  if (!Number.isSafeInteger(args.chunkBytes) || args.chunkBytes < 1 || args.chunkBytes >= MAX_ASSET_BYTES) {
    throw new Error("Chunk size must be greater than 0 and less than 25 MiB.");
  }
  if (args.baseUrl && !/^https?:$/.test(new URL(args.baseUrl).protocol)) throw new Error("Base URL must use HTTP(S).");
  return args;
}

function normalizeManagedPath(value) {
  const normalized = String(value || "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("\0") || normalized.includes(":") || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Invalid modpack file path: ${value}`);
  }
  const parts = normalized.split("/");
  if (!(parts.length === 1 ? ALLOWED_ROOT_FILES.has(parts[0]) : ALLOWED_DIRECTORIES.has(parts[0]))) throw new Error(`Unsupported modpack file path: ${value}`);
  return normalized;
}

async function collectFiles(source, relative = "") {
  const entries = await fs.promises.readdir(path.join(source, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.posix.join(relative, entry.name);
    if (!relative && !ALLOWED_DIRECTORIES.has(entry.name) && !ALLOWED_ROOT_FILES.has(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks cannot be distributed: ${next}`);
    if (entry.isDirectory()) files.push(...await collectFiles(source, next));
    else if (entry.isFile()) files.push(normalizeManagedPath(next));
  }
  return files.sort();
}

function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

async function writeAtomic(target, contents) {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try {
    await fs.promises.writeFile(temp, contents);
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.promises.rename(temp, target);
        break;
      } catch (error) {
        if (attempt >= 4 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  } finally {
    await fs.promises.rm(temp, { force: true });
  }
}

async function validatePagesOutput(output) {
  let count = 0;
  async function visit(directory) {
    for (const entry of await fs.promises.readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Symlink in distribution output: ${target}`);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) {
        if ((await fs.promises.stat(target)).size > MAX_ASSET_BYTES) throw new Error(`Pages asset exceeds 25 MiB: ${target}`);
        count++;
      }
    }
  }
  if (fs.existsSync(output)) await visit(output);
  if (count > MAX_ASSETS) throw new Error(`Pages Free supports at most ${MAX_ASSETS} files; output contains ${count}.`);
  return count;
}

async function buildDistribution(args, config) {
  const project = resolveProject(config, args.project);
  const source = path.resolve(args.source || "");
  const output = path.resolve(args.output || "distribution");
  if (!args.source || !fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Error("--source must point to an existing modpack directory.");
  if (isWithin(source, output) || isWithin(output, source)) throw new Error("Source and distribution output directories must be separate.");
  const chunkBytes = args.chunkBytes ?? CHUNK_BYTES;
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < 1 || chunkBytes >= MAX_ASSET_BYTES) throw new Error("Invalid chunk size.");
  const version = String(args.version || "").trim();
  if (!version) throw new Error("--version is required for every modpack release.");
  await validatePagesOutput(output);
  const filePaths = await collectFiles(source);
  if (filePaths.length === 0) throw new Error("No distributable modpack files found.");
  const keys = new Set();
  const projectOutput = path.join(output, project.id);
  const files = [];
  const writtenAssets = new Set();
  async function writeAsset(sha256, data) {
    if (args.dryRun || writtenAssets.has(sha256)) return;
    const target = path.join(projectOutput, "files", `${sha256}.bin`);
    if (fs.existsSync(target)) {
      const existingHash = crypto.createHash("sha256").update(await fs.promises.readFile(target)).digest("hex");
      if (existingHash === sha256) {
        writtenAssets.add(sha256);
        return;
      }
    }
    await writeAtomic(target, data);
    writtenAssets.add(sha256);
  }
  const assetUrl = (hash) => {
    const relativeUrl = `files/${hash}.bin`;
    return args.baseUrl ? new URL(`${project.id}/${relativeUrl}`, args.baseUrl.replace(/\/?$/, "/")).toString() : relativeUrl;
  };
  for (const filePath of filePaths) {
    const key = filePath.toLowerCase();
    if (keys.has(key)) throw new Error(`Duplicate Windows modpack file path: ${filePath}`);
    keys.add(key);
    const hash = crypto.createHash("sha256");
    const pieces = [];
    let size = 0;
    for await (const data of fs.createReadStream(path.join(source, filePath), { highWaterMark: chunkBytes })) {
      const sha256 = crypto.createHash("sha256").update(data).digest("hex");
      hash.update(data);
      size += data.length;
      pieces.push({ url: assetUrl(sha256), sha256, size: data.length });
      await writeAsset(sha256, data);
    }
    const sha256 = hash.digest("hex");
    if (pieces.length === 0) {
      pieces.push({ url: assetUrl(sha256), sha256, size: 0 });
      await writeAsset(sha256, Buffer.alloc(0));
    }
    files.push({ path: filePath, sha256, size, ...(pieces.length === 1 ? { url: pieces[0].url } : { chunks: pieces }) });
  }
  const manifest = { id: project.id, type: "distribution", version, minecraftVersion: project.minecraftVersion, files };
  if (!args.dryRun) {
    // Keep previous hash assets for clients that have already fetched an older manifest.
    const manifestText = JSON.stringify(manifest, null, 2) + "\n";
    if (Buffer.byteLength(manifestText) > MAX_ASSET_BYTES) throw new Error("Manifest exceeds the Pages asset size limit.");
    await writeAtomic(path.join(output, "_headers"), "/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n");
    await writeAtomic(path.join(output, "index.html"), "<!doctype html><html><head><meta charset=\"utf-8\"><title>BetterLauncher modpacks</title></head><body><h1>BetterLauncher modpack distribution</h1></body></html>\n");
    await writeAtomic(path.join(output, "404.html"), "<!doctype html><html><head><title>Not found</title></head><body>Modpack asset not found.</body></html>\n");
    const count = await validatePagesOutput(output);
    if (count === MAX_ASSETS && !fs.existsSync(path.join(projectOutput, "latest.json"))) throw new Error("No space left for manifest within the Pages file limit.");
    await writeAtomic(path.join(projectOutput, "latest.json"), manifestText);
  }
  return { manifest, output, manifestPath: path.join(projectOutput, "latest.json") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("npm run modpack:build -- --project <id> --source <directory> --version <version> [--output distribution] [--base-url https://name.pages.dev/] [--dry-run]\nBuilds static HTTP(S) distribution files. Upload the whole output directory using Cloudflare Pages Direct Upload.");
    return;
  }
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "modpack.config.json"), "utf8"));
  const result = await buildDistribution(args, config);
  if (args.dryRun) console.log(JSON.stringify(result.manifest, null, 2));
  else console.log(`Built ${result.manifest.id} ${result.manifest.version}: ${result.manifest.files.length} files\nManifest: ${result.manifestPath}\nUpload directory: ${result.output}`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { parseArgs, buildDistribution, validatePagesOutput, main };
