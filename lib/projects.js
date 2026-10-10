"use strict";

const path = require("path");
const net = require("net");
const { domainToASCII } = require("url");

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDOWS_RESERVED_ID = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function getProjectServer(project) {
  const source = project.server !== undefined ? project.server : {
    host: project.serverStatus?.host || project.serverStatus?.address || project.serverStatus?.ip || "",
    port: project.serverStatus?.port
  };
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new Error(`Invalid server configuration for ${project.id}.`);
  }
  if (source.host !== undefined && typeof source.host !== "string") {
    throw new Error(`Invalid server host for ${project.id}.`);
  }
  let host = (source.host || "").trim();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (host && !net.isIP(host)) {
    const ascii = domainToASCII(host).toLowerCase();
    const label = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
    if (!ascii || ascii.length > 253 || /^[\d.]+$/.test(host) ||
        !new RegExp(`^${label}(?:\\.${label})*\\.?$`).test(ascii) || /[\s/:\\@?#]/.test(host)) {
      throw new Error(`Invalid server host for ${project.id}: use a hostname or IP without a port or URL.`);
    }
    host = ascii;
  }
  const rawPort = source.port === undefined ? 25565 : source.port;
  const port = Number(rawPort);
  if (!(["string", "number"].includes(typeof rawPort)) || !/^\d+$/.test(String(rawPort)) ||
      !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid server port for ${project.id}.`);
  }
  return { host, port };
}

function formatServerAddress(server) {
  if (!server.host) return "";
  return `${net.isIP(server.host) === 6 ? `[${server.host}]` : server.host}:${server.port}`;
}

function buildProjectConnectionOptions(project) {
  const server = getProjectServer(project);
  if (!server.host) return {};
  const [major, minor] = project.minecraftVersion.split(".").map(Number);
  // Java Edition 1.20 replaced --server/--port with Quick Play.
  return major > 1 || (major === 1 && minor >= 20)
    ? { quickPlay: { type: "multiplayer", identifier: formatServerAddress(server) } }
    : { customLaunchArgs: ["--server", server.host, "--port", String(server.port)] };
}

function validateProjectId(value) {
  if (typeof value !== "string" || !PROJECT_ID_PATTERN.test(value) || WINDOWS_RESERVED_ID.test(value)) {
    throw new Error(`Invalid modpack project id: ${String(value)}`);
  }
  return value;
}

function readProjects(config = {}) {
  const entries = config.projects ?? [];
  if (!Array.isArray(entries)) throw new Error("Modpack projects must be an array.");
  const ids = new Set();
  return entries.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid modpack project configuration.");
    const id = validateProjectId(entry.id);
    if (ids.has(id)) throw new Error(`Duplicate modpack project id: ${id}`);
    ids.add(id);
    const minecraftVersion = entry.minecraftVersion || "1.21.1";
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(minecraftVersion)) throw new Error(`Invalid Minecraft version for ${id}.`);
    const modLoader = entry.modLoader || "fabric";
    if (modLoader !== "fabric") throw new Error(`Unsupported mod loader for ${id}: ${modLoader}. Currently supported: fabric.`);
    const [, minor, patch = "0"] = minecraftVersion.split(".");
    const inferredJavaMajor = Number(minor) >= 21 || (Number(minor) === 20 && Number(patch) >= 5)
      ? 21 : Number(minor) >= 17 ? 17 : 8;
    const javaMajor = entry.javaMajor ?? inferredJavaMajor;
    if (![8, 17, 21, 25].includes(javaMajor)) throw new Error(`Unsupported Java version for ${id}: ${javaMajor}.`);
    const loaderVersion = entry.loaderVersion || "";
    if (loaderVersion && !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(loaderVersion)) {
      throw new Error(`Invalid Fabric loader version for ${id}.`);
    }
    for (const field of ["modpack", "server", "serverStatus", "news"]) {
      if (entry[field] !== undefined && (!entry[field] || typeof entry[field] !== "object" || Array.isArray(entry[field]))) {
        throw new Error(`Invalid ${field} configuration for ${id}.`);
      }
    }
    return {
      ...entry, id, name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : id,
      minecraftVersion, modLoader, javaMajor, loaderVersion, legacy: false,
      server: getProjectServer(entry),
      modpack: entry.modpack || {}, serverStatus: entry.serverStatus || {}, news: entry.news || {}
    };
  });
}

function resolveProject(config, projectId = "") {
  const projects = readProjects(config);
  if (projects.length === 0) throw new Error("No modpack projects are registered.");
  const id = projectId || config.defaultProject || projects[0].id;
  const project = projects.find((entry) => entry.id === id);
  if (!project) throw new Error(`Unknown modpack project: ${id}`);
  return project;
}

function getProjectDirectory(userDataPath, projectId) {
  return path.join(userDataPath, "instances", validateProjectId(projectId));
}

module.exports = { validateProjectId, readProjects, resolveProject, getProjectDirectory, getProjectServer, formatServerAddress, buildProjectConnectionOptions };
