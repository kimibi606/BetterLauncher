#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const DEFAULT_REPOSITORY = "ExamplePack";
const DEFAULT_MINECRAFT_VERSION = "1.21.1";
const MANIFEST_ASSET_NAME = "latest.json";
const ALLOWED_TOP_LEVEL_DIRECTORIES = new Set([
  "mods",
  "cobblemon",
  "config",
  "defaultconfigs",
  "resourcepacks",
  "shaderpacks"
]);
const ALLOWED_ROOT_FILES = new Set(["options.txt"]);
const EXCLUDED_DIRECTORY_NAMES = new Set([".git", ".bettermon", ".bettermonlauncher", "node_modules"]);

function asText(value) {
  return String(value || "").trim();
}

function parseArgs(argv) {
  const args = {
    source: "",
    repo: asText(process.env.BETTERMON_MODPACK_GITHUB_REPOSITORY) || DEFAULT_REPOSITORY,
    tag: "",
    version: "",
    dryRun: false,
    prerelease: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      return argv[index] || "";
    };

    if (arg === "--source" || arg === "-s") {
      args.source = next();
    } else if (arg.startsWith("--source=")) {
      args.source = arg.slice("--source=".length);
    } else if (arg === "--repo" || arg === "-r") {
      args.repo = next();
    } else if (arg.startsWith("--repo=")) {
      args.repo = arg.slice("--repo=".length);
    } else if (arg === "--tag") {
      args.tag = next();
    } else if (arg.startsWith("--tag=")) {
      args.tag = arg.slice("--tag=".length);
    } else if (arg === "--version") {
      args.version = next();
    } else if (arg.startsWith("--version=")) {
      args.version = arg.slice("--version=".length);
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--prerelease") {
      args.prerelease = true;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.source) {
    args.source =
      asText(process.env.BETTERMON_MODPACK_SOURCE_DIR) ||
      path.join(os.homedir(), "Desktop", "modpack");
  }

  return args;
}

function printUsage() {
  console.log([
    "Usage:",
    "  npm run modpack:publish -- --source C:\\Users\\user\\Desktop\\modpack",
    "",
    "Options:",
    "  --source <dir>       Modpack directory to scan",
    "  --repo owner/name    GitHub repository for modpack releases",
    "  --tag <tag>          Release tag to create",
    "  --version <version>  Manifest version value",
    "  --dry-run            Build the manifest without creating a release"
  ].join("\n"));
}

function parseRepository(value) {
  const match = asText(value).match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new Error(`Invalid GitHub repository: ${value}`);
  }
  return { owner: match[1], repo: match[2] };
}

function normalizeManifestPath(relativePath) {
  const normalized = asText(relativePath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0")) {
    return "";
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) {
    return "";
  }
  return parts.join("/");
}

function isAllowedManifestPath(relativePath) {
  const normalized = normalizeManifestPath(relativePath);
  if (!normalized) {
    return false;
  }
  const parts = normalized.split("/");
  if (parts.length === 1) {
    return ALLOWED_ROOT_FILES.has(parts[0]);
  }
  return ALLOWED_TOP_LEVEL_DIRECTORIES.has(parts[0]);
}

async function listFilesRecursive(root, current = "") {
  const absolute = path.join(root, current);
  const entries = await fs.promises.readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = current ? path.join(current, entry.name) : entry.name;
    const manifestPath = normalizeManifestPath(relativePath);
    if (!manifestPath || entry.name === MANIFEST_ASSET_NAME) {
      continue;
    }

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name)) {
        continue;
      }
      files.push(...await listFilesRecursive(root, relativePath));
      continue;
    }

    if (entry.isFile() && isAllowedManifestPath(manifestPath)) {
      files.push(manifestPath);
    }
  }

  return files;
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

async function buildLocalFileEntries(sourceDir) {
  const relativePaths = (await listFilesRecursive(sourceDir)).sort((left, right) =>
    left.localeCompare(right, "en", { sensitivity: "base" })
  );
  const files = [];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(sourceDir, relativePath);
    const stat = await fs.promises.stat(absolutePath);
    files.push({
      path: relativePath,
      absolutePath,
      size: stat.size,
      sha256: await computeFileSha256(absolutePath)
    });
  }
  return files;
}

function readLocalMetadata(sourceDir) {
  const latestPath = path.join(sourceDir, MANIFEST_ASSET_NAME);
  if (!fs.existsSync(latestPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(latestPath, "utf8"));
  } catch (error) {
    throw new Error(`Local ${MANIFEST_ASSET_NAME} is invalid JSON: ${String(error?.message || error)}`);
  }
}

async function fetchJsonOrNull(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`);
  }
  return response.json();
}

function buildGitHubHeaders(token, extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "BetterMon-Modpack-Publisher",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

async function fetchPreviousManifest(owner, repo) {
  const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest/download/${MANIFEST_ASSET_NAME}`;
  try {
    return await fetchJsonOrNull(url, { "Cache-Control": "no-cache", "User-Agent": "BetterMon-Modpack-Publisher" });
  } catch {
    return null;
  }
}

function buildPreviousIndexes(previousManifest) {
  const byPath = new Map();
  const byHash = new Map();
  if (!Array.isArray(previousManifest?.files)) {
    return { byPath, byHash };
  }

  for (const file of previousManifest.files) {
    const filePath = normalizeManifestPath(file?.path);
    const sha256 = asText(file?.sha256).toLowerCase();
    const url = asText(file?.url);
    if (!filePath || !sha256 || !url) {
      continue;
    }
    const entry = { path: filePath, sha256, url, size: Number(file?.size || 0) };
    byPath.set(filePath.toLowerCase(), entry);
    if (!byHash.has(sha256)) {
      byHash.set(sha256, entry);
    }
  }
  return { byPath, byHash };
}

function sanitizeAssetName(value) {
  const text = asText(value)
    .replace(/\\/g, "__")
    .replace(/\//g, "__")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return text || "file";
}

function buildAssetName(file, usedNames) {
  const prefix = file.sha256.slice(0, 12);
  const trimmedPath = sanitizeAssetName(file.path).slice(-160);
  const baseName = `${prefix}-${trimmedPath}`;
  let assetName = baseName;
  let index = 2;
  while (usedNames.has(assetName.toLowerCase())) {
    assetName = `${prefix}-${index}-${trimmedPath}`;
    index += 1;
  }
  usedNames.add(assetName.toLowerCase());
  return assetName;
}

function getGitHubToken() {
  const envToken = asText(process.env.GH_TOKEN || process.env.GITHUB_TOKEN || process.env.BETTERMON_GITHUB_TOKEN);
  if (envToken) {
    return envToken;
  }

  const result = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0 || !result.stdout) {
    return "";
  }

  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const equalsIndex = line.indexOf("=");
    if (equalsIndex > 0) {
      values[line.slice(0, equalsIndex)] = line.slice(equalsIndex + 1);
    }
  }
  return asText(values.password);
}

function buildReleaseTag(tag) {
  const explicitTag = asText(tag);
  if (explicitTag) {
    return explicitTag;
  }
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    "modpack-v",
    now.getFullYear(),
    ".",
    pad(now.getMonth() + 1),
    ".",
    pad(now.getDate()),
    ".",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

async function createGitHubRelease(owner, repo, token, tag, prerelease) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases`;
  const response = await fetch(url, {
    method: "POST",
    headers: buildGitHubHeaders(token, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      draft: false,
      prerelease: Boolean(prerelease)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Failed to create GitHub release (${response.status}): ${asText(payload?.message) || "unknown error"}`);
  }
  return payload;
}

async function uploadReleaseAsset(uploadUrlTemplate, token, assetName, contentType, buffer) {
  const uploadUrl = `${uploadUrlTemplate.replace(/\{.*$/, "")}?name=${encodeURIComponent(assetName)}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildGitHubHeaders(token, {
      "Content-Type": contentType,
      "Content-Length": String(buffer.length)
    }),
    body: buffer
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Failed to upload asset ${assetName} (${response.status}): ${asText(payload?.message) || "unknown error"}`);
  }
  return payload;
}

function createManifest({ version, minecraftVersion, files, deleteEntries }) {
  return {
    id: "bettermon",
    type: "distribution",
    version,
    minecraftVersion,
    files: files.map((file) => ({
      path: file.path,
      url: file.url,
      sha256: file.sha256,
      size: file.size
    })),
    delete: deleteEntries
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(args.source);
  const sourceStat = await fs.promises.stat(sourceDir).catch(() => null);
  if (!sourceStat || !sourceStat.isDirectory()) {
    throw new Error(`Modpack source directory does not exist: ${sourceDir}`);
  }

  const { owner, repo } = parseRepository(args.repo);
  const metadata = readLocalMetadata(sourceDir);
  const previousManifest = await fetchPreviousManifest(owner, repo);
  const previousIndexes = buildPreviousIndexes(previousManifest);
  const localFiles = await buildLocalFileEntries(sourceDir);
  const localPathKeys = new Set(localFiles.map((file) => file.path.toLowerCase()));
  const previousPaths = Array.isArray(previousManifest?.files)
    ? previousManifest.files.map((file) => normalizeManifestPath(file?.path)).filter(Boolean)
    : [];
  const removedFromPrevious = previousPaths.filter((filePath) => !localPathKeys.has(filePath.toLowerCase()));
  const localDeleteEntries = Array.isArray(metadata.delete)
    ? metadata.delete.map(normalizeManifestPath).filter(Boolean)
    : Array.isArray(metadata.remove)
      ? metadata.remove.map(normalizeManifestPath).filter(Boolean)
      : [];
  const deleteEntries = Array.from(new Set([...removedFromPrevious, ...localDeleteEntries])).sort((left, right) =>
    left.localeCompare(right, "en", { sensitivity: "base" })
  );
  const changedFiles = [];
  const reusedFiles = [];
  const usedAssetNames = new Set([MANIFEST_ASSET_NAME.toLowerCase()]);

  for (const file of localFiles) {
    const previousByPath = previousIndexes.byPath.get(file.path.toLowerCase());
    const previousByHash = previousIndexes.byHash.get(file.sha256);
    const reusablePrevious = previousByPath?.sha256 === file.sha256 ? previousByPath : previousByHash;
    if (reusablePrevious?.url) {
      reusedFiles.push({ ...file, url: reusablePrevious.url });
      continue;
    }
    changedFiles.push({
      ...file,
      assetName: buildAssetName(file, usedAssetNames)
    });
  }

  const tag = buildReleaseTag(args.tag);
  const version = asText(args.version || metadata.version) || tag;
  if (args.dryRun) {
    const dryRunFiles = [
      ...reusedFiles,
      ...changedFiles.map((file) => ({
        ...file,
        url: `https://github.com/${owner}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file.assetName)}`
      }))
    ].sort((left, right) => left.path.localeCompare(right.path, "en", { sensitivity: "base" }));
    const manifest = createManifest({
      version,
      minecraftVersion: asText(metadata.minecraftVersion) || DEFAULT_MINECRAFT_VERSION,
      files: dryRunFiles,
      deleteEntries
    });
    console.log(JSON.stringify(manifest, null, 2));
    console.error(`dry run: changed ${changedFiles.length}, reused ${reusedFiles.length}, delete ${deleteEntries.length}`);
    return;
  }

  const token = getGitHubToken();
  if (!token) {
    throw new Error("GitHub token is missing. Set GH_TOKEN/GITHUB_TOKEN or sign in through git credential manager.");
  }

  const release = await createGitHubRelease(owner, repo, token, tag, args.prerelease);
  const uploadedFiles = [];
  for (let index = 0; index < changedFiles.length; index += 1) {
    const file = changedFiles[index];
    console.log(`[${index + 1}/${changedFiles.length}] uploading ${file.path}`);
    const buffer = await fs.promises.readFile(file.absolutePath);
    const asset = await uploadReleaseAsset(release.upload_url, token, file.assetName, "application/octet-stream", buffer);
    uploadedFiles.push({ ...file, url: asset.browser_download_url });
  }

  const manifestFiles = [...reusedFiles, ...uploadedFiles].sort((left, right) =>
    left.path.localeCompare(right.path, "en", { sensitivity: "base" })
  );
  const manifest = createManifest({
    version,
    minecraftVersion: asText(metadata.minecraftVersion) || DEFAULT_MINECRAFT_VERSION,
    files: manifestFiles,
    deleteEntries
  });
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await uploadReleaseAsset(release.upload_url, token, MANIFEST_ASSET_NAME, "application/json", manifestBuffer);

  console.log(`release: ${release.html_url}`);
  console.log(`changed: ${changedFiles.length}, reused: ${reusedFiles.length}, delete: ${deleteEntries.length}`);
  console.log(`manifest files: ${manifestFiles.length}`);
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});
