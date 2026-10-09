"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");

// An account ID identifies the deployment destination; it is not a credential.
const result = spawnSync(process.execPath, [require.resolve("wrangler/bin/wrangler.js"),
  "pages", "deploy", "distribution", "--project-name", "ExamplePack", "--branch", "main",
  ...process.argv.slice(2)], {
  cwd: path.resolve(__dirname, ".."), stdio: "inherit", windowsHide: true,
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "ExamplePack" }
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
