"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { readProjects, resolveProject, getProjectDirectory } = require("../lib/projects");

const config = { defaultProject: "second", projects: [
  { id: "first", name: "First", minecraftVersion: "1.20.1", javaMajor: 17 },
  { id: "second", name: "Second", minecraftVersion: "1.21.1", javaMajor: 21 }
] };

test("projects retain independent runtime requirements and default selection", () => {
  assert.equal(resolveProject(config).id, "second");
  assert.equal(resolveProject(config, "first").javaMajor, 17);
  assert.equal(resolveProject(config, "second").minecraftVersion, "1.21.1");
  assert.notEqual(getProjectDirectory(path.resolve("userdata"), "first"), getProjectDirectory(path.resolve("userdata"), "second"));
  assert.throws(() => resolveProject(config, "missing"), /Unknown/);
});

test("project directories reject traversal, Windows device names and duplicate ids", () => {
  for (const id of ["../escape", "a/b", "CON", "nul", "lpt1", "", "a.", "Uppercase"]) {
    assert.throws(() => getProjectDirectory(path.resolve("userdata"), id), /Invalid/);
  }
  assert.throws(() => readProjects({ projects: [{ id: "same" }, { id: "same" }] }), /Duplicate/);
  assert.equal(readProjects({ projects: [] }).length, 0);
  assert.throws(() => readProjects({ projects: [{ id: "test", modLoader: "forge" }] }), /Unsupported mod loader/);
});

test("empty catalogs do not import a legacy BetterMon project", () => {
  assert.deepEqual(readProjects({}), []);
  assert.deepEqual(readProjects({ projects: [] }), []);
  assert.deepEqual(readProjects({ modpack: { manifestUrl: "https://example.test/latest.json" } }), []);
  assert.throws(() => resolveProject({ projects: [] }), /No modpack projects/);
});

test("Java defaults follow the Minecraft runtime boundary", () => {
  const versions = ["1.16.5", "1.20.1", "1.20.4", "1.20.5", "1.21.1"];
  const projects = readProjects({ projects: versions.map((minecraftVersion, index) => ({ id: `pack-${index}`, minecraftVersion })) });
  assert.deepEqual(projects.map((project) => project.javaMajor), [8, 17, 17, 21, 21]);
});
