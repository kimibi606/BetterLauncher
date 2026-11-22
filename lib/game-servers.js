"use strict";

const { gunzipSync } = require("node:zlib");
const nbt = require("prismarine-nbt");
const { formatServerAddress } = require("./projects");

const MAX_SERVER_LIST_BYTES = 16 * 1024 ** 2;

function updateGameServers(data, project, { addServer, serverResourcePack }) {
  const { server } = project;
  if (!server?.host || (!data && !addServer && !serverResourcePack)) return null;
  if (data?.length > MAX_SERVER_LIST_BYTES) throw new Error("Minecraft server list is too large.");
  const compressed = data?.[0] === 0x1f && data?.[1] === 0x8b;
  const raw = compressed ? gunzipSync(data, { maxOutputLength: MAX_SERVER_LIST_BYTES }) : data;
  const document = raw ? nbt.parseUncompressed(raw) : nbt.comp({ servers: nbt.list(nbt.comp([])) });
  const list = document.value?.servers?.value;
  if (document.type !== "compound" || !Array.isArray(list?.value) ||
      (list.type !== "compound" && !(list.type === "end" && list.value.length === 0))) {
    throw new Error("Minecraft server list is invalid.");
  }

  const address = formatServerAddress(server);
  const entry = list.value.find(item => {
    const existing = item.ip?.value?.toLowerCase();
    return existing === address.toLowerCase() || (server.port === 25565 && existing === server.host.toLowerCase());
  });
  if (!entry && !addServer && !serverResourcePack) return null;
  const target = entry || { name: nbt.string(project.name), ip: nbt.string(address), hidden: nbt.byte(addServer ? 0 : 1) };
  if (!entry) {
    list.type = "compound";
    list.value.push(target);
  } else if (addServer && target.hidden?.value === 1) {
    target.hidden = nbt.byte(0);
  }
  if (serverResourcePack === true) target.acceptTextures = nbt.byte(1);
  if (serverResourcePack === false && target.acceptTextures?.value === 1) delete target.acceptTextures;
  const output = nbt.writeUncompressed(document);
  return raw?.equals(output) ? null : output;
}

module.exports = { MAX_SERVER_LIST_BYTES, updateGameServers };
