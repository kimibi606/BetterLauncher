"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { build, Platform } = require("electron-builder");
const { readProjects, resolveProject } = require("../lib/projects");

async function main() {
  const root = path.resolve(__dirname, "..");
  const privateRoot = path.join(root, ".private");
  const config = JSON.parse(fs.readFileSync(path.join(privateRoot, "modpack.config.json"), "utf8"));
  if (!readProjects(config).length) throw new Error("Private operating catalog is empty.");
  resolveProject(config);
  config.github = { ...config.github, enabled: false };
  const staging = path.join(privateRoot, "builds", crypto.randomUUID());
  if (!staging.startsWith(privateRoot + path.sep)) throw new Error("Invalid private build destination.");
  const appDir = path.join(staging, "app");
  const output = path.join(staging, "output");
  fs.mkdirSync(appDir, { recursive: true });
  for (const entry of ["main.js", "preload.js", "src", "lib", "vendor"]) {
    fs.cpSync(path.join(root, entry), path.join(appDir, entry), { recursive: true });
  }
  const appPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  delete appPackage.build;
  delete appPackage.devDependencies;
  fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify(appPackage, null, 2) + "\n");
  fs.writeFileSync(path.join(appDir, "modpack.config.json"), JSON.stringify(config, null, 2) + "\n");
  fs.symlinkSync(path.join(root, "node_modules"), path.join(appDir, "node_modules"), "junction");
  const files = await build({
    targets: Platform.WINDOWS.createTarget(["nsis"]),
    publish: "never",
    config: { directories: { app: appDir, output }, publish: null }
  });
  console.log("Private build completed. Share the installer directly with trusted users; do not upload it to GitHub.");
  for (const file of files) console.log(file);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
