"use strict";

const fs = require("fs");
const path = require("path");

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

  const refName = asText(process.env.GITHUB_REF_NAME || process.env.BETTERMON_RELEASE_TAG);
  if (refName.startsWith("v") && refName.slice(1) !== version) {
    fail(`tag ${refName} does not match package.json version ${version}`);
  }

  const githubPublish = (packageJson.build?.publish || []).find((entry) => entry?.provider === "github");
  if (!asText(githubPublish?.owner) || !asText(githubPublish?.repo)) {
    fail("build.publish must contain a GitHub owner and repo");
  }

  const config = JSON.parse(fs.readFileSync(path.join(projectRoot, "modpack.config.json"), "utf8"));
  if (
    asText(config.github?.owner) !== asText(githubPublish.owner) ||
    asText(config.github?.repo) !== asText(githubPublish.repo)
  ) {
    fail("modpack.config.json github settings do not match package.json build.publish");
  }

  console.log(`release validation passed for BetterMon Launcher ${version}`);
}

main();
