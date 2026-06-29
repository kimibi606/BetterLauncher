"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findRceditExecutable() {
  const explicitExe = String(process.env.BETTERMON_RCEDIT_EXE || "").trim();
  if (explicitExe && fileExists(explicitExe)) {
    return explicitExe;
  }

  const explicitDir = String(process.env.BETTERMON_RCEDIT_PATH || "").trim();
  if (explicitDir) {
    const candidate = path.join(explicitDir, "rcedit-x64.exe");
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  const localAppData = String(process.env.LOCALAPPDATA || "").trim();
  if (!localAppData) {
    return "";
  }

  const cacheRoot = path.join(localAppData, "electron-builder", "Cache", "winCodeSign");
  if (!fs.existsSync(cacheRoot)) {
    return "";
  }

  const dirs = fs
    .readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(cacheRoot, entry.name));
  const candidates = [];
  for (const dir of dirs) {
    const candidate = path.join(dir, "rcedit-x64.exe");
    if (!fileExists(candidate)) {
      continue;
    }
    const stat = fs.statSync(candidate);
    candidates.push({
      path: candidate,
      mtimeMs: Number(stat.mtimeMs || 0)
    });
  }
  if (candidates.length === 0) {
    return "";
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0].path;
}

function main() {
  if (process.platform !== "win32") {
    console.log("patch-win-exe-icon: skipped (non-Windows platform).");
    process.exit(0);
  }

  const projectRoot = path.resolve(__dirname, "..");
  const exePath = path.join(projectRoot, "dist", "win-unpacked", "BetterMon Launcher.exe");
  const iconPath = path.join(projectRoot, "src", "assets", "app-icon.ico");
  if (!fileExists(exePath)) {
    throw new Error(`Target executable not found: ${exePath}`);
  }
  if (!fileExists(iconPath)) {
    throw new Error(`Icon file not found: ${iconPath}`);
  }

  const rceditExe = findRceditExecutable();
  if (!rceditExe) {
    console.warn(
      "patch-win-exe-icon: skipped because rcedit was not found. Set BETTERMON_RCEDIT_EXE or BETTERMON_RCEDIT_PATH to force patching."
    );
    process.exit(0);
  }

  const result = spawnSync(rceditExe, [exePath, "--set-icon", iconPath], {
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`rcedit failed with exit code ${result.status}.`);
  }
  console.log("patch-win-exe-icon: icon patched successfully.");
}

main();
