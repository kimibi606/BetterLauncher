"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectName = process.env.CLOUDFLARE_PAGES_PROJECT;
if (!projectName || !/^[a-z0-9][a-z0-9-]{0,57}$/.test(projectName)) {
  throw new Error("Set CLOUDFLARE_PAGES_PROJECT to your Pages project name before deploying.");
}
const result = spawnSync(process.execPath, [require.resolve("wrangler/bin/wrangler.js"),
  "pages", "deploy", "distribution", "--project-name", projectName, "--branch", "main",
  ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, ".."), stdio: "inherit", windowsHide: true,
  env: { ...process.env }
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
