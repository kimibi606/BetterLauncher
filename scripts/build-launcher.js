"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { readProjects, resolveProject } = require("../lib/projects");

function prepareLauncherBuild(root) {
  root = path.resolve(root);
  const privateRoot = path.join(root, ".private");
  const configPath = path.join(privateRoot, "modpack.config.json");
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (readProjects(config).length !== 1) throw new Error();
    const project = resolveProject(config);
    const manifest = new URL(project.modpack?.manifestUrl);
    if (manifest.protocol !== "https:" || manifest.username || manifest.password) throw new Error();
  } catch {
    throw new Error("A valid single-modpack configuration is required in .private/modpack.config.json. Empty-catalog builds are not supported.");
  }
  const appPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(appPackage.version)) throw new Error("Invalid launcher build version.");
  const buildConfig = appPackage.build;
  const github = buildConfig?.publish?.find(entry => entry.provider === "github");
  if (!github || !/^[a-zA-Z0-9-]+$/.test(github.owner) || !/^[a-zA-Z0-9_.-]+$/.test(github.repo)) {
    throw new Error("A GitHub release repository is required for launcher updates.");
  }
  // Update configuration belongs to the launcher. An old modpack flag must not
  // create a separate installer with updates disabled.
  config.github = { owner: github.owner, repo: github.repo, timeoutMs: 7000 };
  const stagingRoot = path.join(privateRoot, "builds");
  const output = path.join(privateRoot, "releases", appPackage.version);
  for (const directory of [privateRoot, stagingRoot, path.dirname(output), output]) {
    if (fs.lstatSync(directory, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error("Build directories cannot be symbolic links or junctions.");
  }
  fs.mkdirSync(stagingRoot, { recursive: true });
  const staging = fs.mkdtempSync(path.join(stagingRoot, "launcher-"));
  const cleanup = () => fs.rmSync(staging, { recursive: true, force: true, maxRetries: 3 });
  try {
    fs.writeFileSync(path.join(staging, "modpack.config.json"), JSON.stringify(config, null, 2) + "\n");
    return {
      root, output, version: appPackage.version, cleanup,
      builderConfig: {
        directories: { output },
        files: [{ from: staging, filter: ["modpack.config.json"] }]
      }
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== "--dir")) throw new Error("Supported build option: --dir. Uploading is a separate explicit action.");
  const { build, Platform, Arch } = require("electron-builder");
  const prepared = prepareLauncherBuild(path.resolve(__dirname, ".."));
  const unpacked = args.includes("--dir");
  let files;
  try {
    files = await build({
      projectDir: prepared.root,
      targets: Platform.WINDOWS.createTarget(unpacked ? "dir" : "nsis", Arch.x64, Arch.arm64),
      publish: "never",
      config: prepared.builderConfig
    });
  } finally {
    prepared.cleanup();
  }
  const checksums = [];
  // electron-builder returns the installer and blockmap, but emits latest.yml
  // separately. Include all three release files in the local checksum list.
  const releaseFiles = unpacked ? [] : [
    `BetterLauncher-Setup-${prepared.version}.exe`,
    `BetterLauncher-Setup-${prepared.version}.exe.blockmap`,
    "latest.yml"
  ].map(name => path.join(prepared.output, name));
  for (const file of releaseFiles) {
    const hash = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    checksums.push(`${hash.digest("hex")}  ${path.basename(file)}`);
  }
  if (checksums.length) fs.writeFileSync(path.join(prepared.output, "SHA256SUMS.txt"), checksums.sort().join("\n") + "\n");
  console.log(`BetterLauncher ${prepared.version} built. No files were uploaded.`);
  for (const file of files) console.log(file);
  return prepared;
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { prepareLauncherBuild, main };
