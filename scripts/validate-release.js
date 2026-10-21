"use strict";

const fs = require("fs");
const path = require("path");
const { readProjects, resolveProject } = require("../lib/projects");

function fail(message) {
  throw new Error(`release validation failed: ${message}`);
}

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  const version = asText(packageJson.version);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`package.json version is not valid semver: ${version || "(empty)"}`);
  }

  const refName = asText(process.env.GITHUB_REF_NAME || (process.env.BETTERLAUNCHER_RELEASE_TAG || process.env.BETTERMON_RELEASE_TAG));
  if (refName.startsWith("v") && refName.slice(1) !== version) {
    fail(`tag ${refName} does not match package.json version ${version}`);
  }

  const githubPublish = (packageJson.build?.publish || []).find((entry) => entry?.provider === "github");
  if (!asText(githubPublish?.owner) || !asText(githubPublish?.repo)) {
    fail("build.publish must contain a GitHub owner and repo");
  }

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "modpack.config.json"), "utf8"));
  if (config.defaultProject || !Array.isArray(config.projects) || config.projects.length !== 0) {
    fail("repository config must contain an empty catalog; keep operating settings in .private/modpack.config.json");
  }
  if (readProjects(config).length > 0) resolveProject(config);
  if (Object.hasOwn(config.github || {}, "enabled")) {
    fail("launcher updates must not vary with the operating catalog");
  }
  if (packageJson.name !== "betterlauncher" || packageJson.build?.productName !== "BetterLauncher") {
    fail("package name and product name must use BetterLauncher");
  }
  if (packageJson.build?.nsis?.guid !== "0e192e02-a904-5be6-bca2-04cae62ae05b") {
    fail("keep the original launcher installation GUID so Windows upgrades remain compatible");
  }
  if (packageJson.build?.nsis?.include !== "build/installer.nsh" ||
      !fs.existsSync(path.join(projectRoot, "build", "installer.nsh")) ||
      packageJson.build?.nsis?.deleteAppDataOnUninstall !== false) {
    fail("Windows installers must include legacy migration and preserve application data");
  }
  if (
    asText(config.github?.owner) !== asText(githubPublish.owner) ||
    asText(config.github?.repo) !== asText(githubPublish.repo)
  ) {
    fail("modpack.config.json github settings do not match package.json build.publish");
  }

  console.log(`release validation passed for BetterLauncher ${version}`);
}

main();
