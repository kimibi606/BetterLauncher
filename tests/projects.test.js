"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { readProjects, resolveProject, getProjectDirectory, getProjectServer, formatServerAddress, buildProjectConnectionOptions } = require("../lib/projects");

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

test("project servers select their own address and the correct Minecraft connection arguments", () => {
  const projects = readProjects({ projects: [
    { id: "old", minecraftVersion: "1.19.4", server: { host: "old.example", port: 25566 } },
    { id: "new", minecraftVersion: "1.20", server: { host: "new.example" }, serverStatus: { host: "stale.example", port: 9999 } },
    { id: "ipv6", minecraftVersion: "1.21.1", server: { host: "[2001:db8::1]", port: 25567 } },
    { id: "solo", server: {}, serverStatus: { host: "stale.example" } },
    { id: "legacy", serverStatus: { host: "legacy.example", port: 25568 } }
  ] });
  assert.deepEqual(buildProjectConnectionOptions(projects[0]), { customLaunchArgs: ["--server", "old.example", "--port", "25566"] });
  assert.deepEqual(buildProjectConnectionOptions(projects[1]), { quickPlay: { type: "multiplayer", identifier: "new.example:25565" } });
  assert.equal(formatServerAddress(projects[2].server), "[2001:db8::1]:25567");
  assert.equal(buildProjectConnectionOptions(projects[2]).quickPlay.identifier, "[2001:db8::1]:25567");
  assert.deepEqual(buildProjectConnectionOptions({ ...projects[2], minecraftVersion: "1.19.4" }).customLaunchArgs, ["--server", "2001:db8::1", "--port", "25567"]);
  assert.deepEqual(buildProjectConnectionOptions(projects[3]), {});
  assert.equal(formatServerAddress(getProjectServer(projects[4])), "legacy.example:25568");
});

test("administrator server settings reject malformed destinations instead of silently using a fallback", () => {
  for (const host of ["https://play.example", "play.example:25565", "user@play.example", "--server", "bad host", "play.example/", "256.256.256.256", "play.example\n--username", 123]) {
    assert.throws(() => readProjects({ projects: [{ id: "test", server: { host } }] }), /Invalid server host/);
  }
  for (const port of [0, 65536, -1, 2.5, true, "", "abc"]) {
    assert.throws(() => readProjects({ projects: [{ id: "test", server: { host: "play.example", port } }] }), /Invalid server port/);
  }
  for (const server of [null, [], "play.example"]) {
    assert.throws(() => readProjects({ projects: [{ id: "test", server }] }), /Invalid server/);
  }
});
