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
const PLAYER_COUNT_REFRESH_MS = 30000;
const NEWS_REFRESH_DEFAULT_MS = 60000;
const NEWS_REFRESH_MIN_MS = 5000;
const NEWS_REFRESH_MAX_MS = 30 * 60 * 1000;
const PRESET_TRANSITION_FADE_MS = 980;
const PRESET_ICON_FADE_MS = 640;
const PRESET_TRANSITION_SETTLE_MS = 120;
const GITHUB_RELEASE_NOTES_MAX_ITEMS = 8;
const JAVA_RAM_MIN_MB = 6144;
const JAVA_RAM_STEP_MB = 512;
const DISCORD_INVITE_URL = "https://example.invalid/private";
const SETTINGS_STORAGE_KEY = "bettermon.launcher.settings.v1";
const NEWS_PANEL_EXPANDED_STORAGE_KEY = "bettermon.launcher.news.expanded.v1";
const LOGIN_WAITING_ENTER_DELAY_MS = 220;
const LOGIN_GATE_ENTER_DELAY_MS = 180;
const MODPACK_PROGRESS_PATTERN = /\[Modpack\s+(\d+)\s*\/\s*(\d+)\]\s*(.*)/i;
const LAUNCHER_BGM_DEFAULT_SOURCE = "./assets/audio/launcher_bgm.ogg";
const LAUNCHER_BGM_GHOST_SOURCE = "./assets/audio/ghost_bgm.ogg";
const LAUNCHER_BGM_GHOST_PROBABILITY = 0.01;
const DEFAULT_LAUNCHER_BGM_VOLUME = 35;

const DEFAULT_SETTINGS = {
  gameWidth: 1280,
  gameHeight: 720,
  fullscreen: false,
  autoConnect: true,
  launchDetached: false,
  minecraftDirectory: "",
  selectedProfile: "",
  javaPath: "",
  jvmArgs: "",
  ramMin: JAVA_RAM_MIN_MB,
  ramMax: JAVA_RAM_MIN_MB,
  dataDirectory: "",
  launcherPreset: "",
  bgmVolume: DEFAULT_LAUNCHER_BGM_VOLUME,
  bgmMuted: false
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
const launchPresetPanel = document.getElementById("launchPresetPanel");
const launchPresetSelect = document.getElementById("launchPresetSelect");
const newsPanel = document.getElementById("newsPanel");
const newsList = document.getElementById("newsList");
const newsPanelBadge = document.getElementById("newsPanelBadge");
const newsPanelExpandButton = document.getElementById("newsPanelExpandButton");
const playerCountPanel = document.getElementById("playerCountPanel");
const playerCountValue = document.getElementById("playerCountValue");
const playerCountTooltip = document.getElementById("playerCountTooltip");
const discordButton = document.getElementById("discordButton");
const settingsButton = document.getElementById("settingsButton");
const bgmToggleButton = document.getElementById("bgmToggleButton");
const bgmVolumeSlider = document.getElementById("bgmVolumeSlider");
const bgmVolumeValue = document.getElementById("bgmVolumeValue");
const startLaunchButton = document.getElementById("startLaunchButton");
const launchStatus = document.getElementById("launchStatus");
const settingsCloseButton = document.getElementById("settingsCloseButton");
const settingsDoneButton = document.getElementById("settingsDoneButton");
const settingsStatus = document.getElementById("settingsStatus");
const settingsMicrosoftAddButton = document.getElementById("settingsMicrosoftAdd");
const settingsAccountList = document.getElementById("settingsAccountList");
const settingsGameWidthInput = document.getElementById("settingsGameWidth");
const settingsGameHeightInput = document.getElementById("settingsGameHeight");
const settingsFullscreenInput = document.getElementById("settingsFullscreen");
const settingsAutoConnectInput = document.getElementById("settingsAutoConnect");
const settingsLaunchDetachedInput = document.getElementById("settingsLaunchDetached");
const settingsMinecraftDirectoryInput = document.getElementById("settingsMinecraftDirectory");
const settingsPickMinecraftDirectoryButton = document.getElementById("settingsPickMinecraftDirectory");
const settingsProfileSelect = document.getElementById("settingsProfileSelect");
const settingsJavaPathInput = document.getElementById("settingsJavaPath");
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
const settingsLauncherPresetSelect = document.getElementById("settingsLauncherPreset");
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
const settingsPresetHint = document.getElementById("settingsPresetHint");
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
  autoConnect: settingsAutoConnectInput,
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
let hasStartupModpackSyncRun = false;
let isPresetModpackSyncRunning = false;
let isModpackUpdateApplyRunning = false;
let modpackUpdateState = null;
let pendingPresetSyncPreset = "";
let isLauncherUpdateGateRunning = false;
let isBackgroundPresetPrefetchRunning = false;
let activeBackgroundPresetCachePreset = "";
let pendingBackgroundPresetCachePreset = "";
let startupProgressPercent = 0;
let startupOverlayDismissed = false;
let launchLogCaptureUntil = 0;
let launchStartTimeoutId = null;
let lastAccountModelKey = "";
let newsRefreshMs = NEWS_REFRESH_DEFAULT_MS;
let newsPollTimer = null;
let isNewsRequestPending = false;
let currentNewsItems = [];
let lastRenderedNewsSignature = "";
let isNewsPanelExpanded = false;
let playerCountPollTimer = null;
let isPlayerCountRequestPending = false;
let presetTransitionTimeoutId = null;
let presetTransitionSequenceId = 0;
let updaterSnapshot = null;
let githubReleaseSnapshot = null;
let isGitHubReleaseRequestPending = false;
let launcherBgmAudio = null;
let launcherBgmRetryOnInteraction = false;
let isLauncherBgmPlayPending = false;
let hasLauncherBgmFallbackApplied = false;
let launcherBgmSource =
  Math.random() < LAUNCHER_BGM_GHOST_PROBABILITY ? LAUNCHER_BGM_GHOST_SOURCE : LAUNCHER_BGM_DEFAULT_SOURCE;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fallbackLauncherBgmSource() {
  if (hasLauncherBgmFallbackApplied || launcherBgmSource === LAUNCHER_BGM_DEFAULT_SOURCE) {
    return false;
  }

  hasLauncherBgmFallbackApplied = true;
  launcherBgmSource = LAUNCHER_BGM_DEFAULT_SOURCE;
  if (launcherBgmAudio) {
    launcherBgmAudio.pause();
    launcherBgmAudio.src = launcherBgmSource;
    launcherBgmAudio.load();
  }
  return true;
}

function getNormalizedLauncherBgmVolume(value = launcherSettings?.bgmVolume) {
  return asNumber(value, DEFAULT_LAUNCHER_BGM_VOLUME, 0, 100);
}

function isLauncherBgmMuted() {
  return Boolean(launcherSettings?.bgmMuted) || getNormalizedLauncherBgmVolume() <= 0;
}

function shouldPlayLauncherBgm() {
  if (document.hidden) {
    return false;
  }

  if (isStartupOverlayVisible()) {
    return false;
  }

  if (isLaunchRequestPending || isLauncherRunning) {
    return false;
  }

  return (currentScreen === "launch" || currentScreen === "settings") && !isLauncherBgmMuted();
}

function updateLauncherBgmControls() {
  const volume = getNormalizedLauncherBgmVolume();
  const muted = isLauncherBgmMuted();
  const displayVolume = muted ? 0 : volume;

  if (bgmVolumeSlider) {
    bgmVolumeSlider.value = String(displayVolume);
    bgmVolumeSlider.setAttribute("aria-valuenow", String(displayVolume));
    bgmVolumeSlider.setAttribute("aria-valuetext", muted ? "음소거" : `${displayVolume}%`);
    bgmVolumeSlider.style.setProperty("--bgm-volume-ratio", `${displayVolume}%`);
  }

  if (bgmVolumeValue) {
    bgmVolumeValue.textContent = muted ? "OFF" : `${displayVolume}%`;
  }

  if (bgmToggleButton) {
    bgmToggleButton.setAttribute("aria-pressed", muted ? "true" : "false");
    bgmToggleButton.setAttribute("aria-label", muted ? "배경음 켜기" : "배경음 끄기");
    bgmToggleButton.removeAttribute("title");
    bgmToggleButton.classList.toggle("is-muted", muted);
  }
}

function ensureLauncherBgmAudio() {
  if (launcherBgmAudio) {
    return launcherBgmAudio;
  }

  const audio = new Audio(launcherBgmSource);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = getNormalizedLauncherBgmVolume() / 100;
  audio.muted = Boolean(launcherSettings?.bgmMuted);
  audio.addEventListener("error", () => {
    if (fallbackLauncherBgmSource()) {
      window.setTimeout(() => {
        void startLauncherBgmPlayback();
      }, 0);
      return;
    }
    console.warn(`Launcher BGM failed to load: ${launcherBgmSource}`);
  });

  launcherBgmAudio = audio;
  return audio;
}

async function startLauncherBgmPlayback() {
  const audio = ensureLauncherBgmAudio();
  audio.volume = getNormalizedLauncherBgmVolume() / 100;
  audio.muted = Boolean(launcherSettings?.bgmMuted);

  if (!shouldPlayLauncherBgm()) {
    audio.pause();
    return;
  }

  if (!audio.paused || isLauncherBgmPlayPending) {
    return;
  }

  isLauncherBgmPlayPending = true;
  try {
    await audio.play();
    launcherBgmRetryOnInteraction = false;
  } catch (error) {
    launcherBgmRetryOnInteraction = true;
    console.warn(`Launcher BGM playback was blocked: ${String(error?.message || error)}`);
  } finally {
    isLauncherBgmPlayPending = false;
  }
}

function retryLauncherBgmPlaybackOnInteraction() {
  if (!launcherBgmRetryOnInteraction) {
    return;
  }
  void startLauncherBgmPlayback();
}

function syncLauncherBgmPlayback() {
  updateLauncherBgmControls();

  const audio = ensureLauncherBgmAudio();
  audio.volume = getNormalizedLauncherBgmVolume() / 100;
  audio.muted = Boolean(launcherSettings?.bgmMuted);

  if (!shouldPlayLauncherBgm()) {
    if (!audio.paused) {
      audio.pause();
    }
    return;
  }

  void startLauncherBgmPlayback();
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
  const previousScreen = currentScreen;
  const next = targetScreen in SCREEN_ELEMENTS ? targetScreen : "login";
  currentScreen = next;
  if (document.body) {
    document.body.setAttribute("data-screen", next);
  }

  if (previousScreen !== next) {
    resetPresetTransitionEffects();
  }

  for (const [screenKey, screenElement] of Object.entries(SCREEN_ELEMENTS)) {
    if (!screenElement) {
      continue;
    }

    const isActive = screenKey === next;
    screenElement.hidden = false;
    screenElement.classList.toggle("screen-active", isActive);
    setAriaHidden(screenElement, !isActive);
  }

  updateLoginWaitingState();
  syncLauncherBgmPlayback();
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

function buildMinecraftBodyModelUrlCandidates(uuid, profileName = "") {
  const safeUuid = normalizeMinecraftUuid(uuid);
  const safeName = encodeURIComponent(asText(profileName));
  const urls = [];

  if (safeUuid) {
    urls.push(`https://mc-heads.net/body/${safeUuid}/right`);
    urls.push(`https://starlightskins.lunareclipse.studio/render/default/${safeUuid}/full?renderScale=3`);
    urls.push(`https://minotar.net/body/${safeUuid}/256.png`);
  }

  if (safeName) {
    urls.push(`https://mc-heads.net/body/${safeName}/right`);
    urls.push(`https://minotar.net/body/${safeName}/256.png`);
  }

  return urls;
}

function updateAccountModelUi() {
  if (!accountModelPanel) {
    return;
  }

  if (!authState.signedIn) {
    accountModelPanel.hidden = true;
    if (launchPresetPanel) {
      launchPresetPanel.hidden = true;
    }
    lastAccountModelKey = "";
    if (accountModelImage) {
      accountModelImage.onerror = null;
      accountModelImage.onload = null;
      accountModelImage.src = "./assets/app-icon.png";
      accountModelImage.alt = "\uB85C\uADF8\uC778 \uACC4\uC815 \uBAA8\uB378";
    }
    if (accountModelName) {
      accountModelName.textContent = "\uB85C\uADF8\uC778 \uC548 \uB428";
    }
    return;
  }

  const uuid = normalizeMinecraftUuid(authState.uuid);
  const displayName = asText(authState.profileName, "\uD50C\uB808\uC774\uC5B4");
  const modelKey = uuid || `name:${displayName.toLowerCase()}`;
  accountModelPanel.hidden = false;
  if (launchPresetPanel) {
    launchPresetPanel.hidden = false;
  }

  if (accountModelName) {
    accountModelName.textContent = displayName;
  }

  if (!accountModelImage) {
    return;
  }

  if (modelKey === lastAccountModelKey) {
    return;
  }

  lastAccountModelKey = modelKey;
  accountModelImage.alt = `${displayName} \uBAA8\uB378`;

  const candidates = buildMinecraftBodyModelUrlCandidates(uuid, displayName);
  if (candidates.length === 0) {
    accountModelImage.onerror = null;
    accountModelImage.onload = null;
    accountModelImage.src = "./assets/app-icon.png";
    return;
  }

  let candidateIndex = 0;
  const tryNextCandidate = () => {
    if (candidateIndex >= candidates.length) {
      accountModelImage.onerror = null;
      accountModelImage.src = "./assets/app-icon.png";
      return;
    }
    accountModelImage.src = candidates[candidateIndex];
    candidateIndex += 1;
  };

  accountModelImage.onerror = () => {
    tryNextCandidate();
  };
  accountModelImage.onload = () => {
    accountModelImage.onerror = null;
  };
  tryNextCandidate();
}

function loadMinecraftModelImage(imageElement, uuidValue, profileNameValue) {
  if (!imageElement) {
    return;
  }

  const uuid = normalizeMinecraftUuid(uuidValue);
  const displayName = asText(profileNameValue, "플레이어");
  imageElement.alt = `${displayName} 모델`;

  const candidates = buildMinecraftBodyModelUrlCandidates(uuid, displayName);
  if (candidates.length === 0) {
    imageElement.onerror = null;
    imageElement.onload = null;
    imageElement.src = "./assets/app-icon.png";
    return;
  }

  let candidateIndex = 0;
  const tryNextCandidate = () => {
    if (candidateIndex >= candidates.length) {
      imageElement.onerror = null;
      imageElement.src = "./assets/app-icon.png";
      return;
    }
    imageElement.src = candidates[candidateIndex];
    candidateIndex += 1;
  };

  imageElement.onerror = () => {
    tryNextCandidate();
  };
  imageElement.onload = () => {
    imageElement.onerror = null;
  };
  tryNextCandidate();
}

function clampNewsRefreshMs(value, fallback = NEWS_REFRESH_DEFAULT_MS) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(NEWS_REFRESH_MIN_MS, Math.min(NEWS_REFRESH_MAX_MS, parsed));
}

function normalizeNewsItem(rawItem) {
  if (typeof rawItem === "string") {
    const text = asText(rawItem);
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

  const text = asText(rawItem.text);
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
    return [];
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

async function refreshGitHubReleaseInfo(force = false) {
  if (!window.launcherApi || typeof window.launcherApi.getGitHubRelease !== "function") {
    return;
  }
  if (isGitHubReleaseRequestPending && !force) {
    return;
  }

  isGitHubReleaseRequestPending = true;
  try {
    const snapshot = await window.launcherApi.getGitHubRelease();
    applyGitHubReleaseUi(snapshot);
  } catch (error) {
    if (!githubReleaseSnapshot) {
      applyGitHubReleaseUi({
        ok: false,
        configured: false,
        error: asText(error?.message) || "Failed to load GitHub release."
      });
    }
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

function applyLauncherNewsUi(snapshot) {
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
  const didRenderNews = renderNewsItems(currentNewsItems);
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

async function refreshLauncherNews(force = false) {
  if (!newsList || !window.launcherApi || typeof window.launcherApi.getNews !== "function") {
    return;
  }
  if (isNewsRequestPending && !force) {
    return;
  }

  isNewsRequestPending = true;
  try {
    const snapshot = await window.launcherApi.getNews();
    const nextRefreshMs = clampNewsRefreshMs(snapshot?.refreshMs, newsRefreshMs);
    if (nextRefreshMs !== newsRefreshMs) {
      newsRefreshMs = nextRefreshMs;
      if (newsPollTimer !== null) {
        restartNewsPollingTimer();
      }
    }
    applyLauncherNewsUi(snapshot);
  } catch {
    setNewsBadgeText("\uC624\uD504\uB77C\uC778");
  } finally {
    isNewsRequestPending = false;
  }
}

function startNewsPolling() {
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

  void refreshLauncherNews(true);
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
    ? server.playerNames.map((name) => asText(name)).filter(Boolean)
    : [];
  if (names.length === 0) {
    return "";
  }
  return names.join("\n");
}

function applyPlayerCountUi(snapshot) {
  if (!playerCountValue) {
    return;
  }

  if (!snapshot || snapshot.ok === false) {
    setPlayerCountText("\uD655\uC778 \uC2E4\uD328", true);
    setPlayerCountTooltip(asText(snapshot?.error));
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
    setPlayerCountTooltip(asText(server?.error));
    return;
  }

  setPlayerCountText("\uD655\uC778 \uC911...", false);
  setPlayerCountTooltip(asText(server?.error));
}

async function refreshPlayerCount(force = false) {
  if (!window.launcherApi || typeof window.launcherApi.getServerStatus !== "function") {
    setPlayerCountText("\uD655\uC778 \uC2E4\uD328", true);
    return;
  }
  if (isPlayerCountRequestPending && !force) {
    return;
  }

  isPlayerCountRequestPending = true;
  try {
    const snapshot = await window.launcherApi.getServerStatus();
    applyPlayerCountUi(snapshot);
  } catch (error) {
    setPlayerCountText("\uD655\uC778 \uC2E4\uD328", true);
    setPlayerCountTooltip(String(error?.message || error));
  } finally {
    isPlayerCountRequestPending = false;
  }
}

function startPlayerCountPolling() {
  if (!playerCountValue) {
    return;
  }

  if (playerCountPollTimer !== null) {
    window.clearInterval(playerCountPollTimer);
  }
  void refreshPlayerCount(true);
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
    "Downloading Java runtime...": "Java \uB7F0\uD0C0\uC784 \uB2E4\uC6B4\uB85C\uB4DC \uC911...",
    "Extracting Java runtime...": "Java \uB7F0\uD0C0\uC784 \uCD94\uCD9C \uC911...",
    "Using system Java runtime from PATH.": "PATH\uC5D0 \uB4F1\uB85D\uB41C \uC2DC\uC2A4\uD15C Java \uB7F0\uD0C0\uC784 \uC0AC\uC6A9 \uC911.",
    "Fetching Fabric loader metadata...": "\uD328\uBE0C\uB9AD \uB85C\uB354 \uBA54\uD0C0\uB370\uC774\uD130 \uC870\uD68C \uC911...",
    "Analyzing modpack archive contents...": "\uBAA8\uB4DC\uD329 \uC544\uCE74\uC774\uBE0C \uB0B4\uC6A9 \uBD84\uC11D \uC911...",
    "Cleaning previous modpack files...": "\uAE30\uC874 \uBAA8\uB4DC\uD329 \uD30C\uC77C \uC815\uB9AC \uC911...",
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
    /^Using bundled Java runtime:\s*(.+)$/i,
    "\uB0B4\uC7A5 Java \uB7F0\uD0C0\uC784 \uC0AC\uC6A9: $1"
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

function normalizeLauncherPreset(value, fallback = "high") {
  const preset = asText(value).toLowerCase();
  if (preset === "low" || preset === "high") {
    return preset;
  }
  return fallback === "low" ? "low" : "high";
}

function getBackgroundImageUrlForPreset(preset) {
  return normalizeLauncherPreset(preset, "high") === "low"
    ? "./assets/background_low.png"
    : "./assets/background_high.png";
}

function getCurrentBodyPreset() {
  if (!document.body) {
    return "";
  }
  const current = asText(document.body.getAttribute("data-launcher-preset")).toLowerCase();
  return current === "low" || current === "high" ? current : "";
}

function ensurePresetTransitionOverlay() {
  if (!document.body) {
    return null;
  }
  let overlay = document.getElementById("presetTransitionOverlay");
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "presetTransitionOverlay";
  overlay.className = "preset-transition-overlay";
  document.body.appendChild(overlay);
  return overlay;
}

function setPresetTransitionIconsHidden(hidden) {
  if (!document.body) {
    return;
  }
  document.body.classList.toggle("preset-icons-hidden", Boolean(hidden));
}

function resetPresetTransitionEffects() {
  presetTransitionSequenceId += 1;
  setPresetTransitionIconsHidden(false);

  if (presetTransitionTimeoutId !== null) {
    window.clearTimeout(presetTransitionTimeoutId);
    presetTransitionTimeoutId = null;
  }

  const overlay = document.getElementById("presetTransitionOverlay");
  if (overlay) {
    overlay.classList.remove("is-fading");
  }
}

function playPresetBackgroundTransition(previousPreset, nextPreset) {
  const previous = normalizeLauncherPreset(previousPreset, "");
  const next = normalizeLauncherPreset(nextPreset, "");
  if (!previous || !next || previous === next || (currentScreen !== "launch" && currentScreen !== "settings")) {
    return;
  }

  const overlay = ensurePresetTransitionOverlay();
  if (!overlay) {
    return;
  }

  overlay.style.background = `url("${getBackgroundImageUrlForPreset(previous)}") center / cover no-repeat`;
  overlay.classList.remove("is-fading");
  void overlay.offsetWidth;
  overlay.classList.add("is-fading");

  if (presetTransitionTimeoutId !== null) {
    window.clearTimeout(presetTransitionTimeoutId);
    presetTransitionTimeoutId = null;
  }
  presetTransitionTimeoutId = window.setTimeout(() => {
    overlay.classList.remove("is-fading");
    presetTransitionTimeoutId = null;
  }, PRESET_TRANSITION_FADE_MS + 100);
}

async function runPresetLaunchTransition(previousPreset, nextPreset) {
  const previous = normalizeLauncherPreset(previousPreset, "");
  const next = normalizeLauncherPreset(nextPreset, getRecommendedLauncherPreset());

  if (!document.body) {
    return;
  }

  if (!previous || previous === next || currentScreen !== "launch") {
    resetPresetTransitionEffects();
    document.body.setAttribute("data-launcher-preset", next);
    return;
  }

  const sequenceId = ++presetTransitionSequenceId;
  setPresetTransitionIconsHidden(true);
  await delay(PRESET_ICON_FADE_MS);
  if (sequenceId !== presetTransitionSequenceId || currentScreen !== "launch") {
    return;
  }

  document.body.setAttribute("data-launcher-preset", next);
  playPresetBackgroundTransition(previous, next);

  await delay(PRESET_TRANSITION_FADE_MS + PRESET_TRANSITION_SETTLE_MS);
  if (sequenceId !== presetTransitionSequenceId || currentScreen !== "launch") {
    return;
  }

  setPresetTransitionIconsHidden(false);
}

async function runPresetBackgroundOnlyTransition(previousPreset, nextPreset) {
  const previous = normalizeLauncherPreset(previousPreset, "");
  const next = normalizeLauncherPreset(nextPreset, getRecommendedLauncherPreset());

  if (!document.body) {
    return;
  }

  if (!previous || previous === next || currentScreen !== "settings") {
    resetPresetTransitionEffects();
    document.body.setAttribute("data-launcher-preset", next);
    return;
  }

  const sequenceId = ++presetTransitionSequenceId;
  document.body.setAttribute("data-launcher-preset", next);
  playPresetBackgroundTransition(previous, next);

  await delay(PRESET_TRANSITION_FADE_MS + PRESET_TRANSITION_SETTLE_MS);
  if (sequenceId !== presetTransitionSequenceId || currentScreen !== "settings") {
    return;
  }
}

function normalizeSettings(raw, defaults = DEFAULT_SETTINGS) {
  const source = raw && typeof raw === "object" ? raw : {};
  const unifiedRamMb = asNumber(source.ramMax ?? source.ramMin, defaults.ramMax, JAVA_RAM_MIN_MB, 32768);
  const normalizedJvmArgs = asText(source.jvmArgs);
  const normalized = {
    gameWidth: asNumber(source.gameWidth, defaults.gameWidth, 320, 7680),
    gameHeight: asNumber(source.gameHeight, defaults.gameHeight, 240, 4320),
    fullscreen: asBoolean(source.fullscreen, defaults.fullscreen),
    autoConnect: true,
    launchDetached: asBoolean(source.launchDetached, defaults.launchDetached),
    minecraftDirectory: asText(source.minecraftDirectory, defaults.minecraftDirectory),
    selectedProfile: "",
    javaPath: asText(source.javaPath, defaults.javaPath),
    jvmArgs: normalizedJvmArgs || asText(defaults.jvmArgs),
    ramMin: unifiedRamMb,
    ramMax: unifiedRamMb,
    dataDirectory: asText(source.dataDirectory, defaults.dataDirectory),
    bgmVolume: getNormalizedLauncherBgmVolume(source.bgmVolume ?? defaults.bgmVolume),
    bgmMuted: asBoolean(source.bgmMuted, defaults.bgmMuted),
    launcherPreset: asText(source.launcherPreset)
      ? normalizeLauncherPreset(source.launcherPreset, asText(defaults.launcherPreset))
      : asText(defaults.launcherPreset)
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
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
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
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
}

function setSettingsStatus(message, isError = false) {
  if (!settingsStatus) {
    return;
  }
  settingsStatus.textContent = message || "";
  settingsStatus.style.color = isError ? "#ff9b9b" : "";
}

function setLaunchStatus(message, isError = false) {
  if (!launchStatus) {
    return;
  }
  launchStatus.textContent = message || "";
  launchStatus.classList.toggle("is-error", Boolean(message && isError));
}

function setPresetApplyStatus(message, isError = false) {
  setLaunchStatus(message, isError);
  if (currentScreen === "settings") {
    setSettingsStatus(message, isError);
  }
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
  startupStatus.textContent = asText(message) || "\uB7F0\uCC98 \uC2DC\uC791 \uC911...";
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

  if (/(installing fabric|fetching fabric loader metadata|downloading fabric profile)/i.test(message)) {
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

  if (/(fabric profile installed|fabric runtime already installed)/i.test(message)) {
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

function getRecommendedLauncherPreset() {
  return normalizeLauncherPreset(detectedSystemProfile?.preset, "high");
}

function updatePresetHint() {
  if (!settingsPresetHint) {
    return;
  }

  if (!detectedSystemProfile) {
    settingsPresetHint.textContent = "";
    return;
  }

  const cores = Number(detectedSystemProfile.logicalCores);
  const memory = Number(detectedSystemProfile.totalMemoryGb);
  const presetLabel = getRecommendedLauncherPreset() === "low" ? "\uC800\uC0AC\uC591" : "\uACE0\uC0AC\uC591";
  const coresLabel =
    Number.isFinite(cores) && cores > 0
      ? `${cores}\uAC1C \uB17C\uB9AC \uCF54\uC5B4`
      : "CPU \uCF54\uC5B4 \uC815\uBCF4 \uC5C6\uC74C";
  const memoryLabel =
    Number.isFinite(memory) && memory > 0
      ? `${memory.toFixed(1)}GB RAM`
      : "RAM \uC815\uBCF4 \uC5C6\uC74C";
  settingsPresetHint.textContent = `\uC2DC\uC2A4\uD15C: ${coresLabel}, ${memoryLabel}. \uCD94\uCC9C \uD504\uB9AC\uC14B: ${presetLabel}.`;
}

function applyLauncherPreset(preset) {
  const previousPreset = getCurrentBodyPreset();
  const nextPreset = normalizeLauncherPreset(preset, getRecommendedLauncherPreset());
  launcherSettings.launcherPreset = nextPreset;

  if (settingsLauncherPresetSelect) {
    settingsLauncherPresetSelect.value = nextPreset;
  }
  if (launchPresetSelect) {
    launchPresetSelect.value = nextPreset;
  }

  if (!document.body) {
    updatePresetHint();
    return;
  }

  if (!previousPreset || previousPreset === nextPreset) {
    resetPresetTransitionEffects();
    document.body.setAttribute("data-launcher-preset", nextPreset);
    updatePresetHint();
    return;
  }

  if (currentScreen === "launch") {
    void runPresetLaunchTransition(previousPreset, nextPreset);
    updatePresetHint();
    return;
  }

  if (currentScreen === "settings") {
    void runPresetBackgroundOnlyTransition(previousPreset, nextPreset);
    updatePresetHint();
    return;
  }

  resetPresetTransitionEffects();
  document.body.setAttribute("data-launcher-preset", nextPreset);
  updatePresetHint();
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

function updateLaunchButtonUi() {
  if (!startLaunchButton) {
    return;
  }

  const hasPendingModpackUpdate = Boolean(modpackUpdateState?.pending);
  const busy =
    isLaunchRequestPending ||
    isLauncherRunning ||
    isStartupModpackSyncRunning ||
    isPresetModpackSyncRunning ||
    isModpackUpdateApplyRunning ||
    isLauncherUpdateGateRunning;
  startLaunchButton.disabled = !authState.signedIn || busy;
  startLaunchButton.textContent = isLauncherUpdateGateRunning
    ? "\uC5C5\uB370\uC774\uD2B8 \uC911..."
    : isModpackUpdateApplyRunning
      ? "업데이트 중..."
    : isPresetModpackSyncRunning
      ? "\uC801\uC6A9 \uC911..."
      : isStartupModpackSyncRunning
        ? "확인 중..."
      : busy
        ? "\uC2E4\uD589 \uC911..."
        : hasPendingModpackUpdate
          ? "업데이트"
          : "\uAC8C\uC784 \uC2DC\uC791";
  startLaunchButton.setAttribute("aria-busy", busy ? "true" : "false");
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
    username: asText(authState.profileName, "\uD50C\uB808\uC774\uC5B4"),
    version: "",
    versionType: "release",
    launcherPreset: normalizeLauncherPreset(launcherSettings.launcherPreset, getRecommendedLauncherPreset()),
    gameWidth: Number(launcherSettings.gameWidth) || DEFAULT_SETTINGS.gameWidth,
    gameHeight: Number(launcherSettings.gameHeight) || DEFAULT_SETTINGS.gameHeight,
    fullscreen: Boolean(launcherSettings.fullscreen),
    autoConnect: Boolean(launcherSettings.autoConnect),
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
    launcherPreset: normalizeLauncherPreset(launcherSettings.launcherPreset, getRecommendedLauncherPreset()),
    minecraftDirectory: asText(launcherSettings.minecraftDirectory) || asText(launcherDefaults.minecraftDirectory),
    gameDirectory: ""
  };
}

function getLauncherPresetLabel(preset) {
  return normalizeLauncherPreset(preset, getRecommendedLauncherPreset()) === "low" ? "저사양" : "고사양";
}

function getOtherLauncherPreset(preset) {
  return normalizeLauncherPreset(preset, getRecommendedLauncherPreset()) === "low" ? "high" : "low";
}

async function prefetchLauncherPresetArchives(payload) {
  if (!window.launcherApi || typeof window.launcherApi.prefetchModpackPresets !== "function") {
    return null;
  }

  try {
    return await window.launcherApi.prefetchModpackPresets(payload);
  } catch {
    return null;
  }
}

async function runBackgroundPresetPrefetchIfIdle() {
  if (isBackgroundPresetPrefetchRunning) {
    return;
  }

  if (
    isStartupOverlayVisible() ||
    isStartupModpackSyncRunning ||
    isPresetModpackSyncRunning ||
    isModpackUpdateApplyRunning ||
    isLaunchRequestPending ||
    isLauncherRunning ||
    isLauncherUpdateGateRunning
  ) {
    return;
  }

  const activePreset = normalizeLauncherPreset(
    pendingBackgroundPresetCachePreset || launcherSettings.launcherPreset,
    getRecommendedLauncherPreset()
  );
  activeBackgroundPresetCachePreset = getOtherLauncherPreset(activePreset);
  const payload = {
    ...buildModpackSyncPayload(),
    excludePreset: activePreset
  };
  pendingBackgroundPresetCachePreset = "";

  if (!payload.minecraftDirectory) {
    return;
  }

  isBackgroundPresetPrefetchRunning = true;
  try {
    await prefetchLauncherPresetArchives(payload);
  } finally {
    isBackgroundPresetPrefetchRunning = false;
    activeBackgroundPresetCachePreset = "";
    await runQueuedPresetSyncIfIdle();
    if (pendingBackgroundPresetCachePreset) {
      await runBackgroundPresetPrefetchIfIdle();
    }
  }
}

function scheduleBackgroundPresetPrefetch(activePreset = launcherSettings.launcherPreset) {
  pendingBackgroundPresetCachePreset = normalizeLauncherPreset(activePreset, getRecommendedLauncherPreset());
  void runBackgroundPresetPrefetchIfIdle();
}

async function runQueuedPresetSyncIfIdle() {
  if (!pendingPresetSyncPreset) {
    return;
  }
  if (
    isStartupModpackSyncRunning ||
    isPresetModpackSyncRunning ||
    isModpackUpdateApplyRunning ||
    isLaunchRequestPending ||
    isLauncherRunning ||
    isLauncherUpdateGateRunning
  ) {
    return;
  }

  const nextPreset = pendingPresetSyncPreset;
  pendingPresetSyncPreset = "";
  await runLauncherPresetModpackSync(nextPreset);
}

async function runLauncherPresetModpackSync(preset) {
  const nextPreset = normalizeLauncherPreset(preset, getRecommendedLauncherPreset());
  const payload = {
    ...buildModpackSyncPayload(),
    launcherPreset: nextPreset
  };
  const presetLabel = getLauncherPresetLabel(nextPreset);

  if (!payload.minecraftDirectory) {
    const message = "마인크래프트 폴더가 설정되지 않아 프리셋을 바로 적용할 수 없습니다.";
    setPresetApplyStatus(message, true);
    return false;
  }

  if (!window.launcherApi || typeof window.launcherApi.syncModpack !== "function") {
    const message = "프리셋 적용 기능을 사용할 수 없습니다.";
    setPresetApplyStatus(message, true);
    return false;
  }

  isPresetModpackSyncRunning = true;
  updateLaunchButtonUi();

  const applyingMessage = `${presetLabel} 프리셋 적용 중...`;
  setPresetApplyStatus(applyingMessage);

  try {
    const result = await window.launcherApi.syncModpack(payload);
    if (!result?.ok) {
      const message = localizeStatusMessage(result?.error || "Modpack update failed.");
      setPresetApplyStatus(message, true);
      return false;
    }

    const appliedMessage = `${presetLabel} 프리셋이 적용되었습니다.`;
    setPresetApplyStatus(appliedMessage);
    modpackUpdateState = { ok: true, pending: false, preset: nextPreset, latestVersion: asText(result?.version) };
    scheduleBackgroundPresetPrefetch(nextPreset);
    return true;
  } catch (error) {
    const message = localizeStatusMessage(asText(error?.message) || "Modpack update failed.");
    setPresetApplyStatus(message, true);
    return false;
  } finally {
    isPresetModpackSyncRunning = false;
    updateLaunchButtonUi();
    await runQueuedPresetSyncIfIdle();
    void runBackgroundPresetPrefetchIfIdle();
  }
}

function requestLauncherPresetApply(preset) {
  const nextPreset = normalizeLauncherPreset(preset, getRecommendedLauncherPreset());
  const presetLabel = getLauncherPresetLabel(nextPreset);

  if (isLauncherRunning || isLaunchRequestPending || isModpackUpdateApplyRunning || isLauncherUpdateGateRunning) {
    pendingPresetSyncPreset = nextPreset;
    const message = "게임 실행 중이라 프리셋 적용을 대기합니다. 게임 종료 후 자동 적용됩니다.";
    setPresetApplyStatus(message);
    return;
  }

  if (isBackgroundPresetPrefetchRunning && activeBackgroundPresetCachePreset === nextPreset) {
    pendingPresetSyncPreset = nextPreset;
    const message = `${presetLabel} 프리셋 캐시 다운로드를 마치는 중입니다. 완료 후 바로 적용합니다.`;
    setPresetApplyStatus(message);
    return;
  }

  if (isStartupModpackSyncRunning || isPresetModpackSyncRunning || isModpackUpdateApplyRunning) {
    pendingPresetSyncPreset = nextPreset;
    const message = `${presetLabel} 프리셋 적용 대기 중...`;
    setPresetApplyStatus(message);
    return;
  }

  void runLauncherPresetModpackSync(nextPreset);
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
      setStartupProgress(startupProgressPercent, message, true);
      await new Promise(() => {});
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
      setLaunchStatus(localizeStatusMessage(result?.error || "Launcher update check failed."), true);
      return false;
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

async function runStartupModpackSync() {
  if (hasStartupModpackSyncRun || isStartupModpackSyncRunning) {
    return;
  }
  hasStartupModpackSyncRun = true;

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
      scheduleBackgroundPresetPrefetch(payload.launcherPreset);
    }
  } catch (error) {
    const message = localizeStatusMessage(asText(error?.message) || "Modpack update check failed.");
    setLaunchStatus(message, true);
    setStartupProgress(startupProgressPercent, message, true);
  } finally {
    isStartupModpackSyncRunning = false;
    updateLaunchButtonUi();
    await runQueuedPresetSyncIfIdle();
    void runBackgroundPresetPrefetchIfIdle();
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
    void runQueuedPresetSyncIfIdle();
    void runBackgroundPresetPrefetchIfIdle();
  }

  updateLaunchButtonUi();
  syncLauncherBgmPlayback();
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
      preset: payload.launcherPreset,
      latestVersion: asText(result?.version) || asText(modpackUpdateState?.latestVersion)
    };
    setLaunchStatus("모드팩 업데이트가 완료되었습니다. 게임을 시작할 수 있습니다.");
    scheduleBackgroundPresetPrefetch(payload.launcherPreset);
    return true;
  } catch (error) {
    const message = localizeStatusMessage(asText(error?.message) || "Modpack update failed.");
    setLaunchStatus(message, true);
    return false;
  } finally {
    isModpackUpdateApplyRunning = false;
    updateLaunchButtonUi();
    await runQueuedPresetSyncIfIdle();
    void runBackgroundPresetPrefetchIfIdle();
  }
}

async function launchGame() {
  if (!authState.signedIn) {
    setLaunchStatus("Microsoft\uB85C \uBA3C\uC800 \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.", true);
    switchScreen("login");
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

  if (isPresetModpackSyncRunning) {
    setLaunchStatus("\uD504\uB9AC\uC14B \uC801\uC6A9 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.", true);
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
    await runQueuedPresetSyncIfIdle();
    void runBackgroundPresetPrefetchIfIdle();
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

  if (settingsAutoConnectInput) {
    settingsAutoConnectInput.checked = true;
    settingsAutoConnectInput.disabled = true;
  }

  if (settingsLauncherPresetSelect) {
    settingsLauncherPresetSelect.value = normalizeLauncherPreset(settings.launcherPreset, getRecommendedLauncherPreset());
  }

  syncJavaMemoryControls();
  updateJavaPathStatus();
  updateLauncherBgmControls();
  syncLauncherBgmPlayback();
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
      autoConnect: true,
      selectedProfile: settingsProfileSelect?.value,
      launcherPreset: settingsLauncherPresetSelect?.value,
      bgmVolume: launcherSettings.bgmVolume,
      bgmMuted: launcherSettings.bgmMuted
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
  image.src = "./assets/app-icon.png";
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

  const uuidField = document.createElement("div");
  uuidField.className = "settings-account-field";
  const uuidLabel = document.createElement("span");
  uuidLabel.className = "settings-account-field-label";
  uuidLabel.textContent = "UUID";
  const uuidValue = document.createElement("span");
  uuidValue.className = "settings-account-field-value settings-account-uuid-value";
  uuidValue.textContent = placeholder ? "-" : normalizeMinecraftUuid(account?.uuid) || "-";
  uuidField.appendChild(uuidLabel);
  uuidField.appendChild(uuidValue);

  meta.appendChild(nameField);
  meta.appendChild(uuidField);

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
  if (!settingsScreen) {
    return;
  }
  setSettingsStatus("");
  applySettingsToInputs(launcherSettings);
  selectSettingsTab(tabId);
  switchScreen("settings");
  updateSettingsAccountUi();
}

function persistSettingsSnapshot() {
  const next = readSettingsFromInputs();
  next.launcherPreset = normalizeLauncherPreset(next.launcherPreset, getRecommendedLauncherPreset());
  next.selectedProfile = settingsProfileSelect
    ? asText(settingsProfileSelect.value, asText(launcherSettings.selectedProfile))
    : asText(launcherSettings.selectedProfile);
  launcherSettings = next;
  applyLauncherPreset(next.launcherPreset);
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
    const result = await window.launcherApi.loadProfiles({ minecraftDirectory: targetDirectory });
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

  if (!asText(launcherSettings.launcherPreset)) {
    launcherSettings.launcherPreset = getRecommendedLauncherPreset();
    writeStoredSettings(launcherSettings);
  } else {
    launcherSettings.launcherPreset = normalizeLauncherPreset(
      launcherSettings.launcherPreset,
      getRecommendedLauncherPreset()
    );
  }

  applyLauncherPreset(launcherSettings.launcherPreset);
  applySettingsToInputs(launcherSettings);
  await refreshProfilesForDirectory(launcherSettings.minecraftDirectory, launcherSettings.selectedProfile);
}

async function saveSettings(closeAfterSave = true) {
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
      gateAuthStatus.textContent = `\uB85C\uADF8\uC778\uB428: ${authState.profileName || authState.uuid}`;
    } else {
      gateAuthStatus.textContent = "";
    }
  }

  if (!authState.signedIn) {
    switchScreen("login");
  } else if (currentScreen === "login") {
    switchScreen("launch");
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
  updaterSnapshot = state && typeof state === "object" ? { ...state } : null;
  updateSettingsAboutReleaseUi();
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
  const launchRelated = /(minecraft|java|launch|fabric|modpack|runtime|auth|session|auto-connect|quickplay|server|port)/i.test(
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
    /(preparing|downloading|checking|modpack|fabric|installing|runtime|minecraft|java|auth|launch|auto-connect|quickplay|server)/i.test(
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
applyLauncherPreset(getRecommendedLauncherPreset());
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
  const result = await window.launcherApi.openExternal(DISCORD_INVITE_URL);
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

if (settingsLauncherPresetSelect) {
  settingsLauncherPresetSelect.addEventListener("change", () => {
    const nextPreset = normalizeLauncherPreset(settingsLauncherPresetSelect.value, getRecommendedLauncherPreset());
    applyLauncherPreset(nextPreset);
    writeStoredSettings(launcherSettings);
    setSettingsStatus("");
    requestLauncherPresetApply(nextPreset);
  });
}

if (launchPresetSelect) {
  launchPresetSelect.addEventListener("change", () => {
    const nextPreset = normalizeLauncherPreset(launchPresetSelect.value, getRecommendedLauncherPreset());
    applyLauncherPreset(nextPreset);
    writeStoredSettings(launcherSettings);
    requestLauncherPresetApply(nextPreset);
  });
}

bindClick(bgmToggleButton, () => {
  const currentlyMuted = isLauncherBgmMuted();
  const currentVolume = getNormalizedLauncherBgmVolume(launcherSettings.bgmVolume);
  launcherSettings.bgmMuted = !currentlyMuted;
  launcherSettings.bgmVolume = currentlyMuted
    ? (currentVolume > 0 ? currentVolume : DEFAULT_LAUNCHER_BGM_VOLUME)
    : currentVolume;
  writeStoredSettings(launcherSettings);
  syncLauncherBgmPlayback();
});

if (bgmVolumeSlider) {
  bgmVolumeSlider.addEventListener("input", () => {
    const nextVolume = getNormalizedLauncherBgmVolume(bgmVolumeSlider.value);
    launcherSettings.bgmVolume = nextVolume;
    launcherSettings.bgmMuted = nextVolume <= 0;
    writeStoredSettings(launcherSettings);
    syncLauncherBgmPlayback();
  });

  bgmVolumeSlider.addEventListener("dblclick", () => {
    launcherSettings.bgmVolume = DEFAULT_LAUNCHER_BGM_VOLUME;
    launcherSettings.bgmMuted = false;
    writeStoredSettings(launcherSettings);
    syncLauncherBgmPlayback();
  });

  bgmVolumeSlider.addEventListener("keydown", (event) => {
    if (event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    launcherSettings.bgmVolume = event.key === "Home" ? 0 : 100;
    launcherSettings.bgmMuted = launcherSettings.bgmVolume <= 0;
    writeStoredSettings(launcherSettings);
    syncLauncherBgmPlayback();
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
document.addEventListener("pointerdown", retryLauncherBgmPlaybackOnInteraction, { passive: true });
document.addEventListener("keydown", retryLauncherBgmPlaybackOnInteraction);
document.addEventListener("visibilitychange", syncLauncherBgmPlayback);
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
  resetPresetTransitionEffects();
  stopNewsPolling();
  stopPlayerCountPolling();
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
    await ensureLatestLauncherOnStartup();
    startNewsPolling();
    startPlayerCountPolling();
    setStartupProgress(STARTUP_SETTINGS_PROGRESS, "\uB7F0\uCC98 \uC124\uC815 \uBD88\uB7EC\uC624\uAE30 \uC644\uB8CC.");
    await runStartupModpackSync();
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
    void startLauncherBgmPlayback();
    void runBackgroundPresetPrefetchIfIdle();
  })
  .catch(async (error) => {
    const message = localizeStatusMessage(
      asText(error?.message) || "\uC2DC\uC791 \uC2E4\uD328. \uACC4\uC18D \uC9C4\uD589\uD569\uB2C8\uB2E4."
    );
    setStartupProgress(startupProgressPercent, message, true);
    await hideStartupOverlay();
    void startLauncherBgmPlayback();
  });
