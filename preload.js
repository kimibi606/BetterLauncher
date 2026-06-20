const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("launcherApi", {
  getDefaults: () => ipcRenderer.invoke("launcher:get-defaults"),
  getAuthState: () => ipcRenderer.invoke("launcher:get-auth-state"),
  getSystemProfile: () => ipcRenderer.invoke("launcher:get-system-profile"),
  getServerStatus: () => ipcRenderer.invoke("launcher:get-server-status"),
  getNews: () => ipcRenderer.invoke("launcher:get-news"),
  getGitHubRelease: () => ipcRenderer.invoke("launcher:get-github-release"),
  getUpdaterState: () => ipcRenderer.invoke("updater:get-state"),
  ensureLatestLauncherUpdate: () => ipcRenderer.invoke("updater:ensure-latest"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  microsoftLogin: () => ipcRenderer.invoke("launcher:microsoft-login"),
  selectMicrosoftAccount: (accountId) => ipcRenderer.invoke("launcher:microsoft-select-account", accountId),
  microsoftLogout: () => ipcRenderer.invoke("launcher:microsoft-logout"),
  openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.send("window:toggle-maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  getWindowState: () => ipcRenderer.invoke("window:get-state"),
  pickDirectory: () => ipcRenderer.invoke("launcher:pick-directory"),
  pickJava: () => ipcRenderer.invoke("launcher:pick-java"),
  loadProfiles: (payload) => ipcRenderer.invoke("launcher:load-profiles", payload),
  prepareRuntime: (payload) => ipcRenderer.invoke("launcher:prepare-runtime", payload),
  checkModpackUpdate: (payload) => ipcRenderer.invoke("launcher:check-modpack-update", payload),
  syncModpack: (payload) => ipcRenderer.invoke("launcher:sync-modpack", payload),
  prefetchModpackPresets: (payload) => ipcRenderer.invoke("launcher:prefetch-modpacks", payload),
  launch: (payload) => ipcRenderer.invoke("launcher:launch", payload),
  onLog: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("launcher:log", listener);
    return () => ipcRenderer.removeListener("launcher:log", listener);
  },
  onState: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("launcher:state", listener);
    return () => ipcRenderer.removeListener("launcher:state", listener);
  },
  onAuthState: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("launcher:auth-state", listener);
    return () => ipcRenderer.removeListener("launcher:auth-state", listener);
  },
  onWindowState: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("window:state", listener);
    return () => ipcRenderer.removeListener("window:state", listener);
  },
  onUpdaterState: (handler) => {
    const listener = (_, payload) => handler(payload);
    ipcRenderer.on("updater:state", listener);
    return () => ipcRenderer.removeListener("updater:state", listener);
  }
});
