"use strict";

// Compile and execute the real NSIS migration with disposable application
// files and unique HKCU registry keys. Never launch a real app's uninstaller.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist", "installer-tests", crypto.randomUUID());
const registryRoot = "HKCU\\Software\\BetterLauncherInstallerTests\\" + crypto.randomUUID();
function run(executable, args, expected = 0) {
  const result = spawnSync(executable, args, { encoding: "utf8", windowsHide: true, timeout: 30000 });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, `${path.basename(executable)} exited ${result.status}: ${result.stdout}\n${result.stderr}`);
  return result;
}
function compilerPath() {
  if (process.env.BETTERLAUNCHER_MAKENSIS) return process.env.BETTERLAUNCHER_MAKENSIS;
  const cache = path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache", "nsis");
  for (const directory of fs.readdirSync(cache).filter(name => name.startsWith("nsis-")).sort().reverse()) {
    const candidate = path.join(cache, directory, "Bin", "makensis.exe");
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Build a Windows installer first, or set BETTERLAUNCHER_MAKENSIS.");
}

function main() {
  if (process.platform !== "win32") {
    console.log("NSIS execution tests require Windows; skipped on this platform.");
    return;
  }
  assert.ok(output.startsWith(path.join(root, "dist", "installer-tests") + path.sep));
  assert.ok(registryRoot.startsWith("HKCU\\Software\\BetterLauncherInstallerTests\\"));
  const compiler = compilerPath();
  fs.mkdirSync(output, { recursive: true });
  const scenarios = [
    { name: "fresh", absent: true },
    { name: "legacy-32", view: 32 },
    { name: "legacy-64", view: 64 },
    { name: "legacy-compact-name", exe: "BetterMonLauncher" },
    { name: "machine-uninstall-flags", machine: true },
    { name: "current-betterlauncher", display: "BetterLauncher 0.4.12", skip: true },
    { name: "cancel-before-install", initOnly: true, skip: true },
    { name: "failed-uninstall", result: 5, expected: 2 },
    { name: "false-success-uninstall", result: 3, expected: 2 },
    { name: "missing-uninstaller", missing: true, expected: 2 },
    { name: "mismatched-uninstall-command", mismatch: true, expected: 2 },
    { name: "junction-directory", junction: true, expected: 2 },
    { name: "custom-destination", custom: true }
  ];
  const passed = [];
  try {
    for (const scenario of scenarios) {
      const directory = path.join(output, scenario.name);
      const target = path.join(directory, "legacy target");
      const legacy = scenario.junction ? path.join(directory, "legacy junction") : target;
      const exe = scenario.exe || "BetterMon Launcher";
      const view = scenario.view || 64;
      const key = registryRoot + "\\" + scenario.name;
      const installKey = key.slice("HKCU\\".length) + "\\Install";
      const uninstallKey = key.slice("HKCU\\".length) + "\\Uninstall";
      const uninstaller = path.join(target, `Uninstall ${exe}.exe`);
      const record = path.join(directory, "events.txt");
      const userData = path.join(directory, "app-data", "game-save.txt");
      const destination = scenario.custom ? path.join(directory, "custom", "BetterLauncher") : path.join(legacy, "BetterLauncher");
      fs.mkdirSync(path.join(target, "resources"), { recursive: true });
      fs.mkdirSync(path.dirname(userData), { recursive: true });
      fs.writeFileSync(userData, "keep-login-and-game-data");
      fs.writeFileSync(path.join(target, exe + ".exe"), "fixture-executable");
      fs.writeFileSync(path.join(target, "resources", "app.asar"), "fixture-asar");
      if (scenario.junction) fs.symlinkSync(target, legacy, "junction");
      const defines = {
        PROJECT_DIR: root, TEST_GENERATOR: path.join(directory, "generate.exe"), TEST_UNINSTALLER: uninstaller,
        TEST_INSTALLER: path.join(directory, "install.exe"), TEST_RECORD: record, TEST_EXE_NAME: exe,
        TEST_REG_VIEW: view, TEST_RESULT: scenario.result || 0,
        TEST_INSTALL_KEY: installKey, TEST_UNINSTALL_KEY: uninstallKey, TEST_DESTINATION: destination
      };
      const compile = file => run(compiler, ["/V2", ...Object.entries(defines).map(([name, value]) => `/D${name}=${value}`), ...(scenario.machine ? ["/DTEST_MACHINE_MODE"] : []), path.join(root, "tests", "fixtures", file)]);
      compile("legacy-uninstaller.nsi");
      run(defines.TEST_GENERATOR, ["/S"]);
      if (scenario.missing) fs.unlinkSync(uninstaller);
      if (!scenario.absent) {
        const registryArgs = [`/reg:${view}`];
        const write = (suffix, name, value) => run("reg.exe", ["add", key + suffix, "/v", name, "/t", "REG_SZ", "/d", value, "/f", ...registryArgs]);
        write("\\Install", "InstallLocation", legacy);
        write("\\Uninstall", "DisplayName", scenario.display || `${exe} 0.3.0`);
        const command = scenario.mismatch ? path.join(directory, "unrelated.exe") : path.join(legacy, `Uninstall ${exe}.exe`);
        // These hostile arguments must not be copied into the executed command.
        write("\\Uninstall", "UninstallString", `"${command}" --delete-app-data & ignored-command`);
      }
      compile("installer-migration.nsi");
      run(defines.TEST_INSTALLER, ["/S", ...(scenario.initOnly ? ["/init-only"] : [])], scenario.expected || 0);
      const events = fs.existsSync(record) ? fs.readFileSync(record, "utf8") : "";
      const eventLines = events.split(/\r?\n/);
      const uninstallEvent = eventLines.findIndex(line => line.startsWith("uninstall:"));
      const installEvent = eventLines.findIndex(line => line.startsWith("install:"));
      assert.equal(fs.readFileSync(userData, "utf8"), "keep-login-and-game-data");
      if (scenario.expected || scenario.skip || scenario.absent) {
        assert.ok(fs.existsSync(path.join(target, exe + ".exe")));
        if (scenario.expected || scenario.initOnly) assert.equal(installEvent, -1);
        if (scenario.skip || scenario.absent) assert.equal(uninstallEvent, -1);
      } else {
        assert.equal(fs.existsSync(path.join(target, exe + ".exe")), false);
        assert.ok(uninstallEvent >= 0 && installEvent > uninstallEvent);
        assert.match(events, /\/KEEP_APP_DATA/);
        assert.match(events, /--updated/);
        assert.ok(events.includes(scenario.machine ? "/allusers" : "/currentuser"));
        assert.doesNotMatch(events, /--delete-app-data|ignored-command/);
        const installed = eventLines[installEvent].slice(8);
        assert.equal(path.normalize(installed), scenario.custom ? destination : path.join(directory, "BetterLauncher"));
      }
      passed.push(scenario.name);
      console.log("Passed: " + scenario.name);
    }
  } finally {
    // Delete only the unique test registry subtree. Keep fixture files under
    // ignored dist/ for inspection; never touch real application registrations.
    assert.ok(/^HKCU\\Software\\BetterLauncherInstallerTests\\[a-f0-9-]+$/.test(registryRoot));
    for (const view of [32, 64]) spawnSync("reg.exe", ["delete", registryRoot, "/f", `/reg:${view}`], { windowsHide: true, encoding: "utf8" });
  }
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify({ passed, count: passed.length }, null, 2) + "\n");
  console.log(`Installer migration passed ${passed.length} isolated scenarios.`);
}

try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
