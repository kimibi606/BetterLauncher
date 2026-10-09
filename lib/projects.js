"use strict";

const path = require("path");

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDOWS_RESERVED_ID = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function validateProjectId(value) {
  if (typeof value !== "string" || !PROJECT_ID_PATTERN.test(value) || WINDOWS_RESERVED_ID.test(value)) {
    throw new Error(`Invalid modpack project id: ${String(value)}`);
  }
  return value;
}

function readProjects(config = {}) {
  const legacy = !Array.isArray(config.projects);
  const entries = legacy ? [{
    id: "bettermon", name: "BetterMon", minecraftVersion: "1.21.1", modLoader: "fabric", javaMajor: 21,
    modpack: config.modpack || {}, serverStatus: config.serverStatus || {}, news: config.news || {},
    discordUrl: "https://example.invalid/private"
  }] : config.projects;
  if (entries.length === 0) throw new Error("Configure at least one modpack project in modpack.config.json.");
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
    for (const field of ["modpack", "serverStatus", "news"]) {
      if (entry[field] !== undefined && (!entry[field] || typeof entry[field] !== "object" || Array.isArray(entry[field]))) {
        throw new Error(`Invalid ${field} configuration for ${id}.`);
      }
    }
    return {
      ...entry, id, name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : id,
      minecraftVersion, modLoader, javaMajor, loaderVersion, legacy,
      modpack: entry.modpack || {}, serverStatus: entry.serverStatus || {}, news: entry.news || {}
    };
  });
}

function resolveProject(config, projectId = "") {
  const projects = readProjects(config);
  const id = projectId || config.defaultProject || projects[0].id;
  const project = projects.find((entry) => entry.id === id);
  if (!project) throw new Error(`Unknown modpack project: ${id}`);
  return project;
}

function getProjectDirectory(userDataPath, projectId) {
  return path.join(userDataPath, "instances", validateProjectId(projectId));
}

module.exports = { validateProjectId, readProjects, resolveProject, getProjectDirectory };
