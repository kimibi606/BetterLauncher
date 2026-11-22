"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const nbt = require("prismarine-nbt");
const { updateGameServers } = require("../lib/game-servers");

test("Minecraft server preferences preserve other entries and avoid duplicates", () => {
  const project = { name: "테스트 모드팩", server: { host: "play.example", port: 25565 } };
  const prefs = { serverResourcePack: true };
  const hidden = updateGameServers(null, project, prefs);
  assert.equal(nbt.simplify(nbt.parseUncompressed(hidden)).servers[0].hidden, 1);

  const other = { name: nbt.string("Other"), ip: nbt.string("other.example"), hidden: nbt.byte(0) };
  const document = nbt.parseUncompressed(hidden);
  document.value.servers.value.value.unshift(other);
  const input = nbt.writeUncompressed(document);
  const result = updateGameServers(input, project, { addServer: true, serverResourcePack: false });
  const { servers } = nbt.simplify(nbt.parseUncompressed(result));
  assert.deepEqual(servers, [
    { name: "Other", ip: "other.example", hidden: 0 },
    { name: project.name, ip: "play.example:25565", hidden: 0 }
  ]);
  assert.equal(updateGameServers(result, project, { addServer: true, serverResourcePack: false }), null);
});
