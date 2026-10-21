"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { secureFetch } = require("./secure-fetch");

function validateNeoForgeVersion(version, minecraftVersion) {
  const parts = String(minecraftVersion).split(".").map(Number);
  const prefix = parts[0] === 1 ? `${parts[1]}.${parts[2] || 0}.` : `${parts[0]}.${parts[1]}.`;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+(?:-beta)?$/.test(version) || !version.startsWith(prefix)) {
    throw new Error("A pinned NeoForge version matching Minecraft is required.");
  }
  return version;
}

function neoForgeProfileId(project) {
  return "neoforge-" + validateNeoForgeVersion(project.loaderVersion, project.minecraftVersion);
}

function safeRuntimePath(root, relative) {
  if (!relative || relative.includes("\\") || relative.includes(":") || relative.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Unsafe NeoForge runtime path.");
  }
  let current = path.resolve(root);
  for (const part of ["", ...relative.split("/")]) {
    if (part) current = path.join(current, part);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error("NeoForge runtime contains a symbolic link or junction."); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return current;
}

function validateNeoForgeProfile(profile, project) {
  if (profile?.id !== neoForgeProfileId(project) || profile.inheritsFrom !== project.minecraftVersion ||
      !["cpw.mods.bootstraplauncher.BootstrapLauncher", "cpw.mods.modlauncher.Launcher"].includes(profile.mainClass) ||
      !Array.isArray(profile.libraries) || !profile.libraries.length ||
      !Array.isArray(profile.arguments?.game) || !Array.isArray(profile.arguments?.jvm) ||
      ![...profile.arguments.game, ...profile.arguments.jvm].every(arg => typeof arg === "string" && !arg.includes("\0"))) {
    throw new Error("NeoForge profile does not match the configured runtime.");
  }
  for (const library of profile.libraries) {
    const artifact = library.downloads?.artifact;
    if (!artifact || typeof artifact.path !== "string" || artifact.path.includes("\\") || artifact.path.includes(":") ||
        artifact.path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Unsafe NeoForge library path.");
    if (artifact.url) {
      const url = new URL(artifact.url);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Unsafe NeoForge library URL.");
    }
  }
  return profile;
}

async function hashFile(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function readBounded(response, maxBytes) {
  if (!response.ok || !response.body) throw new Error("NeoForge service is unavailable.");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel();
    throw new Error("NeoForge response is too large.");
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > maxBytes) throw new Error("NeoForge response is too large.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function assertNoLinks(directory) {
  if (!fs.existsSync(directory)) return;
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error("NeoForge installation cannot follow symbolic links or junctions.");
    if (fs.statSync(current).isDirectory()) {
      for (const entry of await fs.promises.readdir(current)) pending.push(path.join(current, entry));
    }
  }
}

function createNeoForgeRuntime({ fetchImpl = secureFetch, spawnImpl = spawn, log = () => {}, timeoutMs = 20 * 60 * 1000 } = {}) {
  const pending = new Map();
  async function install(project, root, javaPath) {
    const versionId = neoForgeProfileId(project);
    const resolve = relative => safeRuntimePath(root, relative);
    const runtime = `.betterlauncher/runtime/neoforge/${project.loaderVersion}`;
    const profileFile = resolve(`versions/${versionId}/${versionId}.json`);
    const markerFile = resolve(`${runtime}/installed.json`);
    const clientJar = resolve(`versions/${project.minecraftVersion}/${project.minecraftVersion}.jar`);
    const baseProfile = resolve(`versions/${project.minecraftVersion}/${project.minecraftVersion}.json`);
    const customJar = resolve(`versions/${versionId}/${versionId}.jar`);
    const verifyFiles = () => {
      const profile = validateNeoForgeProfile(JSON.parse(fs.readFileSync(profileFile, "utf8")), project);
      if (![clientJar, baseProfile, customJar].every(file => fs.statSync(file).isFile() && fs.statSync(file).size > 0)) throw new Error("NeoForge client runtime is incomplete.");
      for (const library of profile.libraries) {
        if (library.rules) continue;
        const file = resolve("libraries/" + library.downloads.artifact.path);
        if (!fs.statSync(file).isFile() || !fs.statSync(file).size) throw new Error("NeoForge libraries are incomplete.");
      }
      return profile;
    };
    try {
      const marker = JSON.parse(fs.readFileSync(markerFile, "utf8"));
      if (marker.minecraftVersion === project.minecraftVersion && marker.loaderVersion === project.loaderVersion &&
          marker.installerSha256 === (project.loaderInstallerSha256 || marker.installerSha256) &&
          marker.profileSha256 === await hashFile(profileFile)) {
        verifyFiles();
        log({ level: "info", message: "NeoForge runtime already installed." });
        return versionId;
      }
    } catch { /* An incomplete install must be repaired instead of reused. */ }
    if (!javaPath) throw new Error("Java is required to install NeoForge.");
    for (const relative of ["versions", "libraries", ".betterlauncher/runtime/neoforge"]) await assertNoLinks(resolve(relative));
    await fs.promises.mkdir(resolve(runtime), { recursive: true });
    const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${project.loaderVersion}/neoforge-${project.loaderVersion}-installer.jar`;
    const expectedHash = project.loaderInstallerSha256 ||
      (await readBounded(await fetchImpl(url + ".sha256", { signal: AbortSignal.timeout(30000) }), 256)).toString("utf8").trim().split(/\s/)[0];
    if (!/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error("NeoForge installer SHA-256 is invalid.");
    const installer = resolve(`${runtime}/installer.jar`);
    let cached = false;
    try { cached = await hashFile(installer) === expectedHash.toLowerCase(); } catch { /* Download below. */ }
    if (!cached) {
      log({ level: "progress", message: "Downloading NeoForge installer..." });
      const data = await readBounded(await fetchImpl(url, { signal: AbortSignal.timeout(5 * 60 * 1000) }), 64 * 1024 * 1024);
      if (crypto.createHash("sha256").update(data).digest("hex") !== expectedHash.toLowerCase()) throw new Error("NeoForge installer integrity check failed.");
      await fs.promises.writeFile(installer, data);
    }
    const launcherProfiles = resolve("launcher_profiles.json");
    try {
      await fs.promises.writeFile(launcherProfiles, JSON.stringify({ profiles: {}, version: 3 }), { flag: "wx" });
    } catch (error) { if (error.code !== "EEXIST") throw error; }
    log({ level: "progress", message: "Installing NeoForge runtime..." });
    const logFile = resolve(`${runtime}/installer-output.log`);
    const consoleJava = process.platform === "win32" && path.basename(javaPath).toLowerCase() === "javaw.exe"
      ? path.join(path.dirname(javaPath), "java.exe") : javaPath;
    const installerJava = fs.existsSync(consoleJava) ? consoleJava : javaPath;
    const env = { ...process.env };
    for (const name of Object.keys(env)) {
      if (["JAVA_TOOL_OPTIONS", "_JAVA_OPTIONS", "JDK_JAVA_OPTIONS", "CLASSPATH"].includes(name) || /TOKEN|SECRET|PASSWORD|API_KEY/i.test(name)) delete env[name];
    }
    await new Promise((resolveProcess, reject) => {
      let output = "", settled = false;
      const child = spawnImpl(installerJava, ["-Djava.awt.headless=true", "-jar", installer, "--installClient", path.resolve(root)],
        { cwd: resolve(runtime), windowsHide: true, shell: false, env });
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { fs.writeFileSync(logFile, output); } catch (writeError) { error ||= writeError; }
        if (error) reject(error); else resolveProcess();
      };
      const timer = setTimeout(() => {
        if (process.platform === "win32" && Number.isInteger(child.pid) && child.pid > 0) {
          spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => {});
        } else child.kill();
        finish(new Error("NeoForge installation timed out. Try again."));
      }, timeoutMs);
      for (const stream of [child.stdout, child.stderr]) stream?.on("data", chunk => { output = (output + chunk.toString()).slice(-128 * 1024); });
      child.once("error", () => finish(new Error("Could not start the NeoForge installer.")));
      child.once("close", code => finish(code === 0 ? null : new Error("NeoForge installation failed. Try again.")));
    });
    validateNeoForgeProfile(JSON.parse(fs.readFileSync(profileFile, "utf8")), project);
    await fs.promises.copyFile(clientJar, customJar);
    verifyFiles();
    const marker = { minecraftVersion: project.minecraftVersion, loaderVersion: project.loaderVersion,
      installerSha256: expectedHash.toLowerCase(), profileSha256: await hashFile(profileFile) };
    await fs.promises.writeFile(markerFile, JSON.stringify(marker, null, 2) + "\n");
    log({ level: "info", message: "NeoForge runtime installed." });
    return versionId;
  }
  return {
    ensure(project, directory, javaPath) {
      const root = path.resolve(directory);
      const key = root + "\0" + neoForgeProfileId(project);
      if (pending.has(key)) return pending.get(key);
      const result = install(project, root, javaPath).finally(() => pending.delete(key));
      pending.set(key, result);
      return result;
    }
  };
}

function createNeoForgeClient(Client, project) {
  return new class extends Client {
    async getModifyJson() {
      const profile = validateNeoForgeProfile(await super.getModifyJson(), project);
      const separator = process.platform === "win32" ? ";" : ":";
      const fields = {
        "${library_directory}": path.join(this.options.root, "libraries"),
        "${classpath_separator}": separator,
        "${version_name}": profile.id,
        "${natives_directory}": this.options.root,
        "${launcher_name}": "BetterLauncher",
        "${launcher_version}": "1"
      };
      const jvm = profile.arguments.jvm.map(value => {
        let arg = value;
        for (const [key, replacement] of Object.entries(fields)) arg = arg.split(key).join(replacement);
        if (/\$\{[^}]+\}/.test(arg)) throw new Error("Unsupported NeoForge JVM argument.");
        return arg;
      });
      this.options.customArgs = [...jvm, ...(this.options.customArgs || [])];
      // MCLC otherwise drops the base game's authentication and asset arguments
      // when a loader profile has enough arguments of its own.
      return { ...profile, arguments: { ...profile.arguments,
        game: [...this.handler.version.arguments.game, ...profile.arguments.game] } };
    }
  }();
}

module.exports = { validateNeoForgeVersion, neoForgeProfileId, validateNeoForgeProfile, safeRuntimePath, createNeoForgeRuntime, createNeoForgeClient };
