const WINDOW_MAX_ICON = "\u25A1";
const WINDOW_RESTORE_ICON = "\u2750";
const STARTUP_MIN_DURATION_MS = 1200;
const STARTUP_FADE_DURATION_MS = 420;
const STARTUP_SETTINGS_PROGRESS = 8;
const STARTUP_RUNTIME_PROGRESS_START = 24;
const STARTUP_RUNTIME_JAVA_DOWNLOAD_PROGRESS = 32;
const STARTUP_RUNTIME_JAVA_EXTRACT_PROGRESS = 38;
const STARTUP_RUNTIME_PROGRESS_DONE = 44;
const STARTUP_MODPACK_PROGRESS_START = 52;
const STARTUP_MODPACK_PROGRESS_DONE = 88;
const STARTUP_FINALIZING_PROGRESS = 96;
const STARTUP_COMPLETE_PROGRESS = 100;
const LAUNCH_LOG_CAPTURE_MS = 45000;
const LAUNCH_START_TIMEOUT_MS = 20000;
const PLAYER_COUNT_REFRESH_MS = 15000;
const MODPACK_UPDATE_REFRESH_MS = 60000;
const NEWS_REFRESH_DEFAULT_MS = 15000;
const NEWS_REFRESH_MIN_MS = 5000;
const NEWS_REFRESH_MAX_MS = 30 * 60 * 1000;
const GITHUB_RELEASE_NOTES_MAX_ITEMS = 8;
const JAVA_RAM_MIN_MB = 6144;
const JAVA_RAM_STEP_MB = 512;
const JAVA_PATH_AUTO_SELECT_PLACEHOLDERS = new Set(["java", "java.exe", "javaw", "javaw.exe"]);
const LEGACY_SETTINGS_STORAGE_KEY = "bettermon.launcher.settings.v1";
const NEWS_PANEL_EXPANDED_STORAGE_KEY = "bettermon.launcher.news.expanded.v1";
const LOGIN_WAITING_ENTER_DELAY_MS = 220;
const LOGIN_GATE_ENTER_DELAY_MS = 180;
const MODPACK_PROGRESS_PATTERN = /\[Modpack\s+(\d+)\s*\/\s*(\d+)\]\s*(.*)/i;
const DEFAULT_JVM_ARGS = "-XX:+UseZGC";

const DEFAULT_SETTINGS = {
  gameWidth: 1280,
  gameHeight: 720,
  fullscreen: false,
  launchDetached: false,
  minecraftDirectory: "",
  selectedProfile: "",
  javaPath: "",
  jvmArgs: DEFAULT_JVM_ARGS,
  ramMin: JAVA_RAM_MIN_MB,
  ramMax: JAVA_RAM_MIN_MB,
  dataDirectory: "",
};

const loginScreen = document.getElementById("loginScreen");
const launchScreen = document.getElementById("launchScreen");
const settingsScreen = document.getElementById("settingsScreen");
const loginGate = document.getElementById("loginGate");
const loginWaitingState = document.getElementById("loginWaitingState");
const mainLayout = document.getElementById("mainLayout");
const gateMicrosoftLoginButton = document.getElementById("gateMicrosoftLogin");
const gateAuthStatus = document.getElementById("gateAuthStatus");
const windowMinimizeButton = document.getElementById("windowMinimize");
const windowMaximizeButton = document.getElementById("windowMaximize");
const windowCloseButton = document.getElementById("windowClose");
const startupOverlay = document.getElementById("startupOverlay");
const startupStatus = document.getElementById("startupStatus");
const startupProgressTrack = document.getElementById("startupProgressTrack");
const startupProgressBar = document.getElementById("startupProgressBar");
const startupProgressText = document.getElementById("startupProgressText");
const accountModelPanel = document.getElementById("accountModelPanel");
const accountModelImage = document.getElementById("accountModelImage");
const accountModelName = document.getElementById("accountModelName");
const newsPanel = document.getElementById("newsPanel");
const newsList = document.getElementById("newsList");
const newsPanelBadge = document.getElementById("newsPanelBadge");
const newsPanelExpandButton = document.getElementById("newsPanelExpandButton");
const playerCountPanel = document.getElementById("playerCountPanel");
const playerCountValue = document.getElementById("playerCountValue");
const playerCountTooltip = document.getElementById("playerCountTooltip");
const discordButton = document.getElementById("discordButton");
const settingsButton = document.getElementById("settingsButton");
const startLaunchButton = document.getElementById("startLaunchButton");
const externalMedia = document.getElementById("externalMedia");
let activeModpack = null;
let activeProjectId = "";
let isLauncherInitialized = false;
let authSessionRevision = 0;
let isModpackPreparing = false;
let hasActiveModpack = false;
const launchStatus = document.getElementById("launchStatus");
const settingsCloseButton = document.getElementById("settingsCloseButton");
const settingsDoneButton = document.getElementById("settingsDoneButton");
const settingsStatus = document.getElementById("settingsStatus");
const settingsMicrosoftAddButton = document.getElementById("settingsMicrosoftAdd");
const settingsAccountList = document.getElementById("settingsAccountList");
const settingsGameWidthInput = document.getElementById("settingsGameWidth");
const settingsGameHeightInput = document.getElementById("settingsGameHeight");
const settingsFullscreenInput = document.getElementById("settingsFullscreen");
const settingsLaunchDetachedInput = document.getElementById("settingsLaunchDetached");
const settingsMinecraftDirectoryInput = document.getElementById("settingsMinecraftDirectory");
const settingsPickMinecraftDirectoryButton = document.getElementById("settingsPickMinecraftDirectory");
const settingsProfileSelect = document.getElementById("settingsProfileSelect");
const settingsJavaPathInput = document.getElementById("settingsJavaPath");
const settingsAutoJavaPathButton = document.getElementById("settingsAutoJavaPath");
const settingsPickJavaPathButton = document.getElementById("settingsPickJavaPath");
const settingsRamMinInput = document.getElementById("settingsRamMin");
const settingsRamMaxInput = document.getElementById("settingsRamMax");
const settingsRamMinDisplay = document.getElementById("settingsRamMinDisplay");
const settingsRamMaxDisplay = document.getElementById("settingsRamMaxDisplay");
const settingsJavaTotalMemory = document.getElementById("settingsJavaTotalMemory");
const settingsJavaUsableMemory = document.getElementById("settingsJavaUsableMemory");
const settingsJavaPathStatus = document.getElementById("settingsJavaPathStatus");
const settingsJvmArgsInput = document.getElementById("settingsJvmArgs");
const settingsDataDirectoryInput = document.getElementById("settingsDataDirectory");
const settingsUpdateSummary = document.getElementById("settingsUpdateSummary");
const settingsUpdateIndicator = document.getElementById("settingsUpdateIndicator");
const settingsUpdateChannel = document.getElementById("settingsUpdateChannel");
const settingsUpdateVersion = document.getElementById("settingsUpdateVersion");
const settingsUpdateActionButton = document.getElementById("settingsUpdateAction");
const settingsAboutChannel = document.getElementById("settingsAboutChannel");
const settingsAboutVersion = document.getElementById("settingsAboutVersion");
const settingsAboutReleaseDate = document.getElementById("settingsAboutReleaseDate");
const settingsAboutReleaseTitle = document.getElementById("settingsAboutReleaseTitle");
const settingsAboutNewsList = document.getElementById("settingsAboutNewsList");
const settingsNavItems = Array.from(document.querySelectorAll(".settings-nav-item[data-settings-tab]"));
const settingsTabs = Array.from(document.querySelectorAll(".settings-tab"));

const SCREEN_ELEMENTS = {
  login: loginScreen,
  launch: launchScreen,
  settings: settingsScreen
};

const SETTINGS_TEXT_INPUTS = {
  gameWidth: settingsGameWidthInput,
  gameHeight: settingsGameHeightInput,
  minecraftDirectory: settingsMinecraftDirectoryInput,
  javaPath: settingsJavaPathInput,
  jvmArgs: settingsJvmArgsInput,
  ramMin: settingsRamMinInput,
  ramMax: settingsRamMaxInput,
  dataDirectory: settingsDataDirectoryInput
};

const SETTINGS_BOOLEAN_INPUTS = {
  fullscreen: settingsFullscreenInput,
  launchDetached: settingsLaunchDetachedInput
};

const startupStartedAt = Date.now();
let authState = {
  signedIn: false,
  profileName: "",
  uuid: "",
  accounts: [],
  loggingIn: false
};
let launcherDefaults = { ...DEFAULT_SETTINGS };
let launcherSettings = { ...DEFAULT_SETTINGS };
let selectedSettingsTab = "settingsTabAccount";
let currentScreen = "login";
let loginRequestedByUser = false;
let loginWaitingEnterTimer = null;
let loginGateEnterTimer = null;
let loadedProfiles = [];
let isLaunchRequestPending = false;
let isLauncherRunning = false;
let detectedSystemProfile = null;
let isStartupModpackSyncRunning = false;
let isModpackUpdateApplyRunning = false;
let modpackUpdateState = null;
let isLauncherUpdateGateRunning = false;
let isLauncherUpdateInstallRunning = false;
let startupProgressPercent = 0;
let startupOverlayDismissed = false;
let launchLogCaptureUntil = 0;
let launchStartTimeoutId = null;
let newsRefreshMs = NEWS_REFRESH_DEFAULT_MS;
let newsPollTimer = null;
let isNewsRequestPending = false;
let currentNewsItems = [];
let lastRenderedNewsSignature = "";
let isNewsPanelExpanded = false;
let playerCountPollTimer = null;
let isPlayerCountRequestPending = false;
let modpackUpdatePollTimer = null;
let isModpackUpdateCheckRunning = false;
let updaterSnapshot = null;
let githubReleaseSnapshot = null;
let isGitHubReleaseRequestPending = false;
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isElementVisible(key) {
  return currentScreen === key;
}

function setAriaHidden(element, hidden) {
  if (!element) {
    return;
  }
  element.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function setActiveState(element, active) {
  if (!element) {
    return;
  }
  element.classList.toggle("is-active", active);
  setAriaHidden(element, !active);
}

function bindClick(element, handler) {
  if (!element) {
    return;
  }
  element.addEventListener("click", handler);
}

function readStoredNewsPanelExpanded() {
  try {
    return localStorage.getItem(NEWS_PANEL_EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredNewsPanelExpanded(expanded) {
  try {
    if (expanded) {
      localStorage.setItem(NEWS_PANEL_EXPANDED_STORAGE_KEY, "1");
    } else {
      localStorage.removeItem(NEWS_PANEL_EXPANDED_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

function applyNewsPanelExpandedState(expanded, persist = true) {
  isNewsPanelExpanded = Boolean(expanded);
  if (newsPanel) {
    newsPanel.classList.toggle("is-expanded", isNewsPanelExpanded);
  }
  if (newsPanelExpandButton) {
    newsPanelExpandButton.setAttribute("aria-expanded", isNewsPanelExpanded ? "true" : "false");
    newsPanelExpandButton.setAttribute("aria-label", isNewsPanelExpanded ? "뉴스 패널 줄이기" : "뉴스 패널 늘리기");
    newsPanelExpandButton.textContent = isNewsPanelExpanded ? "줄이기" : "늘리기";
  }
  if (persist) {
    writeStoredNewsPanelExpanded(isNewsPanelExpanded);
  }
}

function switchScreen(targetScreen) {
  const next = targetScreen in SCREEN_ELEMENTS ? targetScreen : "login";
  currentScreen = next;
  if (document.body) {
    document.body.setAttribute("data-screen", next);
  }

  for (const [screenKey, screenElement] of Object.entries(SCREEN_ELEMENTS)) {
    if (!screenElement) {
      continue;
    }

    const isActive = screenKey === next;
    screenElement.hidden = !isActive;
    screenElement.inert = !isActive;
    screenElement.classList.toggle("screen-active", isActive);
    setAriaHidden(screenElement, !isActive);
  }

  updateLoginWaitingState();
}

function isLoginFlowActive() {
  return loginRequestedByUser && authState.loggingIn && !authState.signedIn;
}

function clearLoginTransitionTimers() {
  if (loginWaitingEnterTimer !== null) {
    window.clearTimeout(loginWaitingEnterTimer);
    loginWaitingEnterTimer = null;
  }

  if (loginGateEnterTimer !== null) {
    window.clearTimeout(loginGateEnterTimer);
    loginGateEnterTimer = null;
  }
}

function updateLoginWaitingState() {
  if (!loginGate || !loginWaitingState) {
    return;
  }

  const showWaiting = isLoginFlowActive() && isElementVisible("login");
  const waitingWasVisible = loginWaitingState.classList.contains("is-active");
  clearLoginTransitionTimers();

  if (showWaiting) {
    setActiveState(loginGate, false);
    setActiveState(loginWaitingState, false);

    loginWaitingEnterTimer = window.setTimeout(() => {
      loginWaitingEnterTimer = null;
      if (!isLoginFlowActive() || !isElementVisible("login")) {
        return;
      }

      setActiveState(loginWaitingState, true);
    }, LOGIN_WAITING_ENTER_DELAY_MS);
    return;
  }

  setActiveState(loginWaitingState, false);

  if (waitingWasVisible && isElementVisible("login")) {
    setActiveState(loginGate, false);

    loginGateEnterTimer = window.setTimeout(() => {
      loginGateEnterTimer = null;
      if (isLoginFlowActive() || !isElementVisible("login")) {
        return;
      }

      setActiveState(loginGate, true);
    }, LOGIN_GATE_ENTER_DELAY_MS);
    return;
  }

  setActiveState(loginGate, true);
}

function asText(value, fallback = "") {
  if (typeof value === "string") {
    return value.trim();
  }
  return fallback;
}

function normalizeMinecraftUuid(value) {
  const normalized = asText(value).replace(/-/g, "").toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    return "";
  }
  return normalized;
}

const DEFAULT_SKIN_IMAGE = "./assets/default-skin.svg";
const SKIN_CACHE_MS = 5 * 60 * 1000;
const renderedSkinCache = new Map();
const renderedSkinRequests = new Map();
const skinImageStates = new WeakMap();

async function getRenderedAccountSkin(uuid) {
  const saved = renderedSkinCache.get(uuid);
  if (saved && saved.expiresAt > Date.now()) return saved.image;
  if (renderedSkinRequests.has(uuid)) return renderedSkinRequests.get(uuid);
  const request = (async () => {
    let timer;
    try {
      const result = await Promise.race([
        window.launcherApi.getAccountSkin(uuid),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Skin request timed out.")), 12000); })
      ]);
      if (!result?.ok || normalizeMinecraftUuid(result.uuid) !== uuid) throw new Error("Skin is unavailable.");
      const image = result.textureDataUrl ? await window.minecraftSkinModel.render(result.textureDataUrl, result.model) : DEFAULT_SKIN_IMAGE;
      renderedSkinCache.delete(uuid);
      renderedSkinCache.set(uuid, { image, expiresAt: Date.now() + SKIN_CACHE_MS });
      if (renderedSkinCache.size > 32) renderedSkinCache.delete(renderedSkinCache.keys().next().value);
      return image;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => renderedSkinRequests.delete(uuid));
  renderedSkinRequests.set(uuid, request);
  return request;
}

function resetMinecraftModelImage(imageElement) {
  if (!imageElement) return;
  const state = skinImageStates.get(imageElement);
  if (state?.retryTimer) clearTimeout(state.retryTimer);
  skinImageStates.delete(imageElement);
  imageElement.onerror = null;
  imageElement.src = DEFAULT_SKIN_IMAGE;
  imageElement.dataset.skinState = "default";
}

function updateAccountModelUi() {
  if (!accountModelPanel) return;
  accountModelPanel.hidden = !authState.signedIn;
  if (!authState.signedIn) {
    resetMinecraftModelImage(accountModelImage);
    if (accountModelName) accountModelName.textContent = "로그인 안 됨";
    return;
  }
  const displayName = asText(authState.profileName, "플레이어");
  if (accountModelName) accountModelName.textContent = displayName;
  void loadMinecraftModelImage(accountModelImage, authState.uuid, displayName);
}

async function loadMinecraftModelImage(imageElement, uuidValue, profileNameValue) {
  if (!imageElement) return;
  const uuid = normalizeMinecraftUuid(uuidValue);
  const displayName = asText(profileNameValue, "플레이어");
  imageElement.alt = displayName + " 스킨";
  const previous = skinImageStates.get(imageElement);
  if (previous?.uuid === uuid && (previous.loading || previous.loadedAt > Date.now() - SKIN_CACHE_MS)) return;
  resetMinecraftModelImage(imageElement);
  if (!uuid) return;
  const state = { uuid, loading: true, loadedAt: 0, retryTimer: null };
  skinImageStates.set(imageElement, state);
  imageElement.dataset.skinState = "loading";
  imageElement.title = "스킨 불러오는 중...";
  const isCurrent = () => imageElement.isConnected && skinImageStates.get(imageElement) === state;
  try {
    const image = await getRenderedAccountSkin(uuid);
    if (!isCurrent()) return;
    state.loadedAt = Date.now();
    imageElement.src = image;
    imageElement.dataset.skinState = image === DEFAULT_SKIN_IMAGE ? "default" : "ready";
    imageElement.title = displayName + " 스킨";
  } catch {
    if (!isCurrent()) return;
    imageElement.dataset.skinState = "retry";
    imageElement.title = "스킨을 불러오지 못했습니다. 잠시 후 다시 시도합니다.";
    state.retryTimer = setTimeout(() => {
      if (isCurrent()) void loadMinecraftModelImage(imageElement, uuid, displayName);
    }, 30000);
  } finally {
    state.loading = false;
  }
}

function clampNewsRefreshMs(value, fallback = NEWS_REFRESH_DEFAULT_MS) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(NEWS_REFRESH_MIN_MS, Math.min(NEWS_REFRESH_MAX_MS, parsed));
}

function normalizeNewsTextValue(value) {
  if (Array.isArray(value)) {
    return value.map((line) => asText(line)).filter(Boolean).join("\n");
  }
  return asText(value);
}

function normalizeNewsItem(rawItem) {
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

  const text = normalizeNewsTextValue(rawItem.text);
  if (!text) {
    return null;
  }
  return {
    type: asText(rawItem.type, "\uC548\uB0B4") || "\uC548\uB0B4",
    date: asText(rawItem.date),
    text
  };
}

function formatReleaseDateLabel(value) {
  const raw = asText(value);
  if (!raw) {
    return "-";
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(parsed);
  } catch {
    return raw;
  }
}

function formatReleaseVersionLabel(value) {
  const normalized = asText(value);
  if (!normalized || normalized === "-") {
    return "v-";
  }
  return normalized.toLowerCase().startsWith("v") ? normalized : `v${normalized}`;
}

function normalizeGitHubTagToVersion(tagName) {
  const tag = asText(tagName);
  if (!tag) {
    return "";
  }
  return tag.toLowerCase().startsWith("v") ? tag.slice(1) : tag;
}

function getGitHubReleaseHeadline(snapshot) {
  const releaseName = asText(snapshot?.name);
  if (releaseName) {
    return releaseName;
  }
  if (snapshot?.prerelease) {
    return "GitHub Pre-release";
  }
  return "GitHub Release";
}

function getGitHubRepositoryLabel(snapshot) {
  const owner = asText(snapshot?.owner);
  const repo = asText(snapshot?.repo);
  if (!owner || !repo) {
    return "";
  }
  return `${owner}/${repo}`;
}

function isGitHubReleaseConfigured(snapshot) {
  return Boolean(snapshot && typeof snapshot === "object" && snapshot.configured);
}

function parseGitHubReleaseNotes(bodyText, publishedAt = "") {
  const body = String(bodyText || "").replace(/\r/g, "");
  if (!body) {
    return [];
  }

  const notes = [];
  const lines = body.split("\n");
  const formattedNoteDate = formatReleaseDateLabel(publishedAt);
  const noteDate = formattedNoteDate === "-" ? "" : formattedNoteDate;

  for (const rawLine of lines) {
    const line = asText(rawLine);
    if (!line) {
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      continue;
    }

    const text = line.replace(/^[-*]\s+/, "");
    if (!text || /^[-=_]{3,}$/.test(text)) {
      continue;
    }

    notes.push({
      type: "GitHub",
      date: noteDate,
      text
    });

    if (notes.length >= GITHUB_RELEASE_NOTES_MAX_ITEMS) {
      break;
    }
  }

  return notes;
}

function getAboutReleaseNoteItems() {
  if (isGitHubReleaseConfigured(githubReleaseSnapshot)) {
    if (githubReleaseSnapshot?.ok) {
      return parseGitHubReleaseNotes(githubReleaseSnapshot.body, githubReleaseSnapshot.publishedAt);
    }
    return currentNewsItems;
  }
  return currentNewsItems;
}

function updateSettingsAboutReleaseUi() {
  if (!settingsAboutChannel || !settingsAboutVersion || !settingsAboutReleaseDate || !settingsAboutReleaseTitle) {
    return;
  }

  const updater = updaterSnapshot || {};
  const githubSnapshot = githubReleaseSnapshot && typeof githubReleaseSnapshot === "object" ? githubReleaseSnapshot : null;
  const github = githubSnapshot && githubSnapshot.ok ? githubSnapshot : null;
  const githubConfigured = isGitHubReleaseConfigured(githubSnapshot);
  const githubRepositoryLabel = getGitHubRepositoryLabel(githubSnapshot);
  const githubVersion = normalizeGitHubTagToVersion(github?.tagName);
  const releaseName = github
    ? getGitHubReleaseHeadline(github)
    : githubRepositoryLabel
      ? `GitHub ${githubRepositoryLabel}`
      : githubConfigured
        ? "GitHub Release"
        : asText(updater.releaseName) || "Stable Release";
  const releaseVersion = github
    ? githubVersion || asText(updater.latestVersion) || asText(updater.currentVersion) || "-"
    : asText(updater.latestVersion) || asText(updater.currentVersion) || "-";
  const releaseVersionLabel = formatReleaseVersionLabel(releaseVersion);
  const releaseDateLabel = formatReleaseDateLabel(github ? asText(github.publishedAt) : asText(updater.releaseDate));

  settingsAboutChannel.textContent = releaseName;
  settingsAboutVersion.textContent = `Version ${releaseVersion}`;
  settingsAboutReleaseDate.textContent = releaseDateLabel === "-" ? "Updated -" : `Updated ${releaseDateLabel}`;
  settingsAboutReleaseTitle.textContent = `Release ${releaseVersionLabel}`;
}

function buildSettingsAboutNewsItemElement(item) {
  const element = document.createElement("li");
  element.className = "settings-about-news-item";

  const headElement = document.createElement("div");
  headElement.className = "settings-about-news-head";

  const typeElement = document.createElement("span");
  typeElement.className = "settings-about-news-type";
  typeElement.textContent = asText(item?.type, "\uC548\uB0B4") || "\uC548\uB0B4";

  const dateElement = document.createElement("span");
  dateElement.className = "settings-about-news-date";
  dateElement.textContent = asText(item?.date);

  const textElement = document.createElement("p");
  textElement.className = "settings-about-news-text";
  textElement.textContent = asText(item?.text);

  headElement.appendChild(typeElement);
  headElement.appendChild(dateElement);
  element.appendChild(headElement);
  element.appendChild(textElement);
  return element;
}

function renderSettingsAboutNewsItems(items = null) {
  if (!settingsAboutNewsList) {
    return;
  }

  settingsAboutNewsList.innerHTML = "";
  const githubConfigured = isGitHubReleaseConfigured(githubReleaseSnapshot);
  const preferredItems = Array.isArray(items) ? items : getAboutReleaseNoteItems();
  const normalizedItems = preferredItems
    .map((item) => normalizeNewsItem(item))
    .filter(Boolean)
    .slice(0, GITHUB_RELEASE_NOTES_MAX_ITEMS);

  if (normalizedItems.length === 0) {
    const emptyElement = document.createElement("li");
    emptyElement.className = "settings-about-news-empty";
    emptyElement.textContent = githubConfigured
      ? "표시할 GitHub 릴리즈 노트가 없습니다."
      : "\uD45C\uC2DC\uD560 \uB9B4\uB9AC\uC988 \uB178\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
    settingsAboutNewsList.appendChild(emptyElement);
    return;
  }

  for (const item of normalizedItems) {
    settingsAboutNewsList.appendChild(buildSettingsAboutNewsItemElement(item));
  }
}

function applyGitHubReleaseUi(snapshot) {
  githubReleaseSnapshot = snapshot && typeof snapshot === "object" ? { ...snapshot } : null;
  updateSettingsAboutReleaseUi();
  renderSettingsAboutNewsItems();
  updateUpdaterUi(updaterSnapshot);
}

async function refreshGitHubReleaseInfo(options = {}) {
  if (!window.launcherApi || typeof window.launcherApi.getGitHubRelease !== "function") {
    return false;
  }
  const forceRefresh = Boolean(options?.forceRefresh);
  const allowFallback = Boolean(options?.allowFallback);
  if (isGitHubReleaseRequestPending && !forceRefresh) {
    return true;
  }

  isGitHubReleaseRequestPending = true;
  try {
    const snapshot = await window.launcherApi.getGitHubRelease({ forceRefresh });
    applyGitHubReleaseUi(snapshot);
    return allowFallback || !snapshot || snapshot.ok !== false;
  } catch (error) {
    if (!githubReleaseSnapshot) {
      applyGitHubReleaseUi({
        ok: false,
        configured: false,
        error: asText(error?.message) || "Failed to load GitHub release."
      });
    }
    return allowFallback;
  } finally {
    isGitHubReleaseRequestPending = false;
  }
}

function readNewsItemsFromDom() {
  if (!newsList) {
    return [];
  }

  const items = [];
  const itemElements = Array.from(newsList.querySelectorAll(".news-item"));
  for (const itemElement of itemElements) {
    const normalized = normalizeNewsItem({
      type: itemElement.querySelector(".news-item-type")?.textContent || "",
      date: itemElement.querySelector(".news-item-date")?.textContent || "",
      text: itemElement.querySelector(".news-item-text")?.textContent || ""
    });
    if (normalized) {
      items.push(normalized);
    }
  }
  return items;
}

function setNewsBadgeText(text) {
  if (!newsPanelBadge) {
    return;
  }
  const nextText = asText(text) || "\uC0C8\uC18C\uC2DD";
  if (newsPanelBadge.textContent === nextText) {
    return;
  }
  newsPanelBadge.textContent = nextText;
}

function normalizeNewsItems(items) {
  return Array.isArray(items) ? items.map((item) => normalizeNewsItem(item)).filter(Boolean) : [];
}

function buildNewsItemsSignature(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "empty";
  }

  return items
    .map((item) => `${asText(item?.type)}\u001f${asText(item?.date)}\u001f${asText(item?.text)}`)
    .join("\u001e");
}

function buildNewsItemElement(item) {
  const element = document.createElement("li");
  element.className = "news-item";

  const typeElement = document.createElement("span");
  typeElement.className = "news-item-type";
  typeElement.textContent = asText(item?.type, "\uC548\uB0B4") || "\uC548\uB0B4";

  const dateElement = document.createElement("span");
  dateElement.className = "news-item-date";
  dateElement.textContent = asText(item?.date);

  const textElement = document.createElement("p");
  textElement.className = "news-item-text";
  textElement.textContent = asText(item?.text);

  element.appendChild(typeElement);
  element.appendChild(dateElement);
  element.appendChild(textElement);
  return element;
}

function renderNewsItems(items, force = false) {
  if (!newsList) {
    return false;
  }

  const normalizedItems = normalizeNewsItems(items);
  const nextSignature = buildNewsItemsSignature(normalizedItems);
  if (!force && nextSignature === lastRenderedNewsSignature) {
    return false;
  }

  lastRenderedNewsSignature = nextSignature;
  newsList.innerHTML = "";
  if (normalizedItems.length === 0) {
    newsList.appendChild(
      buildNewsItemElement({
        type: "\uC548\uB0B4",
        date: "",
        text: "\uD45C\uC2DC\uD560 \uC0C8 \uC18C\uC2DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
      })
    );
    return true;
  }

  for (const item of normalizedItems) {
    newsList.appendChild(buildNewsItemElement(item));
  }
  return true;
}

function applyLauncherNewsUi(snapshot, options = {}) {
  if (!newsList) {
    return;
  }

  if (!snapshot || snapshot.ok === false) {
    setNewsBadgeText("\uC624\uD504\uB77C\uC778");
    renderSettingsAboutNewsItems();
    return;
  }

  const incomingItems = Array.isArray(snapshot.items) ? snapshot.items : [];
  currentNewsItems = normalizeNewsItems(incomingItems);
  const didRenderNews = renderNewsItems(currentNewsItems, Boolean(options?.forceRender));
  if (didRenderNews) {
    renderSettingsAboutNewsItems();
  }
  setNewsBadgeText(snapshot?.hasSource ? "\uC2E4\uC2DC\uAC04" : "\uC0C8\uC18C\uC2DD");
}

function restartNewsPollingTimer() {
  if (newsPollTimer !== null) {
    window.clearInterval(newsPollTimer);
  }
  newsPollTimer = window.setInterval(() => {
    void refreshLauncherNews();
  }, newsRefreshMs);
}

async function refreshLauncherNews(options = {}) {
  if (!newsList || !window.launcherApi || typeof window.launcherApi.getNews !== "function") {
    return false;
  }
  const forceRefresh = Boolean(options?.forceRefresh);
  const forceRender = Boolean(options?.forceRender);
  if (isNewsRequestPending && !forceRefresh) {
    return true;
  }

  isNewsRequestPending = true;
  const requestedProjectId = activeProjectId;
  try {
    const snapshot = await window.launcherApi.getNews({ forceRefresh, projectId: requestedProjectId });
    if (requestedProjectId !== activeProjectId) return false;
    const nextRefreshMs = clampNewsRefreshMs(snapshot?.refreshMs, newsRefreshMs);
    if (nextRefreshMs !== newsRefreshMs) {
      newsRefreshMs = nextRefreshMs;
      if (newsPollTimer !== null) {
        restartNewsPollingTimer();
      }
    }
    applyLauncherNewsUi(snapshot, { forceRender });
    return !snapshot || snapshot.ok !== false;
  } catch {
    if (requestedProjectId !== activeProjectId) return false;
    setNewsBadgeText("\uC624\uD504\uB77C\uC778");
    return false;
  } finally {
    isNewsRequestPending = false;
  }
}

function startNewsPolling() {
  if (!hasActiveModpack || !activeProjectId) return;
  if (!newsList) {
    return;
  }

  currentNewsItems = normalizeNewsItems(readNewsItemsFromDom());
  renderNewsItems(currentNewsItems, true);
  renderSettingsAboutNewsItems();
  if (!window.launcherApi || typeof window.launcherApi.getNews !== "function") {
    setNewsBadgeText("\uC624\uD504\uB77C\uC778");
    return;
  }

  void refreshLauncherNews();
  restartNewsPollingTimer();
}

function stopNewsPolling() {
  if (newsPollTimer === null) {
    return;
  }
  window.clearInterval(newsPollTimer);
  newsPollTimer = null;
}

function setPlayerCountText(text, isError = false) {
  if (!playerCountValue) {
    return;
  }
  playerCountValue.textContent = text;
  playerCountValue.classList.toggle("is-error", isError);
}

function setPlayerCountTooltip(text) {
  const tooltip = asText(text);
  if (playerCountTooltip) {
    playerCountTooltip.textContent = tooltip;
    playerCountTooltip.classList.toggle("is-empty", !tooltip);
  }
  if (playerCountValue) {
    playerCountValue.removeAttribute("title");
  }
  if (playerCountPanel) {
    playerCountPanel.removeAttribute("title");
  }
}

function buildPlayerListTooltip(server) {
  const names = Array.isArray(server?.playerNames)
    ? server.playerNames.map((name) => asText(name)).filter(name => /^[A-Za-z0-9_]{1,16}$/.test(name)).slice(0, 40)
    : [];
  const playersOnline = Number(server?.playersOnline);
  if (names.length === 0) {
    if (Number.isFinite(playersOnline) && playersOnline > 0) {
      return "플레이어 목록은 서버에서 전체 공개하지 않습니다.";
    }
    return "";
  }
  if (Number.isFinite(playersOnline) && playersOnline > names.length) {
    return `${names.join("\n")}\n외 ${playersOnline - names.length}명`;
  }
  return names.join("\n");
}

function applyPlayerCountUi(snapshot) {
  if (!playerCountValue) {
    return;
  }

  if (!snapshot || snapshot.ok === false) {
    setPlayerCountText("\uD655\uC778 \uC2E4\uD328", true);
    setPlayerCountTooltip("");
    return;
  }

  const server = snapshot?.server && typeof snapshot.server === "object" ? snapshot.server : {};
  const playersOnline = Number(server?.playersOnline);
  const playersMax = Number(server?.playersMax);
  const playersTooltip = buildPlayerListTooltip(server);

  if (Number.isFinite(playersOnline) && playersOnline >= 0 && Number.isFinite(playersMax) && playersMax > 0) {
    setPlayerCountText(`${playersOnline}/${playersMax}`, false);
    setPlayerCountTooltip(playersTooltip);
    return;
  }

  if (server.online === true && Number.isFinite(playersOnline) && playersOnline >= 0) {
    setPlayerCountText(`${playersOnline}/?`, false);
    setPlayerCountTooltip(playersTooltip);
    return;
  }

  if (server.online === false) {
    setPlayerCountText("\uC624\uD504\uB77C\uC778", true);
    setPlayerCountTooltip("");
    return;
  }

  if (!snapshot?.hasServerTarget) {
    setPlayerCountText("\uC11C\uBC84 \uBBF8\uC124\uC815", true);
    setPlayerCountTooltip("");
    return;
  }

  setPlayerCountText("\uD655\uC778 \uC911...", false);
  setPlayerCountTooltip("");
}

async function refreshPlayerCount() {
  if (!window.launcherApi || typeof window.launcherApi.getServerStatus !== "function") {
    setPlayerCountText("\uD655\uC778 \uC2E4\uD328", true);
    setPlayerCountTooltip("");
    return false;
  }
  if (isPlayerCountRequestPending) {
    return true;
  }

  isPlayerCountRequestPending = true;
  const requestedProjectId = activeProjectId;
  try {
    const snapshot = await window.launcherApi.getServerStatus({ projectId: requestedProjectId });
    if (requestedProjectId !== activeProjectId) return false;
    applyPlayerCountUi(snapshot);
    return !snapshot || snapshot.ok !== false;
  } catch {
    if (requestedProjectId !== activeProjectId) return false;
    setPlayerCountText("\uD655\uC778 \uC2E4\uD328", true);
    setPlayerCountTooltip("");
    return false;
  } finally {
    isPlayerCountRequestPending = false;
  }
}

function startPlayerCountPolling() {
  if (!hasActiveModpack || !activeProjectId) return;
  if (!playerCountValue) {
    return;
  }

  if (playerCountPollTimer !== null) {
    window.clearInterval(playerCountPollTimer);
  }
  void refreshPlayerCount();
  playerCountPollTimer = window.setInterval(() => {
    void refreshPlayerCount();
  }, PLAYER_COUNT_REFRESH_MS);
}

function stopPlayerCountPolling() {
  if (playerCountPollTimer === null) {
    return;
  }
  window.clearInterval(playerCountPollTimer);
  playerCountPollTimer = null;
}

function canRunBackgroundModpackUpdateCheck() {
  return authState.signedIn && hasActiveModpack && activeModpack?.manifestConfigured && !(
    isModpackPreparing ||
    isStartupModpackSyncRunning ||
    isModpackUpdateApplyRunning ||
    isLaunchRequestPending ||
    isLauncherRunning ||
    isLauncherUpdateGateRunning
  );
}

async function refreshModpackUpdateStatus(options = {}) {
  if (!window.launcherApi || typeof window.launcherApi.checkModpackUpdate !== "function") {
    return false;
  }
  if (isModpackUpdateCheckRunning) {
    return true;
  }

  const sessionRevision = authSessionRevision;
  const silent = Boolean(options?.silent);
  const payload = buildModpackSyncPayload();
  if (!payload.minecraftDirectory) {
    if (!silent) {
      setLaunchStatus("Minecraft 폴더가 설정되지 않아 모드팩 상태를 확인할 수 없습니다.", true);
    }
    return false;
  }

  isModpackUpdateCheckRunning = true;
  updateLaunchButtonUi();
  try {
    const result = await window.launcherApi.checkModpackUpdate(payload);
    if (!authState.signedIn || sessionRevision !== authSessionRevision || payload.projectId !== activeProjectId) return false;
    if (!result?.ok) {
      if (!silent) {
        setLaunchStatus(localizeStatusMessage(result?.error || "Modpack update check failed."), true);
      }
      return false;
    }

    const wasPending = Boolean(modpackUpdateState?.pending);
    modpackUpdateState = result && typeof result === "object" ? { ...result } : null;
    updateLaunchButtonUi();
    if (result.pending) {
      setLaunchStatus("모드팩 업데이트가 있습니다. 업데이트 버튼을 눌러 적용하세요.");
    } else if (wasPending && !silent) {
      setLaunchStatus("모드팩이 최신 상태입니다.");
    }
    return true;
  } finally {
    isModpackUpdateCheckRunning = false;
    updateLaunchButtonUi();
  }
}

async function refreshModpackUpdateStatusInBackground() {
  if (!canRunBackgroundModpackUpdateCheck()) {
    return false;
  }
  return refreshModpackUpdateStatus({ silent: true });
}

function startModpackUpdatePolling() {
  if (!hasActiveModpack || !activeProjectId || !activeModpack?.manifestConfigured) return;
  if (modpackUpdatePollTimer !== null) {
    window.clearInterval(modpackUpdatePollTimer);
  }
  modpackUpdatePollTimer = window.setInterval(() => {
    void refreshModpackUpdateStatusInBackground();
  }, MODPACK_UPDATE_REFRESH_MS);
}

function stopModpackUpdatePolling() {
  if (modpackUpdatePollTimer === null) {
    return;
  }
  window.clearInterval(modpackUpdatePollTimer);
  modpackUpdatePollTimer = null;
}

function parseModpackProgressMessage(message) {
  const text = asText(message);
  if (!text) {
    return null;
  }

  const match = text.match(MODPACK_PROGRESS_PATTERN);
  if (!match) {
    return null;
  }

  const current = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  const rawPath = asText(match[3]).replace(/^[-:\s]+/, "");
  const filePath = rawPath || "\uD30C\uC77C \uACBD\uB85C \uD655\uC778 \uC911";
  const safeCurrent = Math.max(0, Math.min(total, current));
  const ratio = Math.max(0, Math.min(1, safeCurrent / total));

  return {
    current: safeCurrent,
    total,
    ratio,
    filePath
  };
}

function formatModpackProgressStatus(progress) {
  if (!progress) {
    return "";
  }
  return `\uB2E4\uC6B4\uB85C\uB4DC \uC911: ${progress.filePath} (${progress.current}/${progress.total})`;
}

function localizeStatusMessage(message) {
  const text = asText(message);
  if (!text) {
    return "";
  }

  const directMap = {
    "Preparing Fabric runtime...": "\uD328\uBE0C\uB9AD \uB7F0\uD0C0\uC784 \uC900\uBE44 \uC911...",
    "Downloading NeoForge installer...": "NeoForge 설치 파일 다운로드 중...",
    "Installing NeoForge runtime...": "NeoForge 실행 환경 설치 중...",
    "NeoForge runtime already installed.": "NeoForge 실행 환경이 준비되었습니다.",
    "NeoForge runtime installed.": "NeoForge 실행 환경 설치 완료.",
    "NeoForge installation failed. Try again.": "NeoForge를 설치하지 못했습니다. 다시 실행해 주세요.",
    "NeoForge installation timed out. Try again.": "NeoForge 설치 시간이 초과되었습니다. 다시 실행해 주세요.",
    "Could not start the NeoForge installer.": "NeoForge 설치 프로그램을 실행하지 못했습니다. Java 설정을 확인해 주세요.",
    "Checking modpack updates...": "\uBAA8\uB4DC\uD329 \uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uC911...",
    "Modpack is up to date.": "\uBAA8\uB4DC\uD329\uC774 \uCD5C\uC2E0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.",
    "Modpack update completed.": "\uBAA8\uB4DC\uD329 \uC5C5\uB370\uC774\uD2B8\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    "Runtime preparation failed.": "\uB7F0\uD0C0\uC784 \uC900\uBE44\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    "Modpack update failed.": "\uBAA8\uB4DC\uD329 \uC5C5\uB370\uC774\uD2B8\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    "Modpack update check failed.": "\uBAA8\uB4DC\uD329 \uC5C5\uB370\uC774\uD2B8 \uD655\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    "Minecraft launch failed.": "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC2E4\uD589\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
    "Minecraft is running...": "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC2E4\uD589 \uC911...",
    "Minecraft closed.": "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8\uAC00 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.",
    "Starting Minecraft...": "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC2E4\uD589 \uC911...",
    "Launch request accepted. Waiting for Minecraft process...": "\uC2E4\uD589 \uC694\uCCAD \uC644\uB8CC. \uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD504\uB85C\uC138\uC2A4 \uC2DC\uC791 \uB300\uAE30 \uC911...",
    "Validating Microsoft session...": "Microsoft \uC138\uC158 \uAC80\uC99D \uC911...",
    "Opening Microsoft login window...": "Microsoft \uB85C\uADF8\uC778 \uCC3D \uC5EC\uB294 \uC911...",
    "Microsoft session expired. Please sign in again.": "Microsoft \uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.",
    "Downloading Java runtime...": "Java \uB7F0\uD0C0\uC784 \uB2E4\uC6B4\uB85C\uB4DC \uC911...",
    "Extracting Java runtime...": "Java \uB7F0\uD0C0\uC784 \uCD94\uCD9C \uC911...",
    "Using system Java runtime from PATH.": "PATH\uC5D0 \uB4F1\uB85D\uB41C \uC2DC\uC2A4\uD15C Java \uB7F0\uD0C0\uC784 \uC0AC\uC6A9 \uC911.",
    "Fetching Fabric loader metadata...": "\uD328\uBE0C\uB9AD \uB85C\uB354 \uBA54\uD0C0\uB370\uC774\uD130 \uC870\uD68C \uC911...",
    "Analyzing modpack archive contents...": "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C \uB0B4\uC6A9 \uBD84\uC11D \uC911...",
    "Cleaning previous modpack files...": "\uAE30\uC874 \uBAA8\uB4DC\uD329 \uD30C\uC77C \uC815\uB9AC \uC911...",
    "Resetting existing modpack files...": "\uAE30\uC874 \uBAA8\uB4DC\uD329 \uD30C\uC77C\uC744 \uCD08\uAE30\uD654\uD558\uB294 \uC911...",
    "Extracting modpack archive...": "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C \uCD94\uCD9C \uC911...",
    "Modpack distribution is already up to date.": "\uBAA8\uB4DC\uD329 \uBC30\uD3EC \uD30C\uC77C\uC774 \uCD5C\uC2E0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.",
    "Modpack archive is up to date (SHA256 pinned).": "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C\uAC00 \uCD5C\uC2E0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4 (SHA256 \uACE0\uC815).",
    "Modpack archive is already up to date.": "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C\uAC00 \uC774\uBBF8 \uCD5C\uC2E0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.",
    "Local modpack archive is unchanged.": "\uB85C\uCEEC \uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C\uAC00 \uBCC0\uACBD\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.",
    "Modpack source returned 404. Keeping previously applied modpack files.": "\uBAA8\uB4DC\uD329 \uC18C\uC2A4\uAC00 404\uB97C \uBC18\uD658\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC801\uC6A9 \uD30C\uC77C\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4.",
    "Modpack update is required before launch.": "게임 실행 전에 모드팩 업데이트가 필요합니다."
  };
  if (Object.prototype.hasOwnProperty.call(directMap, text)) {
    return directMap[text];
  }

  let localized = text;
  localized = localized.replace(
    /^Downloading:\s*(.+?)\s*\((\d+)\s*\/\s*(\d+)\)\s*$/i,
    "\uB2E4\uC6B4\uB85C\uB4DC \uC911: $1 ($2/$3)"
  );
  localized = localized.replace(
    /^Downloading:\s*(.+?)\s*$/i,
    "\uB2E4\uC6B4\uB85C\uB4DC \uC911: $1"
  );
  localized = localized.replace(
    /^Using Java:\s*(.+)$/i,
    "Java \uC0AC\uC6A9: $1"
  );
  localized = localized.replace(
    /^Installing Java (\d+) runtime for launcher instance\.\.\.$/i,
    "\uB7F0\uCC98 \uC804\uC6A9 Java $1 \uB7F0\uD0C0\uC784 \uC124\uCE58 \uC911..."
  );
  localized = localized.replace(
    /^Java runtime installed:\s*(.+)$/i,
    "Java \uB7F0\uD0C0\uC784 \uC124\uCE58 \uC644\uB8CC: $1"
  );
  localized = localized.replace(
    /^Using configured Java runtime:\s*(.+)$/i,
    "\uC124\uC815\uB41C Java \uB7F0\uD0C0\uC784 \uC0AC\uC6A9: $1"
  );
  localized = localized.replace(
    /^Configured Java runtime could not be used \(version:\s*([^)]+)\)\. Trying automatic Java detection\.\.\.$/i,
    "\uC124\uC815\uB41C Java \uB7F0\uD0C0\uC784\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC5B4 \uC790\uB3D9 \uD0D0\uC9C0\uB97C \uC2DC\uB3C4\uD569\uB2C8\uB2E4 (\uBC84\uC804: $1)."
  );
  localized = localized.replace(
    /^Configured Java runtime could not be used \(version:\s*([^)]+)\)\. Java (\d+) is required\. Trying automatic Java detection\.\.\.$/i,
    "설정된 Java 런타임을 사용할 수 없습니다. Java $2가 필요합니다 (현재 버전: $1)."
  );
  localized = localized.replace(
    /^Using bundled Java runtime:\s*(.+)$/i,
    "\uB0B4\uC7A5 Java \uB7F0\uD0C0\uC784 \uC0AC\uC6A9: $1"
  );
  localized = localized.replace(
    /^Bundled Java runtime could not be used \(version:\s*([^)]+)\)\. Reinstalling Java (\d+) runtime\.\.\.$/i,
    "내장 Java 런타임 버전이 맞지 않아 Java $2를 다시 설치합니다 (현재 버전: $1)."
  );
  localized = localized.replace(
    /^System Java runtime from PATH could not be used \(version:\s*([^)]+)\)\. Java (\d+) is required\.$/i,
    "PATH의 Java 런타임을 사용할 수 없습니다. Java $2가 필요합니다 (현재 버전: $1)."
  );
  localized = localized.replace(
    /^Fabric runtime already installed:\s*(.+)$/i,
    "\uD328\uBE0C\uB9AD \uB7F0\uD0C0\uC784\uC774 \uC774\uBBF8 \uC124\uCE58\uB428: $1"
  );
  localized = localized.replace(
    /^Installing Fabric ([0-9.]+) profile for launcher instance\.\.\.$/i,
    "\uB7F0\uCC98 \uC804\uC6A9 Fabric $1 \uD504\uB85C\uD544 \uC124\uCE58 \uC911..."
  );
  localized = localized.replace(
    /^Downloading Fabric profile \(([^)]+)\)\.\.\.$/i,
    "Fabric \uD504\uB85C\uD544 \uB2E4\uC6B4\uB85C\uB4DC \uC911 ($1)..."
  );
  localized = localized.replace(
    /^Fabric profile installed:\s*(.+)$/i,
    "Fabric \uD504\uB85C\uD544 \uC124\uCE58 \uC644\uB8CC: $1"
  );
  localized = localized.replace(
    /^Checking modpack distribution \((LOW|HIGH)\)\.\.\.$/i,
    "\uBAA8\uB4DC\uD329 \uBC30\uD3EC \uD30C\uC77C \uD655\uC778 \uC911 ($1)..."
  );
  localized = localized.replace(
    /^Checking modpack archive \((LOW|HIGH)\)\.\.\.$/i,
    "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C \uD655\uC778 \uC911 ($1)..."
  );
  localized = localized.replace(
    /^Downloading modpack archive \((LOW|HIGH)\)\.\.\.$/i,
    "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C \uB2E4\uC6B4\uB85C\uB4DC \uC911 ($1)..."
  );
  localized = localized.replace(
    /^Removing obsolete modpack entries \((\d+)\)\.\.\.$/i,
    "\uC0AC\uC6A9\uD558\uC9C0 \uC54A\uB294 \uBAA8\uB4DC\uD329 \uD56D\uBAA9 \uC0AD\uC81C \uC911 ($1)..."
  );
  localized = localized.replace(
    /^Applying modpack distribution files \((\d+)\)\.\.\.$/i,
    "\uBAA8\uB4DC\uD329 \uBC30\uD3EC \uD30C\uC77C \uC801\uC6A9 \uC911 ($1)..."
  );
  localized = localized.replace(
    /^Modpack distribution sync completed\. Updated (\d+), skipped (\d+), removed (\d+)\.$/i,
    "\uBAA8\uB4DC\uD329 \uBC30\uD3EC \uB3D9\uAE30\uD654 \uC644\uB8CC. \uC5C5\uB370\uC774\uD2B8 $1, \uC720\uC9C0 $2, \uC0AD\uC81C $3."
  );
  localized = localized.replace(
    /^Modpack archive sync completed\. Removed (\d+) top-level entries and applied archive\.$/i,
    "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C \uB3D9\uAE30\uD654 \uC644\uB8CC. \uCD5C\uC0C1\uC704 \uD56D\uBAA9 $1\uAC1C \uC0AD\uC81C \uD6C4 \uC801\uC6A9\uD588\uC2B5\uB2C8\uB2E4."
  );
  localized = localized.replace(
    /^Preparing FABRIC ([0-9.]+) \(([^)]+)\)\.\.\.$/i,
    "FABRIC $1 \uC900\uBE44 \uC911 ($2)..."
  );
  localized = localized.replace(
    /^Minecraft assets \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC5D0\uC14B ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft legacy assets \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uB808\uAC70\uC2DC \uC5D0\uC14B ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft libraries \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uB77C\uC774\uBE0C\uB7EC\uB9AC ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft natives \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uB124\uC774\uD2F0\uBE0C ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft asset index \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC5D0\uC14B \uC778\uB371\uC2A4 ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft client \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD074\uB77C\uC774\uC5B8\uD2B8 ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft download \((\d+)\/(\d+)\)$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uB2E4\uC6B4\uB85C\uB4DC ($1/$2)"
  );
  localized = localized.replace(
    /^Minecraft process started(.*)\.$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD504\uB85C\uC138\uC2A4 \uC2DC\uC791$1."
  );
  localized = localized.replace(
    /^Minecraft closed \(code:\s*([^)]+)\)\.$/i,
    "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC885\uB8CC (\uCF54\uB4DC: $1)."
  );

  return localized;
}

function asBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < min || parsed > max) {
    return fallback;
  }
  return parsed;
}

function bindResolutionInputGuard(input, min, max) {
  if (!input) {
    return;
  }

  const sanitizeDigits = () => {
    const digitsOnly = String(input.value || "")
      .replace(/[^0-9]/g, "")
      .slice(0, 4);
    if (input.value !== digitsOnly) {
      input.value = digitsOnly;
    }
  };

  input.addEventListener("input", () => {
    sanitizeDigits();
  });

  input.addEventListener("blur", () => {
    sanitizeDigits();
    if (!input.value) {
      return;
    }
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed)) {
      input.value = "";
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    input.value = String(clamped);
  });
}

function bindResolutionInputGuards() {
  bindResolutionInputGuard(settingsGameWidthInput, 320, 7680);
  bindResolutionInputGuard(settingsGameHeightInput, 240, 4320);
}

function normalizeDirectoryForCompare(value) {
  const normalized = asText(value).replace(/\\/g, "/").replace(/\/+$/g, "");
  return normalized.toLowerCase();
}

function isSameDirectoryPath(left, right) {
  const a = normalizeDirectoryForCompare(left);
  const b = normalizeDirectoryForCompare(right);
  return Boolean(a && b && a === b);
}

function normalizeSettings(raw, defaults = DEFAULT_SETTINGS) {
  const source = raw && typeof raw === "object" ? raw : {};
  const unifiedRamMb = asNumber(source.ramMax ?? source.ramMin, defaults.ramMax, JAVA_RAM_MIN_MB, 32768);
  const normalizedJvmArgs = asText(source.jvmArgs);
  const normalized = {
    gameWidth: asNumber(source.gameWidth, defaults.gameWidth, 320, 7680),
    gameHeight: asNumber(source.gameHeight, defaults.gameHeight, 240, 4320),
    fullscreen: asBoolean(source.fullscreen, defaults.fullscreen),
    launchDetached: asBoolean(source.launchDetached, defaults.launchDetached),
    minecraftDirectory: asText(source.minecraftDirectory, defaults.minecraftDirectory),
    selectedProfile: "",
    javaPath: asText(source.javaPath, defaults.javaPath),
    jvmArgs: normalizedJvmArgs || asText(defaults.jvmArgs),
    ramMin: unifiedRamMb,
    ramMax: unifiedRamMb,
    dataDirectory: asText(source.dataDirectory, defaults.dataDirectory),
  };

  return normalized;
}

function formatMemoryGbTextFromMb(memoryMb) {
  const mb = Number(memoryMb);
  if (!Number.isFinite(mb) || mb <= 0) {
    return "-";
  }
  return `${(mb / 1024).toFixed(1)}G`;
}

function formatSystemMemoryGbText(memoryGb) {
  const gb = Number(memoryGb);
  if (!Number.isFinite(gb) || gb <= 0) {
    return "-";
  }
  return `${gb.toFixed(1)}G`;
}

function getJavaMemorySliderMaxMb() {
  const totalMemoryGb = Number(detectedSystemProfile?.totalMemoryGb);
  if (!Number.isFinite(totalMemoryGb) || totalMemoryGb <= 0) {
    return 32768;
  }
  const totalMemoryMb = Math.max(1024, Math.floor(totalMemoryGb * 1024));
  const maxAllocatableMb = Math.floor(totalMemoryMb * 0.75);
  const steppedMax = Math.floor(maxAllocatableMb / JAVA_RAM_STEP_MB) * JAVA_RAM_STEP_MB;
  return Math.max(JAVA_RAM_MIN_MB, Math.min(65536, steppedMax));
}

function snapMemoryValue(value, min, max, step = 128) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  const clamped = Math.min(max, Math.max(min, parsed));
  const stepped = Math.round(clamped / step) * step;
  return Math.min(max, Math.max(min, stepped));
}

function updateJavaPathStatus() {
  if (!settingsJavaPathStatus) {
    return;
  }
  const javaPath = asText(settingsJavaPathInput?.value);
  const normalizedPath = javaPath.replace(/\\/g, "/").toLowerCase();
  const valid = Boolean(normalizedPath && /\/javaw?\.exe$/.test(normalizedPath));
  settingsJavaPathStatus.textContent = valid
    ? "\uC720\uD6A8\uD55C Java \uC2E4\uD589 \uD30C\uC77C"
    : "\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uC120\uD0DD";
  settingsJavaPathStatus.classList.toggle("is-valid", valid);
  settingsJavaPathStatus.classList.toggle("is-invalid", !valid);
}

function syncJavaMemoryControls() {
  if (!settingsRamMaxInput) {
    return;
  }

  const maxBound = getJavaMemorySliderMaxMb();
  settingsRamMaxInput.min = String(JAVA_RAM_MIN_MB);
  settingsRamMaxInput.max = String(maxBound);

  const unifiedValue = snapMemoryValue(settingsRamMaxInput.value, JAVA_RAM_MIN_MB, maxBound, JAVA_RAM_STEP_MB);
  settingsRamMaxInput.value = String(unifiedValue);
  if (settingsRamMinInput) {
    settingsRamMinInput.value = String(unifiedValue);
  }

  if (settingsRamMinDisplay) {
    settingsRamMinDisplay.textContent = formatMemoryGbTextFromMb(unifiedValue);
  }
  if (settingsRamMaxDisplay) {
    settingsRamMaxDisplay.textContent = formatMemoryGbTextFromMb(unifiedValue);
  }

  const totalMemoryGb = Number(detectedSystemProfile?.totalMemoryGb);
  const usableMemoryGb = Number.isFinite(totalMemoryGb) && totalMemoryGb > 0 ? totalMemoryGb * 0.75 : NaN;
  if (settingsJavaTotalMemory) {
    settingsJavaTotalMemory.textContent = formatSystemMemoryGbText(totalMemoryGb);
  }
  if (settingsJavaUsableMemory) {
    settingsJavaUsableMemory.textContent = formatSystemMemoryGbText(usableMemoryGb);
  }
}

function bindJavaMemoryControlEvents() {
  if (settingsRamMaxInput) {
    settingsRamMaxInput.addEventListener("input", () => {
      syncJavaMemoryControls();
    });
  }
}

function readStoredSettings() {
  try {
    const storageKey = `betterlauncher.project.${activeProjectId}.settings.v1`;
    const raw = localStorage.getItem(storageKey) ||
      (activeProjectId === "bettermon" ? localStorage.getItem(LEGACY_SETTINGS_STORAGE_KEY) : null);
    if (!raw) {
      return normalizeSettings({}, launcherDefaults);
    }

    const parsed = JSON.parse(raw);
    return normalizeSettings(parsed, launcherDefaults);
  } catch {
    return normalizeSettings({}, launcherDefaults);
  }
}

function writeStoredSettings(settings) {
  try {
    if (!activeProjectId) return;
    localStorage.setItem(`betterlauncher.project.${activeProjectId}.settings.v1`, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
}

function privateStatusText(message) {
  return window.launcherPrivacy.redactPrivateDiagnostics(message);
}

function setSettingsStatus(message, isError = false) {
  if (!settingsStatus) {
    return;
  }
  settingsStatus.textContent = privateStatusText(message);
  settingsStatus.style.color = isError ? "#ff9b9b" : "";
}

function setLaunchStatus(message, isError = false) {
  if (!launchStatus) {
    return;
  }
  const nextMessage = privateStatusText(message);
  const nextIsError = Boolean(nextMessage && isError);
  if (launchStatus.textContent !== nextMessage) {
    launchStatus.textContent = nextMessage;
  }
  launchStatus.classList.toggle("is-error", nextIsError);
}

function clearLaunchStartTimeout() {
  if (launchStartTimeoutId === null) {
    return;
  }
  window.clearTimeout(launchStartTimeoutId);
  launchStartTimeoutId = null;
}

function extendLaunchLogCapture(durationMs = LAUNCH_LOG_CAPTURE_MS) {
  const nextUntil = Date.now() + Math.max(0, Number(durationMs) || 0);
  launchLogCaptureUntil = Math.max(launchLogCaptureUntil, nextUntil);
}

function startLaunchStartTimeoutWatch() {
  clearLaunchStartTimeout();
  launchStartTimeoutId = window.setTimeout(() => {
    launchStartTimeoutId = null;
    if (!isLauncherRunning) {
      setLaunchStatus(
        "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD504\uB85C\uC138\uC2A4\uAC00 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. Java \uACBD\uB85C\uC640 \uB7F0\uCC98 \uB85C\uADF8\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.",
        true
      );
    }
  }, LAUNCH_START_TIMEOUT_MS);
}

function clampPercent(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }
  return Math.max(0, Math.min(100, numberValue));
}

function isStartupOverlayVisible() {
  return Boolean(startupOverlay && !startupOverlay.hidden && !startupOverlayDismissed);
}

function setStartupStatus(message, isError = false) {
  if (!startupStatus) {
    return;
  }
  startupStatus.textContent = privateStatusText(message) || "\uB7F0\uCC98 \uC2DC\uC791 \uC911...";
  startupStatus.classList.toggle("is-error", Boolean(isError));
}

function setStartupProgress(percent, message = "", isError = false, allowDecrease = false) {
  if (!isStartupOverlayVisible()) {
    return;
  }

  const normalized = clampPercent(percent);
  const nextPercent = allowDecrease ? normalized : Math.max(startupProgressPercent, normalized);
  startupProgressPercent = nextPercent;

  if (startupProgressBar) {
    startupProgressBar.style.width = `${nextPercent.toFixed(1)}%`;
  }

  const roundedPercent = Math.round(nextPercent);
  if (startupProgressTrack) {
    startupProgressTrack.setAttribute("aria-valuenow", String(roundedPercent));
  }
  if (startupProgressText) {
    startupProgressText.textContent = `${roundedPercent}%`;
    startupProgressText.classList.toggle("is-error", Boolean(isError));
  }

  if (message) {
    setStartupStatus(message, isError);
  }
}

function applyStartupLogStatus(payload) {
  if (!isStartupModpackSyncRunning || !isStartupOverlayVisible()) {
    return;
  }

  const level = asText(payload?.level).toLowerCase();
  const message = asText(payload?.message);
  const localizedMessage = localizeStatusMessage(message);
  if (!level || !message) {
    return;
  }

  if (level === "error") {
    setStartupProgress(startupProgressPercent, localizedMessage || message, true);
    return;
  }

  const modpackProgress = parseModpackProgressMessage(message);
  if (modpackProgress) {
    const dynamicPercent =
      STARTUP_MODPACK_PROGRESS_START +
      modpackProgress.ratio * (STARTUP_MODPACK_PROGRESS_DONE - STARTUP_MODPACK_PROGRESS_START);
    setStartupProgress(dynamicPercent, formatModpackProgressStatus(modpackProgress));
    return;
  }

  if (/(installing fabric|fetching fabric loader metadata|downloading fabric profile|downloading neoforge installer|installing neoforge runtime)/i.test(message)) {
    setStartupProgress(STARTUP_RUNTIME_PROGRESS_START, localizedMessage || message);
    return;
  }

  if (/(installing java|using configured java runtime|using bundled java runtime|using system java runtime)/i.test(message)) {
    setStartupProgress(STARTUP_RUNTIME_PROGRESS_START + 2, localizedMessage || message);
    return;
  }

  if (/downloading java runtime/i.test(message)) {
    setStartupProgress(STARTUP_RUNTIME_JAVA_DOWNLOAD_PROGRESS, localizedMessage || message);
    return;
  }

  if (/extracting java runtime/i.test(message)) {
    setStartupProgress(STARTUP_RUNTIME_JAVA_EXTRACT_PROGRESS, localizedMessage || message);
    return;
  }

  if (/java runtime installed/i.test(message)) {
    setStartupProgress(STARTUP_RUNTIME_PROGRESS_DONE, localizedMessage || message);
    return;
  }

  if (/(fabric profile installed|fabric runtime already installed|neoforge runtime (?:already )?installed)/i.test(message)) {
    setStartupProgress(STARTUP_RUNTIME_PROGRESS_DONE, localizedMessage || message);
    return;
  }

  if (/checking modpack/i.test(message)) {
    setStartupProgress(STARTUP_MODPACK_PROGRESS_START, localizedMessage || message);
    return;
  }

  if (/(downloading|extracting|cleaning|analyzing|applying|removing).*(modpack|archive|distribution)/i.test(message)) {
    setStartupProgress(STARTUP_MODPACK_PROGRESS_START + 8, localizedMessage || message);
    return;
  }

  if (/(modpack).*(up to date|completed|applied|unchanged|skipping)/i.test(message)) {
    setStartupProgress(STARTUP_MODPACK_PROGRESS_DONE, localizedMessage || message);
    return;
  }

  if (level === "info" || level === "progress" || level === "warn") {
    setStartupStatus(localizedMessage || message, false);
  }
}

function applyResolvedJavaPath(resolvedJavaPath) {
  const nextJavaPath = asText(resolvedJavaPath);
  if (!nextJavaPath) {
    return;
  }

  launcherDefaults.javaPath = nextJavaPath;
  if (asText(launcherSettings.javaPath) !== nextJavaPath) {
    launcherSettings.javaPath = nextJavaPath;
    writeStoredSettings(launcherSettings);
  }
  if (settingsJavaPathInput && asText(settingsJavaPathInput.value) !== nextJavaPath) {
    settingsJavaPathInput.value = nextJavaPath;
  }
  updateJavaPathStatus();
}

function shouldAutoSelectJavaPath(value) {
  const javaPath = asText(value);
  return !javaPath || JAVA_PATH_AUTO_SELECT_PLACEHOLDERS.has(javaPath.toLowerCase());
}

function getConfiguredMinecraftDirectory() {
  return asText(launcherSettings.minecraftDirectory) || asText(launcherDefaults.minecraftDirectory);
}

async function ensureJavaPathAutoSelectedForProject() {
  if (!activeModpack?.manifestConfigured) return false;
  if (!window.launcherApi || typeof window.launcherApi.autoSelectJava !== "function") {
    return false;
  }
  if (!shouldAutoSelectJavaPath(launcherSettings.javaPath)) {
    return false;
  }

  const minecraftDirectory = getConfiguredMinecraftDirectory();
  if (!minecraftDirectory) {
    return false;
  }

  setStartupProgress(STARTUP_SETTINGS_PROGRESS + 2, `Java ${activeModpack?.javaMajor || 21} 실행 파일 자동 선택 중...`);

  try {
    const result = await window.launcherApi.autoSelectJava({ minecraftDirectory, projectId: activeProjectId });
    if (!result?.ok || !asText(result?.javaPath)) {
      setStartupProgress(
        STARTUP_SETTINGS_PROGRESS + 4,
        asText(result?.error) || "Java 실행 파일 자동 선택에 실패했습니다.",
        true
      );
      return false;
    }

    applyResolvedJavaPath(result.javaPath);
    setStartupProgress(STARTUP_SETTINGS_PROGRESS + 4, "Java 실행 파일 자동 선택 완료.");
    return true;
  } catch (error) {
    setStartupProgress(
      STARTUP_SETTINGS_PROGRESS + 4,
      asText(error?.message) || "Java 실행 파일 자동 선택에 실패했습니다.",
      true
    );
    return false;
  }
}

function updateLaunchButtonUi() {
  if (!startLaunchButton) {
    return;
  }

  const hasPendingModpackUpdate = Boolean(modpackUpdateState?.pending);
  const hasLauncherUpdateReady = isLauncherUpdateReadyToInstall();
  const isLauncherUpdateDownloading = isLauncherUpdateDownloadInProgress();
  const busy =
    isModpackPreparing ||
    isLaunchRequestPending ||
    isLauncherRunning ||
    isStartupModpackSyncRunning ||
    isModpackUpdateApplyRunning ||
    isLauncherUpdateInstallRunning ||
    isLauncherUpdateGateRunning ||
    isLauncherUpdateDownloading;
  let label = "\uAC8C\uC784 \uC2DC\uC791";
  if (isLauncherUpdateInstallRunning) {
    label = "\uC5C5\uB370\uC774\uD2B8 \uC801\uC6A9 \uC911...";
  } else if (isLauncherUpdateGateRunning) {
    label = "\uAC8C\uC784 \uC2DC\uC791";
  } else if (hasLauncherUpdateReady) {
    label = "\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8";
  } else if (isLauncherUpdateDownloading) {
    label = "\uC5C5\uB370\uC774\uD2B8 \uB2E4\uC6B4\uB85C\uB4DC";
  } else if (isModpackUpdateApplyRunning) {
    label = "업데이트 중...";
  } else if (isStartupModpackSyncRunning) {
    label = "\uAC8C\uC784 \uC2DC\uC791";
  } else if (isLaunchRequestPending || isLauncherRunning) {
    label = "\uC2E4\uD589 \uC911...";
  } else if (hasPendingModpackUpdate) {
    label = "업데이트";
  }
  const project = activeModpack;
  startLaunchButton.disabled = busy || (!hasLauncherUpdateReady && (!authState.signedIn || !hasActiveModpack || !project?.manifestConfigured));
  startLaunchButton.textContent = label;
  startLaunchButton.setAttribute("aria-label", label);
  startLaunchButton.setAttribute("aria-busy", busy ? "true" : "false");
}

function isLauncherUpdateReadyToInstall() {
  return Boolean(updaterSnapshot?.enabled && updaterSnapshot?.downloaded);
}

function isLauncherUpdateDownloadInProgress() {
  return Boolean(
    updaterSnapshot?.enabled &&
      !updaterSnapshot?.downloaded &&
      (updaterSnapshot?.downloading || updaterSnapshot?.available)
  );
}

function getSelectedProfileInfo() {
  const selectedProfileId = asText(settingsProfileSelect?.value) || asText(launcherSettings.selectedProfile);
  if (!selectedProfileId) {
    return null;
  }

  return loadedProfiles.find((profile) => asText(profile?.id) === selectedProfileId) || null;
}

function buildLaunchPayload() {
  const selectedProfile = getSelectedProfileInfo();
  const minecraftDirectory = asText(launcherSettings.minecraftDirectory) || asText(launcherDefaults.minecraftDirectory);
  const javaPath =
    asText(launcherSettings.javaPath) ||
    asText(selectedProfile?.javaDir) ||
    asText(launcherDefaults.javaPath);

  return {
    projectId: activeProjectId,
    username: asText(authState.profileName, "\uD50C\uB808\uC774\uC5B4"),
    version: "",
    versionType: "release",
    gameWidth: Number(launcherSettings.gameWidth) || DEFAULT_SETTINGS.gameWidth,
    gameHeight: Number(launcherSettings.gameHeight) || DEFAULT_SETTINGS.gameHeight,
    fullscreen: Boolean(launcherSettings.fullscreen),
    minecraftDirectory,
    gameDirectory: "",
    javaPath,
    jvmArgs: asText(launcherSettings.jvmArgs) || asText(launcherDefaults.jvmArgs),
    ramMin: Number(launcherSettings.ramMin) || DEFAULT_SETTINGS.ramMin,
    ramMax: Number(launcherSettings.ramMax) || DEFAULT_SETTINGS.ramMax
  };
}

function buildModpackSyncPayload() {
  return {
    projectId: activeProjectId,
    minecraftDirectory: asText(launcherSettings.minecraftDirectory) || asText(launcherDefaults.minecraftDirectory),
    gameDirectory: ""
  };
}

async function ensureLatestLauncherOnStartup() {
  if (!window.launcherApi || typeof window.launcherApi.ensureLatestLauncherUpdate !== "function") {
    return;
  }

  isLauncherUpdateGateRunning = true;
  updateLaunchButtonUi();
  setStartupProgress(STARTUP_SETTINGS_PROGRESS + 6, "\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uC911...");

  try {
    const result = await window.launcherApi.ensureLatestLauncherUpdate();
    if (!result?.ok) {
      const message = localizeStatusMessage(result?.error || "Launcher update check failed.");
      setStartupProgress(
        STARTUP_SETTINGS_PROGRESS + 12,
        `런처 업데이트를 확인하지 못했습니다. 현재 버전으로 계속합니다. (${message})`
      );
      return;
    }

    if (result.restarting) {
      setStartupProgress(
        STARTUP_FINALIZING_PROGRESS,
        "\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8 \uC801\uC6A9\uC744 \uC704\uD574 \uB2E4\uC2DC \uC2DC\uC791\uD569\uB2C8\uB2E4."
      );
      await new Promise(() => {});
    }

    setStartupProgress(STARTUP_SETTINGS_PROGRESS + 12, "\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uC644\uB8CC.");
  } finally {
    isLauncherUpdateGateRunning = false;
    updateLaunchButtonUi();
  }
}

async function ensureLatestLauncherBeforeLaunch() {
  if (!window.launcherApi || typeof window.launcherApi.ensureLatestLauncherUpdate !== "function") {
    return true;
  }

  isLauncherUpdateGateRunning = true;
  updateLaunchButtonUi();
  setLaunchStatus("\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uC911...");

  try {
    const result = await window.launcherApi.ensureLatestLauncherUpdate();
    if (!result?.ok) {
      const message = localizeStatusMessage(result?.error || "Launcher update check failed.");
      setLaunchStatus(`런처 업데이트를 확인하지 못해 현재 버전으로 계속합니다. (${message})`);
      return true;
    }

    if (result.restarting) {
      setLaunchStatus("\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8 \uC801\uC6A9\uC744 \uC704\uD574 \uB2E4\uC2DC \uC2DC\uC791\uD569\uB2C8\uB2E4.");
      return false;
    }

    return true;
  } finally {
    isLauncherUpdateGateRunning = false;
    updateLaunchButtonUi();
  }
}

async function checkModpackUpdateOnStartup() {
  if (!hasActiveModpack || isStartupModpackSyncRunning) {
    return;
  }
  if (!activeModpack?.manifestConfigured) {
    setLaunchStatus(activeProjectId ? "모드팩 배포 주소를 설정하면 설치하고 실행할 수 있습니다." : "등록된 모드팩이 없습니다.");
    return;
  }

  const sessionRevision = authSessionRevision;
  const payload = buildModpackSyncPayload();
  if (!payload.minecraftDirectory) {
    setStartupProgress(
      STARTUP_FINALIZING_PROGRESS,
      "\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD3F4\uB354\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC544 \uC2DC\uC791 \uC5C5\uB370\uC774\uD2B8\uB97C \uAC74\uB108\uB701\uB2C8\uB2E4."
    );
    return;
  }

  isStartupModpackSyncRunning = true;
  updateLaunchButtonUi();
  setLaunchStatus("모드팩 업데이트 확인 중...");
  setStartupProgress(STARTUP_MODPACK_PROGRESS_START, "모드팩 업데이트 확인 중...");

  try {
    if (!window.launcherApi || typeof window.launcherApi.checkModpackUpdate !== "function") {
      setLaunchStatus("");
      setStartupProgress(STARTUP_MODPACK_PROGRESS_DONE, "모드팩 업데이트 확인을 건너뜁니다.");
      return;
    }

    const result = await window.launcherApi.checkModpackUpdate(payload);
    if (!authState.signedIn || sessionRevision !== authSessionRevision) return;
    if (!result?.ok) {
      const message = localizeStatusMessage(result?.error || "Modpack update check failed.");
      setLaunchStatus(message, true);
      setStartupProgress(startupProgressPercent, message, true);
      return;
    }

    modpackUpdateState = result && typeof result === "object" ? { ...result } : null;
    if (result.pending) {
      const message = "모드팩 업데이트가 있습니다. 업데이트 버튼을 눌러 적용하세요.";
      setLaunchStatus(message);
      setStartupProgress(STARTUP_MODPACK_PROGRESS_DONE, "모드팩 업데이트 확인 완료.");
    } else {
      setLaunchStatus("\uBAA8\uB4DC\uD329\uC774 \uCD5C\uC2E0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.");
      setStartupProgress(STARTUP_MODPACK_PROGRESS_DONE, "\uBAA8\uB4DC\uD329\uC774 \uCD5C\uC2E0 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.");
    }
  } catch (error) {
    if (!authState.signedIn || sessionRevision !== authSessionRevision) return;
    const message = localizeStatusMessage(asText(error?.message) || "Modpack update check failed.");
    setLaunchStatus(message, true);
    setStartupProgress(startupProgressPercent, message, true);
  } finally {
    isStartupModpackSyncRunning = false;
    updateLaunchButtonUi();
  }
}

function applyLauncherState(nextState) {
  const wasRunning = isLauncherRunning;
  isLauncherRunning = Boolean(nextState?.launching);

  if (isLauncherRunning) {
    clearLaunchStartTimeout();
    extendLaunchLogCapture();
    setLaunchStatus("\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC2E4\uD589 \uC911...");
  } else if (wasRunning) {
    clearLaunchStartTimeout();
    setLaunchStatus("\uB9C8\uC778\uD06C\uB798\uD504\uD2B8\uAC00 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  }

  updateLaunchButtonUi();
}

async function runPendingModpackUpdate() {
  const payload = buildModpackSyncPayload();
  if (!payload.minecraftDirectory) {
    setLaunchStatus("\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD3F4\uB354\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", true);
    return false;
  }

  if (!window.launcherApi || typeof window.launcherApi.syncModpack !== "function") {
    setLaunchStatus("모드팩 업데이트 기능을 사용할 수 없습니다.", true);
    return false;
  }

  isModpackUpdateApplyRunning = true;
  updateLaunchButtonUi();
  setLaunchStatus("모드팩 업데이트 중...");

  try {
    const result = await window.launcherApi.syncModpack(payload);
    if (!result?.ok) {
      const message = localizeStatusMessage(result?.error || "Modpack update failed.");
      setLaunchStatus(message, true);
      return false;
    }

    modpackUpdateState = {
      ok: true,
      pending: false,
      latestVersion: asText(result?.version) || asText(modpackUpdateState?.latestVersion)
    };
    setLaunchStatus("모드팩 업데이트가 완료되었습니다. 게임을 시작할 수 있습니다.");
    return true;
  } catch (error) {
    const message = localizeStatusMessage(asText(error?.message) || "Modpack update failed.");
    setLaunchStatus(message, true);
    return false;
  } finally {
    isModpackUpdateApplyRunning = false;
    updateLaunchButtonUi();
  }
}

async function installDownloadedLauncherUpdate() {
  if (!window.launcherApi || typeof window.launcherApi.installUpdate !== "function") {
    setLaunchStatus("런처 업데이트 기능을 사용할 수 없습니다.", true);
    return false;
  }

  isLauncherUpdateInstallRunning = true;
  updateLaunchButtonUi();
  setLaunchStatus("런처 업데이트 적용을 위해 다시 시작합니다.");

  try {
    const result = await window.launcherApi.installUpdate();
    if (!result?.ok) {
      setLaunchStatus(asText(result?.error) || "런처 업데이트 적용에 실패했습니다.", true);
      return false;
    }
    return true;
  } catch (error) {
    setLaunchStatus(asText(error?.message) || "런처 업데이트 적용에 실패했습니다.", true);
    return false;
  } finally {
    isLauncherUpdateInstallRunning = false;
    updateLaunchButtonUi();
  }
}

async function launchGame() {
  if (isLauncherUpdateReadyToInstall()) {
    await installDownloadedLauncherUpdate();
    return;
  }

  if (isLauncherUpdateDownloadInProgress()) {
    setLaunchStatus("런처 업데이트를 다운로드 중입니다. 완료되면 적용해 주세요.");
    return;
  }
  if (isModpackPreparing) return;

  if (!authState.signedIn) {
    setLaunchStatus("Microsoft\uB85C \uBA3C\uC800 \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.", true);
    switchScreen("login");
    return;
  }

  if (!hasActiveModpack) {
    setLaunchStatus("모드팩 설정을 확인해 주세요.", true);
    return;
  }

  if (isStartupModpackSyncRunning) {
    setLaunchStatus("\uBAA8\uB4DC\uD329 \uC5C5\uB370\uC774\uD2B8 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.", true);
    return;
  }

  if (isLauncherUpdateGateRunning) {
    setLaunchStatus("\uB7F0\uCC98 \uC5C5\uB370\uC774\uD2B8 \uD655\uC778 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.", true);
    return;
  }

  if (isModpackUpdateApplyRunning) {
    setLaunchStatus("모드팩 업데이트 진행 중입니다. 잠시 기다려 주세요.", true);
    return;
  }

  if (isLaunchRequestPending || isLauncherRunning) {
    return;
  }

  const payload = buildLaunchPayload();
  if (!payload.minecraftDirectory) {
    setLaunchStatus("\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD3F4\uB354\uAC00 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.", true);
    return;
  }

  if (payload.ramMin > payload.ramMax) {
    setLaunchStatus("RAM \uC124\uC815\uAC12\uC774 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", true);
    return;
  }

  if (modpackUpdateState?.pending) {
    await runPendingModpackUpdate();
    return;
  }

  const launcherReady = await ensureLatestLauncherBeforeLaunch();
  if (!launcherReady) {
    return;
  }

  isLaunchRequestPending = true;
  extendLaunchLogCapture();
  clearLaunchStartTimeout();
  updateLaunchButtonUi();
  setLaunchStatus("\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uC2E4\uD589 \uC911...");

  try {
    const result = await window.launcherApi.launch(payload);
    if (!result?.ok) {
      if (result?.code === "modpack-update-required" || result?.modpackUpdate?.pending) {
        modpackUpdateState =
          result?.modpackUpdate && typeof result.modpackUpdate === "object"
            ? { ...result.modpackUpdate, pending: true }
            : { ok: true, pending: true };
        updateLaunchButtonUi();
      }
      if (result?.code === "auth-session-expired") {
        applyAuthState({
          ...authState,
          signedIn: false,
          ...(result?.status && typeof result.status === "object" ? result.status : {})
        });
      }
      setLaunchStatus(localizeStatusMessage(result?.error || "Minecraft launch failed."), true);
      return;
    }

    applyResolvedJavaPath(result?.javaPath);
    extendLaunchLogCapture();
    setLaunchStatus("\uC2E4\uD589 \uC694\uCCAD \uC644\uB8CC. \uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD504\uB85C\uC138\uC2A4 \uC2DC\uC791 \uB300\uAE30 \uC911...");
    startLaunchStartTimeoutWatch();
  } catch (error) {
    const message = localizeStatusMessage(
      asText(error?.message) || "\uC2E4\uD589 \uC694\uCCAD \uC804\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."
    );
    setLaunchStatus(message, true);
  } finally {
    isLaunchRequestPending = false;
    updateLaunchButtonUi();
  }
}

function applySettingsToInputs(settings) {
  for (const [key, input] of Object.entries(SETTINGS_TEXT_INPUTS)) {
    if (input) {
      input.value = String(settings[key] ?? "");
    }
  }

  for (const [key, input] of Object.entries(SETTINGS_BOOLEAN_INPUTS)) {
    if (input) {
      input.checked = Boolean(settings[key]);
    }
  }

  syncJavaMemoryControls();
  updateJavaPathStatus();
}

function readSettingsFromInputs() {
  const textValues = {};
  for (const [key, input] of Object.entries(SETTINGS_TEXT_INPUTS)) {
    textValues[key] = input?.value;
  }

  const booleanValues = {};
  for (const [key, input] of Object.entries(SETTINGS_BOOLEAN_INPUTS)) {
    booleanValues[key] = input?.checked;
  }

  return normalizeSettings(
    {
      ...textValues,
      ...booleanValues,
      selectedProfile: settingsProfileSelect?.value,
    },
    launcherDefaults
  );
}

function updateSettingsAccountUi() {
  if (settingsMicrosoftAddButton) {
    settingsMicrosoftAddButton.disabled = authState.loggingIn;
  }
  renderSettingsAccountList();
}

function buildSettingsAccountCard(account, { placeholder = false } = {}) {
  const card = document.createElement("article");
  card.className = "settings-account-card";
  card.classList.toggle("is-selected", Boolean(account?.selected));
  card.classList.toggle("is-clickable", !placeholder && !account?.selected && !authState.loggingIn);
  if (!placeholder) {
    card.dataset.accountId = asText(account?.id);
    card.setAttribute("role", "button");
    card.tabIndex = !account?.selected && !authState.loggingIn ? 0 : -1;
  }

  const image = document.createElement("img");
  image.className = "settings-account-model-image";
  image.loading = "lazy";
  image.src = DEFAULT_SKIN_IMAGE;
  image.alt = "계정 모델";

  const meta = document.createElement("div");
  meta.className = "settings-account-meta";

  const nameField = document.createElement("div");
  nameField.className = "settings-account-field";
  const nameLabel = document.createElement("span");
  nameLabel.className = "settings-account-field-label";
  nameLabel.textContent = "사용자 이름";
  const nameValue = document.createElement("span");
  nameValue.className = "settings-account-field-value";
  nameValue.textContent = placeholder ? (authState.loggingIn ? "Microsoft 로그인 진행 중..." : "로그인 안 됨") : asText(account?.profileName, "플레이어");
  nameField.appendChild(nameLabel);
  nameField.appendChild(nameValue);

  meta.appendChild(nameField);

  const state = document.createElement("div");
  state.className = "settings-account-state";
  const selectedLabel = document.createElement("span");
  selectedLabel.className = "settings-account-selected";
  selectedLabel.textContent = placeholder
    ? authState.loggingIn
      ? "연결 중..."
      : "선택된 계정 없음"
    : account?.selected
      ? "선택된 계정"
      : "클릭하여 선택";
  state.appendChild(selectedLabel);

  if (!placeholder && account?.selected) {
    const logoutButton = document.createElement("button");
    logoutButton.type = "button";
    logoutButton.className = "settings-account-logout";
    logoutButton.textContent = "로그아웃";
    logoutButton.disabled = !authState.signedIn || authState.loggingIn;
    logoutButton.dataset.action = "logout";
    state.appendChild(logoutButton);
  }

  card.appendChild(image);
  card.appendChild(meta);
  card.appendChild(state);

  if (!placeholder) {
    loadMinecraftModelImage(image, account?.uuid, account?.profileName);
  }

  return card;
}

function renderSettingsAccountList() {
  if (!settingsAccountList) {
    return;
  }

  settingsAccountList.innerHTML = "";
  const accounts = Array.isArray(authState.accounts) ? authState.accounts : [];
  settingsAccountList.hidden = false;

  if (accounts.length === 0) {
    settingsAccountList.appendChild(buildSettingsAccountCard(null, { placeholder: true }));
    return;
  }

  for (const account of accounts) {
    settingsAccountList.appendChild(buildSettingsAccountCard(account));
  }
}

function selectSettingsTab(tabId) {
  const targetId = settingsTabs.some((tab) => tab.id === tabId) ? tabId : "settingsTabAccount";
  selectedSettingsTab = targetId;

  for (const navItem of settingsNavItems) {
    const isActive = navItem.dataset.settingsTab === targetId;
    navItem.classList.toggle("active", isActive);
  }

  for (const tab of settingsTabs) {
    const isActive = tab.id === targetId;
    tab.classList.toggle("active", isActive);
    tab.hidden = !isActive;
  }

  if (targetId === "settingsTabAbout" || targetId === "settingsTabUpdate") {
    void refreshGitHubReleaseInfo();
  }
}

function openSettingsScreen(tabId = selectedSettingsTab) {
  if (!settingsScreen || isModpackPreparing) {
    return;
  }
  setSettingsStatus("");
  const projectTabs = ["settingsTabMinecraft", "settingsTabJava", "settingsTabLauncher"];
  for (const item of settingsNavItems) {
    item.disabled = !hasActiveModpack && projectTabs.includes(item.dataset.settingsTab);
  }
  if (!hasActiveModpack && projectTabs.includes(tabId)) tabId = "settingsTabAccount";
  applySettingsToInputs(launcherSettings);
  selectSettingsTab(tabId);
  switchScreen("settings");
  updateSettingsAccountUi();
}

function persistSettingsSnapshot() {
  if (!hasActiveModpack) return;
  const next = readSettingsFromInputs();
  next.selectedProfile = settingsProfileSelect
    ? asText(settingsProfileSelect.value, asText(launcherSettings.selectedProfile))
    : asText(launcherSettings.selectedProfile);
  launcherSettings = next;
  writeStoredSettings(launcherSettings);
}

function closeSettingsScreen() {
  persistSettingsSnapshot();
  switchScreen(authState.signedIn ? "launch" : "login");
}

function fillProfileSelect(profiles, selectedProfile) {
  if (!settingsProfileSelect) {
    return;
  }

  settingsProfileSelect.innerHTML = "";

  if (!Array.isArray(profiles) || profiles.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "\uB4F1\uB85D\uB41C \uD504\uB85C\uD544 \uC5C6\uC74C";
    settingsProfileSelect.appendChild(option);
    return;
  }

  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = asText(profile?.id);

    const profileName = asText(profile?.name, option.value);
    const version = asText(profile?.lastVersionId);
    option.textContent = version ? `${profileName} (${version})` : profileName;

    settingsProfileSelect.appendChild(option);
  }

  if (selectedProfile) {
    settingsProfileSelect.value = selectedProfile;
  }

  if (!settingsProfileSelect.value && settingsProfileSelect.options.length > 0) {
    settingsProfileSelect.selectedIndex = 0;
  }
}

async function refreshProfilesForDirectory(minecraftDirectory, selectedProfile = "") {
  if (!settingsProfileSelect) {
    return;
  }

  const targetDirectory = asText(minecraftDirectory);
  if (!targetDirectory) {
    loadedProfiles = [];
    fillProfileSelect([], "");
    return;
  }

  try {
    const result = await window.launcherApi.loadProfiles({ minecraftDirectory: targetDirectory, projectId: activeProjectId });
    if (!result?.ok) {
      loadedProfiles = [];
      fillProfileSelect([], "");
      setSettingsStatus(result?.error || "\uB4F1\uB85D \uD504\uB85C\uD544\uC744 \uBD88\uB7EC\uC624\uB294 \uB370 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", true);
      return;
    }

    loadedProfiles = Array.isArray(result?.profiles) ? result.profiles : [];
    const preferred = asText(selectedProfile) || asText(result?.selectedProfile);
    fillProfileSelect(loadedProfiles, preferred);
  } catch {
    loadedProfiles = [];
    fillProfileSelect([], "");
    setSettingsStatus("\uB7F0\uCC98 \uD504\uB85C\uD544 \uC77D\uAE30\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", true);
  }
}

async function initializeSettings() {
  let defaults = null;

  try {
    defaults = await window.launcherApi.getDefaults();
  } catch {
    defaults = null;
  }
  if (!defaults || defaults.ok === false || !Array.isArray(defaults.projects)) {
    throw new Error(defaults?.error || "모드팩 프로젝트 설정을 불러올 수 없습니다.");
  }
  activeProjectId = asText(defaults.projectId);
  activeModpack = defaults.projects.find((entry) => entry.id === activeProjectId) || null;

  try {
    const systemProfile = await window.launcherApi.getSystemProfile();
    detectedSystemProfile = systemProfile && typeof systemProfile === "object" ? systemProfile : null;
  } catch {
    detectedSystemProfile = null;
  }

  if (defaults) {
    launcherDefaults = normalizeSettings(
      {
        ...DEFAULT_SETTINGS,
        minecraftDirectory: asText(defaults?.minecraftDirectory),
        javaPath: asText(defaults?.javaPath),
        jvmArgs: asText(defaults?.jvmArgs) || DEFAULT_SETTINGS.jvmArgs,
        ramMin: Number(defaults?.ramMin) || DEFAULT_SETTINGS.ramMin,
        ramMax: Number(defaults?.ramMax) || DEFAULT_SETTINGS.ramMax,
        dataDirectory: asText(defaults?.minecraftDirectory)
      },
      DEFAULT_SETTINGS
    );
  } else {
    launcherDefaults = { ...DEFAULT_SETTINGS };
  }

  launcherSettings = readStoredSettings();
  const systemMinecraftDirectory = asText(defaults?.systemMinecraftDirectory);
  if (isSameDirectoryPath(launcherSettings.minecraftDirectory, systemMinecraftDirectory)) {
    launcherSettings.minecraftDirectory = asText(launcherDefaults.minecraftDirectory);
    launcherSettings.selectedProfile = "";
    writeStoredSettings(launcherSettings);
  }

  applySettingsToInputs(launcherSettings);
  writeStoredSettings(launcherSettings);
  updateModpackControls();
  await refreshProfilesForDirectory(launcherSettings.minecraftDirectory, launcherSettings.selectedProfile);
}

function updateModpackControls() {
  const project = activeModpack;
  if (externalMedia) externalMedia.hidden = !project?.discordUrl;
  if (playerCountPanel) playerCountPanel.hidden = !project;
  if (discordButton) {
    discordButton.hidden = !project?.discordUrl;
    discordButton.setAttribute("aria-label", `${project?.name || "모드팩"} 디스코드`);
  }
  updateLaunchButtonUi();
}

async function prepareModpackForSession() {
  if (!isLauncherInitialized || !authState.signedIn || isModpackPreparing) return;
  if (!activeModpack) {
    hasActiveModpack = false;
    setLaunchStatus("모드팩 설정을 확인해 주세요.");
    updateLaunchButtonUi();
    return;
  }
  const sessionRevision = authSessionRevision;
  isModpackPreparing = true;
  hasActiveModpack = true;
  modpackUpdateState = null;
  currentNewsItems = [];
  renderNewsItems([], true);
  renderSettingsAboutNewsItems();
  setPlayerCountText("확인 중...", false);
  setPlayerCountTooltip("");
  updateLaunchButtonUi();
  try {
    if (!activeModpack.manifestConfigured) {
      setLaunchStatus("모드팩 배포 준비 중입니다. 관리자에게 문의해 주세요.");
      return;
    }
    setLaunchStatus(activeModpack.name + " 실행 준비 중...");
    await ensureJavaPathAutoSelectedForProject();
    if (!authState.signedIn || sessionRevision !== authSessionRevision) return;
    await checkModpackUpdateOnStartup();
  } catch (error) {
    if (authState.signedIn && sessionRevision === authSessionRevision) {
      setLaunchStatus(asText(error?.message) || "모드팩을 준비할 수 없습니다. 다시 실행해 주세요.", true);
    }
  } finally {
    isModpackPreparing = false;
    if (authState.signedIn && sessionRevision === authSessionRevision && hasActiveModpack) {
      startNewsPolling();
      startPlayerCountPolling();
      startModpackUpdatePolling();
      if (currentScreen === "launch") startLaunchButton?.focus();
    }
    updateLaunchButtonUi();
    if (authState.signedIn && sessionRevision !== authSessionRevision) void prepareModpackForSession();
  }
}

async function saveSettings(closeAfterSave = true) {
  if (!hasActiveModpack) {
    if (closeAfterSave) closeSettingsScreen();
    return;
  }
  persistSettingsSnapshot();
  applySettingsToInputs(launcherSettings);
  await refreshProfilesForDirectory(launcherSettings.minecraftDirectory, launcherSettings.selectedProfile);

  if (settingsProfileSelect) {
    launcherSettings.selectedProfile = asText(settingsProfileSelect.value);
  }

  writeStoredSettings(launcherSettings);
  setSettingsStatus("\uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");

  if (closeAfterSave) {
    closeSettingsScreen();
  }
}

function updateAuthUi() {
  const loginFlowActive = isLoginFlowActive();
  if (gateMicrosoftLoginButton) {
    gateMicrosoftLoginButton.disabled = loginFlowActive;
    gateMicrosoftLoginButton.toggleAttribute("loading", loginFlowActive);
  }

  if (gateAuthStatus) {
    if (loginFlowActive) {
      gateAuthStatus.textContent = "Microsoft \uB85C\uADF8\uC778 \uC9C4\uD589 \uC911...";
    } else if (authState.signedIn) {
      gateAuthStatus.textContent = `\uB85C\uADF8\uC778\uB428: ${authState.profileName || "플레이어"}`;
    } else {
      gateAuthStatus.textContent = "";
    }
  }

  if (!authState.signedIn) {
    hasActiveModpack = false;
    stopNewsPolling();
    stopPlayerCountPolling();
    stopModpackUpdatePolling();
    switchScreen("login");
  } else if (currentScreen === "login") {
    switchScreen("launch");
    void prepareModpackForSession();
  }

  if (!authState.signedIn && !isLauncherRunning && !isLaunchRequestPending) {
    setLaunchStatus("");
  }

  updateLoginWaitingState();
  updateAccountModelUi();
  updateSettingsAccountUi();
  updateLaunchButtonUi();
}

function applyAuthState(nextState) {
  if (authState.signedIn !== Boolean(nextState?.signedIn) || authState.uuid !== String(nextState?.uuid || "")) authSessionRevision += 1;
  authState = {
    signedIn: Boolean(nextState?.signedIn),
    profileName: String(nextState?.profileName || ""),
    uuid: String(nextState?.uuid || ""),
    accounts: Array.isArray(nextState?.accounts) ? nextState.accounts : [],
    loggingIn: Boolean(nextState?.loggingIn)
  };

  if (!authState.loggingIn || authState.signedIn) {
    loginRequestedByUser = false;
  }

  updateAuthUi();
}

function applyWindowState(nextState) {
  if (!windowMaximizeButton) {
    return;
  }

  const maximized = Boolean(nextState?.maximized);
  windowMaximizeButton.textContent = maximized ? WINDOW_RESTORE_ICON : WINDOW_MAX_ICON;
  windowMaximizeButton.setAttribute("aria-label", maximized ? "\uC6D0\uBCF5" : "\uCD5C\uB300\uD654");
}

function updateUpdaterUi(state) {
  const wasDownloaded = Boolean(updaterSnapshot?.downloaded);
  updaterSnapshot = state && typeof state === "object" ? { ...state } : null;
  updateSettingsAboutReleaseUi();
  updateLaunchButtonUi();
  if (
    !wasDownloaded &&
    updaterSnapshot?.downloaded &&
    currentScreen === "launch" &&
    !isLaunchRequestPending &&
    !isLauncherRunning
  ) {
    setLaunchStatus("런처 업데이트가 준비되었습니다. 적용 후 게임을 시작할 수 있습니다.");
  }
  if (!settingsUpdateSummary || !settingsUpdateIndicator || !settingsUpdateChannel || !settingsUpdateVersion || !settingsUpdateActionButton) {
    return;
  }

  const snapshot = updaterSnapshot || {};
  const githubSnapshot = githubReleaseSnapshot && typeof githubReleaseSnapshot === "object" ? githubReleaseSnapshot : null;
  const github = githubSnapshot && githubSnapshot.ok ? githubSnapshot : null;
  const githubConfigured = isGitHubReleaseConfigured(githubSnapshot);
  const githubRepositoryLabel = getGitHubRepositoryLabel(githubSnapshot);
  const githubReleaseUrl = asText(githubSnapshot?.releaseUrl);
  const currentVersion = asText(snapshot.currentVersion);
  const githubVersion = normalizeGitHubTagToVersion(github?.tagName);
  const latestVersion = asText(snapshot.latestVersion) || githubVersion;
  const releaseName =
    asText(snapshot.releaseName) ||
    (github
      ? getGitHubReleaseHeadline(github)
      : githubRepositoryLabel
        ? `GitHub ${githubRepositoryLabel}`
        : githubConfigured
          ? "GitHub Release"
          : "");
  const downloaded = Boolean(snapshot.downloaded);
  const downloading = Boolean(snapshot.downloading);
  const checking = Boolean(snapshot.checking);
  const available = Boolean(snapshot.available);
  const enabled = Boolean(snapshot.enabled);
  const hasError = Boolean(asText(snapshot.lastError));
  const progressPercent = Number(snapshot.progressPercent);
  const hasGitHubReleasePage = Boolean(githubSnapshot?.configured && githubReleaseUrl);

  let summaryText = "최신 버전을 사용하고 있습니다.";
  let actionText = "업데이트 확인";
  let actionDisabled = false;
  let indicatorClass = "";
  let channelText = releaseName || (githubConfigured ? "GitHub Release" : "Stable Release");
  let versionText = `Version ${latestVersion || currentVersion || "-"}`;

  if (!enabled) {
    if (hasGitHubReleasePage) {
      summaryText = "GitHub 릴리즈에서 최신 업데이트를 확인할 수 있습니다.";
      actionText = "GitHub 릴리즈 열기";
      actionDisabled = false;
      indicatorClass = "";
    } else {
      summaryText = "업데이트 기능을 사용할 수 없습니다.";
      actionText = "사용 불가";
      actionDisabled = true;
      indicatorClass = "is-warning";
    }
  } else if (hasError) {
    summaryText = "업데이트 확인 중 문제가 발생했습니다.";
    actionText = "다시 확인";
    indicatorClass = "is-error";
  } else if (downloaded) {
    summaryText = "업데이트 다운로드가 완료되었습니다.";
    actionText = "업데이트 설치";
    indicatorClass = "is-pending";
  } else if (downloading || available) {
    const progressText =
      Number.isFinite(progressPercent) && progressPercent > 0 ? ` (${progressPercent.toFixed(1)}%)` : "";
    summaryText = `업데이트를 다운로드 중입니다.${progressText}`;
    actionText = "다운로드 중";
    actionDisabled = true;
    indicatorClass = "is-pending";
  } else if (checking) {
    summaryText = "업데이트를 확인하고 있습니다.";
    actionText = "확인 중";
    actionDisabled = true;
    indicatorClass = "is-pending";
  }

  if (github && asText(github.publishedAt)) {
    const publishedLabel = formatReleaseDateLabel(github.publishedAt);
    if (publishedLabel !== "-") {
      channelText = `${channelText} · ${publishedLabel}`;
    }
  }

  settingsUpdateSummary.textContent = summaryText;
  settingsUpdateChannel.textContent = channelText;
  settingsUpdateVersion.textContent = versionText;
  settingsUpdateActionButton.textContent = actionText;
  settingsUpdateActionButton.disabled = actionDisabled;

  settingsUpdateIndicator.classList.remove("is-pending", "is-warning", "is-error");
  if (indicatorClass) {
    settingsUpdateIndicator.classList.add(indicatorClass);
  }
}
function applyLogStatus(payload) {
  const level = asText(payload?.level).toLowerCase();
  const message = asText(payload?.message);
  if (!level || !message) {
    return;
  }
  const modpackProgress = parseModpackProgressMessage(message);
  const displayMessage = localizeStatusMessage(
    modpackProgress ? formatModpackProgressStatus(modpackProgress) : message
  );

  const recentLaunchCapture = Date.now() < launchLogCaptureUntil;
  const busy = isLaunchRequestPending || isLauncherRunning || isStartupModpackSyncRunning || recentLaunchCapture;
  const launchRelated = /(minecraft|java|launch|fabric|neoforge|modpack|runtime|auth|session|auto-connect|quickplay|server|port)/i.test(
    message
  );

  if (level === "error") {
    if (busy || launchRelated) {
      setLaunchStatus(displayMessage, true);
    }
    return;
  }

  if (!busy) {
    return;
  }

  if (level === "progress") {
    setLaunchStatus(displayMessage);
    return;
  }

  if (level === "warn" && launchRelated) {
    setLaunchStatus(displayMessage, true);
    return;
  }

  if (
    (level === "info" || level === "warn") &&
    /(preparing|downloading|checking|modpack|fabric|neoforge|installing|runtime|minecraft|java|auth|launch|auto-connect|quickplay|server)/i.test(
      message
    )
  ) {
    setLaunchStatus(displayMessage);
  }
}

async function hideStartupOverlay() {
  if (!startupOverlay || startupOverlay.hidden) {
    return;
  }

  startupOverlayDismissed = true;
  startupOverlay.classList.add("hidden");
  await delay(STARTUP_FADE_DURATION_MS);
  startupOverlay.hidden = true;
}

async function runMicrosoftLogin() {
  const result = await window.launcherApi.microsoftLogin();
  if (result?.status) {
    applyAuthState(result.status);
  } else {
    applyAuthState({
      ...authState,
      loggingIn: false
    });
  }
}

switchScreen("login");
updateLaunchButtonUi();
updateSettingsAboutReleaseUi();
renderSettingsAboutNewsItems();
applyNewsPanelExpandedState(readStoredNewsPanelExpanded(), false);
bindResolutionInputGuards();
bindJavaMemoryControlEvents();

bindClick(gateMicrosoftLoginButton, async () => {
  if (!isLoginFlowActive()) {
    loginRequestedByUser = true;
    applyAuthState({
      ...authState,
      loggingIn: true
    });
  }
  await runMicrosoftLogin();
});

bindClick(discordButton, async (event) => {
  event.preventDefault();
  const discordUrl = activeModpack?.discordUrl;
  if (!discordUrl) return;
  const result = await window.launcherApi.openExternal(discordUrl);
  if (!result?.ok && gateAuthStatus) {
    gateAuthStatus.textContent = "\uB514\uC2A4\uCF54\uB4DC \uB9C1\uD06C\uB97C \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
  }
});

bindClick(settingsButton, () => {
  openSettingsScreen();
});

bindClick(newsPanelExpandButton, () => {
  applyNewsPanelExpandedState(!isNewsPanelExpanded);
});

bindClick(accountModelPanel, () => {
  if (!authState.signedIn) {
    return;
  }
  openSettingsScreen("settingsTabAccount");
});

if (accountModelPanel) {
  accountModelPanel.addEventListener("keydown", (event) => {
    if (!authState.signedIn) {
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openSettingsScreen("settingsTabAccount");
  });
}

bindClick(startLaunchButton, async () => {
  await launchGame();
});

bindClick(settingsCloseButton, () => {
  closeSettingsScreen();
});

bindClick(settingsDoneButton, async () => {
  await saveSettings(true);
});

if (settingsScreen) {
  settingsScreen.addEventListener("click", (event) => {
    if (event.target === settingsScreen) {
      closeSettingsScreen();
    }
  });
}

for (const navItem of settingsNavItems) {
  navItem.addEventListener("click", () => {
    selectSettingsTab(navItem.dataset.settingsTab || "settingsTabAccount");
  });
}

bindClick(settingsPickMinecraftDirectoryButton, async () => {
  const pickedDirectory = await window.launcherApi.pickDirectory();
  if (!pickedDirectory) {
    return;
  }

  if (settingsMinecraftDirectoryInput) {
    settingsMinecraftDirectoryInput.value = pickedDirectory;
  }

  await refreshProfilesForDirectory(pickedDirectory, "");
  setSettingsStatus("\uB9C8\uC778\uD06C\uB798\uD504\uD2B8 \uD3F4\uB354\uAC00 \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
});

bindClick(settingsAutoJavaPathButton, async () => {
  if (!window.launcherApi || typeof window.launcherApi.autoSelectJava !== "function") {
    setSettingsStatus("Java 자동 선택 기능을 사용할 수 없습니다.", true);
    return;
  }

  const minecraftDirectory =
    asText(settingsMinecraftDirectoryInput?.value) ||
    asText(launcherSettings.minecraftDirectory) ||
    asText(launcherDefaults.minecraftDirectory);
  if (!minecraftDirectory) {
    setSettingsStatus("Minecraft 폴더를 먼저 선택해 주세요.", true);
    return;
  }

  if (settingsAutoJavaPathButton) {
    settingsAutoJavaPathButton.disabled = true;
  }
  if (settingsPickJavaPathButton) {
    settingsPickJavaPathButton.disabled = true;
  }
  setSettingsStatus(`Java ${activeModpack?.javaMajor || 21} 실행 파일 자동 선택 중...`);

  try {
    const result = await window.launcherApi.autoSelectJava({ minecraftDirectory, projectId: activeProjectId });
    if (!result?.ok || !asText(result?.javaPath)) {
      setSettingsStatus(asText(result?.error) || "Java 실행 파일 자동 선택에 실패했습니다.", true);
      return;
    }

    applyResolvedJavaPath(result.javaPath);
    setSettingsStatus("Java 실행 파일을 자동 선택했습니다.");
  } catch (error) {
    setSettingsStatus(asText(error?.message) || "Java 실행 파일 자동 선택에 실패했습니다.", true);
  } finally {
    if (settingsAutoJavaPathButton) {
      settingsAutoJavaPathButton.disabled = false;
    }
    if (settingsPickJavaPathButton) {
      settingsPickJavaPathButton.disabled = false;
    }
  }
});

bindClick(settingsPickJavaPathButton, async () => {
  const pickedJavaPath = await window.launcherApi.pickJava();
  if (!pickedJavaPath) {
    return;
  }

  if (settingsJavaPathInput) {
    settingsJavaPathInput.value = pickedJavaPath;
  }

  updateJavaPathStatus();
  setSettingsStatus("");
});

bindClick(settingsMicrosoftAddButton, async () => {
  if (authState.loggingIn || !window.launcherApi || typeof window.launcherApi.microsoftLogin !== "function") {
    return;
  }

  if (settingsMicrosoftAddButton) {
    settingsMicrosoftAddButton.disabled = true;
  }
  setSettingsStatus("Microsoft 로그인 진행 중...");

  try {
    const previousAccountCount = Array.isArray(authState.accounts) ? authState.accounts.length : 0;
    const previousUuid = normalizeMinecraftUuid(authState.uuid);
    const result = await window.launcherApi.microsoftLogin();
    if (result?.status) {
      applyAuthState(result.status);
      const nextAccountCount = Array.isArray(result.status.accounts) ? result.status.accounts.length : 0;
      const nextUuid = normalizeMinecraftUuid(result.status.uuid);
      if (previousUuid && nextUuid === previousUuid && nextAccountCount > previousAccountCount) {
        setSettingsStatus("Microsoft 계정이 추가되었습니다. 현재 선택 계정은 유지됩니다.");
      } else if (result.ok) {
        setSettingsStatus("Microsoft 계정이 연결되었습니다.");
      } else if (result.error) {
        setSettingsStatus(localizeStatusMessage(result.error), true);
      }
    }
  } catch {
    setSettingsStatus("Microsoft 로그인을 시작할 수 없습니다.", true);
  } finally {
    updateSettingsAccountUi();
  }
});

if (settingsAccountList) {
  const selectAccountFromCard = async (target) => {
    if (!target || authState.loggingIn || !window.launcherApi || typeof window.launcherApi.selectMicrosoftAccount !== "function") {
      return;
    }

    if (target.classList.contains("is-selected")) {
      return;
    }

    const accountId = asText(target.dataset.accountId);
    if (!accountId) {
      return;
    }

    const result = await window.launcherApi.selectMicrosoftAccount(accountId);
    if (result?.status) {
      applyAuthState(result.status);
    }
    if (result?.ok) {
      setSettingsStatus("선택 계정을 변경했습니다.");
    } else if (result?.error) {
      setSettingsStatus(localizeStatusMessage(result.error), true);
    }
  };

  settingsAccountList.addEventListener("click", async (event) => {
    const actionTarget = event.target instanceof Element ? event.target.closest("[data-action='logout']") : null;
    if (actionTarget) {
      const result = await window.launcherApi.microsoftLogout();
      if (result?.status) {
        applyAuthState(result.status);
        setSettingsStatus("Microsoft에서 로그아웃했습니다.");
      }
      return;
    }

    const target = event.target instanceof Element ? event.target.closest(".settings-account-card") : null;
    await selectAccountFromCard(target);
  });

  settingsAccountList.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const target = event.target instanceof Element ? event.target.closest(".settings-account-card") : null;
    if (!target) {
      return;
    }

    event.preventDefault();
    await selectAccountFromCard(target);
  });
}

if (settingsProfileSelect) {
  settingsProfileSelect.addEventListener("change", () => {
    setSettingsStatus("");
  });
}

bindClick(settingsUpdateActionButton, async () => {
  if (!window.launcherApi || typeof window.launcherApi.getUpdaterState !== "function") {
    return;
  }

  const githubReleaseUrl = asText(githubReleaseSnapshot?.releaseUrl);
  const state = updaterSnapshot || (await window.launcherApi.getUpdaterState().catch(() => null));
  if (!state || !state.enabled) {
    if (githubReleaseUrl) {
      const openResult = await window.launcherApi.openExternal(githubReleaseUrl).catch((error) => ({
        ok: false,
        error: asText(error?.message) || "GitHub 릴리즈 페이지를 열 수 없습니다."
      }));
      if (openResult?.ok) {
        setSettingsStatus("GitHub 릴리즈 페이지를 열었습니다.");
      } else {
        setSettingsStatus(asText(openResult?.error) || "GitHub 릴리즈 페이지를 열 수 없습니다.", true);
      }
      return;
    }

    setSettingsStatus("업데이트 기능을 사용할 수 없습니다.", true);
    return;
  }

  if (state.downloaded) {
    const installResult = await window.launcherApi.installUpdate().catch((error) => ({
      ok: false,
      error: asText(error?.message) || "업데이트 설치 요청에 실패했습니다."
    }));
    if (installResult?.ok) {
      setSettingsStatus("업데이트 설치를 위해 런처를 다시 시작합니다.");
    } else {
      setSettingsStatus(asText(installResult?.error) || "업데이트 설치 요청에 실패했습니다.", true);
    }
    return;
  }

  const checkResult = await window.launcherApi.checkForUpdates().catch((error) => ({
    ok: false,
    error: asText(error?.message) || "업데이트 확인에 실패했습니다."
  }));
  if (!checkResult?.ok) {
    setSettingsStatus(asText(checkResult?.error) || "업데이트 확인에 실패했습니다.", true);
    return;
  }
  if (checkResult.downloaded) {
    setSettingsStatus("업데이트 다운로드가 완료되었습니다. 런처를 다시 시작하면 적용됩니다.");
    return;
  }
  setSettingsStatus("런처가 최신 버전입니다.");
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentScreen === "launch" && isNewsPanelExpanded) {
    applyNewsPanelExpandedState(false);
    return;
  }
  if (event.key === "Escape" && currentScreen === "settings") {
    closeSettingsScreen();
  }
});

bindClick(windowMinimizeButton, () => {
  window.launcherApi.minimizeWindow();
});

bindClick(windowMaximizeButton, () => {
  window.launcherApi.toggleMaximizeWindow();
});

bindClick(windowCloseButton, () => {
  window.launcherApi.closeWindow();
});

window.launcherApi.onAuthState((payload) => {
  applyAuthState(payload);
});

window.launcherApi.onWindowState((payload) => {
  applyWindowState(payload);
});

window.launcherApi.onState((payload) => {
  applyLauncherState(payload);
});

window.launcherApi.onUpdaterState((payload) => {
  updateUpdaterUi(payload);
});

window.launcherApi.onLog((payload) => {
  applyStartupLogStatus(payload);
  applyLogStatus(payload);
});

window.addEventListener("beforeunload", () => {
  stopNewsPolling();
  stopPlayerCountPolling();
  stopModpackUpdatePolling();
});

Promise.resolve()
  .then(() => {
    setStartupProgress(0, "\uB7F0\uCC98 \uC124\uC815 \uBD88\uB7EC\uC624\uB294 \uC911...", false, true);
    const githubReleasePromise =
      window.launcherApi && typeof window.launcherApi.getGitHubRelease === "function"
        ? window.launcherApi.getGitHubRelease().catch(() => null)
        : Promise.resolve(null);
    return Promise.all([
      window.launcherApi.getAuthState(),
      window.launcherApi.getWindowState(),
      initializeSettings(),
      window.launcherApi.getUpdaterState().catch(() => null),
      githubReleasePromise
    ]);
  })
  .then(async ([state, windowState, _, updaterState, githubRelease]) => {
    applyAuthState(state);
    applyWindowState(windowState);
    applyGitHubReleaseUi(githubRelease);
    updateUpdaterUi(updaterState);
    setStartupProgress(STARTUP_SETTINGS_PROGRESS, "\uB7F0\uCC98 \uC124\uC815 \uBD88\uB7EC\uC624\uAE30 \uC644\uB8CC.");
    await ensureLatestLauncherOnStartup();
    isLauncherInitialized = true;
    await prepareModpackForSession();
  })
  .then(async () => {
    setStartupProgress(STARTUP_FINALIZING_PROGRESS, "\uB7F0\uCC98 \uC2DC\uC791 \uB9C8\uBB34\uB9AC \uC911...");
    const elapsed = Date.now() - startupStartedAt;
    const wait = Math.max(0, STARTUP_MIN_DURATION_MS - elapsed);
    if (wait > 0) {
      await delay(wait);
    }
    setStartupProgress(STARTUP_COMPLETE_PROGRESS, "\uC2DC\uC791 \uC644\uB8CC.");
    await hideStartupOverlay();
    if (currentScreen === "launch") startLaunchButton?.focus();
  })
  .catch(async (error) => {
    const message = localizeStatusMessage(
      asText(error?.message) || "\uC2DC\uC791 \uC2E4\uD328. \uACC4\uC18D \uC9C4\uD589\uD569\uB2C8\uB2E4."
    );
    setStartupProgress(startupProgressPercent, message, true);
    isLauncherInitialized = true;
    setLaunchStatus(message, true);
    if (gateAuthStatus) gateAuthStatus.textContent = privateStatusText(message);
    await hideStartupOverlay();
  });
