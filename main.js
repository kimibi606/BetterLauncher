const fs = require("fs");
const crypto = require("crypto");
const os = require("os");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { fileURLToPath } = require("url");

const { app, BrowserWindow, dialog, ipcMain, screen, shell, safeStorage } = require("electron");
const { autoUpdater } = require("electron-updater");
const { Client } = require("minecraft-launcher-core");

const MICROSOFT_AUTH_CACHE_FILE = "microsoft_auth.json";
const MICROSOFT_AUTH_CACHE_ENVELOPE_FORMAT = "safe-storage-v1";
const MICROSOFT_AUTH_SCHEMA_VERSION = 2;
const MICROSOFT_OAUTH_DEFAULT_CLIENT_ID = "19d2cd2f-06f2-40b7-a7d0-fe3bf47f56d1";
const MICROSOFT_OAUTH_DEFAULT_TENANT = "consumers";
const MICROSOFT_OAUTH_DEFAULT_REDIRECT_URI = "http://localhost";
const MICROSOFT_OAUTH_DEFAULT_PROMPT = "select_account";
const MICROSOFT_OAUTH_SCOPE = "XboxLive.signin XboxLive.offline_access offline_access";
const MICROSOFT_OAUTH_AUTHORIZE_PATH = "/oauth2/v2.0/authorize";
const MICROSOFT_OAUTH_TOKEN_PATH = "/oauth2/v2.0/token";
const XBOX_LIVE_AUTH_URL = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MINECRAFT_AUTH_URL = "https://api.minecraftservices.com/authentication/login_with_xbox";
const XBOX_DEVICE_AUTH_URL = "https://device.auth.xboxlive.com/device/authenticate";
const XBOX_SISU_AUTHENTICATE_URL = "https://sisu.xboxlive.com/authenticate";
const XBOX_SISU_AUTHORIZE_URL = "https://sisu.xboxlive.com/authorize";
const MICROSOFT_LIVE_OAUTH_TOKEN_URL = "https://login.live.com/oauth20_token.srf";
const MICROSOFT_MINECRAFT_CLIENT_ID = "00000000402b5328";
const MICROSOFT_MINECRAFT_AUTH_REPLY_URL = "https://login.live.com/oauth20_desktop.srf";
const MICROSOFT_MINECRAFT_REQUESTED_SCOPE = "service::user.auth.xboxlive.com::MBI_SSL";
const MINECRAFT_LAUNCHER_LOGIN_URL = "https://api.minecraftservices.com/launcher/login";
const MINECRAFT_SERVICES_USER_AGENT = "BetterMon Launcher (Minecraft Launcher compatible auth)";
const WINDOWS_EPOCH_SECONDS = 11644473600n;
const WINDOWS_TICKS_PER_SECOND = 10000000n;
const MINECRAFT_ENTITLEMENTS_URL = "https://api.minecraftservices.com/entitlements/mcstore";
const MINECRAFT_PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";
const MODPACK_CONFIG_FILE = "modpack.config.json";
const MODPACK_STATE_DIRECTORY = ".bettermon";
const MODPACK_STATE_FILE = "modpack-state.json";
const LEGACY_MODPACK_STATE_FILE = "modpack_state.json";
const DEFAULT_MODPACK_GITHUB_REPOSITORY = "ExamplePack";
const MODPACK_GITHUB_MANIFEST_ASSET = "latest.json";
const MODPACK_ALLOWED_TOP_LEVEL_DIRECTORIES = new Set([
  "mods",
  "mods-disabled",
  "cobblemon",
  "config",
  "defaultconfigs",
  "resourcepacks",
  "shaderpacks"
]);
const MODPACK_MODS_DIRECTORY = "mods";
const MODPACK_DISABLED_MODS_DIRECTORY = "mods-disabled";
const MODPACK_ALLOWED_ROOT_FILES = new Set(["options.txt"]);
const LAUNCHER_USER_DATA_DIRECTORY = ".bettermonlauncher";
const LEGACY_USER_DATA_DIRECTORY_CANDIDATES = ["bettermon-launcher", "BetterMon Launcher"];
const LAUNCHER_RUNTIME_DIRECTORY = "runtime";
const LAUNCHER_SESSION_DIRECTORY = "session";
const LAUNCHER_STATE_DIRECTORY = "state";
const LAUNCHER_AUTH_STATE_DIRECTORY = "auth";
const LAUNCHER_UPDATER_STATE_DIRECTORY = "updater";
const LEGACY_SESSION_DATA_ENTRY_NAMES = [
  "blob_storage",
  "Cache",
  "Code Cache",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "Dictionaries",
  "GPUCache",
  "Local Storage",
  "Network",
  "Session Storage",
  "Shared Dictionary",
  "DIPS",
  "Local State",
  "Preferences",
  "SharedStorage"
];
const FIXED_MINECRAFT_VERSION = "1.21.1";
const FIXED_MOD_LOADER = "fabric";
const FIXED_JAVA_MAJOR_VERSION = 21;
const FIXED_JAVA_REQUIREMENT_LABEL = `Java ${FIXED_JAVA_MAJOR_VERSION}`;
const WINDOWS_JAVA_RUNTIME_URL = `https://api.adoptium.net/v3/binary/latest/${FIXED_JAVA_MAJOR_VERSION}/ga/windows/x64/jre/hotspot/normal/eclipse`;
const APP_UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const APP_ICON_PATH = path.join(
  __dirname,
  "src",
  "assets",
  process.platform === "win32" ? "app-icon.ico" : "app-icon.png"
);
const ZIP_MAGIC_SIGNATURES = new Set(["504b0304", "504b0506", "504b0708"]);
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
const ZIP_EOCD_MIN_SIZE = 22;
const ZIP_EOCD_MAX_COMMENT_LENGTH = 0xffff;
const ZIP_EOCD_SCAN_PADDING_BYTES = 1024;
const SERVER_STATUS_TIMEOUT_MS = 7000;
const NEWS_REFRESH_DEFAULT_MS = 15000;
const NEWS_REFRESH_MIN_MS = 5000;
const NEWS_REFRESH_MAX_MS = 30 * 60 * 1000;
const NEWS_TIMEOUT_DEFAULT_MS = 7000;
const NEWS_TIMEOUT_MIN_MS = 1000;
const NEWS_TIMEOUT_MAX_MS = 60000;
const NEWS_MAX_ITEMS_DEFAULT = 8;
const NEWS_MAX_ITEMS_LIMIT = 20;
const GITHUB_RELEASE_TIMEOUT_DEFAULT_MS = 7000;
const GITHUB_RELEASE_TIMEOUT_MIN_MS = 1000;
const GITHUB_RELEASE_TIMEOUT_MAX_MS = 60000;
const WINDOW_ROUNDED_RADIUS_PX = 10;
const LAUNCHER_PRESET_OPTIONS = ["low", "high"];
const EXTERNAL_OPEN_URL_MAX_LENGTH = 2048;

let mainWindow;
let isLaunching = false;
let isLaunchRequestInProgress = false;
let isMicrosoftLoggingIn = false;
let microsoftAccount = null;
let isUpdaterInitialized = false;
let updaterPeriodicTimer = null;
let modpackConfigWarnedKey = "";
let cachedModpackConfigPath = "";
let cachedModpackConfigFingerprint = "";
let cachedModpackConfigValue = null;
const modpackSessionSyncedKeys = new Set();
const modpackArchiveSessionCache = new Map();
let activeUpdaterCheckPromise = null;
const updaterState = {
  enabled: false,
  checking: false,
  available: false,
  downloading: false,
  downloaded: false,
  currentVersion: app.getVersion(),
  latestVersion: "",
  releaseName: "",
  releaseDate: "",
  progressPercent: 0,
  lastCheckedAt: "",
  lastError: "",
  message: ""
};

function isMainWindowAlive() {
  return Boolean(mainWindow && !mainWindow.isDestroyed());
}

function withMainWindow(callback) {
  if (!isMainWindowAlive()) {
    return;
  }
  callback(mainWindow);
}

function sendToRenderer(channel, payload) {
  withMainWindow((win) => {
    win.webContents.send(channel, payload);
  });
}

function buildRoundedRectShape(width, height, radius) {
  const safeWidth = Math.max(1, Math.floor(Number(width) || 0));
  const safeHeight = Math.max(1, Math.floor(Number(height) || 0));
  const clampedRadius = Math.max(0, Math.min(Math.floor(Number(radius) || 0), Math.floor(Math.min(safeWidth, safeHeight) / 2)));

  if (clampedRadius <= 0) {
    return [{ x: 0, y: 0, width: safeWidth, height: safeHeight }];
  }

  const rects = [];
  for (let y = 0; y < safeHeight; y += 1) {
    let inset = 0;

    if (y < clampedRadius) {
      const dy = clampedRadius - y - 0.5;
      inset = Math.ceil(clampedRadius - Math.sqrt(Math.max(0, clampedRadius * clampedRadius - dy * dy)));
    } else if (y >= safeHeight - clampedRadius) {
      const dy = y - (safeHeight - clampedRadius) + 0.5;
      inset = Math.ceil(clampedRadius - Math.sqrt(Math.max(0, clampedRadius * clampedRadius - dy * dy)));
    }

    const rowWidth = safeWidth - inset * 2;
    if (rowWidth > 0) {
      rects.push({ x: inset, y, width: rowWidth, height: 1 });
    }
  }

  return rects;
}

function applyRoundedWindowShape(windowRef, radius) {
  if (!windowRef || windowRef.isDestroyed() || typeof windowRef.setShape !== "function") {
    return;
  }

  const bounds = windowRef.getBounds();
  const width = Math.max(1, Math.floor(Number(bounds?.width) || 0));
  const height = Math.max(1, Math.floor(Number(bounds?.height) || 0));
  if (width <= 0 || height <= 0) {
    return;
  }

  try {
    if (windowRef.isMaximized() || windowRef.isFullScreen()) {
      windowRef.setShape([{ x: 0, y: 0, width, height }]);
      return;
    }

    windowRef.setShape(buildRoundedRectShape(width, height, radius));
  } catch {
    // Ignore platforms or window modes that do not support custom shape changes.
  }
}

function getSystemMinecraftDir() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, ".minecraft");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "minecraft");
  }

  return path.join(os.homedir(), ".minecraft");
}

function getLauncherUserDataPath() {
  try {
    return path.join(app.getPath("appData"), LAUNCHER_USER_DATA_DIRECTORY);
  } catch {
    return path.join(process.cwd(), LAUNCHER_USER_DATA_DIRECTORY);
  }
}

function getLauncherSessionDataPath(userDataPath = "") {
  const resolvedUserDataPath =
    typeof userDataPath === "string" && userDataPath.trim() ? userDataPath : getLauncherUserDataPath();
  return path.join(resolvedUserDataPath, LAUNCHER_RUNTIME_DIRECTORY, LAUNCHER_SESSION_DIRECTORY);
}

function getLauncherStateRootPath() {
  return path.join(app.getPath("userData"), LAUNCHER_STATE_DIRECTORY);
}

function getLauncherAuthStatePath() {
  return path.join(getLauncherStateRootPath(), LAUNCHER_AUTH_STATE_DIRECTORY);
}

function getLauncherUpdaterStatePath() {
  return path.join(getLauncherStateRootPath(), LAUNCHER_UPDATER_STATE_DIRECTORY);
}

function normalizePathForCompare(value) {
  const resolved = path.resolve(String(value || ""));
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isAllowedMainWindowNavigationUrl(urlValue) {
  try {
    const parsed = new URL(asTrimmedText(urlValue));
    if (parsed.protocol !== "file:") {
      return false;
    }

    const destinationPath = normalizePathForCompare(fileURLToPath(parsed));
    const expectedPath = normalizePathForCompare(path.join(__dirname, "src", "index.html"));
    return destinationPath === expectedPath;
  } catch {
    return false;
  }
}

function copyDirectoryRecursiveSync(sourcePath, targetPath) {
  if (typeof fs.cpSync === "function") {
    fs.cpSync(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false });
    return;
  }

  fs.mkdirSync(targetPath, { recursive: true });
  const entries = fs.readdirSync(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursiveSync(sourceEntryPath, targetEntryPath);
      continue;
    }
    if (entry.isFile()) {
      if (!fs.existsSync(targetEntryPath)) {
        fs.copyFileSync(sourceEntryPath, targetEntryPath);
      }
    }
  }
}

function movePathWithFallback(sourcePath, targetPath) {
  if (!sourcePath || !targetPath || !fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
    return false;
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(sourcePath, targetPath);
    return true;
  } catch {
    try {
      const sourceStat = fs.statSync(sourcePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (sourceStat.isDirectory()) {
        copyDirectoryRecursiveSync(sourcePath, targetPath);
        fs.rmSync(sourcePath, { recursive: true, force: true });
        return true;
      }
      if (sourceStat.isFile()) {
        fs.copyFileSync(sourcePath, targetPath);
        fs.rmSync(sourcePath, { force: true });
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

function configureLauncherUserDataPath() {
  const userDataPath = getLauncherUserDataPath();
  try {
    app.setPath("userData", userDataPath);
  } catch {
    // ignore path override failures
  }

  try {
    app.setPath("sessionData", getLauncherSessionDataPath(userDataPath));
  } catch {
    // ignore path override failures
  }
}

function getDefaultMinecraftDir() {
  try {
    return path.join(app.getPath("userData"), "minecraft");
  } catch {
    return path.join(process.cwd(), ".bettermon_minecraft");
  }
}

function migrateLegacyUserDataIfNeeded() {
  const targetUserDataPath = app.getPath("userData");
  if (!targetUserDataPath || fs.existsSync(targetUserDataPath)) {
    return;
  }

  const appDataPath = app.getPath("appData");
  const normalizedTarget = normalizePathForCompare(targetUserDataPath);
  for (const legacyDirectoryName of LEGACY_USER_DATA_DIRECTORY_CANDIDATES) {
    const legacyPath = path.join(appDataPath, legacyDirectoryName);
    if (normalizePathForCompare(legacyPath) === normalizedTarget) {
      continue;
    }
    if (!fs.existsSync(legacyPath)) {
      continue;
    }

    try {
      fs.mkdirSync(path.dirname(targetUserDataPath), { recursive: true });
      copyDirectoryRecursiveSync(legacyPath, targetUserDataPath);
      sendLog({
        level: "info",
        message: `Migrated launcher data from "${legacyDirectoryName}" to "${LAUNCHER_USER_DATA_DIRECTORY}".`
      });
      return;
    } catch (error) {
      sendLog({
        level: "warn",
        message: `Failed to migrate legacy launcher data: ${String(error?.message || error)}`
      });
    }
  }
}

function getLegacyMicrosoftAuthCachePath() {
  return path.join(app.getPath("userData"), MICROSOFT_AUTH_CACHE_FILE);
}

function getCurrentMicrosoftAuthCachePath() {
  return path.join(getLauncherAuthStatePath(), MICROSOFT_AUTH_CACHE_FILE);
}

function migrateLegacyMicrosoftAuthCacheIfNeeded() {
  const legacyPath = getLegacyMicrosoftAuthCachePath();
  const currentPath = getCurrentMicrosoftAuthCachePath();
  if (normalizePathForCompare(legacyPath) === normalizePathForCompare(currentPath)) {
    return;
  }

  if (movePathWithFallback(legacyPath, currentPath)) {
    sendLog({
      level: "info",
      message: "Migrated Microsoft auth cache to state/auth directory."
    });
  }
}

function getLegacyUpdaterConfigPath() {
  return path.join(app.getPath("userData"), "updater", "app-update.yml");
}

function getCurrentUpdaterConfigPath() {
  return path.join(getLauncherUpdaterStatePath(), "app-update.yml");
}

function migrateLegacyUpdaterConfigIfNeeded() {
  const legacyPath = getLegacyUpdaterConfigPath();
  const currentPath = getCurrentUpdaterConfigPath();
  if (normalizePathForCompare(legacyPath) === normalizePathForCompare(currentPath)) {
    return;
  }

  if (movePathWithFallback(legacyPath, currentPath)) {
    sendLog({
      level: "info",
      message: "Migrated updater config to state/updater directory."
    });
    return;
  }

  if (fs.existsSync(legacyPath) && fs.existsSync(currentPath)) {
    try {
      fs.rmSync(legacyPath, { force: true });
    } catch {
      // ignore stale legacy updater config cleanup failures
    }
  }
}

function migrateLegacySessionDataIfNeeded() {
  const userDataPath = app.getPath("userData");
  const sessionDataPath = app.getPath("sessionData");
  if (!userDataPath || !sessionDataPath) {
    return;
  }

  if (normalizePathForCompare(userDataPath) === normalizePathForCompare(sessionDataPath)) {
    return;
  }

  fs.mkdirSync(sessionDataPath, { recursive: true });
  let migratedCount = 0;
  for (const entryName of LEGACY_SESSION_DATA_ENTRY_NAMES) {
    const legacyEntryPath = path.join(userDataPath, entryName);
    const currentEntryPath = path.join(sessionDataPath, entryName);
    if (movePathWithFallback(legacyEntryPath, currentEntryPath)) {
      migratedCount += 1;
    }
  }

  if (migratedCount > 0) {
    sendLog({
      level: "info",
      message: `Migrated ${migratedCount} legacy session entries to runtime/session directory.`
    });
  }
}

function migrateLegacyStateLayoutIfNeeded() {
  migrateLegacySessionDataIfNeeded();
  migrateLegacyMicrosoftAuthCacheIfNeeded();
  migrateLegacyUpdaterConfigIfNeeded();
}

configureLauncherUserDataPath();

function asTrimmedText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJvmCustomArgs(rawValue) {
  const rawText = asTrimmedText(rawValue);
  if (!rawText) {
    return [];
  }

  const tokens = rawText.match(/"[^"]*"|\S+/g) || [];
  const parsed = tokens
    .map((token) => token.replace(/^"(.*)"$/, "$1").trim())
    .filter(Boolean);

  const sanitized = [];
  for (let index = 0; index < parsed.length; index += 1) {
    const current = parsed[index];
    const lowered = current.toLowerCase();

    if (lowered === "-xmx" || lowered === "-xms") {
      const next = parsed[index + 1];
      if (next && !next.startsWith("-")) {
        index += 1;
      }
      continue;
    }

    if (lowered.startsWith("-xmx") || lowered.startsWith("-xms")) {
      continue;
    }

    sanitized.push(current);
  }

  return sanitized;
}

function detectLauncherPreset() {
  const cpuInfo = Array.isArray(os.cpus()) ? os.cpus() : [];
  const logicalCores = cpuInfo.length;
  const totalMemoryGb = Number((os.totalmem() / (1024 ** 3)).toFixed(1));
  const cpuModel = asTrimmedText(cpuInfo[0]?.model) || "Unknown CPU";
  const recommendedLow = totalMemoryGb <= 8 || logicalCores <= 4;

  return {
    preset: recommendedLow ? "low" : "high",
    logicalCores,
    totalMemoryGb,
    cpuModel
  };
}

function normalizeLauncherPreset(value, fallback = "high") {
  const preset = asTrimmedText(value).toLowerCase();
  if (preset === "low" || preset === "high") {
    return preset;
  }
  return fallback === "low" ? "low" : "high";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(asTrimmedText(value));
}

function isFileUrl(value) {
  return /^file:\/\//i.test(asTrimmedText(value));
}

function normalizeHostnameForCompare(value) {
  return asTrimmedText(value).replace(/^\[|\]$/g, "").toLowerCase();
}

function isLoopbackHostname(value) {
  const host = normalizeHostnameForCompare(value);
  if (!host) {
    return false;
  }
  if (host === "localhost" || host === "::1") {
    return true;
  }

  const ipv4Parts = host.split(".");
  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => /^\d{1,3}$/.test(part))) {
    const octets = ipv4Parts.map((part) => Number.parseInt(part, 10));
    if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) {
      return false;
    }
    return octets[0] === 127;
  }

  return false;
}

function normalizeExternalOpenUrl(rawUrl, { allowHttpLoopback = true } = {}) {
  const urlText = asTrimmedText(rawUrl);
  if (!urlText) {
    return { ok: false, error: "URL is required." };
  }
  if (urlText.length > EXTERNAL_OPEN_URL_MAX_LENGTH) {
    return { ok: false, error: "URL is too long." };
  }

  let parsed;
  try {
    parsed = new URL(urlText);
  } catch {
    return { ok: false, error: "URL is invalid." };
  }

  if (asTrimmedText(parsed.username) || asTrimmedText(parsed.password)) {
    return { ok: false, error: "URL credentials are not allowed." };
  }

  const protocol = asTrimmedText(parsed.protocol).toLowerCase();
  if (protocol === "https:") {
    return { ok: true, url: parsed.toString() };
  }

  if (protocol === "http:" && allowHttpLoopback && isLoopbackHostname(parsed.hostname)) {
    return { ok: true, url: parsed.toString() };
  }

  return { ok: false, error: "Only https URLs are allowed (http is allowed only for localhost)." };
}

function asNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function asNullableNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function extractPlayerNamesFromPlayersPayload(playersPayload) {
  if (!playersPayload || typeof playersPayload !== "object") {
    return [];
  }

  const sources = [playersPayload.list, playersPayload.sample, playersPayload.names];
  const names = [];
  const dedupe = new Set();

  for (const source of sources) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const item of source) {
      const candidate =
        typeof item === "string"
          ? asTrimmedText(item)
          : asTrimmedText(
              item?.name_clean || item?.name || item?.username || item?.nick || item?.nickname || item?.id
            );
      if (!candidate) {
        continue;
      }

      const key = candidate.toLowerCase();
      if (dedupe.has(key)) {
        continue;
      }
      dedupe.add(key);
      names.push(candidate);

      if (names.length >= 40) {
        return names;
      }
    }
  }

  return names;
}

function asPortNumber(value, fallback = 25565) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function getMinecraftProgressLabel(type) {
  const normalized = asTrimmedText(type).toLowerCase();
  switch (normalized) {
    case "assets":
      return "Minecraft assets";
    case "assets-copy":
      return "Minecraft legacy assets";
    case "classes":
    case "classes-custom":
    case "classes-maven-custom":
      return "Minecraft libraries";
    case "natives":
      return "Minecraft natives";
    case "asset-json":
      return "Minecraft asset index";
    case "version-jar":
      return "Minecraft client";
    default:
      return "Minecraft download";
  }
}

function computeDisplayProgress(currentCompleted, total, hasActiveDownload) {
  const safeTotal = asNonNegativeInteger(total, 0);
  if (safeTotal <= 0) {
    return { current: 0, total: 0 };
  }
  const safeCompleted = Math.max(0, Math.min(asNonNegativeInteger(currentCompleted, 0), safeTotal));
  const displayCurrent = hasActiveDownload && safeCompleted < safeTotal ? safeCompleted + 1 : safeCompleted;
  return { current: displayCurrent, total: safeTotal };
}

function isZipArchiveLocation(value) {
  const normalized = asTrimmedText(value);
  if (!normalized) {
    return false;
  }

  if (isHttpUrl(normalized) || isFileUrl(normalized)) {
    try {
      return /\.zip$/i.test(new URL(normalized).pathname);
    } catch {
      return /\.zip(?:$|[?#])/i.test(normalized);
    }
  }

  return /\.zip$/i.test(normalized.replace(/\\/g, "/"));
}

function isGitHubHttpUrl(value) {
  try {
    const parsed = new URL(asTrimmedText(value));
    return parsed.hostname === "github.com" || parsed.hostname === "api.github.com";
  } catch {
    return false;
  }
}

function buildHttpHeaders(url, baseHeaders = {}) {
  const headers = { ...baseHeaders };
  if (!isGitHubHttpUrl(url)) {
    return headers;
  }

  headers["User-Agent"] = headers["User-Agent"] || "BetterMonLauncher/0.1";
  if (/api\.github\.com$/i.test(new URL(url).hostname)) {
    headers.Accept = headers.Accept || "application/vnd.github+json";
  }

  const token = asTrimmedText(process.env.BETTERMON_GITHUB_TOKEN || process.env.GITHUB_TOKEN);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeSha256(value) {
  const sha = asTrimmedText(value).toLowerCase();
  if (!sha) {
    return "";
  }
  if (!/^[a-f0-9]{64}$/.test(sha)) {
    return "";
  }
  return sha;
}

function normalizeSha1(value) {
  const sha = asTrimmedText(value).toLowerCase();
  if (!sha) {
    return "";
  }
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    return "";
  }
  return sha;
}

function normalizeMd5(value) {
  const md5 = asTrimmedText(value).toLowerCase();
  if (!md5) {
    return "";
  }
  if (!/^[a-f0-9]{32}$/.test(md5)) {
    return "";
  }
  return md5;
}

function computeSha256FromText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function getSessionModpackKey(preset, modpackRoot) {
  const normalizedRoot = path.resolve(modpackRoot);
  const normalizedPreset = normalizeLauncherPreset(preset, "high");
  if (process.platform === "win32") {
    return `${normalizedPreset}|${normalizedRoot.toLowerCase()}`;
  }
  return `${normalizedPreset}|${normalizedRoot}`;
}

function getModpackArchiveCacheKey(preset, modpackRoot) {
  return getSessionModpackKey(preset, modpackRoot);
}

function getModpackArchiveCachePath(modpackRoot, preset) {
  const normalizedPreset = normalizeLauncherPreset(preset, "high");
  return path.join(modpackRoot, MODPACK_STATE_DIRECTORY, "downloads", `modpack_${normalizedPreset}.zip`);
}

function readModpackArchiveSessionCache(preset, modpackRoot) {
  return modpackArchiveSessionCache.get(getModpackArchiveCacheKey(preset, modpackRoot)) || null;
}

function writeModpackArchiveSessionCache(preset, modpackRoot, archiveSource, metadata = {}) {
  modpackArchiveSessionCache.set(getModpackArchiveCacheKey(preset, modpackRoot), {
    sourceKind: asTrimmedText(archiveSource?.kind),
    sourceKey: asTrimmedText(archiveSource?.signatureKey),
    archiveHash: normalizeSha256(metadata?.archiveHash),
    remoteFingerprint: asTrimmedText(metadata?.remoteFingerprint),
    localFingerprint: asTrimmedText(metadata?.localFingerprint),
    cachePath: asTrimmedText(metadata?.cachePath),
    updatedAt: new Date().toISOString()
  });
}

function isPathInside(parentPath, childPath) {
  const parentResolved = path.resolve(parentPath);
  const childResolved = path.resolve(childPath);
  const parentWithSep = parentResolved.endsWith(path.sep) ? parentResolved : `${parentResolved}${path.sep}`;

  if (process.platform === "win32") {
    const parentLower = parentResolved.toLowerCase();
    const parentWithSepLower = parentWithSep.toLowerCase();
    const childLower = childResolved.toLowerCase();
    return childLower === parentLower || childLower.startsWith(parentWithSepLower);
  }

  return childResolved === parentResolved || childResolved.startsWith(parentWithSep);
}

function normalizeRelativeModpackPath(value) {
  const raw = asTrimmedText(value).replace(/\\/g, "/");
  const normalized = path.posix.normalize(raw);
  if (!normalized || normalized === "." || normalized.startsWith("/") || normalized.startsWith("../")) {
    throw new Error(`Invalid modpack path: ${value}`);
  }
  return normalized;
}

function isLauncherManagedInternalModpackPath(relativePath) {
  const normalized = normalizeRelativeModpackPath(relativePath);
  const normalizedKey = buildModpackPathKey(normalized);
  const stateDirectoryKey = buildModpackPathKey(MODPACK_STATE_DIRECTORY);
  return normalizedKey === stateDirectoryKey || normalizedKey.startsWith(`${stateDirectoryKey}/`);
}

function assertModpackPathDoesNotTargetInternalState(relativePath, label = "Modpack path") {
  if (isLauncherManagedInternalModpackPath(relativePath)) {
    throw new Error(`${label} cannot target launcher internal state: ${relativePath}`);
  }
}

function isAllowedManagedModpackPath(relativePath) {
  const normalized = normalizeRelativeModpackPath(relativePath);
  const topLevel = normalized.split("/")[0];
  return MODPACK_ALLOWED_TOP_LEVEL_DIRECTORIES.has(topLevel) || MODPACK_ALLOWED_ROOT_FILES.has(topLevel);
}

function resolveModpackTargetPath(rootDirectory, relativePath) {
  const normalizedRelative = normalizeRelativeModpackPath(relativePath);
  const absolute = path.resolve(rootDirectory, normalizedRelative);
  if (!isPathInside(rootDirectory, absolute)) {
    throw new Error(`Path escapes modpack root: ${relativePath}`);
  }
  return absolute;
}

function buildModpackPathKey(normalizedRelativePath) {
  return process.platform === "win32" ? normalizedRelativePath.toLowerCase() : normalizedRelativePath;
}

function getModpackStatePath(modpackRoot) {
  return path.join(modpackRoot, MODPACK_STATE_DIRECTORY, MODPACK_STATE_FILE);
}

function getLegacyModpackStatePath(modpackRoot) {
  return path.join(modpackRoot, MODPACK_STATE_DIRECTORY, LEGACY_MODPACK_STATE_FILE);
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function readModpackState(modpackRoot) {
  try {
    const statePath = getModpackStatePath(modpackRoot);
    if (fs.existsSync(statePath)) {
      return readJsonFile(statePath);
    }

    const legacyStatePath = getLegacyModpackStatePath(modpackRoot);
    if (fs.existsSync(legacyStatePath)) {
      return readJsonFile(legacyStatePath);
    }

    return null;
  } catch {
    return null;
  }
}

async function writeModpackState(modpackRoot, state) {
  const statePath = getModpackStatePath(modpackRoot);
  await fs.promises.mkdir(path.dirname(statePath), { recursive: true });
  await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function normalizePresetModPattern(value) {
  const rawValue =
    value && typeof value === "object"
      ? value.file || value.name || value.mod || value.pattern
      : value;
  const text = asTrimmedText(rawValue).replace(/\\/g, "/");
  if (!text || text.includes("/") || text === "." || text === "..") {
    return "";
  }
  return text;
}

function normalizePresetModPatterns(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const patterns = [];
  const seen = new Set();
  for (const value of values) {
    const pattern = normalizePresetModPattern(value);
    const key = process.platform === "win32" ? pattern.toLowerCase() : pattern;
    if (!pattern || seen.has(key)) {
      continue;
    }
    seen.add(key);
    patterns.push(pattern);
  }
  return patterns;
}

function normalizePresetModRuleSet(presets) {
  const presetRules = presets && typeof presets === "object" ? presets : {};
  const rules = {};

  for (const preset of LAUNCHER_PRESET_OPTIONS) {
    const presetRule = presetRules[preset] && typeof presetRules[preset] === "object" ? presetRules[preset] : {};
    const disableMods = Array.isArray(presetRule.disableMods) ? presetRule.disableMods : [];
    rules[preset] = normalizePresetModPatterns(disableMods);
  }

  return rules;
}

function mergePresetModRuleSets(...ruleSets) {
  const merged = {};
  for (const preset of LAUNCHER_PRESET_OPTIONS) {
    const values = [];
    for (const ruleSet of ruleSets) {
      if (ruleSet && Array.isArray(ruleSet[preset])) {
        values.push(...ruleSet[preset]);
      }
    }
    merged[preset] = normalizePresetModPatterns(values);
  }
  return merged;
}

function getPresetModRuleConfig(externalPresetRules = null) {
  if (externalPresetRules && typeof externalPresetRules === "object") {
    return normalizePresetModRuleSet(externalPresetRules);
  }

  const config = readModpackConfig() || {};
  const directPresets = config.presets && typeof config.presets === "object" ? config.presets : {};
  const modpackConfig = config.modpack && typeof config.modpack === "object" ? config.modpack : {};
  const modpackPresets = modpackConfig.presets && typeof modpackConfig.presets === "object" ? modpackConfig.presets : {};
  return mergePresetModRuleSets(normalizePresetModRuleSet(modpackPresets), normalizePresetModRuleSet(directPresets));
}

function buildPresetModPatternMatcher(patterns) {
  const exact = new Set();
  const contains = [];
  const wildcardRegexes = [];
  for (const pattern of patterns) {
    const normalized = process.platform === "win32" ? pattern.toLowerCase() : pattern;
    if (/[?*]/.test(pattern)) {
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
      wildcardRegexes.push(new RegExp(`^${escaped}$`, process.platform === "win32" ? "i" : ""));
    } else if (!/\.jar$/i.test(pattern)) {
      contains.push(normalized);
    } else {
      exact.add(normalized);
    }
  }

  return (fileName) => {
    const normalizedFileName = process.platform === "win32" ? asTrimmedText(fileName).toLowerCase() : asTrimmedText(fileName);
    return (
      exact.has(normalizedFileName) ||
      contains.some((pattern) => normalizedFileName.includes(pattern)) ||
      wildcardRegexes.some((regex) => regex.test(fileName))
    );
  };
}

async function listModDirectoryFiles(directoryPath) {
  try {
    const entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function moveModFileReplacing(sourcePath, targetPath) {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.rm(targetPath, { force: true });
  await fs.promises.rename(sourcePath, targetPath);
}

async function writePresetModState(modpackRoot, presetMods) {
  const previousState = readModpackState(modpackRoot) || {};
  await writeModpackState(modpackRoot, {
    ...previousState,
    presetMods,
    preset: presetMods.preset || previousState.preset,
    presetAppliedAt: presetMods.appliedAt
  });
}

async function applyPresetModRules(modpackRoot, launcherPreset, presetRules = null) {
  const normalizedPreset = normalizeLauncherPreset(launcherPreset, "high");
  const rules = getPresetModRuleConfig(presetRules);
  const activeDisablePatterns = rules[normalizedPreset] || [];
  const managedPatterns = normalizePresetModPatterns(Object.values(rules).flat());
  const appliedAt = new Date().toISOString();

  if (managedPatterns.length === 0) {
    return {
      ok: true,
      skipped: true,
      preset: normalizedPreset,
      movedToMods: 0,
      movedToDisabled: 0,
      managedMods: [],
      disabledMods: []
    };
  }

  const modsPath = path.join(modpackRoot, MODPACK_MODS_DIRECTORY);
  const disabledModsPath = path.join(modpackRoot, MODPACK_DISABLED_MODS_DIRECTORY);
  await fs.promises.mkdir(modsPath, { recursive: true });
  await fs.promises.mkdir(disabledModsPath, { recursive: true });

  const matchesManaged = buildPresetModPatternMatcher(managedPatterns);
  const matchesActiveDisabled = buildPresetModPatternMatcher(activeDisablePatterns);
  const currentModFiles = await listModDirectoryFiles(modsPath);
  const currentDisabledModFiles = await listModDirectoryFiles(disabledModsPath);
  const allKnownFiles = [...currentModFiles, ...currentDisabledModFiles];
  const unmatchedDisabledMods = activeDisablePatterns.filter((pattern) => {
    const matcher = buildPresetModPatternMatcher([pattern]);
    return !allKnownFiles.some((fileName) => matcher(fileName));
  });
  const movedToMods = [];
  const movedToDisabled = [];

  for (const fileName of currentDisabledModFiles) {
    if (!matchesManaged(fileName) || matchesActiveDisabled(fileName)) {
      continue;
    }
    await moveModFileReplacing(path.join(disabledModsPath, fileName), path.join(modsPath, fileName));
    movedToMods.push(fileName);
  }

  for (const fileName of currentModFiles) {
    if (!matchesActiveDisabled(fileName)) {
      continue;
    }
    await moveModFileReplacing(path.join(modsPath, fileName), path.join(disabledModsPath, fileName));
    movedToDisabled.push(fileName);
  }

  const presetMods = {
    preset: normalizedPreset,
    appliedAt,
    managedMods: managedPatterns,
    disabledMods: activeDisablePatterns,
    unmatchedDisabledMods,
    movedToMods,
    movedToDisabled,
    skipped: movedToMods.length === 0 && movedToDisabled.length === 0
  };
  await writePresetModState(modpackRoot, presetMods);

  if (movedToMods.length > 0 || movedToDisabled.length > 0) {
    sendLog({
      level: "info",
      message: `Preset ${normalizedPreset} applied. Enabled ${movedToMods.length}, disabled ${movedToDisabled.length} mod(s).`
    });
  } else if (unmatchedDisabledMods.length > 0) {
    sendLog({
      level: "warn",
      message: `Preset ${normalizedPreset} could not find configured mod(s): ${unmatchedDisabledMods.join(", ")}`
    });
  }

  return {
    ok: true,
    ...presetMods,
    movedToMods: movedToMods.length,
    movedToDisabled: movedToDisabled.length
  };
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

async function computeFileDigest(filePath, algorithm) {
  const normalizedAlgorithm = asTrimmedText(algorithm).toLowerCase();
  if (normalizedAlgorithm !== "sha256" && normalizedAlgorithm !== "sha1" && normalizedAlgorithm !== "md5") {
    throw new Error(`Unsupported hash algorithm: ${algorithm}`);
  }

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(normalizedAlgorithm);
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function getPathEntryType(targetPath) {
  try {
    const stats = await fs.promises.stat(targetPath);
    if (stats.isFile()) {
      return "file";
    }
    if (stats.isDirectory()) {
      return "directory";
    }
    return "other";
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return "missing";
    }
    throw error;
  }
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: buildHttpHeaders(url)
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  if (!response.body) {
    throw new Error(`Download response has no body: ${url}`);
  }

  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
  const stream = fs.createWriteStream(destinationPath);
  const readable = Readable.fromWeb(response.body);
  let bytesWritten = 0;
  readable.on("data", (chunk) => {
    bytesWritten += Number(chunk?.length || chunk?.byteLength || 0);
  });
  await pipeline(readable, stream);

  const rawContentLength = asTrimmedText(response.headers.get("content-length"));
  const expectedContentLength = Number.parseInt(rawContentLength, 10);
  if (Number.isFinite(expectedContentLength) && expectedContentLength >= 0 && bytesWritten !== expectedContentLength) {
    throw new Error(
      `Download size mismatch for ${url} (expected ${expectedContentLength} bytes, received ${bytesWritten} bytes).`
    );
  }

  return {
    status: response.status,
    finalUrl: asTrimmedText(response.url) || url,
    contentType: asTrimmedText(response.headers.get("content-type")),
    contentLength: expectedContentLength,
    bytesWritten
  };
}

async function readTextFromSource(source, label) {
  if (!source || typeof source !== "object") {
    throw new Error(`Invalid source for ${label}.`);
  }

  if (source.kind === "http") {
    const response = await fetch(source.value, {
      redirect: "follow",
      cache: "no-store",
      headers: buildHttpHeaders(source.value)
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${label} (${response.status}).`);
    }
    return response.text();
  }

  try {
    return await fs.promises.readFile(source.value, "utf8");
  } catch (error) {
    throw new Error(`Failed to read ${label}: ${String(error?.message || error)}`);
  }
}

async function readFileHeadHex(filePath, byteLength = 4) {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const length = Math.max(1, Number(byteLength) || 4);
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.slice(0, bytesRead).toString("hex").toLowerCase();
  } finally {
    await handle.close();
  }
}

async function validateZipArchiveForExtraction(archivePath) {
  const resolvedPath = path.resolve(archivePath);
  let stats;
  try {
    stats = await fs.promises.stat(resolvedPath);
  } catch (error) {
    throw new Error(`ZIP file not found: ${resolvedPath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`ZIP path is not a file: ${resolvedPath}`);
  }
  if (stats.size < ZIP_EOCD_MIN_SIZE) {
    throw new Error(`ZIP file is too small (${stats.size} bytes): ${resolvedPath}`);
  }

  const magic = await readFileHeadHex(resolvedPath, 4);
  if (!ZIP_MAGIC_SIGNATURES.has(magic)) {
    throw new Error(`Invalid ZIP header (${magic || "empty"}): ${resolvedPath}`);
  }

  const scanSize = Math.min(
    stats.size,
    ZIP_EOCD_MIN_SIZE + ZIP_EOCD_MAX_COMMENT_LENGTH + ZIP_EOCD_SCAN_PADDING_BYTES
  );
  const handle = await fs.promises.open(resolvedPath, "r");
  try {
    const windowBuffer = Buffer.alloc(scanSize);
    const { bytesRead } = await handle.read(windowBuffer, 0, scanSize, stats.size - scanSize);
    const scanned = windowBuffer.slice(0, bytesRead);
    let eocdOffset = -1;

    for (let index = scanned.length - ZIP_EOCD_MIN_SIZE; index >= 0; index -= 1) {
      if (!scanned.slice(index, index + 4).equals(ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE)) {
        continue;
      }
      const commentLength = scanned.readUInt16LE(index + 20);
      if (index + ZIP_EOCD_MIN_SIZE + commentLength === scanned.length) {
        eocdOffset = index;
        break;
      }
    }

    if (eocdOffset < 0) {
      throw new Error("Missing ZIP end-of-central-directory record (archive is likely incomplete/corrupted).");
    }

    const diskNumber = scanned.readUInt16LE(eocdOffset + 4);
    const centralDirectoryDiskNumber = scanned.readUInt16LE(eocdOffset + 6);
    const diskNumberLooksUnsupported = diskNumber !== 0 && diskNumber !== 0xffff;
    const centralDirectoryDiskLooksUnsupported =
      centralDirectoryDiskNumber !== 0 && centralDirectoryDiskNumber !== 0xffff;
    if (diskNumberLooksUnsupported || centralDirectoryDiskLooksUnsupported) {
      throw new Error("ZIP appears to use split/spanned disk metadata, which is unsupported.");
    }

    return {
      path: resolvedPath,
      size: stats.size,
      magic
    };
  } finally {
    await handle.close();
  }
}

function normalizeZipExtractionError(archivePath, error, stage) {
  const rawMessage = String(error?.message || error);
  const resolvedArchivePath = path.resolve(archivePath);
  const contextualPrefix = `Failed to ${stage} modpack ZIP`;

  if (
    /InvalidDataException/i.test(rawMessage) ||
    /OpenRead/i.test(rawMessage) ||
    /split or spanned archives are not supported/i.test(rawMessage) ||
    /unexpected end of archive/i.test(rawMessage) ||
    /end-of-central-directory/i.test(rawMessage)
  ) {
    return new Error(
      `${contextualPrefix}. ZIP is invalid/unsupported. Recreate it as a normal single-file ZIP and republish. (${resolvedArchivePath})`
    );
  }

  return new Error(`${contextualPrefix}: ${rawMessage}`);
}

async function getHttpResourceFingerprint(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      headers: buildHttpHeaders(url)
    });
    if (!response.ok) {
      return "";
    }
    const etag = asTrimmedText(response.headers.get("etag"));
    const lastModified = asTrimmedText(response.headers.get("last-modified"));
    const contentLength = asTrimmedText(response.headers.get("content-length"));
    if (!etag && !lastModified && !contentLength) {
      return "";
    }
    return computeSha256FromText(`${etag}|${lastModified}|${contentLength}`);
  } catch {
    return "";
  }
}

async function getLocalFileFingerprint(filePath) {
  const stats = await fs.promises.stat(filePath);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }
  return `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
}

function getModpackConfigCandidatePaths() {
  const candidates = [];
  if (app.isPackaged) {
    candidates.push(path.join(path.dirname(process.execPath), MODPACK_CONFIG_FILE));
    candidates.push(path.join(app.getAppPath(), MODPACK_CONFIG_FILE));
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, MODPACK_CONFIG_FILE));
    }
    candidates.push(path.join(__dirname, MODPACK_CONFIG_FILE));
  } else {
    candidates.push(path.join(process.cwd(), MODPACK_CONFIG_FILE));
    candidates.push(path.join(__dirname, MODPACK_CONFIG_FILE));
  }

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = asTrimmedText(candidate);
    if (!normalized) {
      continue;
    }
    const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(normalized);
  }
  return deduped;
}

function getFileFingerprint(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return "";
    }
    return `${stats.size}:${Math.trunc(stats.mtimeMs)}`;
  } catch {
    return "";
  }
}

function readModpackConfig() {
  const configPaths = getModpackConfigCandidatePaths();
  for (const configPath of configPaths) {
    const fingerprint = getFileFingerprint(configPath);
    if (!fingerprint) {
      continue;
    }

    if (
      cachedModpackConfigValue &&
      cachedModpackConfigPath === configPath &&
      cachedModpackConfigFingerprint === fingerprint
    ) {
      return cachedModpackConfigValue;
    }

    try {
      const parsed = readJsonFile(configPath);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Config JSON must be an object.");
      }
      const resolvedConfig = {
        ...parsed,
        __configPath: configPath
      };
      cachedModpackConfigPath = configPath;
      cachedModpackConfigFingerprint = fingerprint;
      cachedModpackConfigValue = resolvedConfig;
      modpackConfigWarnedKey = "";
      return resolvedConfig;
    } catch (error) {
      const errorMessage = String(error?.message || error);
      const warningKey = `${configPath}|${fingerprint}|${errorMessage}`;
      if (modpackConfigWarnedKey !== warningKey) {
        modpackConfigWarnedKey = warningKey;
        sendLog({
          level: "warn",
          message: `Invalid modpack config (${configPath}): ${errorMessage}`
        });
      }
    }
  }

  cachedModpackConfigPath = "";
  cachedModpackConfigFingerprint = "";
  cachedModpackConfigValue = null;
  return null;
}

function asIntegerInRange(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeNewsDateText(value) {
  const text = asTrimmedText(value);
  if (!text) {
    return "";
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeNewsTextValue(value) {
  if (Array.isArray(value)) {
    return value.map((line) => asTrimmedText(line)).filter(Boolean).join("\n");
  }
  return asTrimmedText(value);
}

function normalizeLauncherNewsItem(rawItem) {
  if (typeof rawItem === "string") {
    const text = normalizeNewsTextValue(rawItem);
    if (!text) {
      return null;
    }
    return {
      type: "\uC548\uB0B4",
      date: "",
      text
    };
  }

  if (!rawItem || typeof rawItem !== "object") {
    return null;
  }

  const type = asTrimmedText(rawItem.type || rawItem.category || rawItem.tag || rawItem.kind) || "\uC548\uB0B4";
  const primaryText =
    normalizeNewsTextValue(rawItem.text) ||
    normalizeNewsTextValue(rawItem.message) ||
    normalizeNewsTextValue(rawItem.content) ||
    normalizeNewsTextValue(rawItem.body) ||
    normalizeNewsTextValue(rawItem.note);
  const titleText = asTrimmedText(rawItem.title);
  const summaryText =
    normalizeNewsTextValue(rawItem.summary) ||
    normalizeNewsTextValue(rawItem.description) ||
    normalizeNewsTextValue(rawItem.details);
  const text = primaryText || (titleText && summaryText ? `${titleText}\n${summaryText}` : titleText);
  if (!text) {
    return null;
  }

  const date = normalizeNewsDateText(
    rawItem.date || rawItem.publishedAt || rawItem.updatedAt || rawItem.createdAt || rawItem.time || rawItem.timestamp
  );

  return {
    type,
    date,
    text
  };
}

function normalizeLauncherNewsItems(rawItems, maxItems = NEWS_MAX_ITEMS_DEFAULT) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const limit = asIntegerInRange(maxItems, NEWS_MAX_ITEMS_DEFAULT, 1, NEWS_MAX_ITEMS_LIMIT);
  const normalized = [];
  const dedupe = new Set();
  for (const rawItem of rawItems) {
    const item = normalizeLauncherNewsItem(rawItem);
    if (!item) {
      continue;
    }
    const dedupeKey = `${item.type}|${item.date}|${item.text}`.toLowerCase();
    if (dedupe.has(dedupeKey)) {
      continue;
    }
    dedupe.add(dedupeKey);
    normalized.push(item);
    if (normalized.length >= limit) {
      break;
    }
  }
  return normalized;
}

function pickLauncherNewsItemsArray(payload, itemsPath = "") {
  if (itemsPath) {
    const fromPath = getObjectPathValue(payload, itemsPath);
    if (Array.isArray(fromPath)) {
      return fromPath;
    }
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const candidates = [
    payload.items,
    payload.news,
    payload.updates,
    payload.notes,
    payload.data?.items,
    payload.data?.news,
    payload.result?.items
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

function resolveLauncherNewsSource(rawValue, configPath = "") {
  const value = asTrimmedText(rawValue);
  if (!value) {
    return null;
  }

  if (isHttpUrl(value)) {
    return { kind: "http", value };
  }

  let resolvedPath = "";
  if (isFileUrl(value)) {
    try {
      resolvedPath = fileURLToPath(value);
    } catch {
      return null;
    }
  } else if (path.isAbsolute(value)) {
    resolvedPath = value;
  } else {
    const baseDirectory = configPath ? path.dirname(configPath) : process.cwd();
    resolvedPath = path.resolve(baseDirectory, value);
  }

  return {
    kind: "file",
    value: resolvedPath
  };
}

function appendRequestCacheBuster(url, key = "_ts") {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, `${Date.now()}-${process.hrtime.bigint().toString()}`);
    return parsed.toString();
  } catch {
    const separator = String(url).includes("?") ? "&" : "?";
    return `${url}${separator}${encodeURIComponent(key)}=${Date.now()}`;
  }
}

function appendNewsCacheBuster(url) {
  return appendRequestCacheBuster(url, "_newsTs");
}

function readLauncherNewsConfig() {
  const config = readModpackConfig();
  const configPath = asTrimmedText(config?.__configPath);
  const newsConfig = config && config.news && typeof config.news === "object" ? config.news : {};

  const envSource = asTrimmedText(
    process.env.BETTERMON_NEWS_URL || process.env.BETTERMON_NEWS_SOURCE || process.env.BETTERMON_NEWS_PATH
  );
  const sourceRaw = asTrimmedText(
    envSource ||
      newsConfig.url ||
      newsConfig.source ||
      newsConfig.path ||
      config?.newsUrl ||
      config?.newsSource ||
      config?.newsPath
  );
  const source = resolveLauncherNewsSource(sourceRaw, configPath);
  const fallbackSourceRaw = asTrimmedText(
    process.env.BETTERMON_NEWS_FALLBACK_URL ||
      process.env.BETTERMON_NEWS_FALLBACK_SOURCE ||
      newsConfig.fallbackUrl ||
      newsConfig.fallbackSource ||
      newsConfig.publicUrl ||
      config?.newsFallbackUrl ||
      config?.newsPublicUrl
  );
  const fallbackSource = resolveLauncherNewsSource(fallbackSourceRaw, configPath);
  const refreshMs = asIntegerInRange(
    process.env.BETTERMON_NEWS_REFRESH_MS || newsConfig.refreshMs || config?.newsRefreshMs,
    NEWS_REFRESH_DEFAULT_MS,
    NEWS_REFRESH_MIN_MS,
    NEWS_REFRESH_MAX_MS
  );
  const timeoutMs = asIntegerInRange(
    process.env.BETTERMON_NEWS_TIMEOUT_MS || newsConfig.timeoutMs || config?.newsTimeoutMs,
    NEWS_TIMEOUT_DEFAULT_MS,
    NEWS_TIMEOUT_MIN_MS,
    NEWS_TIMEOUT_MAX_MS
  );
  const requestedMaxItems = asIntegerInRange(
    process.env.BETTERMON_NEWS_MAX_ITEMS || newsConfig.maxItems || config?.newsMaxItems,
    NEWS_MAX_ITEMS_DEFAULT,
    1,
    NEWS_MAX_ITEMS_LIMIT
  );
  const maxItems = Math.max(NEWS_MAX_ITEMS_DEFAULT, requestedMaxItems);
  const itemsPath = asTrimmedText(process.env.BETTERMON_NEWS_ITEMS_PATH || newsConfig.itemsPath || config?.newsItemsPath);
  const inlineItems = Array.isArray(newsConfig.items)
    ? newsConfig.items
    : Array.isArray(config?.newsItems)
      ? config.newsItems
      : [];

  return {
    source,
    fallbackSource,
    itemsPath,
    inlineItems,
    refreshMs,
    timeoutMs,
    maxItems
  };
}

function readGitHubReleaseConfig() {
  const config = readModpackConfig();
  const githubConfig = config && config.github && typeof config.github === "object" ? config.github : {};
  const owner = asTrimmedText(
    process.env.BETTERMON_GH_OWNER ||
      process.env.BETTERMON_GITHUB_OWNER ||
      githubConfig.owner ||
      config?.githubOwner
  );
  const repo = asTrimmedText(
    process.env.BETTERMON_GH_REPO ||
      process.env.BETTERMON_GITHUB_REPO ||
      githubConfig.repo ||
      config?.githubRepo
  );
  const apiBaseUrl = asTrimmedText(
    process.env.BETTERMON_GITHUB_API_BASE || githubConfig.apiBaseUrl || githubConfig.apiBase || config?.githubApiBase
  );
  const timeoutMs = asIntegerInRange(
    process.env.BETTERMON_GITHUB_TIMEOUT_MS || githubConfig.timeoutMs || config?.githubTimeoutMs,
    GITHUB_RELEASE_TIMEOUT_DEFAULT_MS,
    GITHUB_RELEASE_TIMEOUT_MIN_MS,
    GITHUB_RELEASE_TIMEOUT_MAX_MS
  );

  return {
    owner,
    repo,
    apiBaseUrl: (apiBaseUrl || "https://api.github.com").replace(/\/+$/g, ""),
    timeoutMs,
    configured: Boolean(owner && repo)
  };
}

function normalizeGitHubReleaseAssetList(rawAssets) {
  if (!Array.isArray(rawAssets)) {
    return [];
  }

  const assets = [];
  for (const rawAsset of rawAssets) {
    const name = asTrimmedText(rawAsset?.name);
    const downloadUrl = asTrimmedText(rawAsset?.browser_download_url || rawAsset?.url);
    if (!name || !downloadUrl) {
      continue;
    }
    assets.push({
      name,
      downloadUrl,
      contentType: asTrimmedText(rawAsset?.content_type),
      size: asNonNegativeInteger(rawAsset?.size, 0)
    });
  }
  return assets;
}

async function getLatestGitHubReleaseSnapshot(options = {}) {
  const github = readGitHubReleaseConfig();
  const updatedAt = new Date().toISOString();
  const forceRefresh = Boolean(options?.force || options?.forceRefresh);

  if (!github.configured) {
    return {
      ok: false,
      configured: false,
      owner: github.owner,
      repo: github.repo,
      repositoryUrl: "",
      releaseUrl: "",
      tagName: "",
      name: "",
      publishedAt: "",
      prerelease: false,
      draft: false,
      body: "",
      assets: [],
      updatedAt,
      error: "GitHub repository owner/repo is not configured."
    };
  }

  const repositoryUrl = `https://github.com/${github.owner}/${github.repo}`;
  const baseApiUrl = `${github.apiBaseUrl}/repos/${encodeURIComponent(github.owner)}/${encodeURIComponent(github.repo)}/releases/latest`;
  const apiUrl = forceRefresh ? appendRequestCacheBuster(baseApiUrl, "_releaseTs") : baseApiUrl;

  try {
    const response = await fetchWithTimeout(
      apiUrl,
      {
        headers: buildHttpHeaders(baseApiUrl, {
          ...(forceRefresh
            ? {
                "Cache-Control": "no-store, no-cache, max-age=0",
                Pragma: "no-cache",
                Expires: "0"
              }
            : {})
        })
      },
      github.timeoutMs
    );

    if (!response.ok) {
      throw new Error(`Failed to load latest GitHub release (${response.status}).`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("GitHub release response is invalid.");
    }

    const assets = normalizeGitHubReleaseAssetList(payload.assets);
    return {
      ok: true,
      configured: true,
      owner: github.owner,
      repo: github.repo,
      repositoryUrl,
      releaseUrl: asTrimmedText(payload.html_url) || `${repositoryUrl}/releases`,
      tagName: asTrimmedText(payload.tag_name),
      name: asTrimmedText(payload.name),
      publishedAt: asTrimmedText(payload.published_at || payload.created_at || payload.updated_at),
      prerelease: Boolean(payload.prerelease),
      draft: Boolean(payload.draft),
      body: String(payload.body || ""),
      assets,
      updatedAt,
      error: ""
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      owner: github.owner,
      repo: github.repo,
      repositoryUrl,
      releaseUrl: `${repositoryUrl}/releases`,
      tagName: "",
      name: "",
      publishedAt: "",
      prerelease: false,
      draft: false,
      body: "",
      assets: [],
      updatedAt,
      error: String(error?.message || error)
    };
  }
}

function readModpackManifestConfig() {
  const config = readModpackConfig();
  const modpackConfig = config && config.modpack && typeof config.modpack === "object" ? config.modpack : {};
  const modpackGithubConfig =
    modpackConfig.github && typeof modpackConfig.github === "object" ? modpackConfig.github : {};
  const manifestUrl = asTrimmedText(
    process.env.BETTERMON_MODPACK_MANIFEST_URL || modpackConfig.manifestUrl || config?.modpackManifestUrl
  );
  const repository = asTrimmedText(
    process.env.BETTERMON_MODPACK_GITHUB_REPOSITORY ||
      process.env.BETTERMON_MODPACK_GH_REPOSITORY ||
      modpackGithubConfig.repository ||
      modpackConfig.githubRepository ||
      config?.modpackGithubRepository ||
      DEFAULT_MODPACK_GITHUB_REPOSITORY
  );
  const apiBaseUrl = asTrimmedText(
    process.env.BETTERMON_MODPACK_GITHUB_API_BASE ||
      modpackGithubConfig.apiBaseUrl ||
      modpackGithubConfig.apiBase ||
      modpackConfig.githubApiBaseUrl ||
      config?.modpackGithubApiBase
  );
  const manifestAsset = asTrimmedText(
    process.env.BETTERMON_MODPACK_GITHUB_MANIFEST_ASSET ||
      modpackGithubConfig.manifestAsset ||
      modpackConfig.manifestAsset ||
      config?.modpackGithubManifestAsset ||
      MODPACK_GITHUB_MANIFEST_ASSET
  );
  const timeoutMs = asIntegerInRange(
    process.env.BETTERMON_MODPACK_GITHUB_TIMEOUT_MS ||
      modpackGithubConfig.timeoutMs ||
      modpackConfig.timeoutMs ||
      config?.modpackGithubTimeoutMs,
    GITHUB_RELEASE_TIMEOUT_DEFAULT_MS,
    GITHUB_RELEASE_TIMEOUT_MIN_MS,
    GITHUB_RELEASE_TIMEOUT_MAX_MS
  );

  return {
    manifestUrl,
    repository,
    apiBaseUrl: (apiBaseUrl || "https://api.github.com").replace(/\/+$/g, ""),
    manifestAsset: manifestAsset || MODPACK_GITHUB_MANIFEST_ASSET,
    timeoutMs,
    configured: Boolean(manifestUrl || repository)
  };
}

function normalizeRepositoryName(value) {
  const repository = asTrimmedText(value).replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return "";
  }
  return repository;
}

function buildGitHubLatestReleaseAssetUrl(repository, assetName) {
  const normalizedRepository = normalizeRepositoryName(repository);
  const normalizedAssetName = asTrimmedText(assetName);
  if (!normalizedRepository || !normalizedAssetName) {
    return "";
  }
  const [owner, repo] = normalizedRepository.split("/");
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest/download/${encodeURIComponent(normalizedAssetName)}`;
}

async function fetchModpackManifestSource() {
  const manifestConfig = readModpackManifestConfig();
  if (!manifestConfig.configured) {
    return null;
  }

  if (manifestConfig.manifestUrl) {
    const source = normalizeModpackArchiveSource(manifestConfig.manifestUrl, "");
    if (!source) {
      throw new Error(`Invalid modpack manifest URL: ${manifestConfig.manifestUrl}`);
    }
    const text = await readTextFromSource(source, "modpack manifest");
    return {
      text,
      json: JSON.parse(text),
      manifestLocation: source.value,
      sourceKind: source.kind,
      sourceKey: source.signatureKey
    };
  }

  const repository = normalizeRepositoryName(manifestConfig.repository);
  if (!repository) {
    throw new Error(`Invalid modpack GitHub repository: ${manifestConfig.repository}`);
  }

  const directManifestUrl = buildGitHubLatestReleaseAssetUrl(repository, manifestConfig.manifestAsset);
  if (directManifestUrl) {
    const directResponse = await fetchWithTimeout(
      directManifestUrl,
      {
        headers: buildHttpHeaders(directManifestUrl)
      },
      manifestConfig.timeoutMs
    );
    if (directResponse.ok) {
      const text = await directResponse.text();
      const manifestLocation = directManifestUrl;
      return {
        text,
        json: JSON.parse(text),
        manifestLocation,
        sourceKind: "http",
        sourceKey: `github-latest:${repository}:${manifestConfig.manifestAsset}:${manifestLocation}`
      };
    }
  }

  const [owner, repo] = repository.split("/");
  const apiUrl = `${manifestConfig.apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
  const releaseResponse = await fetchWithTimeout(
    apiUrl,
    {
      headers: buildHttpHeaders(apiUrl)
    },
    manifestConfig.timeoutMs
  );
  if (!releaseResponse.ok) {
    throw new Error(`Failed to load latest modpack GitHub release (${releaseResponse.status}).`);
  }

  const release = await releaseResponse.json();
  const manifestAsset = Array.isArray(release?.assets)
    ? release.assets.find((asset) => asTrimmedText(asset?.name) === manifestConfig.manifestAsset)
    : null;
  const manifestUrl = asTrimmedText(manifestAsset?.browser_download_url || manifestAsset?.url);
  if (!manifestUrl) {
    throw new Error(`GitHub Release asset not found: ${manifestConfig.manifestAsset}`);
  }

  const manifestResponse = await fetchWithTimeout(
    manifestUrl,
    {
      headers: buildHttpHeaders(manifestUrl)
    },
    manifestConfig.timeoutMs
  );
  if (!manifestResponse.ok) {
    throw new Error(`Failed to load modpack manifest (${manifestResponse.status}).`);
  }

  const text = await manifestResponse.text();
  return {
    text,
    json: JSON.parse(text),
    manifestLocation: manifestUrl,
    sourceKind: "http",
    sourceKey: `github:${repository}:${asTrimmedText(release?.tag_name)}:${manifestConfig.manifestAsset}`
  };
}

function resolveModpackManifestArchiveSource(manifestSource, archiveUrl) {
  const archiveReference = asTrimmedText(archiveUrl);
  if (!archiveReference) {
    return null;
  }

  if (isHttpUrl(archiveReference) || isFileUrl(archiveReference) || path.isAbsolute(archiveReference)) {
    return normalizeModpackArchiveSource(archiveReference, "");
  }

  if (manifestSource?.sourceKind === "http") {
    try {
      return normalizeModpackArchiveSource(new URL(archiveReference, manifestSource.manifestLocation).toString(), "");
    } catch {
      return null;
    }
  }

  if (manifestSource?.sourceKind === "file") {
    return normalizeModpackArchiveSource(path.resolve(path.dirname(manifestSource.manifestLocation), archiveReference), "");
  }

  return null;
}

function parseModpackManifest(manifestSource) {
  const json = manifestSource?.json;
  if (!json || typeof json !== "object") {
    throw new Error("Invalid modpack manifest JSON.");
  }
  const archive = json.archive && typeof json.archive === "object" ? json.archive : null;
  if (!archive) {
    throw new Error("Modpack manifest is missing archive.");
  }

  const archiveSha1 = normalizeSha1(archive.sha1);
  if (!archiveSha1) {
    throw new Error("Modpack manifest archive.sha1 is missing or invalid.");
  }

  const archiveSource = resolveModpackManifestArchiveSource(manifestSource, archive.url);
  if (!archiveSource) {
    throw new Error("Modpack manifest archive.url is missing or invalid.");
  }

  const size = Number(archive.size || 0);
  const rawPresetRules =
    json.presets && typeof json.presets === "object"
      ? json.presets
      : json.modpack && typeof json.modpack === "object" && json.modpack.presets && typeof json.modpack.presets === "object"
        ? json.modpack.presets
        : null;
  return {
    id: asTrimmedText(json.id) || "bettermon",
    version: asTrimmedText(json.version) || archiveSha1.slice(0, 12),
    minecraftVersion: asTrimmedText(json.minecraftVersion),
    archive: {
      source: archiveSource,
      sha1: archiveSha1,
      size: Number.isFinite(size) && size > 0 ? size : 0
    },
    presetRules: rawPresetRules ? normalizePresetModRuleSet(rawPresetRules) : null,
    sourceKey: asTrimmedText(manifestSource.sourceKey),
    manifestDigest: computeSha256FromText(manifestSource.text)
  };
}

async function readLauncherNewsPayload(source, timeoutMs = NEWS_TIMEOUT_DEFAULT_MS, options = {}) {
  if (!source || !source.kind || !source.value) {
    throw new Error("News source is not configured.");
  }

  if (source.kind === "http") {
    const forceRefresh = Boolean(options?.force || options?.forceRefresh);
    const requestUrl = appendNewsCacheBuster(source.value);
    const response = await fetchWithTimeout(
      requestUrl,
      {
        headers: buildHttpHeaders(source.value, {
          "Cache-Control": forceRefresh ? "no-store, no-cache, max-age=0" : "no-cache",
          Pragma: "no-cache",
          ...(forceRefresh ? { Expires: "0" } : {})
        })
      },
      timeoutMs
    );
    if (!response.ok) {
      throw new Error(`Failed to load launcher news (${response.status}).`);
    }
    const raw = await response.text();
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("Launcher news JSON is invalid.");
    }
  }

  const raw = await fs.promises.readFile(source.value, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Launcher news JSON is invalid.");
  }
}

async function getLauncherNewsSnapshot(options = {}) {
  const config = readLauncherNewsConfig();
  const forceRefresh = Boolean(options?.force || options?.forceRefresh);
  const hasSource = Boolean(config?.source?.value);
  const hasFallbackSource = Boolean(config?.fallbackSource?.value);
  const fallbackItems = normalizeLauncherNewsItems(config.inlineItems, config.maxItems);
  let sourceType = hasSource ? config.source.kind : "inline";
  let errorMessage = "";
  let items = fallbackItems;

  if (hasSource) {
    try {
      const payload = await readLauncherNewsPayload(config.source, config.timeoutMs, { forceRefresh });
      const pickedItems = pickLauncherNewsItemsArray(payload, config.itemsPath);
      items = normalizeLauncherNewsItems(pickedItems, config.maxItems);
      sourceType = config.source.kind;
    } catch (error) {
      const primaryError = String(error?.message || error);
      sourceType = config.source.kind;
      if (hasFallbackSource) {
        try {
          const payload = await readLauncherNewsPayload(config.fallbackSource, config.timeoutMs, { forceRefresh });
          const pickedItems = pickLauncherNewsItemsArray(payload, config.itemsPath);
          items = normalizeLauncherNewsItems(pickedItems, config.maxItems);
          sourceType = config.fallbackSource.kind;
        } catch (fallbackError) {
          errorMessage = `${primaryError}; fallback: ${String(fallbackError?.message || fallbackError)}`;
        }
      } else {
        errorMessage = primaryError;
      }
    }
  }

  return {
    ok: !errorMessage || items.length > 0,
    hasSource,
    source: sourceType,
    updatedAt: new Date().toISOString(),
    refreshMs: config.refreshMs,
    items,
    error: errorMessage
  };
}

function getObjectPathValue(source, dottedPath) {
  if (!dottedPath) {
    return source;
  }

  const segments = String(dottedPath)
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  let current = source;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number.parseInt(segment, 10)];
      continue;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = current[segment];
  }
  return current;
}

function inferBooleanStatus(value, expectedOnlineValue = "") {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
    return null;
  }

  const normalized = asTrimmedText(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (expectedOnlineValue && normalized === expectedOnlineValue) {
    return true;
  }
  if (["online", "up", "ok", "running", "alive", "true", "1", "yes", "on", "normal"].includes(normalized)) {
    return true;
  }
  if (["offline", "down", "error", "stopped", "false", "0", "no", "off", "maintenance"].includes(normalized)) {
    return false;
  }
  return null;
}

function formatStatusDisplayValue(value) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "\uC628\uB77C\uC778" : "\uC624\uD504\uB77C\uC778";
  }
  if (typeof value === "number") {
    return String(value);
  }
  const text = asTrimmedText(value);
  if (text) {
    return text;
  }

  if (typeof value === "object") {
    const statusLikeValue =
      asTrimmedText(value.status) ||
      asTrimmedText(value.state) ||
      asTrimmedText(value.message) ||
      asTrimmedText(value.result);
    if (statusLikeValue) {
      return statusLikeValue;
    }
    try {
      const serialized = JSON.stringify(value);
      if (!serialized) {
        return "-";
      }
      return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
    } catch {
      return "-";
    }
  }

  return "-";
}

function readServerStatusConfig() {
  const config = readModpackConfig();
  const serverStatusConfig =
    config && config.serverStatus && typeof config.serverStatus === "object" ? config.serverStatus : {};

  const envHost = asTrimmedText(process.env.BETTERMON_SERVER_HOST || process.env.BETTERMON_SERVER_ADDRESS);
  const envPort = asTrimmedText(process.env.BETTERMON_SERVER_PORT);
  const envMolangUrl = asTrimmedText(process.env.BETTERMON_MOLANG_STATUS_URL);
  const envMolangField = asTrimmedText(process.env.BETTERMON_MOLANG_FIELD);
  const envMolangOnlineField = asTrimmedText(process.env.BETTERMON_MOLANG_ONLINE_FIELD);
  const envMolangOnlineValue = asTrimmedText(process.env.BETTERMON_MOLANG_ONLINE_VALUE).toLowerCase();

  const host = asTrimmedText(
    envHost ||
      serverStatusConfig.host ||
      serverStatusConfig.address ||
      serverStatusConfig.ip ||
      config?.serverHost ||
      config?.serverAddress ||
      config?.serverIp ||
      "server.example"
  );
  const port = asPortNumber(envPort || serverStatusConfig.port || config?.serverPort, 25565);
  const molangUrl = asTrimmedText(
    envMolangUrl || serverStatusConfig.molangUrl || serverStatusConfig.molangStatusUrl || config?.molangStatusUrl
  );
  const molangField = asTrimmedText(envMolangField || serverStatusConfig.molangField || config?.molangField);
  const molangOnlineField = asTrimmedText(
    envMolangOnlineField || serverStatusConfig.molangOnlineField || config?.molangOnlineField
  );
  const molangOnlineValue = asTrimmedText(
    envMolangOnlineValue || serverStatusConfig.molangOnlineValue || config?.molangOnlineValue
  ).toLowerCase();

  return {
    host,
    port,
    molangUrl,
    molangField,
    molangOnlineField,
    molangOnlineValue
  };
}

function buildAutoConnectTarget() {
  const config = readServerStatusConfig();
  const host = asTrimmedText(config.host);
  const port = asPortNumber(config.port, 25565);
  if (!host) {
    return {
      ok: false,
      reason: "server-host-missing",
      host: "",
      port,
      identifier: ""
    };
  }

  return {
    ok: true,
    host,
    port,
    identifier: `${host}:${port}`
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = SERVER_STATUS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function hasMeaningfulPlayerCapacity(serverStatus) {
  const playersOnline = asNullableNonNegativeInteger(serverStatus?.playersOnline);
  const playersMax = asNullableNonNegativeInteger(serverStatus?.playersMax);
  return playersOnline !== null && playersMax !== null && playersMax > 0;
}

function writeMinecraftVarInt(value) {
  const bytes = [];
  let current = Number(value) >>> 0;
  do {
    let temp = current & 0x7f;
    current >>>= 7;
    if (current !== 0) {
      temp |= 0x80;
    }
    bytes.push(temp);
  } while (current !== 0);
  return Buffer.from(bytes);
}

function readMinecraftVarInt(buffer, offset = 0) {
  let value = 0;
  let position = 0;

  for (let index = offset; index < buffer.length; index += 1) {
    const current = buffer[index];
    value |= (current & 0x7f) << (7 * position);
    position += 1;

    if ((current & 0x80) !== 0x80) {
      return {
        value,
        size: index - offset + 1
      };
    }

    if (position > 5) {
      throw new Error("Minecraft status response contained an invalid VarInt.");
    }
  }

  return null;
}

function writeMinecraftString(value) {
  const content = Buffer.from(asTrimmedText(value), "utf8");
  return Buffer.concat([writeMinecraftVarInt(content.length), content]);
}

function buildMinecraftStatusPacket(packetId, payload = Buffer.alloc(0)) {
  const body = Buffer.concat([writeMinecraftVarInt(packetId), payload]);
  return Buffer.concat([writeMinecraftVarInt(body.length), body]);
}

function buildMinecraftStatusHandshake(host, port) {
  const payload = Buffer.concat([
    writeMinecraftVarInt(767),
    writeMinecraftString(host),
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    writeMinecraftVarInt(1)
  ]);
  return buildMinecraftStatusPacket(0, payload);
}

function parseMinecraftStatusResponse(buffer) {
  const packetLength = readMinecraftVarInt(buffer, 0);
  if (!packetLength || buffer.length < packetLength.size + packetLength.value) {
    return null;
  }

  let offset = packetLength.size;
  const packetId = readMinecraftVarInt(buffer, offset);
  if (!packetId) {
    return null;
  }
  offset += packetId.size;

  if (packetId.value !== 0) {
    throw new Error(`Unexpected Minecraft status packet id: ${packetId.value}`);
  }

  const jsonLength = readMinecraftVarInt(buffer, offset);
  if (!jsonLength) {
    return null;
  }
  offset += jsonLength.size;

  const jsonEnd = offset + jsonLength.value;
  if (buffer.length < jsonEnd) {
    return null;
  }

  return JSON.parse(buffer.subarray(offset, jsonEnd).toString("utf8"));
}

function normalizeDirectMinecraftPlayerNames(playersPayload) {
  const sample = Array.isArray(playersPayload?.sample) ? playersPayload.sample : [];
  return extractPlayerNamesFromPlayersPayload({
    sample: sample.map((entry) => ({
      name: entry?.name,
      id: entry?.id
    }))
  });
}

async function queryMinecraftServerStatusDirect(host, port) {
  const target = `${host}:${port}`;
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const chunks = [];
    let finished = false;

    const finish = (result) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        address: target,
        online: null,
        playersOnline: null,
        playersMax: null,
        playerNames: [],
        error: "Minecraft status ping timed out.",
        source: "direct"
      });
    }, SERVER_STATUS_TIMEOUT_MS);

    socket.on("connect", () => {
      socket.write(buildMinecraftStatusHandshake(host, port));
      socket.write(buildMinecraftStatusPacket(0));
    });

    socket.on("data", (chunk) => {
      chunks.push(chunk);
      const buffer = Buffer.concat(chunks);
      try {
        const parsed = parseMinecraftStatusResponse(buffer);
        if (!parsed) {
          return;
        }
        finish({
          address: target,
          online: true,
          playersOnline: asNullableNonNegativeInteger(parsed?.players?.online),
          playersMax: asNullableNonNegativeInteger(parsed?.players?.max),
          playerNames: normalizeDirectMinecraftPlayerNames(parsed?.players),
          error: "",
          source: "direct"
        });
      } catch (error) {
        finish({
          address: target,
          online: null,
          playersOnline: null,
          playersMax: null,
          playerNames: [],
          error: String(error?.message || error),
          source: "direct"
        });
      }
    });

    socket.on("error", (error) => {
      finish({
        address: target,
        online: null,
        playersOnline: null,
        playersMax: null,
        playerNames: [],
        error: String(error?.message || error),
        source: "direct"
      });
    });
  });
}

async function queryMinecraftServerStatusFromMcStatus(host, port) {
  const target = `${host}:${port}`;
  const url = `https://api.mcstatus.io/v2/status/java/${encodeURIComponent(target)}`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`Failed to query server status (${response.status}).`);
    }

    const parsed = await response.json();
    return {
      address: target,
      online: typeof parsed?.online === "boolean" ? parsed.online : null,
      playersOnline: asNullableNonNegativeInteger(parsed?.players?.online),
      playersMax: asNullableNonNegativeInteger(parsed?.players?.max),
      playerNames: extractPlayerNamesFromPlayersPayload(parsed?.players),
      error: "",
      source: "mcstatus.io"
    };
  } catch (error) {
    return {
      address: target,
      online: null,
      playersOnline: null,
      playersMax: null,
      playerNames: [],
      error: String(error?.message || error),
      source: "mcstatus.io"
    };
  }
}

async function queryMinecraftServerStatusFromMcsrvStat(host, port) {
  const target = `${host}:${port}`;
  const url = `https://api.mcsrvstat.us/3/${encodeURIComponent(target)}`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error(`Failed to query fallback server status (${response.status}).`);
    }

    const parsed = await response.json();
    return {
      address: target,
      online: typeof parsed?.online === "boolean" ? parsed.online : null,
      playersOnline: asNullableNonNegativeInteger(parsed?.players?.online),
      playersMax: asNullableNonNegativeInteger(parsed?.players?.max),
      playerNames: extractPlayerNamesFromPlayersPayload(parsed?.players),
      error: "",
      source: "mcsrvstat.us"
    };
  } catch (error) {
    return {
      address: target,
      online: null,
      playersOnline: null,
      playersMax: null,
      playerNames: [],
      error: String(error?.message || error),
      source: "mcsrvstat.us"
    };
  }
}

async function queryMinecraftServerStatus(host, port) {
  const directResult = await queryMinecraftServerStatusDirect(host, port);
  if (directResult.online === true && hasMeaningfulPlayerCapacity(directResult)) {
    const needsFallbackNames = !Array.isArray(directResult.playerNames) || directResult.playerNames.length === 0;
    if (!needsFallbackNames) {
      return directResult;
    }

    const fallbackResult = await queryMinecraftServerStatusFromMcsrvStat(host, port);
    return {
      ...directResult,
      playerNames:
        Array.isArray(fallbackResult.playerNames) && fallbackResult.playerNames.length > 0
          ? fallbackResult.playerNames
          : directResult.playerNames,
      source: fallbackResult.online === true ? `${directResult.source}+${fallbackResult.source}` : directResult.source
    };
  }

  const primaryResult = await queryMinecraftServerStatusFromMcStatus(host, port);
  const shouldUseFallback =
    primaryResult.online !== true ||
    !hasMeaningfulPlayerCapacity(primaryResult) ||
    !Array.isArray(primaryResult.playerNames) ||
    primaryResult.playerNames.length === 0;
  if (!shouldUseFallback) {
    return primaryResult;
  }

  const fallbackResult = await queryMinecraftServerStatusFromMcsrvStat(host, port);

  if (fallbackResult.online === true) {
    return {
      ...fallbackResult,
      playersOnline:
        fallbackResult.playersOnline !== null ? fallbackResult.playersOnline : primaryResult.playersOnline,
      playersMax: fallbackResult.playersMax !== null ? fallbackResult.playersMax : primaryResult.playersMax,
      playerNames:
        Array.isArray(fallbackResult.playerNames) && fallbackResult.playerNames.length > 0
          ? fallbackResult.playerNames
          : Array.isArray(primaryResult.playerNames)
            ? primaryResult.playerNames
            : [],
      error: ""
    };
  }

  if (primaryResult.online === true) {
    return primaryResult;
  }

  if (primaryResult.online === false && fallbackResult.online === null) {
    return primaryResult;
  }
  if (fallbackResult.online === false && primaryResult.online === null) {
    return fallbackResult;
  }

  const mergedError = [primaryResult.error, fallbackResult.error].filter(Boolean).join(" | ");
  return {
    address: directResult.address || primaryResult.address,
    online: directResult.online ?? primaryResult.online ?? fallbackResult.online ?? null,
    playersOnline:
      directResult.playersOnline !== null
        ? directResult.playersOnline
        : primaryResult.playersOnline !== null
          ? primaryResult.playersOnline
          : fallbackResult.playersOnline,
    playersMax:
      directResult.playersMax !== null
        ? directResult.playersMax
        : primaryResult.playersMax !== null
          ? primaryResult.playersMax
          : fallbackResult.playersMax,
    playerNames:
      Array.isArray(directResult.playerNames) && directResult.playerNames.length > 0
        ? directResult.playerNames
        : Array.isArray(primaryResult.playerNames) && primaryResult.playerNames.length > 0
        ? primaryResult.playerNames
        : Array.isArray(fallbackResult.playerNames)
          ? fallbackResult.playerNames
          : [],
    error: [directResult.error, mergedError].filter(Boolean).join(" | "),
    source: directResult.source || primaryResult.source || fallbackResult.source || ""
  };
}

async function queryMolangStatus(config) {
  const configuredUrl = asTrimmedText(config?.molangUrl);
  const molangUrl = configuredUrl || "https://api.minecraftservices.com/health";
  const expectedOnlineValue = configuredUrl ? asTrimmedText(config?.molangOnlineValue).toLowerCase() : "up";
  
  try {
    const response = await fetchWithTimeout(molangUrl);
    if (!response.ok) {
      throw new Error(`Failed to query MOJANG status (${response.status}).`);
    };

    const contentType = asTrimmedText(response.headers.get("content-type")).toLowerCase();
    const rawBody = await response.text();
    const parsedBody = contentType.includes("application/json")
      ? JSON.parse(rawBody)
      : (() => {
          try {
            return JSON.parse(rawBody);
          } catch {
            return rawBody;
          }
        })();

    let displayValue = parsedBody;
    if (parsedBody && typeof parsedBody === "object") {
      const requestedFieldPath = asTrimmedText(config?.molangField);
      const requestedPathValue = requestedFieldPath ? getObjectPathValue(parsedBody, requestedFieldPath) : undefined;
      const statusValue = getObjectPathValue(parsedBody, "status");
      const stateValue = getObjectPathValue(parsedBody, "state");
      const resultValue = getObjectPathValue(parsedBody, "result");
      displayValue =
        requestedPathValue !== undefined
          ? requestedPathValue
          : statusValue !== undefined
            ? statusValue
            : stateValue !== undefined
              ? stateValue
              : resultValue !== undefined
                ? resultValue
                : parsedBody;
    }

    const onlineFieldPath = asTrimmedText(config?.molangOnlineField);
    const onlineFieldValue = onlineFieldPath ? getObjectPathValue(parsedBody, onlineFieldPath) : undefined;
    const onlineValueCandidate = onlineFieldValue !== undefined ? onlineFieldValue : displayValue;
    const online = inferBooleanStatus(onlineValueCandidate, expectedOnlineValue);
    const normalizedStatusText = asTrimmedText(formatStatusDisplayValue(displayValue)).toLowerCase() === "up"
      ? "\uC815\uC0C1"
      : formatStatusDisplayValue(displayValue);

    return {
      configured: true,
      online,
      statusText: normalizedStatusText || "\uD655\uC778 \uC911...",
      error: "",
      source: configuredUrl ? "custom" : "minecraftservices-health"
    };
  } catch (error) {
    return {
      configured: true,
      online: null,
      statusText: "\uD655\uC778 \uC2E4\uD328",
      error: String(error?.message || error),
      source: configuredUrl ? "custom" : "minecraftservices-health"
    };
  }
}

async function getLauncherServerStatusSnapshot() {
  const config = readServerStatusConfig();
  const hasServerTarget = Boolean(config.host);
  const hasAnyConfig = hasServerTarget;

  const serverStatus = hasServerTarget
    ? await queryMinecraftServerStatus(config.host, config.port)
      : {
        address: "",
        online: null,
        playersOnline: null,
        playersMax: null,
        playerNames: [],
        error: "Minecraft server host is not configured."
      };
  return {
    ok: true,
    configured: hasAnyConfig,
    hasServerTarget,
    updatedAt: new Date().toISOString(),
    config: {
      host: config.host,
      port: config.port
    },
    server: serverStatus
  };
}

function getSignatureSafePath(value) {
  const resolved = path.resolve(value);
  if (process.platform === "win32") {
    return resolved.toLowerCase();
  }
  return resolved;
}

function normalizeModpackArchiveSource(rawValue, configPath) {
  const value = asTrimmedText(rawValue);
  if (!value) {
    return null;
  }

  if (isHttpUrl(value)) {
    return {
      kind: "http",
      value,
      signatureKey: value
    };
  }

  let resolvedPath = "";
  if (isFileUrl(value)) {
    try {
      resolvedPath = fileURLToPath(value);
    } catch {
      return null;
    }
  } else if (path.isAbsolute(value)) {
    resolvedPath = value;
  } else {
    const baseDirectory = configPath ? path.dirname(configPath) : process.cwd();
    resolvedPath = path.resolve(baseDirectory, value);
  }

  return {
    kind: "file",
    value: resolvedPath,
    signatureKey: getSignatureSafePath(resolvedPath)
  };
}

function selectFirstModpackSource(candidates, configPath) {
  for (const candidate of candidates) {
    const source = normalizeModpackArchiveSource(candidate, configPath);
    if (source) {
      return source;
    }
  }
  return null;
}

function getModpackDistributionSource(preset) {
  const normalizedPreset = normalizeLauncherPreset(preset, "high");
  const presetEnvKey = `BETTERMON_MODPACK_DISTRIBUTION_${normalizedPreset.toUpperCase()}_URL`;
  const fromPresetEnv = asTrimmedText(process.env[presetEnvKey]);
  const fromCommonEnv = asTrimmedText(process.env.BETTERMON_MODPACK_DISTRIBUTION_URL);

  const config = readModpackConfig();
  const configPath = asTrimmedText(config?.__configPath);
  const fromConfigPreset = asTrimmedText(config?.distributionByPreset?.[normalizedPreset]);
  const fromConfigDefault = asTrimmedText(config?.distributionUrl);

  return selectFirstModpackSource(
    [fromPresetEnv, fromCommonEnv, fromConfigPreset, fromConfigDefault].filter(
      (candidate) => !isZipArchiveLocation(candidate)
    ),
    configPath
  );
}

function getModpackArchiveSource(preset) {
  const normalizedPreset = normalizeLauncherPreset(preset, "high");
  const archivePresetEnvKey = `BETTERMON_MODPACK_ARCHIVE_${normalizedPreset.toUpperCase()}_URL`;
  const zipPresetEnvKey = `BETTERMON_MODPACK_ZIP_${normalizedPreset.toUpperCase()}_URL`;
  const distributionPresetEnvKey = `BETTERMON_MODPACK_DISTRIBUTION_${normalizedPreset.toUpperCase()}_URL`;
  const fromArchivePresetEnv = asTrimmedText(process.env[archivePresetEnvKey]);
  const fromZipPresetEnv = asTrimmedText(process.env[zipPresetEnvKey]);
  const fromDistributionPresetEnv = asTrimmedText(process.env[distributionPresetEnvKey]);
  const fromArchiveCommonEnv = asTrimmedText(process.env.BETTERMON_MODPACK_ARCHIVE_URL);
  const fromZipCommonEnv = asTrimmedText(process.env.BETTERMON_MODPACK_ZIP_URL);
  const fromDistributionCommonEnv = asTrimmedText(process.env.BETTERMON_MODPACK_DISTRIBUTION_URL);

  const config = readModpackConfig();
  const configPath = asTrimmedText(config?.__configPath);
  const fromArchiveConfigPreset = asTrimmedText(config?.archiveByPreset?.[normalizedPreset]);
  const fromZipConfigPreset = asTrimmedText(config?.zipByPreset?.[normalizedPreset]);
  const fromDistributionConfigPreset = asTrimmedText(config?.distributionByPreset?.[normalizedPreset]);
  const fromArchiveConfigDefault = asTrimmedText(config?.archiveUrl);
  const fromZipConfigDefault = asTrimmedText(config?.zipUrl);
  const fromDistributionConfigDefault = asTrimmedText(config?.distributionUrl);

  const candidates = [
    fromArchivePresetEnv,
    fromZipPresetEnv,
    fromArchiveCommonEnv,
    fromZipCommonEnv,
    fromArchiveConfigPreset,
    fromZipConfigPreset,
    fromArchiveConfigDefault,
    fromZipConfigDefault
  ];
  if (isZipArchiveLocation(fromDistributionPresetEnv)) {
    candidates.push(fromDistributionPresetEnv);
  }
  if (isZipArchiveLocation(fromDistributionCommonEnv)) {
    candidates.push(fromDistributionCommonEnv);
  }
  if (isZipArchiveLocation(fromDistributionConfigPreset)) {
    candidates.push(fromDistributionConfigPreset);
  }
  if (isZipArchiveLocation(fromDistributionConfigDefault)) {
    candidates.push(fromDistributionConfigDefault);
  }

  return selectFirstModpackSource(candidates, configPath);
}

function getModpackArchiveSha256(preset) {
  const normalizedPreset = normalizeLauncherPreset(preset, "high");
  const archivePresetEnvKey = `BETTERMON_MODPACK_ARCHIVE_${normalizedPreset.toUpperCase()}_SHA256`;
  const zipPresetEnvKey = `BETTERMON_MODPACK_ZIP_${normalizedPreset.toUpperCase()}_SHA256`;
  const fromArchivePresetEnv = normalizeSha256(process.env[archivePresetEnvKey]);
  if (fromArchivePresetEnv) {
    return fromArchivePresetEnv;
  }
  const fromZipPresetEnv = normalizeSha256(process.env[zipPresetEnvKey]);
  if (fromZipPresetEnv) {
    return fromZipPresetEnv;
  }

  const fromArchiveCommonEnv = normalizeSha256(process.env.BETTERMON_MODPACK_ARCHIVE_SHA256);
  if (fromArchiveCommonEnv) {
    return fromArchiveCommonEnv;
  }
  const fromZipCommonEnv = normalizeSha256(process.env.BETTERMON_MODPACK_ZIP_SHA256);
  if (fromZipCommonEnv) {
    return fromZipCommonEnv;
  }

  const config = readModpackConfig();
  const fromArchiveConfigPreset = normalizeSha256(config?.archiveSha256ByPreset?.[normalizedPreset]);
  if (fromArchiveConfigPreset) {
    return fromArchiveConfigPreset;
  }
  const fromZipConfigPreset = normalizeSha256(config?.zipSha256ByPreset?.[normalizedPreset]);
  if (fromZipConfigPreset) {
    return fromZipConfigPreset;
  }

  const fromArchiveConfigDefault = normalizeSha256(config?.archiveSha256);
  if (fromArchiveConfigDefault) {
    return fromArchiveConfigDefault;
  }
  const fromZipConfigDefault = normalizeSha256(config?.zipSha256);
  if (fromZipConfigDefault) {
    return fromZipConfigDefault;
  }

  return "";
}

function normalizeDistributionBaseUrl(value) {
  const baseUrl = asTrimmedText(value);
  if (!baseUrl) {
    return "";
  }
  try {
    const parsed = new URL(baseUrl);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return "";
    }
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function selectDistributionBaseUrl(candidates) {
  for (const candidate of candidates) {
    const normalized = normalizeDistributionBaseUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function resolveDistributionEntryUrl(rawUrl, relativePath, baseUrl, index) {
  const explicitUrl = asTrimmedText(rawUrl);
  if (explicitUrl) {
    if (isHttpUrl(explicitUrl)) {
      return explicitUrl;
    }
    if (baseUrl) {
      try {
        const resolved = new URL(explicitUrl, baseUrl).toString();
        if (isHttpUrl(resolved)) {
          return resolved;
        }
      } catch {
        // handled below
      }
    }
    throw new Error(`Invalid file URL in distribution file entry at index ${index}.`);
  }

  if (!baseUrl) {
    throw new Error(`Missing file URL in distribution file entry at index ${index}.`);
  }
  try {
    const resolved = new URL(relativePath, baseUrl).toString();
    if (!isHttpUrl(resolved)) {
      throw new Error("invalid protocol");
    }
    return resolved;
  } catch {
    throw new Error(`Failed to resolve file URL in distribution file entry at index ${index}.`);
  }
}

function parseDistributionHash(rawValue, preferredAlgorithm = "") {
  const value = asTrimmedText(rawValue).toLowerCase();
  if (!value) {
    return { sha256: "", md5: "" };
  }

  const taggedMatch = value.match(/^(sha256|md5)\s*:\s*([a-f0-9]+)$/i);
  if (taggedMatch) {
    const algorithm = taggedMatch[1].toLowerCase();
    const hash = taggedMatch[2].toLowerCase();
    return {
      sha256: algorithm === "sha256" ? normalizeSha256(hash) : "",
      md5: algorithm === "md5" ? normalizeMd5(hash) : ""
    };
  }

  const normalizedSha256 = normalizeSha256(value);
  if (normalizedSha256) {
    return { sha256: normalizedSha256, md5: "" };
  }
  const normalizedMd5 = normalizeMd5(value);
  if (normalizedMd5) {
    return { sha256: "", md5: normalizedMd5 };
  }

  const preferred = asTrimmedText(preferredAlgorithm).toLowerCase();
  if (preferred === "sha256") {
    return { sha256: normalizeSha256(value), md5: "" };
  }
  if (preferred === "md5") {
    return { sha256: "", md5: normalizeMd5(value) };
  }

  return { sha256: "", md5: "" };
}

function normalizeDistributionFileEntry(entry, index, baseUrl = "") {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Invalid distribution file entry at index ${index}.`);
  }

  const relativePath = asTrimmedText(entry.path || entry.target || entry.file);
  if (!relativePath) {
    throw new Error(`Missing file path in distribution file entry at index ${index}.`);
  }
  const normalizedPath = normalizeRelativeModpackPath(relativePath);
  assertModpackPathDoesNotTargetInternalState(normalizedPath, "Distribution file path");

  const preferredAlgorithm = asTrimmedText(entry.algorithm || entry.hashAlgorithm).toLowerCase();
  const hashCandidates = [
    parseDistributionHash(entry.sha256, "sha256"),
    parseDistributionHash(entry.md5 || entry.MD5, "md5"),
    parseDistributionHash(entry.hash || entry.sha || entry.checksum, preferredAlgorithm)
  ];
  let sha256 = "";
  let md5 = "";
  for (const candidate of hashCandidates) {
    if (!sha256 && candidate.sha256) {
      sha256 = candidate.sha256;
    }
    if (!md5 && candidate.md5) {
      md5 = candidate.md5;
    }
  }

  if (!sha256 && !md5) {
    throw new Error(`Missing sha256/md5 in distribution file entry at index ${index}.`);
  }

  const resolvedUrl = resolveDistributionEntryUrl(entry.url || entry.download || entry.href, normalizedPath, baseUrl, index);
  const size = Number(entry.size || 0);

  return {
    path: normalizedPath,
    url: resolvedUrl,
    sha256,
    md5,
    size: Number.isFinite(size) && size > 0 ? size : 0
  };
}

function collectDistributionModuleArtifacts(modules, output, basePath = "") {
  if (!Array.isArray(modules)) {
    return;
  }

  for (const moduleEntry of modules) {
    if (!moduleEntry || typeof moduleEntry !== "object") {
      continue;
    }

    const modulePathSegment = asTrimmedText(moduleEntry.basePath || moduleEntry.directory || moduleEntry.folder);
    const nestedBasePath = modulePathSegment
      ? path.posix.join(basePath || "", modulePathSegment).replace(/\\/g, "/")
      : basePath;

    const artifact = moduleEntry.artifact && typeof moduleEntry.artifact === "object" ? moduleEntry.artifact : null;
    if (artifact) {
      const artifactPathRaw = asTrimmedText(artifact.path || moduleEntry.path);
      const artifactPath = artifactPathRaw
        ? path.posix.join(nestedBasePath || "", artifactPathRaw).replace(/\\/g, "/")
        : "";

      if (artifactPath) {
        output.push({
          path: artifactPath,
          url: asTrimmedText(artifact.url),
          sha256: asTrimmedText(artifact.sha256),
          md5: asTrimmedText(artifact.md5 || artifact.MD5),
          hash: asTrimmedText(artifact.hash),
          algorithm: asTrimmedText(artifact.algorithm),
          size: Number(artifact.size || 0)
        });
      }
    }

    collectDistributionModuleArtifacts(moduleEntry.subModules, output, nestedBasePath);
  }
}

function parseDistributionIndex(distributionJson, preset, options = {}) {
  const normalizedPreset = normalizeLauncherPreset(preset, "high");
  if (!distributionJson || typeof distributionJson !== "object") {
    throw new Error("Invalid modpack distribution format.");
  }

  let source = null;
  let sourceKey = "";
  if (distributionJson.presets && typeof distributionJson.presets === "object") {
    const presetSection = distributionJson.presets[normalizedPreset];
    if (presetSection && typeof presetSection === "object") {
      source = presetSection;
      sourceKey = `presets.${normalizedPreset}`;
    }
  }

  if (!source && Array.isArray(distributionJson.servers)) {
    const matchedServer = distributionJson.servers.find((server) => {
      const id = asTrimmedText(server?.id || server?.name).toLowerCase();
      if (!id) {
        return false;
      }
      return id === normalizedPreset || id.includes(normalizedPreset);
    });
    if (matchedServer && typeof matchedServer === "object") {
      source = matchedServer;
      sourceKey = `servers.${asTrimmedText(matchedServer.id || matchedServer.name || normalizedPreset)}`;
    }
  }

  if (!source) {
    source = distributionJson;
    sourceKey = "root";
  }

  const explicitFiles = Array.isArray(source.files) ? source.files : [];
  const moduleFiles = [];
  if (explicitFiles.length === 0 && Array.isArray(source.modules)) {
    collectDistributionModuleArtifacts(source.modules, moduleFiles);
  }

  const fileEntries = explicitFiles.length > 0 ? explicitFiles : moduleFiles;
  const resolvedBaseUrl = selectDistributionBaseUrl([source.baseUrl, distributionJson.baseUrl, options.defaultBaseUrl]);
  const files = [];
  const seenPaths = new Set();
  for (let index = 0; index < fileEntries.length; index += 1) {
    const file = normalizeDistributionFileEntry(fileEntries[index], index, resolvedBaseUrl);
    const pathKey = buildModpackPathKey(file.path);
    if (seenPaths.has(pathKey)) {
      throw new Error(`Duplicate modpack file path in distribution: ${file.path}`);
    }
    seenPaths.add(pathKey);
    files.push(file);
  }

  const deleteEntries = Array.isArray(source.delete)
    ? source.delete
    : Array.isArray(source.remove)
      ? source.remove
      : [];

  return {
    version: asTrimmedText(source.version || distributionJson.version),
    sourceKey,
    files,
    delete: deleteEntries.map((entry) => {
      const normalizedEntry = normalizeRelativeModpackPath(entry);
      assertModpackPathDoesNotTargetInternalState(normalizedEntry, "Distribution delete path");
      return normalizedEntry;
    })
  };
}

function getDistributionSourceBaseUrl(source) {
  if (!source || source.kind !== "http" || !isHttpUrl(source.value)) {
    return "";
  }
  try {
    const parsed = new URL(source.value);
    parsed.hash = "";
    parsed.search = "";
    const pathname = parsed.pathname || "/";
    const lastSlashIndex = pathname.lastIndexOf("/");
    parsed.pathname = lastSlashIndex >= 0 ? pathname.slice(0, lastSlashIndex + 1) : "/";
    return normalizeDistributionBaseUrl(parsed.toString());
  } catch {
    return "";
  }
}

function normalizeStateManagedFiles(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique = new Map();
  for (const entry of value) {
    try {
      const normalized = normalizeRelativeModpackPath(entry);
      if (isLauncherManagedInternalModpackPath(normalized)) {
        continue;
      }
      const key = buildModpackPathKey(normalized);
      if (!unique.has(key)) {
        unique.set(key, normalized);
      }
    } catch {
      // ignore invalid state entries
    }
  }
  return Array.from(unique.values());
}

function normalizeStateManagedFileHashes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Map();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    try {
      const normalizedPath = normalizeRelativeModpackPath(entry.path);
      if (isLauncherManagedInternalModpackPath(normalizedPath)) {
        continue;
      }
      const sha256 = normalizeSha256(entry.sha256);
      const md5 = normalizeMd5(entry.md5 || entry.MD5);
      if (!sha256 && !md5) {
        continue;
      }

      const key = buildModpackPathKey(normalizedPath);
      if (!unique.has(key)) {
        unique.set(key, {
          path: normalizedPath,
          sha256,
          md5
        });
      }
    } catch {
      // ignore invalid state entries
    }
  }

  return Array.from(unique.values());
}

function buildManagedFileHashesState(files) {
  if (!Array.isArray(files)) {
    return [];
  }

  const normalized = [];
  for (const file of files) {
    const filePath = normalizeRelativeModpackPath(file?.path);
    if (isLauncherManagedInternalModpackPath(filePath)) {
      continue;
    }
    const sha256 = normalizeSha256(file?.sha256);
    const md5 = normalizeMd5(file?.md5 || file?.MD5);
    if (!sha256 && !md5) {
      continue;
    }
    normalized.push({
      path: filePath,
      sha256,
      md5
    });
  }
  return normalized;
}

function formatIntegrityIssueList(items, maxCount = 3) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  const listed = items.slice(0, maxCount).join(", ");
  const extraCount = Math.max(0, items.length - maxCount);
  return extraCount > 0 ? `${listed} (+${extraCount} more)` : listed;
}

async function verifyDistributionModpackIntegrity(modpackRoot, state) {
  const managedFiles = normalizeStateManagedFiles(state?.managedFiles);
  const managedHashes = normalizeStateManagedFileHashes(state?.managedFileHashes);
  if (managedFiles.length === 0) {
    return {
      ok: true,
      checked: 0,
      sourceType: "distribution",
      reason: "No managed files to verify."
    };
  }

  if (managedHashes.length === 0) {
    return {
      ok: false,
      checked: 0,
      sourceType: "distribution",
      error: "Distribution state has no file hash metadata."
    };
  }

  const hashByKey = new Map();
  for (const entry of managedHashes) {
    hashByKey.set(buildModpackPathKey(entry.path), entry);
  }

  const missingFiles = [];
  const hashMismatches = [];
  const missingMetadata = [];
  const invalidEntryTypes = [];
  const unreadableFiles = [];
  let checked = 0;

  for (const relativePath of managedFiles) {
    const key = buildModpackPathKey(relativePath);
    const hashMeta = hashByKey.get(key);
    if (!hashMeta) {
      missingMetadata.push(relativePath);
      continue;
    }

    const targetPath = resolveModpackTargetPath(modpackRoot, relativePath);
    const targetEntryType = await getPathEntryType(targetPath);
    if (targetEntryType === "missing") {
      missingFiles.push(relativePath);
      continue;
    }
    if (targetEntryType !== "file") {
      invalidEntryTypes.push(relativePath);
      continue;
    }

    const algorithm = hashMeta.sha256 ? "sha256" : "md5";
    const expected = hashMeta.sha256 || hashMeta.md5;
    try {
      const actual = await computeFileDigest(targetPath, algorithm);
      checked += 1;
      if (actual !== expected) {
        hashMismatches.push(relativePath);
      }
    } catch {
      unreadableFiles.push(relativePath);
    }
  }

  if (
    missingFiles.length === 0 &&
    hashMismatches.length === 0 &&
    missingMetadata.length === 0 &&
    invalidEntryTypes.length === 0 &&
    unreadableFiles.length === 0
  ) {
    return {
      ok: true,
      checked,
      sourceType: "distribution"
    };
  }

  const detailParts = [];
  if (missingFiles.length > 0) {
    detailParts.push(`missing files: ${formatIntegrityIssueList(missingFiles)}`);
  }
  if (hashMismatches.length > 0) {
    detailParts.push(`hash mismatch: ${formatIntegrityIssueList(hashMismatches)}`);
  }
  if (missingMetadata.length > 0) {
    detailParts.push(`missing hash metadata: ${formatIntegrityIssueList(missingMetadata)}`);
  }
  if (invalidEntryTypes.length > 0) {
    detailParts.push(`unexpected file type: ${formatIntegrityIssueList(invalidEntryTypes)}`);
  }
  if (unreadableFiles.length > 0) {
    detailParts.push(`unreadable files: ${formatIntegrityIssueList(unreadableFiles)}`);
  }

  return {
    ok: false,
    checked,
    sourceType: "distribution",
    error: `Distribution integrity check failed (${detailParts.join("; ")}).`
  };
}

async function verifyArchiveModpackIntegrity(modpackRoot, launcherPreset, state) {
  const expectedArchiveSha256 = normalizeSha256(state?.archiveSha256);
  if (!expectedArchiveSha256) {
    return {
      ok: true,
      checked: 0,
      sourceType: "archive",
      reason: "Archive hash pin is not available."
    };
  }

  const archiveCachePath = path.join(modpackRoot, MODPACK_STATE_DIRECTORY, "downloads", `modpack_${launcherPreset}.zip`);
  if (!fs.existsSync(archiveCachePath)) {
    return {
      ok: true,
      checked: 0,
      sourceType: "archive",
      reason: "Cached archive is not present."
    };
  }

  const actualArchiveSha256 = await computeFileSha256(archiveCachePath);
  if (actualArchiveSha256 !== expectedArchiveSha256) {
    return {
      ok: false,
      checked: 1,
      sourceType: "archive",
      error: "Cached modpack archive hash does not match the applied state."
    };
  }

  return {
    ok: true,
    checked: 1,
    sourceType: "archive"
  };
}

async function verifyGitHubArchiveModpackIntegrity(state) {
  const expectedArchiveSha1 = normalizeSha1(state?.archiveSha1);
  const archiveCachePath = asTrimmedText(state?.archiveCachePath);
  if (!expectedArchiveSha1 || !archiveCachePath) {
    return {
      ok: true,
      checked: 0,
      sourceType: "github-archive",
      reason: "Archive cache metadata is not available."
    };
  }

  if (!fs.existsSync(archiveCachePath)) {
    return {
      ok: true,
      checked: 0,
      sourceType: "github-archive",
      reason: "Cached archive is not present."
    };
  }

  const actualArchiveSha1 = await computeFileDigest(archiveCachePath, "sha1");
  if (actualArchiveSha1 !== expectedArchiveSha1) {
    return {
      ok: false,
      checked: 1,
      sourceType: "github-archive",
      error: "Cached modpack archive hash does not match the applied state."
    };
  }

  return {
    ok: true,
    checked: 1,
    sourceType: "github-archive"
  };
}

async function ensureModpackArchiveCached({
  launcherPreset,
  modpackRoot,
  archiveSource,
  expectedSha256 = "",
  knownRemoteFingerprint = "",
  knownLocalFingerprint = "",
  downloadLogMessage = ""
}) {
  const normalizedPreset = normalizeLauncherPreset(launcherPreset, "high");
  const archiveSourceKey = asTrimmedText(archiveSource?.signatureKey);

  if (archiveSource.kind === "http") {
    const cacheArchivePath = getModpackArchiveCachePath(modpackRoot, normalizedPreset);
    const cacheEntry = readModpackArchiveSessionCache(normalizedPreset, modpackRoot);
    let remoteFingerprint = asTrimmedText(knownRemoteFingerprint);

    if (!remoteFingerprint) {
      remoteFingerprint = await getHttpResourceFingerprint(archiveSource.value);
    }

    const canReuseSessionCache =
      Boolean(cacheEntry) &&
      cacheEntry.sourceKind === "http" &&
      cacheEntry.sourceKey === archiveSourceKey &&
      asTrimmedText(cacheEntry.cachePath) === cacheArchivePath &&
      fs.existsSync(cacheArchivePath) &&
      ((!remoteFingerprint && !expectedSha256) ||
        (remoteFingerprint && cacheEntry.remoteFingerprint === remoteFingerprint) ||
        (expectedSha256 && cacheEntry.archiveHash === expectedSha256));

    if (canReuseSessionCache) {
      let archiveHash = normalizeSha256(cacheEntry.archiveHash);
      if (expectedSha256 && !archiveHash) {
        archiveHash = await computeFileSha256(cacheArchivePath);
      }
      if (!expectedSha256 || archiveHash === expectedSha256) {
        return {
          archivePath: cacheArchivePath,
          archiveHash,
          remoteFingerprint,
          localFingerprint: "",
          downloadInfo: null,
          usedCachedArchive: true
        };
      }
    }

    if (downloadLogMessage) {
      sendLog({
        level: "progress",
        message: downloadLogMessage
      });
    }

    const tempArchivePath = `${cacheArchivePath}.download`;
    let downloadInfo = null;
    let archiveHash = "";
    try {
      downloadInfo = await downloadFile(archiveSource.value, tempArchivePath);
      archiveHash = await computeFileSha256(tempArchivePath);
      if (expectedSha256 && archiveHash !== expectedSha256) {
        throw new Error("Modpack archive SHA256 mismatch.");
      }

      await fs.promises.mkdir(path.dirname(cacheArchivePath), { recursive: true });
      if (fs.existsSync(cacheArchivePath)) {
        await fs.promises.rm(cacheArchivePath, { force: true });
      }
      await fs.promises.rename(tempArchivePath, cacheArchivePath);
    } finally {
      if (fs.existsSync(tempArchivePath)) {
        await fs.promises.rm(tempArchivePath, { force: true });
      }
    }

    writeModpackArchiveSessionCache(normalizedPreset, modpackRoot, archiveSource, {
      archiveHash,
      remoteFingerprint,
      cachePath: cacheArchivePath
    });

    return {
      archivePath: cacheArchivePath,
      archiveHash,
      remoteFingerprint,
      localFingerprint: "",
      downloadInfo,
      usedCachedArchive: false
    };
  }

  const archivePath = archiveSource.value;
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Modpack archive file not found: ${archivePath}`);
  }

  const localFingerprint = asTrimmedText(knownLocalFingerprint) || (await getLocalFileFingerprint(archivePath));
  const archiveHash = await computeFileSha256(archivePath);
  if (expectedSha256 && archiveHash !== expectedSha256) {
    throw new Error("Modpack archive SHA256 mismatch.");
  }

  writeModpackArchiveSessionCache(normalizedPreset, modpackRoot, archiveSource, {
    archiveHash,
    localFingerprint,
    cachePath: archivePath
  });

  return {
    archivePath,
    archiveHash,
    remoteFingerprint: "",
    localFingerprint,
    downloadInfo: null,
    usedCachedArchive: true
  };
}

async function verifyLaunchIntegrity(options) {
  const launcherPreset = normalizeLauncherPreset(options?.launcherPreset, detectLauncherPreset().preset);
  const modpackRoot = asTrimmedText(options?.gameDirectory) || asTrimmedText(options?.minecraftDirectory);
  if (!modpackRoot) {
    return {
      ok: true,
      checked: 0,
      sourceType: "none",
      reason: "Modpack root is empty."
    };
  }

  const state = readModpackState(modpackRoot);
  if (!state || typeof state !== "object") {
    return {
      ok: true,
      checked: 0,
      sourceType: "none",
      reason: "Modpack state does not exist."
    };
  }

  const sourceType = asTrimmedText(state?.sourceType).toLowerCase();
  if (sourceType === "distribution") {
    return verifyDistributionModpackIntegrity(modpackRoot, state);
  }
  if (sourceType === "archive") {
    return verifyArchiveModpackIntegrity(modpackRoot, launcherPreset, state);
  }
  if (sourceType === "github-archive") {
    return verifyGitHubArchiveModpackIntegrity(state);
  }

  return {
    ok: true,
    checked: 0,
    sourceType: sourceType || "unknown",
    reason: "Integrity check is not required for this modpack source type."
  };
}

function buildUniqueModpackPathList(entries) {
  const unique = new Map();
  for (const entry of entries) {
    const normalized = normalizeRelativeModpackPath(entry);
    const key = buildModpackPathKey(normalized);
    if (!unique.has(key)) {
      unique.set(key, normalized);
    }
  }
  return Array.from(unique.values());
}

function escapePowerShellLiteral(value) {
  return String(value || "").replace(/'/g, "''");
}

async function runPowerShellScript(script) {
  return new Promise((resolve, reject) => {
    const utf8Preamble = [
      "$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
      "[Console]::InputEncoding = [System.Text.Encoding]::UTF8"
    ].join("; ");
    const fullScript = `${utf8Preamble}; ${String(script || "")}`;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", fullScript],
      { windowsHide: true }
    );
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const details = asTrimmedText(stderr) || asTrimmedText(stdout) || "Unknown PowerShell error";
      reject(new Error(`PowerShell command failed (${code}): ${details}`));
    });
  });
}

async function listArchiveTopLevelEntries(archivePath) {
  if (process.platform !== "win32") {
    return [];
  }

  const escapedArchive = escapePowerShellLiteral(path.resolve(archivePath));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$zip = [System.IO.Compression.ZipFile]::OpenRead('${escapedArchive}')`,
    "try {",
    "  $entries = @{}",
    "  foreach ($entry in $zip.Entries) {",
    "    $full = ($entry.FullName -replace '\\\\', '/')",
    "    $full = $full.TrimStart('/')",
    "    if ([string]::IsNullOrWhiteSpace($full)) { continue }",
    "    $first = $full.Split('/')[0]",
    "    if (-not [string]::IsNullOrWhiteSpace($first)) { $entries[$first.ToLowerInvariant()] = $first }",
    "  }",
    "  $entries.Values | Sort-Object -Unique | ForEach-Object { Write-Output $_ }",
    "} finally {",
    "  $zip.Dispose()",
    "}"
  ].join("; ");

  const { stdout } = await runPowerShellScript(script);
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return Array.from(new Set(lines));
}

async function removeArchiveTopLevelEntries(modpackRoot, entries) {
  let removedCount = 0;
  for (const entry of entries) {
    const normalized = normalizeRelativeModpackPath(entry);
    if (isLauncherManagedInternalModpackPath(normalized)) {
      continue;
    }
    const absolutePath = resolveModpackTargetPath(modpackRoot, normalized);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    await fs.promises.rm(absolutePath, { recursive: true, force: true });
    removedCount += 1;
  }
  return removedCount;
}

function getManagedModpackEntriesFromState(state) {
  const entries = Array.isArray(state?.entries) && state.entries.length > 0 ? state.entries : state?.managedFiles;
  return normalizeStateManagedFiles(entries);
}

async function pruneEmptyManagedModpackDirectories(modpackRoot) {
  for (const directoryName of MODPACK_ALLOWED_TOP_LEVEL_DIRECTORIES) {
    const target = path.join(modpackRoot, directoryName);
    if (!fs.existsSync(target)) {
      continue;
    }

    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$target = '${escapePowerShellLiteral(path.resolve(target))}'`,
      "if (Test-Path -LiteralPath $target) {",
      "  Get-ChildItem -LiteralPath $target -Directory -Recurse | Sort-Object FullName -Descending | ForEach-Object {",
      "    if (-not (Get-ChildItem -LiteralPath $_.FullName -Force | Select-Object -First 1)) {",
      "      Remove-Item -LiteralPath $_.FullName -Force",
      "    }",
      "  }",
      "}"
    ].join("; ");

    try {
      await runPowerShellScript(script);
    } catch {
      // Empty directory pruning is best-effort only.
    }
  }
}

async function cleanManagedModpackEntries(modpackRoot, previousState) {
  let removedCount = 0;
  const previousEntries = getManagedModpackEntriesFromState(previousState);
  if (previousEntries.length > 0) {
    const sortedEntries = previousEntries.slice().sort((a, b) => b.length - a.length);
    for (const entry of sortedEntries) {
      if (!isAllowedManagedModpackPath(entry)) {
        continue;
      }
      const targetPath = resolveModpackTargetPath(modpackRoot, entry);
      if (!fs.existsSync(targetPath)) {
        continue;
      }
      await fs.promises.rm(targetPath, { recursive: true, force: true });
      removedCount += 1;
    }
    await pruneEmptyManagedModpackDirectories(modpackRoot);
    return removedCount;
  }

  for (const directoryName of MODPACK_ALLOWED_TOP_LEVEL_DIRECTORIES) {
    const targetPath = path.join(modpackRoot, directoryName);
    if (!fs.existsSync(targetPath)) {
      continue;
    }
    await fs.promises.rm(targetPath, { recursive: true, force: true });
    removedCount += 1;
  }

  for (const fileName of MODPACK_ALLOWED_ROOT_FILES) {
    const targetPath = path.join(modpackRoot, fileName);
    const entryType = await getPathEntryType(targetPath);
    if (entryType === "file") {
      await fs.promises.rm(targetPath, { force: true });
      removedCount += 1;
    }
  }

  return removedCount;
}

function buildPowerShellStringArray(values) {
  return `@(${Array.from(values)
    .map((value) => `'${escapePowerShellLiteral(value)}'`)
    .join(",")})`;
}

async function extractManagedZipArchive(archivePath, destinationPath) {
  if (process.platform !== "win32") {
    throw new Error("ZIP modpack sync currently supports Windows only.");
  }

  const escapedArchive = escapePowerShellLiteral(path.resolve(archivePath));
  const escapedDestination = escapePowerShellLiteral(path.resolve(destinationPath));
  const allowedDirectories = buildPowerShellStringArray(MODPACK_ALLOWED_TOP_LEVEL_DIRECTORIES);
  const allowedFiles = buildPowerShellStringArray(MODPACK_ALLOWED_ROOT_FILES);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$allowedDirectories = ${allowedDirectories}`,
    `$allowedFiles = ${allowedFiles}`,
    `$destinationRoot = [System.IO.Path]::GetFullPath('${escapedDestination}')`,
    "$trimChars = [char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)",
    "$destinationRootWithSeparator = $destinationRoot.TrimEnd($trimChars) + [System.IO.Path]::DirectorySeparatorChar",
    "function Normalize-ZipPath([string] $name) {",
    "  $normalized = ($name -replace '\\\\', '/').TrimStart('/')",
    "  if ([string]::IsNullOrWhiteSpace($normalized)) { return $null }",
    "  $parts = $normalized.Split('/')",
    "  foreach ($part in $parts) {",
    "    if ([string]::IsNullOrWhiteSpace($part) -or $part -eq '.' -or $part -eq '..') { return $null }",
    "  }",
    "  return ($parts -join '/')",
    "}",
    `$zip = [System.IO.Compression.ZipFile]::OpenRead('${escapedArchive}')`,
    "try {",
    "  foreach ($entry in $zip.Entries) {",
    "    $normalized = Normalize-ZipPath $entry.FullName",
    "    if ($null -eq $normalized) { continue }",
    "    $topLevel = $normalized.Split('/')[0]",
    "    if (-not ($allowedDirectories -contains $topLevel) -and -not ($allowedFiles -contains $topLevel)) { continue }",
    "    $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($destinationRoot, ($normalized -replace '/', [System.IO.Path]::DirectorySeparatorChar)))",
    "    if ($target -ne $destinationRoot -and -not $target.StartsWith($destinationRootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)) {",
    "      throw \"ZIP entry escapes modpack root: $normalized\"",
    "    }",
    "    if ($entry.FullName.EndsWith('/') -or $entry.FullName.EndsWith('\\')) {",
    "      [System.IO.Directory]::CreateDirectory($target) | Out-Null",
    "      continue",
    "    }",
    "    [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target)) | Out-Null",
    "    $inputStream = $entry.Open()",
    "    try {",
    "      $outputStream = [System.IO.File]::Open($target, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)",
    "      try { $inputStream.CopyTo($outputStream) } finally { $outputStream.Dispose() }",
    "    } finally {",
    "      $inputStream.Dispose()",
    "    }",
    "    Write-Output $normalized",
    "  }",
    "} finally {",
    "  $zip.Dispose()",
    "}"
  ].join("; ");

  const { stdout } = await runPowerShellScript(script);
  return buildUniqueModpackPathList(
    String(stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

async function extractZipArchive(archivePath, destinationPath) {
  if (process.platform !== "win32") {
    throw new Error("ZIP modpack sync currently supports Windows only.");
  }

  const escapedArchive = escapePowerShellLiteral(path.resolve(archivePath));
  const escapedDestination = escapePowerShellLiteral(path.resolve(destinationPath));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `Expand-Archive -LiteralPath '${escapedArchive}' -DestinationPath '${escapedDestination}' -Force`
  ].join("; ");
  await runPowerShellScript(script);
}

async function removeDistributionEntries(modpackRoot, entries) {
  let removedCount = 0;
  for (const entry of entries) {
    const normalized = normalizeRelativeModpackPath(entry);
    if (isLauncherManagedInternalModpackPath(normalized)) {
      continue;
    }
    const absolutePath = resolveModpackTargetPath(modpackRoot, normalized);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }
    await fs.promises.rm(absolutePath, { recursive: true, force: true });
    removedCount += 1;
  }
  return removedCount;
}

async function applyDistributionFiles(modpackRoot, files) {
  let updatedCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < files.length; index += 1) {
    const fileEntry = files[index];
    const targetPath = resolveModpackTargetPath(modpackRoot, fileEntry.path);
    const tempPath = `${targetPath}.download`;

    sendLog({
      level: "progress",
      message: `[Modpack ${index + 1}/${files.length}] ${fileEntry.path}`
    });

    const expectedHash = fileEntry.sha256 || fileEntry.md5;
    const expectedAlgorithm = fileEntry.sha256 ? "sha256" : "md5";
    const targetEntryType = await getPathEntryType(targetPath);
    if (expectedHash && targetEntryType === "file") {
      try {
        const currentHash = await computeFileDigest(targetPath, expectedAlgorithm);
        if (currentHash === expectedHash) {
          skippedCount += 1;
          continue;
        }
      } catch (error) {
        sendLog({
          level: "warn",
          message: `Failed to verify existing modpack file "${fileEntry.path}". Re-downloading it. (${String(error?.message || error)})`
        });
      }
    } else if (targetEntryType !== "missing" && targetEntryType !== "file") {
      sendLog({
        level: "warn",
        message: `Existing modpack path is not a file and will be replaced: ${fileEntry.path}`
      });
    }

    try {
      const downloadInfo = await downloadFile(fileEntry.url, tempPath);
      if (fileEntry.size > 0 && Number(downloadInfo?.bytesWritten || 0) !== fileEntry.size) {
        throw new Error(`File size mismatch for ${fileEntry.path}.`);
      }

      if (expectedHash) {
        const downloadedHash = await computeFileDigest(tempPath, expectedAlgorithm);
        if (downloadedHash !== expectedHash) {
          throw new Error(`Hash mismatch for ${fileEntry.path}.`);
        }
      }

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      if (fs.existsSync(targetPath)) {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
      }
      await fs.promises.rename(tempPath, targetPath);
      updatedCount += 1;
    } finally {
      if (fs.existsSync(tempPath)) {
        await fs.promises.rm(tempPath, { force: true });
      }
    }
  }

  return { updatedCount, skippedCount };
}

function buildSafeModpackCacheSegment(value, fallback) {
  const text = asTrimmedText(value) || fallback;
  return text.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
}

function getManifestArchiveCachePath(modpackRoot, manifest) {
  const id = buildSafeModpackCacheSegment(manifest?.id, "bettermon");
  const version = buildSafeModpackCacheSegment(manifest?.version, "modpack");
  const sha1 = normalizeSha1(manifest?.archive?.sha1);
  return path.join(modpackRoot, MODPACK_STATE_DIRECTORY, "downloads", `${id}-${version}-${sha1.slice(0, 12)}.zip`);
}

async function ensureManifestArchiveCached(modpackRoot, manifest) {
  const archiveSource = manifest.archive.source;
  const expectedSha1 = manifest.archive.sha1;

  if (archiveSource.kind === "file") {
    const archivePath = archiveSource.value;
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Modpack archive file not found: ${archivePath}`);
    }
    const archiveSha1 = await computeFileDigest(archivePath, "sha1");
    if (archiveSha1 !== expectedSha1) {
      throw new Error("Modpack archive SHA1 mismatch.");
    }
    return {
      archivePath,
      archiveSha1,
      downloadedArchiveInfo: null,
      usedCachedArchive: true
    };
  }

  const cacheArchivePath = getManifestArchiveCachePath(modpackRoot, manifest);
  if (fs.existsSync(cacheArchivePath)) {
    const cachedSha1 = await computeFileDigest(cacheArchivePath, "sha1");
    if (cachedSha1 === expectedSha1) {
      return {
        archivePath: cacheArchivePath,
        archiveSha1: cachedSha1,
        downloadedArchiveInfo: null,
        usedCachedArchive: true
      };
    }
  }

  sendLog({
    level: "progress",
    message: "Downloading modpack archive..."
  });

  const tempArchivePath = `${cacheArchivePath}.download`;
  let downloadInfo = null;
  try {
    downloadInfo = await downloadFile(archiveSource.value, tempArchivePath);
    if (manifest.archive.size > 0 && Number(downloadInfo?.bytesWritten || 0) !== manifest.archive.size) {
      throw new Error("Modpack archive size mismatch.");
    }

    const downloadedSha1 = await computeFileDigest(tempArchivePath, "sha1");
    if (downloadedSha1 !== expectedSha1) {
      throw new Error("Modpack archive SHA1 mismatch.");
    }

    await fs.promises.mkdir(path.dirname(cacheArchivePath), { recursive: true });
    if (fs.existsSync(cacheArchivePath)) {
      await fs.promises.rm(cacheArchivePath, { force: true });
    }
    await fs.promises.rename(tempArchivePath, cacheArchivePath);

    return {
      archivePath: cacheArchivePath,
      archiveSha1: downloadedSha1,
      downloadedArchiveInfo: downloadInfo,
      usedCachedArchive: false
    };
  } finally {
    if (fs.existsSync(tempArchivePath)) {
      await fs.promises.rm(tempArchivePath, { force: true });
    }
  }
}

async function synchronizeModpackManifest({ launcherPreset, modpackRoot, sessionKey }) {
  sendLog({
    level: "info",
    message: "Checking modpack manifest..."
  });

  const manifestSource = await fetchModpackManifestSource();
  if (!manifestSource) {
    return null;
  }

  const manifest = parseModpackManifest(manifestSource);
  if (manifest.minecraftVersion && manifest.minecraftVersion !== FIXED_MINECRAFT_VERSION) {
    throw new Error(
      `Modpack Minecraft version does not match launcher version: ${manifest.minecraftVersion} != ${FIXED_MINECRAFT_VERSION}`
    );
  }

  const previousState = readModpackState(modpackRoot);
  if (normalizeSha1(previousState?.archiveSha1) === manifest.archive.sha1) {
    await writeModpackState(modpackRoot, {
      ...previousState,
      version: manifest.version,
      manifestSourceKey: manifest.sourceKey,
      manifestDigest: manifest.manifestDigest,
      presetRules: manifest.presetRules || null
    });
    modpackSessionSyncedKeys.add(sessionKey);
    sendLog({
      level: "info",
      message: `Modpack ${manifest.version} is already up to date.`
    });
    return {
      ok: true,
      skipped: true,
      version: manifest.version,
      fileCount: getManagedModpackEntriesFromState(previousState).length,
      removedCount: 0,
      presetRules: manifest.presetRules
    };
  }

  const cacheResult = await ensureManifestArchiveCached(modpackRoot, manifest);
  try {
    await validateZipArchiveForExtraction(cacheResult.archivePath);
  } catch (error) {
    throw normalizeZipExtractionError(cacheResult.archivePath, error, "validate");
  }

  if (cacheResult.downloadedArchiveInfo?.contentType) {
    const normalizedContentType = cacheResult.downloadedArchiveInfo.contentType.toLowerCase();
    if (!normalizedContentType.includes("zip") && !normalizedContentType.includes("octet-stream")) {
      sendLog({
        level: "warn",
        message: `Downloaded archive content-type is ${cacheResult.downloadedArchiveInfo.contentType}. Expected application/zip or octet-stream.`
      });
    }
  }

  sendLog({
    level: "progress",
    message: "Cleaning previous modpack files..."
  });
  const removedCount = await cleanManagedModpackEntries(modpackRoot, previousState);

  sendLog({
    level: "progress",
    message: "Extracting modpack archive..."
  });
  let entries;
  try {
    entries = await extractManagedZipArchive(cacheResult.archivePath, modpackRoot);
  } catch (error) {
    throw normalizeZipExtractionError(cacheResult.archivePath, error, "extract");
  }

  const signature = `github-archive:${manifest.sourceKey}:${manifest.archive.sha1}`;
  await writeModpackState(modpackRoot, {
    signature,
    preset: launcherPreset,
    sourceType: "github-archive",
    id: manifest.id,
    version: manifest.version,
    minecraftVersion: manifest.minecraftVersion || FIXED_MINECRAFT_VERSION,
    manifestSourceKey: manifest.sourceKey,
    manifestDigest: manifest.manifestDigest,
    archiveSource: manifest.archive.source.value,
    archiveSourceKey: manifest.archive.source.signatureKey,
    archiveSha1: manifest.archive.sha1,
    archiveSize: manifest.archive.size,
    archiveCachePath: cacheResult.archivePath,
    presetRules: manifest.presetRules || null,
    appliedAt: new Date().toISOString(),
    updatedCount: entries.length,
    skippedCount: 0,
    removedCount,
    entries,
    managedFiles: entries
  });
  modpackSessionSyncedKeys.add(sessionKey);

  sendLog({
    level: "info",
    message: `Modpack ${manifest.version} sync completed. Installed ${entries.length}, removed ${removedCount}.`
  });

  return {
    ok: true,
    updatedCount: entries.length,
    skippedCount: 0,
    removedCount,
    version: manifest.version,
    fileCount: entries.length,
    presetRules: manifest.presetRules
  };
}

async function synchronizeModpackDistribution({ launcherPreset, modpackRoot, sessionKey, distributionSource }) {
  sendLog({
    level: "info",
    message: `Checking modpack distribution (${launcherPreset.toUpperCase()})...`
  });

  const distributionText = await readTextFromSource(distributionSource, "modpack distribution index");
  let distributionJson;
  try {
    distributionJson = JSON.parse(distributionText);
  } catch (error) {
    throw new Error(`Invalid modpack distribution JSON: ${String(error?.message || error)}`);
  }

  const parsedDistribution = parseDistributionIndex(distributionJson, launcherPreset, {
    defaultBaseUrl: getDistributionSourceBaseUrl(distributionSource)
  });
  const distributionSourceKey = asTrimmedText(distributionSource?.signatureKey);
  const distributionDigest = computeSha256FromText(distributionText);
  const version = asTrimmedText(parsedDistribution.version) || distributionDigest.slice(0, 12);
  const signature = `distribution:${launcherPreset}:${distributionSource.kind}:${distributionSourceKey}:${distributionDigest}`;
  const previousState = readModpackState(modpackRoot);
  const previousManagedFiles = normalizeStateManagedFiles(previousState?.managedFiles);
  const nextManagedFiles = parsedDistribution.files.map((file) => file.path);
  const nextManagedPathKeys = new Set(nextManagedFiles.map((filePath) => buildModpackPathKey(filePath)));
  const staleManagedFiles = previousManagedFiles.filter(
    (filePath) => !nextManagedPathKeys.has(buildModpackPathKey(filePath))
  );

  const deleteEntries = buildUniqueModpackPathList([...(parsedDistribution.delete || []), ...staleManagedFiles]);
  let removedCount = 0;
  if (deleteEntries.length > 0) {
    sendLog({
      level: "progress",
      message: `Removing obsolete modpack entries (${deleteEntries.length})...`
    });
    removedCount = await removeDistributionEntries(modpackRoot, deleteEntries);
  }

  if (parsedDistribution.files.length > 0) {
    sendLog({
      level: "progress",
      message: `Applying modpack distribution files (${parsedDistribution.files.length})...`
    });
  }
  const applyResult = await applyDistributionFiles(modpackRoot, parsedDistribution.files);
  const unchanged = applyResult.updatedCount === 0 && removedCount === 0;

  await writeModpackState(modpackRoot, {
    signature,
    preset: launcherPreset,
    sourceType: "distribution",
    distributionSource: distributionSource.value,
    distributionSourceKey,
    distributionDigest,
    version,
    appliedAt: new Date().toISOString(),
    updatedCount: applyResult.updatedCount,
    skippedCount: applyResult.skippedCount,
    removedCount,
    fileCount: parsedDistribution.files.length,
    managedFiles: nextManagedFiles,
    managedFileHashes: buildManagedFileHashesState(parsedDistribution.files)
  });
  modpackSessionSyncedKeys.add(sessionKey);

  if (unchanged) {
    sendLog({
      level: "info",
      message: "Modpack distribution is already up to date."
    });
  } else {
    sendLog({
      level: "info",
      message: `Modpack distribution sync completed. Updated ${applyResult.updatedCount}, skipped ${applyResult.skippedCount}, removed ${removedCount}.`
    });
  }

  return {
    ok: true,
    skipped: unchanged,
    updatedCount: applyResult.updatedCount,
    skippedCount: applyResult.skippedCount,
    removedCount,
    version
  };
}

async function applyArchiveToModpack({
  launcherPreset,
  modpackRoot,
  archiveSource,
  expectedSha256 = "",
  knownRemoteFingerprint = "",
  knownLocalFingerprint = ""
}) {
  const cacheResult = await ensureModpackArchiveCached({
    launcherPreset,
    modpackRoot,
    archiveSource,
    expectedSha256,
    knownRemoteFingerprint,
    knownLocalFingerprint,
    downloadLogMessage: `Downloading modpack archive (${launcherPreset.toUpperCase()})...`
  });
  const extractionArchivePath = cacheResult.archivePath;
  const archiveHash = cacheResult.archiveHash;
  const remoteFingerprint = cacheResult.remoteFingerprint;
  const localFingerprint = cacheResult.localFingerprint;
  const downloadedArchiveInfo = cacheResult.downloadInfo;

  try {
    await validateZipArchiveForExtraction(extractionArchivePath);
  } catch (error) {
    throw normalizeZipExtractionError(extractionArchivePath, error, "validate");
  }

  if (downloadedArchiveInfo && downloadedArchiveInfo.contentType) {
    const normalizedContentType = downloadedArchiveInfo.contentType.toLowerCase();
    if (
      !normalizedContentType.includes("zip") &&
      !normalizedContentType.includes("octet-stream")
    ) {
      sendLog({
        level: "warn",
        message: `Downloaded archive content-type is ${downloadedArchiveInfo.contentType}. Expected application/zip or octet-stream.`
      });
    }
  }

  sendLog({
    level: "progress",
    message: "Analyzing modpack archive contents..."
  });
  let topLevelEntries;
  try {
    topLevelEntries = await listArchiveTopLevelEntries(extractionArchivePath);
  } catch (error) {
    throw normalizeZipExtractionError(extractionArchivePath, error, "analyze");
  }
  sendLog({
    level: "progress",
    message: "Cleaning previous modpack files..."
  });
  const removedCount = await removeArchiveTopLevelEntries(modpackRoot, topLevelEntries);
  sendLog({
    level: "progress",
    message: "Extracting modpack archive..."
  });
  try {
    await extractZipArchive(extractionArchivePath, modpackRoot);
  } catch (error) {
    throw normalizeZipExtractionError(extractionArchivePath, error, "extract");
  }

  return {
    updatedCount: 1,
    skippedCount: 0,
    removedCount,
    archiveHash,
    remoteFingerprint,
    localFingerprint
  };
}

async function synchronizeModpackArchive({ launcherPreset, modpackRoot, sessionKey, archiveSource }) {
  sendLog({
    level: "info",
    message: `Checking modpack archive (${launcherPreset.toUpperCase()})...`
  });

  const expectedSha256 = getModpackArchiveSha256(launcherPreset);
  const archiveSourceKey = asTrimmedText(archiveSource?.signatureKey);
  const state = readModpackState(modpackRoot);
  const stateMatchesSource =
    Boolean(state) &&
    asTrimmedText(state?.sourceType) === "archive" &&
    asTrimmedText(state?.archiveSourceKey) === archiveSourceKey;
  const expectedShaMatchesState = !expectedSha256 || asTrimmedText(state?.archiveSha256) === expectedSha256;
  let remoteFingerprint = "";
  let localFingerprint = "";

  if (stateMatchesSource && expectedSha256 && asTrimmedText(state?.archiveSha256) === expectedSha256) {
    modpackSessionSyncedKeys.add(sessionKey);
    sendLog({
      level: "info",
      message: "Modpack archive is up to date (SHA256 pinned)."
    });
    return { ok: true, skipped: true, version: asTrimmedText(state?.version) || expectedSha256.slice(0, 12) };
  }

  if (stateMatchesSource && expectedShaMatchesState && archiveSource.kind === "http") {
    remoteFingerprint = await getHttpResourceFingerprint(archiveSource.value);
    if (remoteFingerprint && remoteFingerprint === asTrimmedText(state?.remoteFingerprint)) {
      modpackSessionSyncedKeys.add(sessionKey);
      sendLog({
        level: "info",
        message: "Modpack archive is already up to date."
      });
      return { ok: true, skipped: true, version: asTrimmedText(state?.version) || asTrimmedText(state?.archiveSha256) };
    }
  }

  if (stateMatchesSource && expectedShaMatchesState && archiveSource.kind === "file") {
    localFingerprint = await getLocalFileFingerprint(archiveSource.value);
    if (localFingerprint === asTrimmedText(state?.localFingerprint)) {
      modpackSessionSyncedKeys.add(sessionKey);
      sendLog({
        level: "info",
        message: "Local modpack archive is unchanged."
      });
      return { ok: true, skipped: true, version: asTrimmedText(state?.version) || asTrimmedText(state?.archiveSha256) };
    }
  }

  const result = await applyArchiveToModpack({
    launcherPreset,
    modpackRoot,
    archiveSource,
    expectedSha256,
    knownRemoteFingerprint: remoteFingerprint,
    knownLocalFingerprint: localFingerprint
  });
  const version = result.archiveHash.slice(0, 12);
  const signature = `archive:${launcherPreset}:${archiveSource.kind}:${archiveSourceKey}:${result.archiveHash}`;

  await writeModpackState(modpackRoot, {
    signature,
    preset: launcherPreset,
    sourceType: "archive",
    archiveSource: archiveSource.value,
    archiveSourceKey,
    archiveSha256: result.archiveHash,
    remoteFingerprint: result.remoteFingerprint,
    localFingerprint: result.localFingerprint,
    version,
    appliedAt: new Date().toISOString(),
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    removedCount: result.removedCount
  });
  modpackSessionSyncedKeys.add(sessionKey);

  sendLog({
    level: "info",
    message: `Modpack archive sync completed. Removed ${result.removedCount} top-level entries and applied archive.`
  });

  return {
    ok: true,
    updatedCount: result.updatedCount,
    skippedCount: result.skippedCount,
    removedCount: result.removedCount,
    version
  };
}

function formatModpackSourceFailure(name, error) {
  const message = String(error?.message || error);
  return `${name}: ${message}`;
}

function isModpackNotFoundFailure(message) {
  return /\(404\)/.test(String(message || ""));
}

async function synchronizeModpack(options) {
  const launcherPreset = normalizeLauncherPreset(options?.launcherPreset, detectLauncherPreset().preset);
  const modpackRoot = asTrimmedText(options?.gameDirectory) || asTrimmedText(options?.minecraftDirectory);
  if (!modpackRoot) {
    throw new Error("Modpack target directory is missing.");
  }
  const sessionKey = getSessionModpackKey(launcherPreset, modpackRoot);
  if (Boolean(options?.skipIfSessionSynced) && modpackSessionSyncedKeys.has(sessionKey)) {
    return { ok: true, skipped: true, reason: "session-cached" };
  }

  const sourceFailures = [];
  try {
    const manifestResult = await synchronizeModpackManifest({ launcherPreset, modpackRoot, sessionKey });
    if (manifestResult) {
      return manifestResult;
    }
  } catch (error) {
    sourceFailures.push(formatModpackSourceFailure("manifest", error));
  }

  const distributionSource = getModpackDistributionSource(launcherPreset);
  if (distributionSource) {
    try {
      return await synchronizeModpackDistribution({ launcherPreset, modpackRoot, sessionKey, distributionSource });
    } catch (error) {
      sourceFailures.push(formatModpackSourceFailure("distribution", error));
    }
  }

  const archiveSource = getModpackArchiveSource(launcherPreset);
  if (archiveSource) {
    try {
      return await synchronizeModpackArchive({ launcherPreset, modpackRoot, sessionKey, archiveSource });
    } catch (error) {
      sourceFailures.push(formatModpackSourceFailure("archive", error));
    }
  }

  if (!distributionSource && !archiveSource && sourceFailures.length === 0) {
    throw new Error(
      `No modpack source is configured for preset "${launcherPreset}". Configure archiveByPreset/archiveUrl (or zipByPreset/zipUrl) in modpack.config.json.`
    );
  }

  const existingState = readModpackState(modpackRoot);
  if (sourceFailures.some((message) => isModpackNotFoundFailure(message)) && existingState) {
    modpackSessionSyncedKeys.add(sessionKey);
    sendLog({
      level: "warn",
      message: "Modpack source returned 404. Keeping previously applied modpack files."
    });
    return { ok: true, skipped: true, reason: "source-404-using-existing-state" };
  }

  throw new Error(`All configured modpack sources failed: ${sourceFailures.join(" | ")}`);
}

async function checkModpackUpdate(options) {
  const launcherPreset = normalizeLauncherPreset(options?.launcherPreset, detectLauncherPreset().preset);
  const modpackRoot = asTrimmedText(options?.gameDirectory) || asTrimmedText(options?.minecraftDirectory);
  if (!modpackRoot) {
    throw new Error("Modpack target directory is missing.");
  }

  const manifestSource = await fetchModpackManifestSource();
  if (!manifestSource) {
    return {
      ok: true,
      supported: false,
      pending: false,
      reason: "manifest-unconfigured"
    };
  }

  const manifest = parseModpackManifest(manifestSource);
  if (manifest.minecraftVersion && manifest.minecraftVersion !== FIXED_MINECRAFT_VERSION) {
    throw new Error(
      `Modpack Minecraft version does not match launcher version: ${manifest.minecraftVersion} != ${FIXED_MINECRAFT_VERSION}`
    );
  }

  const previousState = readModpackState(modpackRoot);
  const currentArchiveSha1 = normalizeSha1(previousState?.archiveSha1);
  const latestArchiveSha1 = manifest.archive.sha1;
  const pending = currentArchiveSha1 !== latestArchiveSha1;

  return {
    ok: true,
    supported: true,
    pending,
    preset: launcherPreset,
    currentVersion: asTrimmedText(previousState?.version),
    latestVersion: manifest.version,
    currentArchiveSha1,
    latestArchiveSha1,
    presetRules: manifest.presetRules
  };
}

async function runModpackSyncFromPayload(payload, options = {}) {
  const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory);
  const gameDirectory = asTrimmedText(payload?.gameDirectory);
  const launcherPreset = normalizeLauncherPreset(payload?.launcherPreset, detectLauncherPreset().preset);

  if (!minecraftDirectory && !gameDirectory) {
    return { ok: false, error: "Minecraft directory is required." };
  }

  try {
    const modpackRoot = gameDirectory || minecraftDirectory;
    const result = await synchronizeModpack({
      launcherPreset,
      minecraftDirectory,
      gameDirectory,
      skipIfSessionSynced: Boolean(options?.skipIfSessionSynced)
    });
    const presetMods = await applyPresetModRules(modpackRoot, launcherPreset, result?.presetRules);
    return { ok: true, ...result, presetMods };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function runModpackUpdateCheckFromPayload(payload) {
  const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory);
  const gameDirectory = asTrimmedText(payload?.gameDirectory);
  const launcherPreset = normalizeLauncherPreset(payload?.launcherPreset, detectLauncherPreset().preset);

  if (!minecraftDirectory && !gameDirectory) {
    return { ok: false, error: "Minecraft directory is required." };
  }

  try {
    const result = await checkModpackUpdate({
      launcherPreset,
      minecraftDirectory,
      gameDirectory
    });
    const modpackRoot = gameDirectory || minecraftDirectory;
    const presetMods = await applyPresetModRules(modpackRoot, launcherPreset, result?.presetRules);
    return { ...result, presetMods };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function prefetchModpackArchivesFromPayload(payload) {
  const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory);
  const gameDirectory = asTrimmedText(payload?.gameDirectory);
  const modpackRoot = gameDirectory || minecraftDirectory;
  const excludedPresets = new Set(
    (Array.isArray(payload?.excludePresets) ? payload.excludePresets : [payload?.excludePreset])
      .map((value) => normalizeLauncherPreset(value, ""))
      .filter(Boolean)
  );

  if (!modpackRoot) {
    return { ok: false, error: "Minecraft directory is required." };
  }

  let attemptedCount = 0;
  let downloadedCount = 0;
  let reusedCount = 0;
  const failedPresets = [];

  for (const preset of LAUNCHER_PRESET_OPTIONS) {
    if (excludedPresets.has(preset)) {
      continue;
    }

    const archiveSource = getModpackArchiveSource(preset);
    if (!archiveSource) {
      continue;
    }

    attemptedCount += 1;

    try {
      const cacheResult = await ensureModpackArchiveCached({
        launcherPreset: preset,
        modpackRoot,
        archiveSource,
        expectedSha256: getModpackArchiveSha256(preset),
        downloadLogMessage: `Prefetching modpack archive (${preset.toUpperCase()})...`
      });

      if (cacheResult.usedCachedArchive) {
        reusedCount += 1;
      } else {
        downloadedCount += 1;
      }
    } catch (error) {
      const message = String(error?.message || error);
      failedPresets.push(`${preset}: ${message}`);
      sendLog({
        level: "warn",
        message: `Failed to prefetch modpack archive (${preset.toUpperCase()}): ${message}`
      });
    }
  }

  return {
    ok: failedPresets.length === 0,
    attemptedCount,
    downloadedCount,
    reusedCount,
    failedPresets
  };
}

async function prepareRuntimeFromPayload(payload) {
  const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory || payload);
  const javaPath = asTrimmedText(payload?.javaPath);
  if (!minecraftDirectory) {
    return { ok: false, error: "Minecraft directory is required." };
  }

  try {
    const versionId = await ensureFabricVersionInDirectory(minecraftDirectory);
    const resolvedJavaPath = await ensureJavaRuntimeInDirectory(minecraftDirectory, javaPath);
    return {
      ok: true,
      versionId,
      minecraftVersion: FIXED_MINECRAFT_VERSION,
      loader: FIXED_MOD_LOADER,
      javaPath: resolvedJavaPath
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function autoSelectJavaFromPayload(payload) {
  const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory || payload);
  if (!minecraftDirectory) {
    return { ok: false, error: "Minecraft directory is required." };
  }

  try {
    const resolvedJavaPath = await ensureJavaRuntimeInDirectory(minecraftDirectory, "");
    const settingsJavaPath = resolveJavaExecutableForSettings(resolvedJavaPath);
    return {
      ok: true,
      javaPath: settingsJavaPath || resolvedJavaPath,
      javaVersion: FIXED_JAVA_MAJOR_VERSION
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

function isMicrosoftMclcToken(token) {
  return Boolean(
    token &&
      typeof token === "object" &&
      asTrimmedText(token.access_token) &&
      asTrimmedText(token.uuid) &&
      asTrimmedText(token.meta?.type) === "msa" &&
      (asTrimmedText(token.refreshToken) || asTrimmedText(token.meta?.refresh))
  );
}

function getMicrosoftAuthCachePath() {
  return getCurrentMicrosoftAuthCachePath();
}

function isMicrosoftAuthCacheEncryptionAvailable() {
  try {
    return Boolean(
      safeStorage &&
        typeof safeStorage.isEncryptionAvailable === "function" &&
        safeStorage.isEncryptionAvailable()
    );
  } catch {
    return false;
  }
}

function unwrapMicrosoftAuthCachePayload(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const isEncryptedEnvelope =
    asTrimmedText(parsed.format) === MICROSOFT_AUTH_CACHE_ENVELOPE_FORMAT && asTrimmedText(parsed.payload);
  if (!isEncryptedEnvelope) {
    return parsed;
  }

  if (!isMicrosoftAuthCacheEncryptionAvailable()) {
    return null;
  }

  try {
    const encrypted = Buffer.from(asTrimmedText(parsed.payload), "base64");
    const decryptedText = safeStorage.decryptString(encrypted);
    return JSON.parse(decryptedText);
  } catch {
    return null;
  }
}

function packMicrosoftAuthCachePayload(token) {
  if (!isMicrosoftAuthCacheEncryptionAvailable()) {
    return token;
  }

  try {
    const encrypted = safeStorage.encryptString(JSON.stringify(token));
    return {
      format: MICROSOFT_AUTH_CACHE_ENVELOPE_FORMAT,
      payload: encrypted.toString("base64")
    };
  } catch {
    return token;
  }
}

function readMicrosoftAuthCachePayload() {
  try {
    migrateLegacyMicrosoftAuthCacheIfNeeded();
    const filePath = getMicrosoftAuthCachePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return unwrapMicrosoftAuthCachePayload(parsed);
  } catch {
    return null;
  }
}

function writeMicrosoftAuthCachePayload(payload) {
  try {
    const filePath = getMicrosoftAuthCachePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const packedPayload = packMicrosoftAuthCachePayload(payload);
    fs.writeFileSync(filePath, JSON.stringify(packedPayload, null, 2), {
      encoding: "utf8",
      mode: 0o600
    });
  } catch (error) {
    sendLog({
      level: "warn",
      message: `Failed to save Microsoft auth cache: ${String(error?.message || error)}`
    });
  }
}

function readMicrosoftAuthCache() {
  const payload = readMicrosoftAuthCachePayload();
  const store = normalizeMicrosoftAccountStore(payload);
  return getSelectedMicrosoftAccountFromStore(store);
}

function getMicrosoftAccountId(account) {
  return asTrimmedText(account?.uuid).toLowerCase() || asTrimmedText(account?.name).toLowerCase();
}

function normalizeMicrosoftAccountStore(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const device = source.device && typeof source.device === "object" ? source.device : undefined;

  if (isMicrosoftMclcToken(source)) {
    const accountId = getMicrosoftAccountId(source);
    return {
      selectedAccountId: accountId,
      accounts: accountId ? [source] : [],
      device
    };
  }

  const accounts = Array.isArray(source.accounts)
    ? source.accounts.filter((account) => isMicrosoftMclcToken(account) && getMicrosoftAccountId(account))
    : [];
  const selectedAccountId = asTrimmedText(source.selectedAccountId).toLowerCase();
  const selectedExists = accounts.some((account) => getMicrosoftAccountId(account) === selectedAccountId);

  return {
    selectedAccountId: selectedExists ? selectedAccountId : getMicrosoftAccountId(accounts[0]),
    accounts,
    device
  };
}

function packMicrosoftAccountStore(store) {
  const normalized = normalizeMicrosoftAccountStore(store);
  return {
    schemaVersion: MICROSOFT_AUTH_SCHEMA_VERSION,
    selectedAccountId: normalized.selectedAccountId,
    accounts: normalized.accounts,
    ...(normalized.device ? { device: normalized.device } : {})
  };
}

function getSelectedMicrosoftAccountFromStore(store) {
  const normalized = normalizeMicrosoftAccountStore(store);
  if (normalized.accounts.length === 0) {
    return null;
  }

  return (
    normalized.accounts.find((account) => getMicrosoftAccountId(account) === normalized.selectedAccountId) ||
    normalized.accounts[0]
  );
}

function getMicrosoftAccountSummaries() {
  const store = normalizeMicrosoftAccountStore(readMicrosoftAuthCachePayload());
  return store.accounts.map((account) => ({
    id: getMicrosoftAccountId(account),
    profileName: asTrimmedText(account?.name),
    uuid: asTrimmedText(account?.uuid),
    selected: getMicrosoftAccountId(account) === store.selectedAccountId
  }));
}

function saveMicrosoftAuthCache(token, options = {}) {
  if (!isMicrosoftMclcToken(token)) {
    return;
  }
  const previousStore = normalizeMicrosoftAccountStore(readMicrosoftAuthCachePayload());
  const accountId = getMicrosoftAccountId(token);
  const accounts = previousStore.accounts.filter((account) => getMicrosoftAccountId(account) !== accountId);
  accounts.push(token);

  const shouldSelect = options.select !== false || !previousStore.selectedAccountId;
  writeMicrosoftAuthCachePayload(
    packMicrosoftAccountStore({
      selectedAccountId: shouldSelect ? accountId : previousStore.selectedAccountId,
      accounts,
      device: previousStore.device
    })
  );
}

function removeMicrosoftAuthCacheAccount(accountId) {
  const normalizedAccountId = asTrimmedText(accountId).toLowerCase();
  if (!normalizedAccountId) {
    return;
  }

  const previousStore = normalizeMicrosoftAccountStore(readMicrosoftAuthCachePayload());
  const accounts = previousStore.accounts.filter((account) => getMicrosoftAccountId(account) !== normalizedAccountId);
  writeMicrosoftAuthCachePayload(
    packMicrosoftAccountStore({
      selectedAccountId:
        previousStore.selectedAccountId === normalizedAccountId
          ? getMicrosoftAccountId(accounts[0])
          : previousStore.selectedAccountId,
      accounts,
      device: previousStore.device
    })
  );
}

function selectMicrosoftAuthCacheAccount(accountId) {
  const normalizedAccountId = asTrimmedText(accountId).toLowerCase();
  if (!normalizedAccountId) {
    return { ok: false, error: "Account id is required.", status: getMicrosoftStatus() };
  }

  const previousStore = normalizeMicrosoftAccountStore(readMicrosoftAuthCachePayload());
  const account = previousStore.accounts.find((entry) => getMicrosoftAccountId(entry) === normalizedAccountId);
  if (!account) {
    return { ok: false, error: "Account not found.", status: getMicrosoftStatus() };
  }

  writeMicrosoftAuthCachePayload(
    packMicrosoftAccountStore({
      ...previousStore,
      selectedAccountId: normalizedAccountId
    })
  );
  microsoftAccount = account;
  sendMicrosoftAuthState();
  return { ok: true, status: getMicrosoftStatus() };
}

function clearMicrosoftAuthCache({ allAccounts = true } = {}) {
  try {
    if (!allAccounts && microsoftAccount) {
      removeMicrosoftAuthCacheAccount(getMicrosoftAccountId(microsoftAccount));
      return;
    }

    const pathsToRemove = [getMicrosoftAuthCachePath(), getLegacyMicrosoftAuthCachePath()];
    for (const filePath of pathsToRemove) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    sendLog({
      level: "warn",
      message: `Failed to clear Microsoft auth cache: ${String(error?.message || error)}`
    });
  }
}

function loadCachedMicrosoftAccount() {
  microsoftAccount = readMicrosoftAuthCache();
  return microsoftAccount;
}

function getMicrosoftStatus() {
  const accounts = getMicrosoftAccountSummaries();
  return {
    signedIn: Boolean(microsoftAccount),
    profileName: asTrimmedText(microsoftAccount?.name),
    uuid: asTrimmedText(microsoftAccount?.uuid),
    accounts,
    loggingIn: isMicrosoftLoggingIn
  };
}

function sendLog(payload) {
  sendToRenderer("launcher:log", payload);
}

function sendState(launching) {
  sendToRenderer("launcher:state", { launching });
}

function sendMicrosoftAuthState() {
  sendToRenderer("launcher:auth-state", getMicrosoftStatus());
}

function sendWindowState() {
  withMainWindow((win) => {
    win.webContents.send("window:state", {
      maximized: win.isMaximized()
    });
  });
}

function sendUpdaterState() {
  sendToRenderer("updater:state", { ...updaterState });
}

function patchUpdaterState(patch) {
  Object.assign(updaterState, patch);
  sendUpdaterState();
}

function isUpdaterEnabled() {
  if (app.isPackaged) {
    return true;
  }
  return process.env.BETTERMON_ENABLE_DEV_UPDATER === "1";
}

function normalizeUpdaterCacheDirBase(value) {
  const normalized = asTrimmedText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "bettermon-launcher";
}

function buildAutoUpdaterConfigYaml({ owner, repo, releaseType }) {
  const cacheDirBase = normalizeUpdaterCacheDirBase(process.env.BETTERMON_UPDATER_CACHE_NAME || app.getName());
  const updaterCacheDirName = `${cacheDirBase}-updater`;
  return [
    "provider: github",
    `owner: ${owner}`,
    `repo: ${repo}`,
    "private: false",
    `releaseType: ${asTrimmedText(releaseType) || "release"}`,
    "vPrefixedTagName: true",
    `updaterCacheDirName: ${updaterCacheDirName}`
  ].join("\n");
}

function ensureAutoUpdaterConfigFile(github) {
  try {
    migrateLegacyUpdaterConfigIfNeeded();
    const configPath = getCurrentUpdaterConfigPath();
    const configYaml = `${buildAutoUpdaterConfigYaml({
      owner: github.owner,
      repo: github.repo,
      releaseType: "release"
    })}\n`;

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, configYaml, "utf8");
    autoUpdater.updateConfigPath = configPath;
    return { ok: true, path: configPath };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error)
    };
  }
}

function configureAutoUpdaterFeedFromGitHubConfig() {
  const github = readGitHubReleaseConfig();
  if (!github.configured) {
    return {
      ok: false,
      error: "GitHub release owner/repo is not configured."
    };
  }

  try {
    const releaseType = "release";
    autoUpdater.setFeedURL({
      provider: "github",
      owner: github.owner,
      repo: github.repo,
      private: false,
      releaseType,
      vPrefixedTagName: true
    });

    const configResult = ensureAutoUpdaterConfigFile(github);
    if (!configResult.ok) {
      return {
        ok: false,
        error: `Failed to prepare updater config: ${configResult.error}`
      };
    }
    return {
      ok: true,
      owner: github.owner,
      repo: github.repo,
      configPath: configResult.path
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error)
    };
  }
}

async function checkForAppUpdates({ manual = false } = {}) {
  if (!updaterState.enabled) {
    return {
      ok: false,
      error: "Auto updater is disabled in development mode."
    };
  }

  if (activeUpdaterCheckPromise) {
    return activeUpdaterCheckPromise;
  }

  activeUpdaterCheckPromise = (async () => {
    try {
      if (manual) {
        patchUpdaterState({
          message: "Checking for launcher updates...",
          lastError: ""
        });
      }

      const checkResult = await autoUpdater.checkForUpdates();
      const downloadPromise =
        checkResult &&
        typeof checkResult === "object" &&
        checkResult.downloadPromise &&
        typeof checkResult.downloadPromise.then === "function"
          ? checkResult.downloadPromise
          : null;

      if (downloadPromise) {
        await downloadPromise;
      }

      return {
        ok: true,
        available: Boolean(updaterState.available),
        downloading: Boolean(updaterState.downloading),
        downloaded: Boolean(updaterState.downloaded),
        currentVersion: asTrimmedText(updaterState.currentVersion),
        latestVersion: asTrimmedText(updaterState.latestVersion)
      };
    } catch (error) {
      const message = String(error?.message || error);
      patchUpdaterState({
        checking: false,
        downloading: false,
        lastError: message,
        message: `Update check failed: ${message}`
      });
      sendLog({ level: "error", message: `Auto update check failed: ${message}` });
      return { ok: false, error: message };
    } finally {
      activeUpdaterCheckPromise = null;
    }
  })();

  return activeUpdaterCheckPromise;
}

function triggerDownloadedLauncherInstall() {
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
}

async function ensureLatestLauncherVersion({ installIfDownloaded = false } = {}) {
  if (!updaterState.enabled) {
    return {
      ok: true,
      skipped: true,
      reason: "updater-disabled",
      currentVersion: asTrimmedText(updaterState.currentVersion)
    };
  }

  if (updaterState.downloaded) {
    const latestVersion = asTrimmedText(updaterState.latestVersion);
    if (installIfDownloaded) {
      sendLog({
        level: "info",
        message: `Launcher update ${latestVersion || "latest"} is ready. Restarting to apply it.`
      });
      triggerDownloadedLauncherInstall();
      return { ok: true, downloaded: true, restarting: true, latestVersion };
    }
    return { ok: true, downloaded: true, latestVersion };
  }

  const checkResult = await checkForAppUpdates({ manual: true });
  if (!checkResult.ok) {
    return checkResult;
  }

  if (updaterState.downloaded) {
    const latestVersion = asTrimmedText(updaterState.latestVersion);
    if (installIfDownloaded) {
      sendLog({
        level: "info",
        message: `Launcher update ${latestVersion || "latest"} downloaded. Restarting to apply it.`
      });
      triggerDownloadedLauncherInstall();
      return { ok: true, downloaded: true, restarting: true, latestVersion };
    }
    return { ok: true, downloaded: true, latestVersion };
  }

  return {
    ok: true,
    downloaded: false,
    latestVersion: asTrimmedText(updaterState.latestVersion) || asTrimmedText(updaterState.currentVersion),
    currentVersion: asTrimmedText(updaterState.currentVersion)
  };
}

function schedulePeriodicUpdateChecks() {
  if (updaterPeriodicTimer) {
    clearInterval(updaterPeriodicTimer);
  }

  updaterPeriodicTimer = setInterval(() => {
    checkForAppUpdates().catch((error) => {
      const message = String(error?.message || error);
      sendLog({ level: "warn", message: `Scheduled update check failed: ${message}` });
    });
  }, APP_UPDATE_CHECK_INTERVAL_MS);
}

function setupAutoUpdater() {
  if (isUpdaterInitialized) {
    return;
  }
  isUpdaterInitialized = true;

  updaterState.enabled = isUpdaterEnabled();
  updaterState.currentVersion = app.getVersion();

  if (!updaterState.enabled) {
    updaterState.message = "Auto updater is disabled in development mode.";
    sendUpdaterState();
    return;
  }

  const feedResult = configureAutoUpdaterFeedFromGitHubConfig();
  if (!feedResult.ok) {
    updaterState.enabled = false;
    updaterState.lastError = feedResult.error;
    updaterState.message = `Auto updater feed configuration failed: ${feedResult.error}`;
    sendLog({ level: "warn", message: updaterState.message });
    sendUpdaterState();
    return;
  }
  sendLog({
    level: "info",
    message: `Auto updater feed set to GitHub repo ${feedResult.owner}/${feedResult.repo} (${feedResult.configPath}).`
  });

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    patchUpdaterState({
      checking: true,
      available: false,
      downloaded: false,
      downloading: false,
      progressPercent: 0,
      lastError: "",
      lastCheckedAt: new Date().toISOString(),
      message: "Checking for launcher updates..."
    });
    sendLog({ level: "info", message: "Checking for launcher updates..." });
  });

  autoUpdater.on("update-available", (info) => {
    patchUpdaterState({
      checking: false,
      available: true,
      downloading: true,
      downloaded: false,
      latestVersion: asTrimmedText(info?.version),
      releaseName: asTrimmedText(info?.releaseName),
      releaseDate: asTrimmedText(info?.releaseDate),
      progressPercent: 0,
      message: `Update found (${asTrimmedText(info?.version) || "new version"}). Downloading...`
    });
    sendLog({
      level: "info",
      message: `Launcher update available: ${asTrimmedText(info?.version) || "new version"}. Downloading...`
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    patchUpdaterState({
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      latestVersion: asTrimmedText(info?.version),
      releaseName: asTrimmedText(info?.releaseName),
      releaseDate: asTrimmedText(info?.releaseDate),
      progressPercent: 0,
      lastError: "",
      message: "Launcher is up to date."
    });
    sendLog({ level: "info", message: "Launcher is up to date." });
  });

  autoUpdater.on("download-progress", (progress) => {
    patchUpdaterState({
      checking: false,
      downloading: true,
      progressPercent: Number(progress?.percent || 0),
      message: `Downloading launcher update... ${Number(progress?.percent || 0).toFixed(1)}%`
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    patchUpdaterState({
      checking: false,
      available: true,
      downloading: false,
      downloaded: true,
      latestVersion: asTrimmedText(info?.version),
      releaseName: asTrimmedText(info?.releaseName),
      releaseDate: asTrimmedText(info?.releaseDate),
      progressPercent: 100,
      message: "Update downloaded. It will be applied when the launcher restarts."
    });
    sendLog({ level: "info", message: "Launcher update downloaded. Restart launcher to apply it." });
  });

  autoUpdater.on("error", (error) => {
    const message = String(error?.message || error);
    patchUpdaterState({
      checking: false,
      downloading: false,
      lastError: message,
      message: `Auto update error: ${message}`
    });
    sendLog({ level: "error", message: `Auto update error: ${message}` });
  });

  sendUpdaterState();
  setTimeout(() => {
    checkForAppUpdates().catch((error) => {
      const message = String(error?.message || error);
      sendLog({ level: "warn", message: `Initial update check failed: ${message}` });
    });
  }, 4000);
  schedulePeriodicUpdateChecks();
}

function formatMicrosoftAuthError(error) {
  const message =
    asTrimmedText(error?.message) ||
    asTrimmedText(error?.error_description) ||
    asTrimmedText(error?.error) ||
    asTrimmedText(error);
  return message || "Unknown error";
}

function isMicrosoftRefreshSessionExpiredError(error) {
  const message = formatMicrosoftAuthError(error).toLowerCase();
  return message.includes("microsoft oauth token refresh failed") && message.includes("invalid_grant");
}

function readFirstConfiguredEnvValue(keys) {
  if (!Array.isArray(keys)) {
    return "";
  }

  for (const key of keys) {
    const value = asTrimmedText(process.env[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function normalizeMicrosoftOAuthPrompt(value) {
  const prompt = asTrimmedText(value).toLowerCase();
  const allowed = new Set(["login", "none", "consent", "select_account"]);
  if (!allowed.has(prompt)) {
    return MICROSOFT_OAUTH_DEFAULT_PROMPT;
  }
  return prompt;
}

function getMicrosoftOAuthConfig() {
  const clientId =
    readFirstConfiguredEnvValue(["BETTERMON_MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_ID"]) ||
    MICROSOFT_OAUTH_DEFAULT_CLIENT_ID;
  const tenant =
    readFirstConfiguredEnvValue(["BETTERMON_MICROSOFT_TENANT", "BETTERMON_MICROSOFT_TENANT_ID"]) ||
    MICROSOFT_OAUTH_DEFAULT_TENANT;
  const redirectUri =
    readFirstConfiguredEnvValue(["BETTERMON_MICROSOFT_REDIRECT_URI"]) || MICROSOFT_OAUTH_DEFAULT_REDIRECT_URI;
  const prompt = normalizeMicrosoftOAuthPrompt(
    readFirstConfiguredEnvValue(["BETTERMON_MICROSOFT_PROMPT"]) || MICROSOFT_OAUTH_DEFAULT_PROMPT
  );
  const authorityBase = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}`;
  return {
    clientId,
    tenant,
    redirectUri,
    prompt,
    scope: MICROSOFT_OAUTH_SCOPE,
    authorizeUrl: `${authorityBase}${MICROSOFT_OAUTH_AUTHORIZE_PATH}`,
    tokenUrl: `${authorityBase}${MICROSOFT_OAUTH_TOKEN_PATH}`
  };
}

function assertMicrosoftOAuthConfig(config) {
  if (!asTrimmedText(config?.clientId)) {
    throw new Error("Microsoft Entra client id is missing. Set BETTERMON_MICROSOFT_CLIENT_ID.");
  }

  let parsedRedirect;
  try {
    parsedRedirect = new URL(asTrimmedText(config?.redirectUri));
  } catch {
    throw new Error("BETTERMON_MICROSOFT_REDIRECT_URI is invalid.");
  }

  const host = asTrimmedText(parsedRedirect.hostname).toLowerCase();
  if (parsedRedirect.protocol !== "http:" || (host !== "localhost" && host !== "127.0.0.1")) {
    throw new Error("BETTERMON_MICROSOFT_REDIRECT_URI must use loopback HTTP (for example: http://localhost).");
  }
}

function toBase64Url(value) {
  const source = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ""), "utf8");
  return source.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkcePair() {
  const verifier = toBase64Url(crypto.randomBytes(64));
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier, "utf8").digest());
  return { verifier, challenge };
}

function createMicrosoftOAuthState() {
  return toBase64Url(crypto.randomBytes(24));
}

function tryParseJson(text) {
  if (!asTrimmedText(text)) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeOAuthErrorDescription(value) {
  const raw = asTrimmedText(value);
  if (!raw) {
    return "";
  }

  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20"));
  } catch {
    return raw;
  }
}

function normalizeRedirectUrlForCompare(value) {
  try {
    const parsed = new URL(asTrimmedText(value));
    const protocol = asTrimmedText(parsed.protocol).toLowerCase();
    const hostname = asTrimmedText(parsed.hostname).toLowerCase();
    const fallbackPort = protocol === "http:" ? "80" : protocol === "https:" ? "443" : "";
    const port = asTrimmedText(parsed.port) || fallbackPort;
    const pathname = (asTrimmedText(parsed.pathname).replace(/\/+$/g, "") || "/").toLowerCase();
    return {
      protocol,
      hostname,
      port,
      pathname
    };
  } catch {
    return null;
  }
}

function isMicrosoftRedirectUrlMatch(targetUrl, redirectUri) {
  const current = normalizeRedirectUrlForCompare(targetUrl);
  const expected = normalizeRedirectUrlForCompare(redirectUri);
  if (!current || !expected) {
    return false;
  }

  return (
    current.protocol === expected.protocol &&
    current.hostname === expected.hostname &&
    current.port === expected.port &&
    current.pathname === expected.pathname
  );
}

function createMicrosoftLoginWindowOptions() {
  const loginWindowWidth = 540;
  const loginWindowHeight = 760;
  const launchOptions = {
    width: loginWindowWidth,
    height: loginWindowHeight,
    resizable: false,
    frame: true,
    thickFrame: true,
    roundedCorners: true,
    hasShadow: true,
    backgroundMaterial: "none",
    autoHideMenuBar: true,
    parent: mainWindow,
    modal: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Microsoft Login",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  };

  const targetDisplay =
    mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay();
  const area = targetDisplay.workArea || targetDisplay.bounds;
  launchOptions.x = Math.round(area.x + (area.width - loginWindowWidth) / 2);
  launchOptions.y = Math.round(area.y + (area.height - loginWindowHeight) / 2);
  return launchOptions;
}

function buildMicrosoftAuthorizeUrl(config, state, codeChallenge) {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    response_mode: "query",
    scope: config.scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state
  });
  if (asTrimmedText(config.prompt)) {
    params.set("prompt", config.prompt);
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

function requestMicrosoftAuthorizationCode({ authorizeUrl, redirectUri, expectedState }) {
  return new Promise((resolve, reject) => {
    const loginWindow = new BrowserWindow(createMicrosoftLoginWindowOptions());
    loginWindow.setAutoHideMenuBar(true);
    loginWindow.setMenuBarVisibility(false);
    loginWindow.removeMenu();
    const webContents = loginWindow.webContents;
    let settled = false;

    const settle = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };

    const closeWindow = () => {
      if (!loginWindow.isDestroyed()) {
        try {
          loginWindow.close();
        } catch {
          // no-op
        }
      }
    };

    const failWithError = (error) => {
      const wrapped = error instanceof Error ? error : new Error(String(error || "Unknown error"));
      settle(() => reject(wrapped));
      closeWindow();
    };

    const resolveWithCode = (code) => {
      settle(() => resolve(code));
      closeWindow();
    };

    const handleCallbackUrl = (value) => {
      const callbackUrl = asTrimmedText(value);
      if (!callbackUrl || !isMicrosoftRedirectUrlMatch(callbackUrl, redirectUri)) {
        return false;
      }

      let parsed;
      try {
        parsed = new URL(callbackUrl);
      } catch {
        failWithError(new Error("Microsoft callback URL is invalid."));
        return true;
      }

      const errorCode = asTrimmedText(parsed.searchParams.get("error"));
      if (errorCode) {
        const description = decodeOAuthErrorDescription(parsed.searchParams.get("error_description"));
        failWithError(new Error(description || errorCode));
        return true;
      }

      const state = asTrimmedText(parsed.searchParams.get("state"));
      if (!state || state !== expectedState) {
        failWithError(new Error("Microsoft login state validation failed. Please retry sign-in."));
        return true;
      }

      const code = asTrimmedText(parsed.searchParams.get("code"));
      if (!code) {
        failWithError(new Error("Microsoft login callback did not include an authorization code."));
        return true;
      }

      resolveWithCode(code);
      return true;
    };

    const onNavigate = (event, urlValue) => {
      const matched = handleCallbackUrl(urlValue);
      if (matched && event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
    };

    const onDidNavigate = (_, urlValue) => {
      handleCallbackUrl(urlValue);
    };

    const onDidFailLoad = (_, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (settled || !isMainFrame) {
        return;
      }
      if (isMicrosoftRedirectUrlMatch(validatedUrl, redirectUri)) {
        handleCallbackUrl(validatedUrl);
        return;
      }
      if (Number(errorCode) === -3) {
        return;
      }
      const detail = asTrimmedText(errorDescription) || `error code ${String(errorCode)}`;
      failWithError(new Error(`Microsoft login window failed to load: ${detail}`));
    };

    const onClosed = () => {
      if (settled) {
        return;
      }
      settle(() => reject(new Error("Microsoft login was canceled.")));
    };

    webContents.on("will-redirect", onNavigate);
    webContents.on("will-navigate", onNavigate);
    webContents.on("did-navigate", onDidNavigate);
    webContents.on("did-fail-load", onDidFailLoad);
    loginWindow.on("closed", onClosed);

    loginWindow.loadURL(authorizeUrl).catch((error) => {
      failWithError(new Error(`Failed to open Microsoft login window: ${formatMicrosoftAuthError(error)}`));
    });
  });
}

async function requestJsonWithAuthContext(url, options, contextMessage) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`${contextMessage}: ${String(error?.message || error)}`);
  }

  const text = await response.text();
  const parsed = tryParseJson(text);
  if (!response.ok) {
    const errorCode = asTrimmedText(parsed?.error || parsed?.code);
    const xErr = asTrimmedText(parsed?.XErr);
    const description =
      decodeOAuthErrorDescription(parsed?.error_description) ||
      asTrimmedText(parsed?.errorMessage) ||
      asTrimmedText(parsed?.Message) ||
      asTrimmedText(parsed?.message) ||
      asTrimmedText(text);
    const statusParts = [`HTTP ${response.status}`];
    if (errorCode) {
      statusParts.push(errorCode);
    }
    if (xErr) {
      statusParts.push(`XErr ${xErr}`);
    }
    throw new Error(
      `${contextMessage} (${statusParts.join(" ")})${description ? `: ${description}` : ""}`.trim()
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${contextMessage}: Invalid JSON response.`);
  }
  return parsed;
}

async function exchangeMicrosoftAuthorizationCode(config, code, verifier) {
  const payload = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    code_verifier: verifier
  }).toString();

  return requestJsonWithAuthContext(
    config.tokenUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload
    },
    "Microsoft authorization code exchange failed"
  );
}

async function refreshMicrosoftAccessToken(config, refreshToken) {
  const payload = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: config.scope
  }).toString();

  return requestJsonWithAuthContext(
    config.tokenUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: payload
    },
    "Microsoft token refresh failed"
  );
}

function getXstsErrorMessage(xErr) {
  const code = Number(xErr);
  switch (code) {
    case 2148916233:
      return "This Microsoft account does not have an Xbox profile. Create one at xbox.com and try again.";
    case 2148916235:
      return "Xbox Live is not available for this account region.";
    case 2148916236:
    case 2148916237:
      return "South Korean child-account policy: grant parental permission on Xbox and retry.";
    case 2148916238:
      return "This account is a child account and requires family organizer permission.";
    default:
      return "";
  }
}

function parseJwtPayload(token) {
  const parts = asTrimmedText(token).split(".");
  if (parts.length < 2) {
    return null;
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  try {
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function resolveMinecraftXuid(minecraftAccessToken) {
  const payload = parseJwtPayload(minecraftAccessToken);
  return asTrimmedText(payload?.xuid || payload?.xbox_user_id || payload?.uid || payload?.sub);
}

function createClientToken() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return toBase64Url(crypto.randomBytes(16));
}

function randomHex(byteLength) {
  return crypto.randomBytes(Math.max(1, Number(byteLength) || 1)).toString("hex");
}

function sha256Base64Url(value) {
  return toBase64Url(crypto.createHash("sha256").update(String(value || ""), "utf8").digest());
}

function getJsonStringIgnoreCase(source, ...names) {
  if (!source || typeof source !== "object") {
    return "";
  }
  const wantedNames = names.map((name) => asTrimmedText(name).toLowerCase()).filter(Boolean);
  for (const [key, value] of Object.entries(source)) {
    if (!wantedNames.includes(asTrimmedText(key).toLowerCase())) {
      continue;
    }
    if (typeof value === "string") {
      return asTrimmedText(value);
    }
  }
  return "";
}

function getJsonObjectIgnoreCase(source, ...names) {
  if (!source || typeof source !== "object") {
    return null;
  }
  const wantedNames = names.map((name) => asTrimmedText(name).toLowerCase()).filter(Boolean);
  for (const [key, value] of Object.entries(source)) {
    if (wantedNames.includes(asTrimmedText(key).toLowerCase()) && value && typeof value === "object") {
      return value;
    }
  }
  return null;
}

function parseInstantMillis(value) {
  const parsed = Date.parse(asTrimmedText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createXboxDeviceKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "prime256v1"
  });
  const publicJwk = publicKey.export({ format: "jwk" });
  const privateKeyBase64 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  return {
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : createClientToken(),
    privateKey,
    privateKeyBase64,
    x: asTrimmedText(publicJwk.x),
    y: asTrimmedText(publicJwk.y)
  };
}

function restoreXboxDeviceKey(cachedDevice) {
  const privateKeyBase64 = asTrimmedText(cachedDevice?.privateKeyBase64);
  const id = asTrimmedText(cachedDevice?.id);
  const x = asTrimmedText(cachedDevice?.x);
  const y = asTrimmedText(cachedDevice?.y);
  if (!privateKeyBase64 || !id || !x || !y) {
    return null;
  }

  try {
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyBase64, "base64"),
      type: "pkcs8",
      format: "der"
    });
    return {
      id,
      privateKey,
      privateKeyBase64,
      x,
      y
    };
  } catch {
    return null;
  }
}

function buildXboxProofKey(deviceKey) {
  return {
    kty: "EC",
    x: deviceKey.x,
    y: deviceKey.y,
    crv: "P-256",
    alg: "ES256",
    use: "sig"
  };
}

function int32Be(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(Number(value) || 0, 0);
  return buffer;
}

function int64Be(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(value), 0);
  return buffer;
}

function getWindowsTimestampTicks(date = new Date()) {
  return (BigInt(Math.trunc(date.getTime() / 1000)) + WINDOWS_EPOCH_SECONDS) * WINDOWS_TICKS_PER_SECOND;
}

function signXboxRequestPayload({ method, requestPath, authorization = "", bodyText, deviceKey, date = new Date() }) {
  const windowsTime = getWindowsTimestampTicks(date);
  const zero = Buffer.from([0]);
  const payload = Buffer.concat([
    int32Be(1),
    zero,
    int64Be(windowsTime),
    zero,
    Buffer.from(asTrimmedText(method).toUpperCase() || "POST", "utf8"),
    zero,
    Buffer.from(asTrimmedText(requestPath), "utf8"),
    zero,
    Buffer.from(asTrimmedText(authorization), "utf8"),
    zero,
    Buffer.from(String(bodyText || ""), "utf8"),
    zero
  ]);
  const rawSignature = crypto.sign("sha256", payload, {
    key: deviceKey.privateKey,
    dsaEncoding: "ieee-p1363"
  });
  return Buffer.concat([int32Be(1), int64Be(windowsTime), rawSignature]).toString("base64");
}

async function requestJsonResponseWithAuthContext(url, options, contextMessage) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`${contextMessage}: ${String(error?.message || error)}`);
  }

  const text = await response.text();
  const parsed = tryParseJson(text);
  if (!response.ok) {
    const errorCode = asTrimmedText(parsed?.error || parsed?.code);
    const xErr = asTrimmedText(parsed?.XErr);
    const description =
      decodeOAuthErrorDescription(parsed?.error_description) ||
      asTrimmedText(parsed?.errorMessage) ||
      asTrimmedText(parsed?.Message) ||
      asTrimmedText(parsed?.message) ||
      asTrimmedText(text);
    const statusParts = [`HTTP ${response.status}`];
    if (errorCode) {
      statusParts.push(errorCode);
    }
    if (xErr) {
      statusParts.push(`XErr ${xErr}`);
    }
    throw new Error(
      `${contextMessage} (${statusParts.join(" ")})${description ? `: ${description}` : ""}`.trim()
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`${contextMessage}: Invalid JSON response.`);
  }

  return {
    body: parsed,
    headers: response.headers,
    date: response.headers.get("date") ? new Date(response.headers.get("date")) : new Date()
  };
}

async function postFormJson(url, fields, contextMessage) {
  return (
    await requestJsonResponseWithAuthContext(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: new URLSearchParams(fields).toString()
      },
      contextMessage
    )
  ).body;
}

async function sendSignedXboxJsonRequest({ url, requestPath, body, deviceKey, contextMessage, authorization = "" }) {
  const bodyText = JSON.stringify(body);
  const signature = signXboxRequestPayload({
    method: "POST",
    requestPath,
    authorization,
    bodyText,
    deviceKey
  });
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    Accept: "application/json",
    Signature: signature
  };
  if (url !== XBOX_SISU_AUTHORIZE_URL) {
    headers["x-xbl-contract-version"] = "1";
  }
  if (authorization) {
    headers.Authorization = authorization;
  }

  return requestJsonResponseWithAuthContext(
    url,
    {
      method: "POST",
      headers,
      body: bodyText
    },
    contextMessage
  );
}

function toXboxDeviceToken(rawToken) {
  const token = asTrimmedText(rawToken?.Token || rawToken?.token);
  if (!token) {
    throw new Error("Xbox token response is missing Token.");
  }
  const cachedIssueInstant = Number(rawToken?.issueInstantEpochMillis || 0);
  const cachedNotAfter = Number(rawToken?.notAfterEpochMillis || 0);
  return {
    issueInstantEpochMillis: Number.isFinite(cachedIssueInstant) && cachedIssueInstant > 0
      ? cachedIssueInstant
      : parseInstantMillis(rawToken?.IssueInstant),
    notAfterEpochMillis: Number.isFinite(cachedNotAfter) && cachedNotAfter > 0
      ? cachedNotAfter
      : parseInstantMillis(rawToken?.NotAfter),
    token,
    displayClaims:
      (rawToken?.DisplayClaims && typeof rawToken.DisplayClaims === "object" ? rawToken.DisplayClaims : null) ||
      (rawToken?.displayClaims && typeof rawToken.displayClaims === "object" ? rawToken.displayClaims : {}) ||
      {}
  };
}

function getXboxUserHash(token) {
  const xui = token?.displayClaims?.xui;
  if (!Array.isArray(xui) || !xui[0] || typeof xui[0] !== "object") {
    return "";
  }
  return asTrimmedText(xui[0].uhs);
}

function readMicrosoftAuthCacheObject() {
  const payload = readMicrosoftAuthCachePayload();
  return payload && typeof payload === "object" ? payload : {};
}

function saveMicrosoftAuthCacheObject(payload) {
  writeMicrosoftAuthCachePayload(payload && typeof payload === "object" ? payload : {});
}

function cacheXboxDeviceToken(deviceKey, deviceToken) {
  const cache = readMicrosoftAuthCacheObject();
  saveMicrosoftAuthCacheObject({
    ...cache,
    device: {
      id: deviceKey.id,
      privateKeyBase64: deviceKey.privateKeyBase64,
      x: deviceKey.x,
      y: deviceKey.y,
      issueInstantEpochMillis: deviceToken.issueInstantEpochMillis,
      notAfterEpochMillis: deviceToken.notAfterEpochMillis,
      token: deviceToken.token,
      displayClaims: deviceToken.displayClaims
    }
  });
}

async function requestXboxDeviceToken(deviceKey) {
  const response = await sendSignedXboxJsonRequest({
    url: XBOX_DEVICE_AUTH_URL,
    requestPath: "/device/authenticate",
    deviceKey,
    contextMessage: "Xbox device token request failed",
    body: {
      Properties: {
        AuthMethod: "ProofOfPossession",
        Id: `{${String(deviceKey.id).toUpperCase()}}`,
        DeviceType: "Win32",
        Version: "10.16.0",
        ProofKey: buildXboxProofKey(deviceKey)
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    }
  });
  return toXboxDeviceToken(response.body);
}

async function refreshAndGetXboxDeviceToken() {
  const cache = readMicrosoftAuthCacheObject();
  const cachedDevice = cache.device && typeof cache.device === "object" ? cache.device : null;
  const cachedKey = restoreXboxDeviceKey(cachedDevice);
  if (cachedDevice && cachedKey && Number(cachedDevice.notAfterEpochMillis || 0) > Date.now()) {
    return {
      key: cachedKey,
      token: toXboxDeviceToken(cachedDevice)
    };
  }

  const key = cachedKey || createXboxDeviceKey();
  const token = await requestXboxDeviceToken(key);
  cacheXboxDeviceToken(key, token);
  return { key, token };
}

async function createMinecraftLauncherLoginRequest() {
  sendLog({ level: "auth", message: "Preparing Xbox device token..." });
  const device = await refreshAndGetXboxDeviceToken();
  const verifier = randomHex(64);
  const challenge = sha256Base64Url(verifier);
  const state = randomHex(24);

  sendLog({ level: "auth", message: "Opening Microsoft login session..." });
  const response = await sendSignedXboxJsonRequest({
    url: XBOX_SISU_AUTHENTICATE_URL,
    requestPath: "/authenticate",
    deviceKey: device.key,
    contextMessage: "Sisu authentication failed",
    body: {
      AppId: MICROSOFT_MINECRAFT_CLIENT_ID,
      DeviceToken: device.token.token,
      Offers: [MICROSOFT_MINECRAFT_REQUESTED_SCOPE],
      Query: {
        code_challenge: challenge,
        code_challenge_method: "S256",
        state,
        prompt: "select_account"
      },
      RedirectUri: MICROSOFT_MINECRAFT_AUTH_REPLY_URL,
      Sandbox: "RETAIL",
      TokenType: "code",
      TitleId: "1794566092"
    }
  });

  const sessionId = asTrimmedText(response.headers.get("x-sessionid"));
  const redirectObject = getJsonObjectIgnoreCase(response.body, "RedirectUri");
  const authorizeUrl =
    getJsonStringIgnoreCase(response.body, "MsaOAuthRedirect", "MsaOauthRedirect", "msa_oauth_redirect") ||
    getJsonStringIgnoreCase(redirectObject, "MsaOAuthRedirect", "MsaOauthRedirect", "msa_oauth_redirect");

  if (!sessionId) {
    throw new Error("Sisu authentication response is missing X-SessionId.");
  }
  if (!authorizeUrl) {
    throw new Error("Sisu authentication response is missing Microsoft redirect URL.");
  }

  return {
    authorizeUrl,
    redirectUri: MICROSOFT_MINECRAFT_AUTH_REPLY_URL,
    expectedState: state,
    codeVerifier: verifier,
    sessionId
  };
}

async function exchangeMinecraftLauncherAuthorizationCode(code, verifier) {
  return postFormJson(
    MICROSOFT_LIVE_OAUTH_TOKEN_URL,
    {
      client_id: MICROSOFT_MINECRAFT_CLIENT_ID,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: MICROSOFT_MINECRAFT_AUTH_REPLY_URL,
      scope: MICROSOFT_MINECRAFT_REQUESTED_SCOPE
    },
    "Microsoft OAuth token request failed"
  );
}

async function refreshMinecraftLauncherOAuthToken(refreshToken) {
  return postFormJson(
    MICROSOFT_LIVE_OAUTH_TOKEN_URL,
    {
      client_id: MICROSOFT_MINECRAFT_CLIENT_ID,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      redirect_uri: MICROSOFT_MINECRAFT_AUTH_REPLY_URL,
      scope: MICROSOFT_MINECRAFT_REQUESTED_SCOPE
    },
    "Microsoft OAuth token refresh failed"
  );
}

async function sisuAuthorizeMinecraftSession({ sessionId, microsoftAccessToken }) {
  sendLog({ level: "auth", message: "Authorizing Xbox account..." });
  const device = await refreshAndGetXboxDeviceToken();
  const response = await sendSignedXboxJsonRequest({
    url: XBOX_SISU_AUTHORIZE_URL,
    requestPath: "/authorize",
    deviceKey: device.key,
    contextMessage: "Sisu authorization failed",
    body: {
      AccessToken: `t=${microsoftAccessToken}`,
      AppId: MICROSOFT_MINECRAFT_CLIENT_ID,
      DeviceToken: device.token.token,
      ProofKey: buildXboxProofKey(device.key),
      Sandbox: "RETAIL",
      SessionId: sessionId || null,
      SiteName: "user.auth.xboxlive.com",
      RelyingParty: "http://xboxlive.com",
      UseModernGamertag: true
    }
  });

  return {
    titleToken: toXboxDeviceToken(response.body?.TitleToken),
    userToken: toXboxDeviceToken(response.body?.UserToken)
  };
}

async function xstsAuthorizeMinecraft({ authorize }) {
  sendLog({ level: "auth", message: "Requesting Minecraft service Xbox token..." });
  const device = await refreshAndGetXboxDeviceToken();
  const response = await sendSignedXboxJsonRequest({
    url: XSTS_AUTH_URL,
    requestPath: "/xsts/authorize",
    deviceKey: device.key,
    contextMessage: "Xbox XSTS authentication failed",
    body: {
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [authorize.userToken.token],
        DeviceToken: device.token.token,
        TitleToken: authorize.titleToken.token
      }
    }
  }).catch((error) => {
    const xErrMatch = String(error?.message || "").match(/XErr\s+(\d+)/i);
    const xErrCode = xErrMatch ? Number.parseInt(xErrMatch[1], 10) : NaN;
    const mappedMessage = Number.isFinite(xErrCode) ? getXstsErrorMessage(xErrCode) : "";
    if (mappedMessage) {
      throw new Error(mappedMessage);
    }
    throw error;
  });
  return toXboxDeviceToken(response.body);
}

async function requestMinecraftLauncherToken(xstsToken) {
  sendLog({ level: "auth", message: "Creating Minecraft session..." });
  const userHash = getXboxUserHash(xstsToken);
  if (!userHash) {
    throw new Error("XSTS response is missing user hash.");
  }
  const response = await requestJsonWithAuthContext(
    MINECRAFT_LAUNCHER_LOGIN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": MINECRAFT_SERVICES_USER_AGENT
      },
      body: JSON.stringify({
        platform: "PC_LAUNCHER",
        xtoken: `XBL3.0 x=${userHash};${xstsToken.token}`
      })
    },
    "Minecraft launcher token request failed"
  );
  const minecraftAccessToken = asTrimmedText(response?.access_token);
  if (!minecraftAccessToken) {
    throw new Error("Minecraft launcher token response is missing access_token.");
  }
  return minecraftAccessToken;
}

async function fetchMinecraftEntitlements(minecraftAccessToken) {
  sendLog({ level: "auth", message: "Checking Minecraft account entitlement..." });
  await requestJsonWithAuthContext(
    MINECRAFT_ENTITLEMENTS_URL,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${minecraftAccessToken}`
      }
    },
    "Minecraft entitlement check failed"
  );
}

async function fetchMinecraftProfile(minecraftAccessToken) {
  sendLog({ level: "auth", message: "Fetching Minecraft profile..." });
  const profile = await requestJsonWithAuthContext(
    MINECRAFT_PROFILE_URL,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${minecraftAccessToken}`
      }
    },
    "Minecraft profile fetch failed"
  );
  const profileId = asTrimmedText(profile?.id);
  const profileName = asTrimmedText(profile?.name);
  if (!profileId || !profileName) {
    throw new Error("Minecraft profile response is missing id/name.");
  }
  return { profileId, profileName };
}

async function authenticateMinecraftLauncherSession({ microsoftAccessToken, sessionId }) {
  const authorize = await sisuAuthorizeMinecraftSession({ sessionId, microsoftAccessToken });
  const xsts = await xstsAuthorizeMinecraft({ authorize });
  const minecraftAccessToken = await requestMinecraftLauncherToken(xsts);
  await fetchMinecraftEntitlements(minecraftAccessToken);
  const profile = await fetchMinecraftProfile(minecraftAccessToken);
  return {
    ...profile,
    xuid: resolveMinecraftXuid(minecraftAccessToken) || getXboxUserHash(xsts),
    minecraftAccessToken,
    minecraftExpiresAt: 0
  };
}

async function exchangeMicrosoftAccessForMinecraftSession(msAccessToken, withLogs) {
  if (withLogs) {
    sendLog({ level: "auth", message: "Authenticating with Xbox Live..." });
  }
  const xblAuth = await requestJsonWithAuthContext(
    XBOX_LIVE_AUTH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: `d=${msAccessToken}`
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT"
      })
    },
    "Xbox Live authentication failed"
  );

  const xblToken = asTrimmedText(xblAuth?.Token);
  const userHash = asTrimmedText(xblAuth?.DisplayClaims?.xui?.[0]?.uhs);
  if (!xblToken || !userHash) {
    throw new Error("Xbox Live authentication response is missing required token fields.");
  }

  if (withLogs) {
    sendLog({ level: "auth", message: "Requesting Xbox security token..." });
  }
  const xstsAuth = await requestJsonWithAuthContext(
    XSTS_AUTH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        Properties: {
          SandboxId: "RETAIL",
          UserTokens: [xblToken]
        },
        RelyingParty: "rp://api.minecraftservices.com/",
        TokenType: "JWT"
      })
    },
    "Xbox XSTS authentication failed"
  ).catch((error) => {
    const xErrMatch = String(error?.message || "").match(/XErr\s+(\d+)/i);
    const xErrCode = xErrMatch ? Number.parseInt(xErrMatch[1], 10) : NaN;
    const mappedMessage = Number.isFinite(xErrCode) ? getXstsErrorMessage(xErrCode) : "";
    if (mappedMessage) {
      throw new Error(mappedMessage);
    }
    throw error;
  });

  const xstsToken = asTrimmedText(xstsAuth?.Token);
  if (!xstsToken) {
    throw new Error("Xbox XSTS authentication response is missing token.");
  }

  if (withLogs) {
    sendLog({ level: "auth", message: "Requesting Minecraft access token..." });
  }
  const minecraftAuth = await requestJsonWithAuthContext(
    MINECRAFT_AUTH_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`
      })
    },
    "Minecraft authentication failed"
  );

  const minecraftAccessToken = asTrimmedText(minecraftAuth?.access_token);
  if (!minecraftAccessToken) {
    throw new Error("Minecraft authentication response is missing access token.");
  }

  if (withLogs) {
    sendLog({ level: "auth", message: "Checking Minecraft entitlements..." });
  }
  const entitlements = await requestJsonWithAuthContext(
    MINECRAFT_ENTITLEMENTS_URL,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${minecraftAccessToken}`
      }
    },
    "Minecraft entitlement check failed"
  );
  const entitlementNames = Array.isArray(entitlements?.items)
    ? entitlements.items.map((item) => asTrimmedText(item?.name).toLowerCase()).filter(Boolean)
    : [];
  const hasJavaEntitlement = entitlementNames.includes("product_minecraft") || entitlementNames.includes("game_minecraft");
  if (!hasJavaEntitlement) {
    throw new Error("This account does not have Minecraft Java entitlement.");
  }

  if (withLogs) {
    sendLog({ level: "auth", message: "Fetching Minecraft profile..." });
  }
  const profile = await requestJsonWithAuthContext(
    MINECRAFT_PROFILE_URL,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${minecraftAccessToken}`
      }
    },
    "Minecraft profile fetch failed"
  );

  const profileId = asTrimmedText(profile?.id);
  const profileName = asTrimmedText(profile?.name);
  if (!profileId || !profileName) {
    throw new Error("Minecraft profile response is missing id/name.");
  }

  const expiresIn = Number(minecraftAuth?.expires_in);
  const minecraftExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : 0;
  const xuid = resolveMinecraftXuid(minecraftAccessToken);

  return {
    profileId,
    profileName,
    xuid,
    minecraftAccessToken,
    minecraftExpiresAt
  };
}

function buildMicrosoftAccountRecord({ existingAccount, config, oauthToken, minecraftSession }) {
  const refreshToken =
    asTrimmedText(oauthToken?.refresh_token) ||
    asTrimmedText(existingAccount?.refreshToken) ||
    asTrimmedText(existingAccount?.meta?.refresh);
  if (!refreshToken) {
    throw new Error("Microsoft token response did not include a refresh token.");
  }

  const microsoftAccessToken = asTrimmedText(oauthToken?.access_token);
  if (!microsoftAccessToken) {
    throw new Error("Microsoft token response did not include an access token.");
  }

  const microsoftExpiresIn = Number(oauthToken?.expires_in);
  const microsoftExpiresAt =
    Number.isFinite(microsoftExpiresIn) && microsoftExpiresIn > 0 ? Date.now() + microsoftExpiresIn * 1000 : 0;
  const clientToken = asTrimmedText(existingAccount?.client_token) || createClientToken();

  return {
    schemaVersion: MICROSOFT_AUTH_SCHEMA_VERSION,
    authMethod: "minecraft-launcher-sisu",
    clientId: asTrimmedText(config?.clientId) || MICROSOFT_MINECRAFT_CLIENT_ID,
    tenant: asTrimmedText(config?.tenant),
    redirectUri: asTrimmedText(config?.redirectUri) || MICROSOFT_MINECRAFT_AUTH_REPLY_URL,
    scope: asTrimmedText(config?.scope) || MICROSOFT_MINECRAFT_REQUESTED_SCOPE,
    refreshToken,
    microsoftAccessToken,
    microsoftExpiresAt,
    access_token: minecraftSession.minecraftAccessToken,
    client_token: clientToken,
    uuid: minecraftSession.profileId,
    name: minecraftSession.profileName,
    meta: {
      type: "msa",
      xuid: minecraftSession.xuid,
      demo: false,
      exp: minecraftSession.minecraftExpiresAt || undefined,
      refresh: refreshToken
    },
    user_properties: {}
  };
}

async function refreshMicrosoftAuthorization(withLogs) {
  if (!microsoftAccount) {
    microsoftAccount = readMicrosoftAuthCache();
  }

  if (!microsoftAccount) {
    throw new Error("Microsoft account is not signed in.");
  }

  const savedRefreshToken =
    asTrimmedText(microsoftAccount?.refreshToken) || asTrimmedText(microsoftAccount?.meta?.refresh);
  if (!savedRefreshToken) {
    throw new Error("Saved Microsoft session is invalid. Please sign in again.");
  }

  if (withLogs) {
    sendLog({ level: "auth", message: "Refreshing Microsoft session..." });
  }
  let oauthToken;
  try {
    oauthToken = await refreshMinecraftLauncherOAuthToken(savedRefreshToken);
  } catch (error) {
    if (isMicrosoftRefreshSessionExpiredError(error)) {
      const expiredAccountName = asTrimmedText(microsoftAccount?.name) || "Unknown";
      clearMicrosoftAuthCache({ allAccounts: false });
      microsoftAccount = readMicrosoftAuthCache();
      sendMicrosoftAuthState();
      sendLog({
        level: "warn",
        message: `Microsoft session expired. Removed saved account: ${expiredAccountName}`
      });
      const expiredError = new Error("Microsoft session expired. Please sign in again.");
      expiredError.code = "auth-session-expired";
      throw expiredError;
    }
    throw error;
  }
  const minecraftSession = await authenticateMinecraftLauncherSession({
    microsoftAccessToken: oauthToken.access_token,
    sessionId: null
  });

  microsoftAccount = buildMicrosoftAccountRecord({
    existingAccount: microsoftAccount,
    oauthToken,
    minecraftSession
  });
  saveMicrosoftAuthCache(microsoftAccount);
  sendMicrosoftAuthState();
  return microsoftAccount;
}

async function startMicrosoftLogin() {
  if (isMicrosoftLoggingIn) {
    return {
      ok: false,
      error: "Microsoft login is already in progress.",
      status: getMicrosoftStatus()
    };
  }

  isMicrosoftLoggingIn = true;
  sendMicrosoftAuthState();
  let response;

  try {
    sendLog({ level: "info", message: "Opening Microsoft login window..." });
    const previouslySelectedAccountId = getMicrosoftAccountId(microsoftAccount);
    const loginRequest = await createMinecraftLauncherLoginRequest();
    const authorizationCode = await requestMicrosoftAuthorizationCode({
      authorizeUrl: loginRequest.authorizeUrl,
      redirectUri: loginRequest.redirectUri,
      expectedState: loginRequest.expectedState
    });

    sendLog({ level: "auth", message: "Exchanging authorization code..." });
    const oauthToken = await exchangeMinecraftLauncherAuthorizationCode(
      authorizationCode,
      loginRequest.codeVerifier
    );
    const minecraftSession = await authenticateMinecraftLauncherSession({
      microsoftAccessToken: oauthToken.access_token,
      sessionId: loginRequest.sessionId
    });

    const nextAccount = buildMicrosoftAccountRecord({
      existingAccount: microsoftAccount,
      oauthToken,
      minecraftSession
    });
    const nextAccountId = getMicrosoftAccountId(nextAccount);
    const shouldSelectNewAccount = !previouslySelectedAccountId || previouslySelectedAccountId === nextAccountId;
    saveMicrosoftAuthCache(nextAccount, { select: shouldSelectNewAccount });
    microsoftAccount = shouldSelectNewAccount ? nextAccount : readMicrosoftAuthCache();

    sendLog({
      level: "info",
      message: `Microsoft account added: ${nextAccount.name || "Unknown"}`
    });
    response = { ok: true };
  } catch (error) {
    const message = formatMicrosoftAuthError(error);
    sendLog({ level: "error", message: `Microsoft login failed: ${message}` });
    response = { ok: false, error: message };
  } finally {
    isMicrosoftLoggingIn = false;
    sendMicrosoftAuthState();
  }

  return {
    ...response,
    status: getMicrosoftStatus()
  };
}

function logoutMicrosoft() {
  const signedOutName = asTrimmedText(microsoftAccount?.name);
  const signedOutAccountId = getMicrosoftAccountId(microsoftAccount);
  if (signedOutAccountId) {
    removeMicrosoftAuthCacheAccount(signedOutAccountId);
  }
  microsoftAccount = null;
  microsoftAccount = readMicrosoftAuthCache();
  sendMicrosoftAuthState();
  sendLog({ level: "info", message: `Microsoft account signed out: ${signedOutName || "Unknown"}` });
  return { ok: true, status: getMicrosoftStatus() };
}

function readRegisteredProfiles(minecraftDirectory) {
  const profileFile = path.join(minecraftDirectory, "launcher_profiles.json");
  if (!fs.existsSync(profileFile)) {
    return {
      ok: true,
      selectedProfile: "",
      profiles: []
    };
  }

  try {
    const raw = fs.readFileSync(profileFile, "utf8");
    const parsed = JSON.parse(raw);
    const profileEntries = Object.entries(parsed?.profiles || {});
    const profiles = profileEntries
      .map(([id, profile]) => {
        return {
          id,
          name: asTrimmedText(profile?.name) || id,
          lastVersionId: asTrimmedText(profile?.lastVersionId),
          gameDir: asTrimmedText(profile?.gameDir),
          javaDir: asTrimmedText(profile?.javaDir)
        };
      })
      .filter((profile) => profile.lastVersionId || profile.gameDir || profile.javaDir);

    profiles.sort((a, b) => a.name.localeCompare(b.name));
    return {
      ok: true,
      selectedProfile: asTrimmedText(parsed?.selectedProfile),
      profiles
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse launcher_profiles.json: ${String(error?.message || error)}`
    };
  }
}

function getBundledRuntimeRoot(minecraftDirectory) {
  return path.join(minecraftDirectory, MODPACK_STATE_DIRECTORY, "runtime");
}

function getBundledJavaHome(minecraftDirectory) {
  return path.join(getBundledRuntimeRoot(minecraftDirectory), "java");
}

function getBundledJavaExecutableCandidates(minecraftDirectory) {
  const javaHome = getBundledJavaHome(minecraftDirectory);
  if (process.platform === "win32") {
    return [path.join(javaHome, "bin", "java.exe"), path.join(javaHome, "bin", "javaw.exe")];
  }
  return [path.join(javaHome, "bin", "java")];
}

function parseJavaMajorVersion(rawVersionOutput) {
  const output = String(rawVersionOutput || "");
  const match = output.match(/version\s+"([^"]+)"/i);
  if (!match) {
    return 0;
  }

  const versionText = String(match[1] || "");
  const firstToken = versionText.split(/[._+-]/)[0];
  if (firstToken === "1") {
    const secondToken = Number.parseInt(versionText.split(/[._+-]/)[1] || "", 10);
    return Number.isFinite(secondToken) ? secondToken : 0;
  }

  const major = Number.parseInt(firstToken, 10);
  return Number.isFinite(major) ? major : 0;
}

async function detectJavaMajorVersion(javaExecutable) {
  return new Promise((resolve) => {
    const child = spawn(javaExecutable, ["-version"], { windowsHide: true });
    let output = "";
    let finished = false;

    const finalize = (major) => {
      if (finished) {
        return;
      }
      finished = true;
      resolve(major);
    };

    const timeout = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore kill failures
      }
      finalize(0);
    }, 5000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", () => {
      clearTimeout(timeout);
      finalize(0);
    });
    child.on("close", () => {
      clearTimeout(timeout);
      finalize(parseJavaMajorVersion(output));
    });
  });
}

function isFixedJavaMajorVersion(major) {
  return Number(major) === FIXED_JAVA_MAJOR_VERSION;
}

function resolveExecutableFromPath(commandName) {
  const command = asTrimmedText(commandName);
  if (!command) {
    return "";
  }
  if (path.isAbsolute(command) && fs.existsSync(command)) {
    return command;
  }

  const pathValue = process.env.PATH || "";
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)
      : [""];
  const commandExtension = path.extname(command);
  const candidateNames =
    process.platform === "win32" && !commandExtension
      ? extensions.map((extension) => `${command}${extension.toLowerCase()}`)
      : [command];

  for (const directory of directories) {
    for (const candidateName of candidateNames) {
      const candidatePath = path.join(directory, candidateName);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return "";
}

function preferJavawExecutable(javaExecutable) {
  const candidate = asTrimmedText(javaExecutable);
  if (process.platform !== "win32" || !candidate) {
    return candidate;
  }

  const normalizedBaseName = path.basename(candidate).toLowerCase();
  if (normalizedBaseName !== "java.exe") {
    return candidate;
  }

  const javawCandidate = path.join(path.dirname(candidate), "javaw.exe");
  return fs.existsSync(javawCandidate) ? javawCandidate : candidate;
}

function resolveJavaExecutableForSettings(javaExecutable) {
  const candidate = asTrimmedText(javaExecutable);
  if (!candidate) {
    return "";
  }

  const resolved = path.isAbsolute(candidate) ? candidate : resolveExecutableFromPath(candidate);
  return preferJavawExecutable(resolved || candidate);
}

async function findJavaHomeInDirectory(rootDirectory) {
  const queue = [rootDirectory];

  while (queue.length > 0) {
    const currentDirectory = queue.shift();
    if (!currentDirectory) {
      continue;
    }

    const javaExecutable = process.platform === "win32"
      ? path.join(currentDirectory, "bin", "java.exe")
      : path.join(currentDirectory, "bin", "java");
    const javawExecutable = path.join(currentDirectory, "bin", "javaw.exe");
    if (fs.existsSync(javaExecutable) || fs.existsSync(javawExecutable)) {
      return currentDirectory;
    }

    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      entries = [];
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      queue.push(path.join(currentDirectory, entry.name));
    }
  }

  return "";
}

async function installBundledWindowsJavaRuntime(minecraftDirectory) {
  const runtimeRoot = getBundledRuntimeRoot(minecraftDirectory);
  const downloadDirectory = path.join(runtimeRoot, "downloads");
  const archivePath = path.join(downloadDirectory, `temurin-jre-${FIXED_JAVA_MAJOR_VERSION}-windows-x64.zip`);
  const tempArchivePath = `${archivePath}.download`;
  const extractionDirectory = path.join(runtimeRoot, "java_extract");
  const javaHomeTarget = getBundledJavaHome(minecraftDirectory);

  sendLog({
    level: "info",
    message: `Installing Java ${FIXED_JAVA_MAJOR_VERSION} runtime for launcher instance...`
  });
  sendLog({
    level: "progress",
    message: "Downloading Java runtime..."
  });

  try {
    await downloadFile(WINDOWS_JAVA_RUNTIME_URL, tempArchivePath);
    await fs.promises.mkdir(path.dirname(archivePath), { recursive: true });
    if (fs.existsSync(archivePath)) {
      await fs.promises.rm(archivePath, { force: true });
    }
    await fs.promises.rename(tempArchivePath, archivePath);
  } finally {
    if (fs.existsSync(tempArchivePath)) {
      await fs.promises.rm(tempArchivePath, { force: true });
    }
  }

  sendLog({
    level: "progress",
    message: "Extracting Java runtime..."
  });
  await fs.promises.rm(extractionDirectory, { recursive: true, force: true });
  await fs.promises.mkdir(extractionDirectory, { recursive: true });
  try {
    await validateZipArchiveForExtraction(archivePath);
  } catch (error) {
    throw new Error(`Downloaded Java runtime ZIP is invalid or incomplete: ${String(error?.message || error)}`);
  }

  try {
    await extractZipArchive(archivePath, extractionDirectory);
  } catch (error) {
    throw new Error(`Failed to extract Java runtime ZIP: ${String(error?.message || error)}`);
  }

  const extractedJavaHome = await findJavaHomeInDirectory(extractionDirectory);
  if (!extractedJavaHome) {
    throw new Error("Downloaded Java runtime does not contain a valid Java executable.");
  }

  await fs.promises.rm(javaHomeTarget, { recursive: true, force: true });
  await fs.promises.mkdir(path.dirname(javaHomeTarget), { recursive: true });
  await fs.promises.rename(extractedJavaHome, javaHomeTarget);
  await fs.promises.rm(extractionDirectory, { recursive: true, force: true });

  const javaExecutable = getBundledJavaExecutableCandidates(minecraftDirectory).find((candidate) => fs.existsSync(candidate));
  if (!javaExecutable) {
    throw new Error("Bundled Java runtime install completed, but java executable was not found.");
  }

  const major = await detectJavaMajorVersion(javaExecutable);
  if (!isFixedJavaMajorVersion(major)) {
    throw new Error(`Installed Java runtime version is ${major || "unknown"}, but ${FIXED_JAVA_REQUIREMENT_LABEL} is required.`);
  }

  sendLog({
    level: "info",
    message: `Java runtime installed: ${javaExecutable}`
  });
  return javaExecutable;
}

async function ensureJavaRuntimeInDirectory(minecraftDirectory, requestedJavaPath = "") {
  const explicitJavaPath = asTrimmedText(requestedJavaPath);
  if (explicitJavaPath) {
    const explicitMajor = await detectJavaMajorVersion(explicitJavaPath);
    if (isFixedJavaMajorVersion(explicitMajor)) {
      sendLog({
        level: "info",
        message: `Using configured Java runtime: ${explicitJavaPath}`
      });
      return explicitJavaPath;
    }
    sendLog({
      level: "info",
      message: `Configured Java runtime could not be used (version: ${explicitMajor || "unknown"}). ${FIXED_JAVA_REQUIREMENT_LABEL} is required. Trying automatic Java detection...`
    });
  }

  const bundledJava = getBundledJavaExecutableCandidates(minecraftDirectory).find((candidate) => fs.existsSync(candidate));
  if (bundledJava) {
    const bundledMajor = await detectJavaMajorVersion(bundledJava);
    if (isFixedJavaMajorVersion(bundledMajor)) {
      sendLog({
        level: "info",
        message: `Using bundled Java runtime: ${bundledJava}`
      });
      return bundledJava;
    }
    sendLog({
      level: "info",
      message: `Bundled Java runtime could not be used (version: ${bundledMajor || "unknown"}). Reinstalling ${FIXED_JAVA_REQUIREMENT_LABEL} runtime...`
    });
  }

  const systemJavaMajor = await detectJavaMajorVersion("java");
  if (isFixedJavaMajorVersion(systemJavaMajor)) {
    sendLog({
      level: "info",
      message: "Using system Java runtime from PATH."
    });
    return "java";
  }
  if (systemJavaMajor) {
    sendLog({
      level: "info",
      message: `System Java runtime from PATH could not be used (version: ${systemJavaMajor}). ${FIXED_JAVA_REQUIREMENT_LABEL} is required.`
    });
  }

  if (process.platform === "win32") {
    return installBundledWindowsJavaRuntime(minecraftDirectory);
  }

  throw new Error(`${FIXED_JAVA_REQUIREMENT_LABEL} runtime is required, and automatic installation is not supported on this OS.`);
}

function isFixedFabricVersionId(versionId) {
  const value = asTrimmedText(versionId).toLowerCase();
  return value.includes(FIXED_MOD_LOADER) && value.includes(FIXED_MINECRAFT_VERSION);
}

function detectInstalledFabricVersionId(minecraftDirectory) {
  const versionsDirectory = path.join(minecraftDirectory, "versions");
  if (!fs.existsSync(versionsDirectory)) {
    return "";
  }

  let entries = [];
  try {
    entries = fs.readdirSync(versionsDirectory, { withFileTypes: true });
  } catch {
    return "";
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => isFixedFabricVersionId(name))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

  return candidates[0] || "";
}

async function ensureFabricVersionInDirectory(minecraftDirectory) {
  const existing = detectInstalledFabricVersionId(minecraftDirectory);
  if (existing) {
    sendLog({
      level: "info",
      message: `Fabric runtime already installed: ${existing}`
    });
    return existing;
  }

  sendLog({
    level: "info",
    message: `Installing Fabric ${FIXED_MINECRAFT_VERSION} profile for launcher instance...`
  });

  const versionsApiUrl = `https://meta.fabricmc.net/v2/versions/loader/${FIXED_MINECRAFT_VERSION}`;
  sendLog({
    level: "progress",
    message: "Fetching Fabric loader metadata..."
  });
  const versionsResponse = await fetch(versionsApiUrl, { redirect: "follow", cache: "no-store" });
  if (!versionsResponse.ok) {
    throw new Error(`Failed to query Fabric loader versions (${versionsResponse.status}).`);
  }

  let loaderVersions;
  try {
    loaderVersions = await versionsResponse.json();
  } catch (error) {
    throw new Error(`Failed to parse Fabric loader versions: ${String(error?.message || error)}`);
  }

  if (!Array.isArray(loaderVersions) || loaderVersions.length === 0) {
    throw new Error(`No Fabric loader versions found for ${FIXED_MINECRAFT_VERSION}.`);
  }

  const stableEntry = loaderVersions.find((entry) => Boolean(entry?.loader?.stable));
  const selectedEntry = stableEntry || loaderVersions[0];
  const loaderVersion = asTrimmedText(selectedEntry?.loader?.version);
  if (!loaderVersion) {
    throw new Error("Fabric loader version response is invalid.");
  }

  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${FIXED_MINECRAFT_VERSION}/${loaderVersion}/profile/json`;
  sendLog({
    level: "progress",
    message: `Downloading Fabric profile (${loaderVersion})...`
  });
  const profileResponse = await fetch(profileUrl, { redirect: "follow", cache: "no-store" });
  if (!profileResponse.ok) {
    throw new Error(`Failed to download Fabric profile (${profileResponse.status}).`);
  }

  let profileJson;
  try {
    profileJson = await profileResponse.json();
  } catch (error) {
    throw new Error(`Failed to parse Fabric profile JSON: ${String(error?.message || error)}`);
  }

  const versionId = asTrimmedText(profileJson?.id);
  if (!isFixedFabricVersionId(versionId)) {
    throw new Error("Fabric profile id is invalid for launcher target.");
  }

  const versionDirectory = path.join(minecraftDirectory, "versions", versionId);
  const versionJsonPath = path.join(versionDirectory, `${versionId}.json`);
  await fs.promises.mkdir(versionDirectory, { recursive: true });
  await fs.promises.writeFile(versionJsonPath, JSON.stringify(profileJson, null, 2), "utf8");

  sendLog({
    level: "info",
    message: `Fabric profile installed: ${versionId}`
  });
  return versionId;
}

async function resolveLaunchVersionId(minecraftDirectory, requestedVersion) {
  const explicitVersion = asTrimmedText(requestedVersion);
  if (isFixedFabricVersionId(explicitVersion)) {
    return explicitVersion;
  }

  const detectedVersion = detectInstalledFabricVersionId(minecraftDirectory);
  if (detectedVersion) {
    return detectedVersion;
  }

  const installedVersion = await ensureFabricVersionInDirectory(minecraftDirectory);
  if (installedVersion) {
    return installedVersion;
  }

  throw new Error(
    `Failed to prepare Fabric ${FIXED_MINECRAFT_VERSION} profile.`
  );
}

function createWindow() {
  const isWindows = process.platform === "win32";
  const useCustomRoundedWindow = isWindows && WINDOW_ROUNDED_RADIUS_PX > 0;
  const roundedShapeRadius = useCustomRoundedWindow ? WINDOW_ROUNDED_RADIUS_PX : 0;
  let windowShapeTimer = null;
  let windowShapeLastAppliedAt = 0;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 860,
    minHeight: 660,
    icon: APP_ICON_PATH,
    frame: false,
    thickFrame: false,
    roundedCorners: true,
    hasShadow: true,
    transparent: false,
    backgroundMaterial: "none",
    show: false,
    backgroundColor: "#060b13",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false
    }
  });
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.removeMenu();
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const normalizedUrl = normalizeExternalOpenUrl(url, { allowHttpLoopback: false });
    if (normalizedUrl.ok) {
      void shell.openExternal(normalizedUrl.url).catch(() => {});
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, urlValue) => {
    if (isAllowedMainWindowNavigationUrl(urlValue)) {
      return;
    }
    event.preventDefault();
  });

  const applyRoundedShapeNow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    applyRoundedWindowShape(mainWindow, roundedShapeRadius);
    windowShapeLastAppliedAt = Date.now();
  };

  const scheduleRoundedShapeUpdate = (immediate = false) => {
    if (!useCustomRoundedWindow) {
      return;
    }

    if (immediate) {
      const now = Date.now();
      if (now - windowShapeLastAppliedAt >= 8) {
        applyRoundedShapeNow();
      }
    }

    if (windowShapeTimer !== null) {
      return;
    }

    windowShapeTimer = setTimeout(() => {
      windowShapeTimer = null;
      applyRoundedShapeNow();
    }, 8);
  };

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.show();
    applyRoundedShapeNow();
    scheduleRoundedShapeUpdate();
  });
  mainWindow.webContents.on("did-finish-load", () => {
    sendState(isLaunching);
    sendMicrosoftAuthState();
    sendWindowState();
    sendUpdaterState();
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("show", () => {
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("resize", () => {
    scheduleRoundedShapeUpdate(true);
  });
  mainWindow.on("will-resize", () => {
    scheduleRoundedShapeUpdate(true);
  });
  mainWindow.on("restore", () => {
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("maximize", () => {
    sendWindowState();
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("unmaximize", () => {
    sendWindowState();
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("enter-full-screen", () => {
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("leave-full-screen", () => {
    scheduleRoundedShapeUpdate();
  });
  mainWindow.on("closed", () => {
    if (windowShapeTimer !== null) {
      clearTimeout(windowShapeTimer);
      windowShapeTimer = null;
    }
  });
}

ipcMain.handle("launcher:get-defaults", () => {
  return {
    username: asTrimmedText(microsoftAccount?.name) || "Player",
    version: FIXED_MINECRAFT_VERSION,
    modLoader: FIXED_MOD_LOADER,
    versionType: "release",
    minecraftDirectory: getDefaultMinecraftDir(),
    systemMinecraftDirectory: getSystemMinecraftDir(),
    javaPath: "",
    jvmArgs: "",
    ramMin: 6144,
    ramMax: 6144
  };
});

ipcMain.handle("launcher:get-auth-state", () => {
  return getMicrosoftStatus();
});

ipcMain.handle("launcher:get-system-profile", () => {
  return detectLauncherPreset();
});

ipcMain.handle("launcher:get-server-status", async () => {
  try {
    return await getLauncherServerStatusSnapshot();
  } catch (error) {
    return {
      ok: false,
      configured: false,
      hasServerTarget: false,
      updatedAt: new Date().toISOString(),
      error: String(error?.message || error)
    };
  }
});

ipcMain.handle("launcher:get-news", async (_event, payload = {}) => {
  try {
    return await getLauncherNewsSnapshot(payload);
  } catch (error) {
    return {
      ok: false,
      hasSource: false,
      source: "",
      updatedAt: new Date().toISOString(),
      refreshMs: NEWS_REFRESH_DEFAULT_MS,
      items: [],
      error: String(error?.message || error)
    };
  }
});

ipcMain.handle("launcher:get-github-release", async (_event, payload = {}) => {
  try {
    return await getLatestGitHubReleaseSnapshot(payload);
  } catch (error) {
    return {
      ok: false,
      configured: false,
      owner: "",
      repo: "",
      repositoryUrl: "",
      releaseUrl: "",
      tagName: "",
      name: "",
      publishedAt: "",
      prerelease: false,
      draft: false,
      body: "",
      assets: [],
      updatedAt: new Date().toISOString(),
      error: String(error?.message || error)
    };
  }
});

ipcMain.handle("updater:get-state", () => {
  return { ...updaterState };
});

ipcMain.handle("updater:ensure-latest", () => {
  return ensureLatestLauncherVersion({ installIfDownloaded: true });
});

ipcMain.handle("updater:check", () => {
  return checkForAppUpdates({ manual: true });
});

ipcMain.handle("updater:install", () => {
  if (!updaterState.enabled) {
    return { ok: false, error: "Auto updater is disabled in development mode." };
  }
  if (!updaterState.downloaded) {
    return { ok: false, error: "No downloaded update is ready to install." };
  }

  triggerDownloadedLauncherInstall();

  return { ok: true };
});

ipcMain.handle("launcher:microsoft-login", async () => {
  return startMicrosoftLogin();
});

ipcMain.handle("launcher:microsoft-select-account", (_, accountId) => {
  return selectMicrosoftAuthCacheAccount(accountId);
});

ipcMain.handle("launcher:microsoft-logout", () => {
  return logoutMicrosoft();
});

ipcMain.handle("app:open-external", async (_, rawUrl) => {
  const normalizedUrl = normalizeExternalOpenUrl(rawUrl, { allowHttpLoopback: true });
  if (!normalizedUrl.ok) {
    return { ok: false, error: normalizedUrl.error };
  }

  try {
    await shell.openExternal(normalizedUrl.url);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
});

ipcMain.on("window:minimize", () => {
  withMainWindow((win) => {
    win.minimize();
  });
});

ipcMain.on("window:toggle-maximize", () => {
  withMainWindow((win) => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
});

ipcMain.on("window:close", () => {
  withMainWindow((win) => {
    win.close();
  });
});

ipcMain.handle("window:get-state", () => {
  if (!isMainWindowAlive()) {
    return { maximized: false };
  }
  return { maximized: mainWindow.isMaximized() };
});

ipcMain.handle("launcher:pick-directory", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });

  if (result.canceled || !result.filePaths[0]) {
    return "";
  }

  return result.filePaths[0];
});

ipcMain.handle("launcher:pick-java", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Java", extensions: ["exe", "bin", "cmd"] },
      { name: "All files", extensions: ["*"] }
    ]
  });

  if (result.canceled || !result.filePaths[0]) {
    return "";
  }

  return result.filePaths[0];
});

ipcMain.handle("launcher:auto-select-java", async (_, payload) => {
  const result = await autoSelectJavaFromPayload(payload);
  if (!result.ok) {
    sendLog({ level: "error", message: `Java auto selection failed: ${result.error}` });
    return {
      ok: false,
      error: `Java auto selection failed: ${result.error}`
    };
  }
  return result;
});

ipcMain.handle("launcher:load-profiles", async (_, payload) => {
  const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory || payload);
  if (!minecraftDirectory) {
    return { ok: false, error: "Minecraft directory is required." };
  }
  return readRegisteredProfiles(minecraftDirectory);
});

ipcMain.handle("launcher:sync-modpack", async (_, payload) => {
  const result = await runModpackSyncFromPayload(payload, { skipIfSessionSynced: false });
  if (!result.ok) {
    sendLog({ level: "error", message: `Modpack sync failed: ${result.error}` });
    return {
      ok: false,
      error: `Modpack update failed: ${result.error}`
    };
  }
  return result;
});

ipcMain.handle("launcher:check-modpack-update", async (_, payload) => {
  const result = await runModpackUpdateCheckFromPayload(payload);
  if (!result.ok) {
    sendLog({ level: "warn", message: `Modpack update check failed: ${result.error}` });
  }
  return result;
});

ipcMain.handle("launcher:prefetch-modpacks", async (_, payload) => {
  const result = await prefetchModpackArchivesFromPayload(payload);
  if (!result.ok && Array.isArray(result.failedPresets) && result.failedPresets.length > 0) {
    sendLog({
      level: "warn",
      message: `Modpack prefetch finished with warnings: ${result.failedPresets.join(" | ")}`
    });
  }
  return result;
});

ipcMain.handle("launcher:prepare-runtime", async (_, payload) => {
  const result = await prepareRuntimeFromPayload(payload);
  if (!result.ok) {
    sendLog({ level: "error", message: `Runtime preparation failed: ${result.error}` });
    return {
      ok: false,
      error: `Runtime preparation failed: ${result.error}`
    };
  }
  return result;
});

ipcMain.handle("launcher:launch", async (_, payload) => {
  if (isLaunching || isLaunchRequestInProgress) {
    return { ok: false, error: "Launcher is already starting Minecraft." };
  }

  isLaunchRequestInProgress = true;
  try {
    const username = asTrimmedText(payload?.username);
    const requestedVersion = asTrimmedText(payload?.version);
    const minecraftDirectory = asTrimmedText(payload?.minecraftDirectory);
    const gameDirectory = asTrimmedText(payload?.gameDirectory);
    const launcherPreset = normalizeLauncherPreset(payload?.launcherPreset, detectLauncherPreset().preset);
    const requestedJavaPath = asTrimmedText(payload?.javaPath);
    const requestedJvmArgs = asTrimmedText(payload?.jvmArgs);
    const customJvmArgs = parseJvmCustomArgs(requestedJvmArgs);
    const gameWidth = asIntegerInRange(payload?.gameWidth, 1280, 320, 7680);
    const gameHeight = asIntegerInRange(payload?.gameHeight, 720, 240, 4320);
    const fullscreen = Boolean(payload?.fullscreen);
    const autoConnectEnabled = payload?.autoConnect !== false;
    const versionType = "release";
    const ramMin = Number(payload?.ramMin || 6144);
    const ramMax = Number(payload?.ramMax || 6144);

    if (!minecraftDirectory) {
      return { ok: false, error: "Minecraft directory is required." };
    }
    if (!Number.isFinite(ramMin) || !Number.isFinite(ramMax) || ramMin <= 0 || ramMax <= 0 || ramMin > ramMax) {
      return { ok: false, error: "Memory values are invalid." };
    }

    let resolvedJavaPath = "";
    try {
      resolvedJavaPath = await ensureJavaRuntimeInDirectory(minecraftDirectory, requestedJavaPath);
    } catch (error) {
      return { ok: false, error: `Java runtime preparation failed: ${String(error?.message || error)}` };
    }

    let version;
    try {
      version = await resolveLaunchVersionId(minecraftDirectory, requestedVersion);
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }

    const isCustomFabricVersion = isFixedFabricVersionId(version);
    const launchVersionNumber = isCustomFabricVersion ? FIXED_MINECRAFT_VERSION : version;
    const launchVersionConfig = isCustomFabricVersion
      ? { number: launchVersionNumber, type: versionType, custom: version }
      : { number: launchVersionNumber, type: versionType };

    let authorization;
    let launchName = username || "Player";

    if (isMicrosoftLoggingIn) {
      return { ok: false, error: "Microsoft login is still in progress." };
    }

    try {
      sendLog({ level: "info", message: "Validating Microsoft session..." });
      authorization = await refreshMicrosoftAuthorization(true);
      launchName = asTrimmedText(authorization.name) || launchName;
    } catch (error) {
      const message = formatMicrosoftAuthError(error);
      sendLog({ level: "error", message: `Microsoft auth error: ${message}` });
      return {
        ok: false,
        code: error?.code || "auth-failed",
        error: error?.code === "auth-session-expired" ? message : `Microsoft auth failed: ${message}`,
        status: getMicrosoftStatus()
      };
    }

    const modpackUpdateCheck = await runModpackUpdateCheckFromPayload({
      launcherPreset,
      minecraftDirectory,
      gameDirectory
    });
    if (!modpackUpdateCheck.ok) {
      sendLog({ level: "error", message: `Modpack update check failed: ${modpackUpdateCheck.error}` });
      return { ok: false, error: `Modpack update check failed: ${modpackUpdateCheck.error}` };
    }
    if (modpackUpdateCheck.pending) {
      sendLog({ level: "warn", message: "Modpack update is required before launch." });
      return {
        ok: false,
        code: "modpack-update-required",
        error: "Modpack update is required before launch.",
        modpackUpdate: modpackUpdateCheck
      };
    }

    const modpackResult = await runModpackSyncFromPayload(
      {
        launcherPreset,
        minecraftDirectory,
        gameDirectory
      },
      { skipIfSessionSynced: false }
    );
    if (!modpackResult.ok) {
      sendLog({ level: "error", message: `Modpack sync failed: ${modpackResult.error}` });
      return { ok: false, error: `Modpack update failed: ${modpackResult.error}` };
    }

    sendLog({
      level: "info",
      message: "Running launch integrity check..."
    });
    let integrityResult;
    try {
      integrityResult = await verifyLaunchIntegrity({
        launcherPreset,
        minecraftDirectory,
        gameDirectory
      });
    } catch (error) {
      const message = `Integrity check failed to run: ${String(error?.message || error)}`;
      sendLog({ level: "error", message });
      return { ok: false, error: message };
    }

    if (!integrityResult.ok) {
      sendLog({
        level: "warn",
        message: `${integrityResult.error} Attempting automatic repair sync...`
      });

      const repairResult = await runModpackSyncFromPayload(
        {
          launcherPreset,
          minecraftDirectory,
          gameDirectory
        },
        { skipIfSessionSynced: false }
      );
      if (!repairResult.ok) {
        sendLog({ level: "error", message: `Integrity repair sync failed: ${repairResult.error}` });
        return { ok: false, error: `Integrity check failed: ${integrityResult.error}` };
      }

      try {
        integrityResult = await verifyLaunchIntegrity({
          launcherPreset,
          minecraftDirectory,
          gameDirectory
        });
      } catch (error) {
        const message = `Integrity re-check failed: ${String(error?.message || error)}`;
        sendLog({ level: "error", message });
        return { ok: false, error: message };
      }

      if (!integrityResult.ok) {
        sendLog({ level: "error", message: integrityResult.error });
        return { ok: false, error: `Integrity check failed: ${integrityResult.error}` };
      }
    }

    sendLog({
      level: "info",
      message: `Integrity check passed (source: ${integrityResult.sourceType}, checked: ${integrityResult.checked}).`
    });

    const launcher = new Client();
    let launchFailureDetail = "";
    const minecraftDownloadState = {
      type: "",
      task: 0,
      total: 0,
      activeFile: "",
      lastActiveFileLogAt: 0
    };
    sendLog({
      level: "info",
      message: `Preparing ${FIXED_MOD_LOADER.toUpperCase()} ${FIXED_MINECRAFT_VERSION} (${version})...`
    });
    sendLog({
      level: "debug",
      message: `Launch version config: number=${launchVersionNumber}${isCustomFabricVersion ? `, custom=${version}` : ""}`
    });
    sendLog({
      level: "info",
      message: `Using Java: ${resolvedJavaPath || "auto-detect/runtime-managed"}`
    });
    sendLog({
      level: "info",
      message: `Using memory: Xms ${ramMin}M, Xmx ${ramMax}M`
    });
    sendLog({
      level: "debug",
      message: customJvmArgs.length > 0 ? `Custom JVM args: ${customJvmArgs.join(" ")}` : "Custom JVM args: (none)"
    });
    sendLog({
      level: "info",
      message: fullscreen ? "Window mode: fullscreen" : `Window mode: ${gameWidth}x${gameHeight}`
    });

    launcher.on("debug", (line) => {
      const message = String(line || "").trim();
      if (message) {
        if (/couldn'?t start minecraft due to|failed to start due to/i.test(message)) {
          launchFailureDetail = message.replace(/^\[MCLC\]:\s*/i, "");
        }
        sendLog({ level: "debug", message });
      }
    });
    launcher.on("data", (line) => sendLog({ level: "game", message: String(line).trim() }));
    launcher.on("progress", (event) => {
      const type = asTrimmedText(event?.type);
      if (type) {
        minecraftDownloadState.type = type;
      }
      minecraftDownloadState.task = asNonNegativeInteger(event?.task, minecraftDownloadState.task);
      minecraftDownloadState.total = asNonNegativeInteger(event?.total, minecraftDownloadState.total);

      const now = Date.now();
      const hasActiveFileMessage = Boolean(minecraftDownloadState.activeFile);
      const detailedFileMessageRecentlyShown = now - minecraftDownloadState.lastActiveFileLogAt < 800;
      if (hasActiveFileMessage || detailedFileMessageRecentlyShown) {
        return;
      }

      const progress = computeDisplayProgress(
        minecraftDownloadState.task,
        minecraftDownloadState.total,
        Boolean(minecraftDownloadState.activeFile)
      );
      const label = getMinecraftProgressLabel(minecraftDownloadState.type);
      if (progress.total > 0) {
        sendLog({
          level: "progress",
          message: `${label} (${progress.current}/${progress.total})`
        });
        return;
      }

      sendLog({
        level: "progress",
        message: label
      });
    });
    launcher.on("download-status", (event) => {
      const fileName = asTrimmedText(event?.name);
      if (!fileName) {
        return;
      }

      const now = Date.now();
      const sameFile = minecraftDownloadState.activeFile === fileName;
      if (sameFile && now - minecraftDownloadState.lastActiveFileLogAt < 350) {
        return;
      }

      minecraftDownloadState.activeFile = fileName;
      minecraftDownloadState.lastActiveFileLogAt = now;

      const progress = computeDisplayProgress(
        minecraftDownloadState.task,
        minecraftDownloadState.total,
        true
      );
      const progressSuffix = progress.total > 0 ? ` (${progress.current}/${progress.total})` : "";
      sendLog({
        level: "progress",
        message: `Downloading: ${fileName}${progressSuffix}`
      });
    });
    launcher.on("download", () => {
      minecraftDownloadState.activeFile = "";
    });
    launcher.on("close", (code) => {
      isLaunching = false;
      sendState(false);
      sendLog({ level: "info", message: `Minecraft closed (code: ${String(code)}).` });
    });
    launcher.on("error", (error) => {
      isLaunching = false;
      sendState(false);
      sendLog({ level: "error", message: String(error?.message || error) });
    });

    try {
      const autoConnectTarget = autoConnectEnabled ? buildAutoConnectTarget() : { ok: false, reason: "disabled" };
      if (autoConnectTarget.ok) {
        sendLog({
          level: "info",
          message: `Auto-connect target: ${autoConnectTarget.identifier}`
        });
      } else if (autoConnectEnabled) {
        sendLog({
          level: "warn",
          message: `Auto-connect disabled: ${autoConnectTarget.reason || "invalid server target"}`
        });
      }

      const launchProcess = await launcher.launch({
        authorization,
        root: minecraftDirectory,
        version: launchVersionConfig,
        ...(autoConnectTarget.ok
          ? {
              quickPlay: {
                type: "multiplayer",
                identifier: autoConnectTarget.identifier
              }
            }
          : {}),
        ...(customJvmArgs.length > 0 ? { customArgs: customJvmArgs } : {}),
        memory: {
          min: `${ramMin}M`,
          max: `${ramMax}M`
        },
        window: {
          width: gameWidth,
          height: gameHeight,
          fullscreen
        },
        javaPath: resolvedJavaPath || undefined,
        overrides: {
          detached: false,
          ...(gameDirectory ? { gameDirectory } : {})
        }
      });

      if (!launchProcess) {
        const message =
          launchFailureDetail ||
          "Minecraft launch returned no process. Check Java path/runtime and launcher logs.";
        isLaunching = false;
        sendState(false);
        sendLog({ level: "error", message });
        return { ok: false, error: message };
      }

      const launchPid = Number(launchProcess?.pid);
      if (!Number.isFinite(launchPid) || launchPid <= 0) {
        const message = launchFailureDetail
          ? `Minecraft process was not created (no PID). ${launchFailureDetail}`
          : "Minecraft process was not created (no PID). Check Java/runtime configuration.";
        isLaunching = false;
        sendState(false);
        sendLog({ level: "error", message });
        return { ok: false, error: message };
      }

      isLaunching = true;
      sendState(true);
      const pidSuffix = Number.isFinite(launchPid) && launchPid > 0 ? ` (PID ${launchPid})` : "";
      sendLog({
        level: "info",
        message: `Minecraft process started${pidSuffix}${launchName ? ` for ${launchName}` : ""}.`
      });
      return {
        ok: true,
        pid: launchPid,
        javaPath: resolvedJavaPath
      };
    } catch (error) {
      isLaunching = false;
      sendState(false);
      const message = String(error?.message || error);
      sendLog({ level: "error", message });
      return { ok: false, error: message };
    }
  } finally {
    isLaunchRequestInProgress = false;
  }
});

app.whenReady().then(() => {
  migrateLegacyUserDataIfNeeded();
  migrateLegacyStateLayoutIfNeeded();

  if (process.platform === "darwin" && app.dock && fs.existsSync(APP_ICON_PATH)) {
    app.dock.setIcon(APP_ICON_PATH);
  }

  loadCachedMicrosoftAccount();
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (updaterPeriodicTimer) {
    clearInterval(updaterPeriodicTimer);
    updaterPeriodicTimer = null;
  }
});
