"use strict";

const fs = require("fs");
const path = require("path");

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolvePublishConfig(packageJson) {
  const build = packageJson && typeof packageJson === "object" ? packageJson.build : null;
  const publish = build && Array.isArray(build.publish) ? build.publish : [];
  const githubPublish = publish.find((item) => item && item.provider === "github") || null;
  if (!githubPublish) {
    throw new Error("GitHub publish config is missing in package.json build.publish.");
  }
  return githubPublish;
}

function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const publish = resolvePublishConfig(packageJson);

  const owner =
    asText(process.env.BETTERMON_GH_OWNER) ||
    asText(process.env.BETTERMON_GITHUB_OWNER) ||
    asText(publish.owner);
  const repo =
    asText(process.env.BETTERMON_GH_REPO) ||
    asText(process.env.BETTERMON_GITHUB_REPO) ||
    asText(publish.repo);
  if (!owner || !repo) {
    throw new Error("GitHub owner/repo is empty. Cannot generate app-update.yml.");
  }

  const releaseType = asText(publish.releaseType) || "release";
  const updaterCacheDirName = `${asText(packageJson.name) || "app"}-updater`;
  const targetPath = path.join(projectRoot, "dist", "win-unpacked", "resources", "app-update.yml");
  const yamlLines = [
    "provider: github",
    `owner: ${owner}`,
    `repo: ${repo}`,
    "private: false",
    `releaseType: ${releaseType}`,
    "vPrefixedTagName: true",
    `updaterCacheDirName: ${updaterCacheDirName}`
  ];

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${yamlLines.join("\n")}\n`, "utf8");
  console.log(`write-app-update-config: generated ${targetPath}`);
}

main();
