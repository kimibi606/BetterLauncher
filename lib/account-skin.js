"use strict";

const { secureFetch } = require("./secure-fetch");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function normalizeSkinUuid(value) {
  const uuid = typeof value === "string" ? value.replace(/-/g, "").toLowerCase() : "";
  return /^[a-f0-9]{32}$/.test(uuid) ? uuid : "";
}

function normalizeSkinUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "textures.minecraft.net" ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\/texture\/[a-f0-9]{32,128}$/i.test(url.pathname)) {
    throw new Error("Invalid official skin texture URL.");
  }
  url.protocol = "https:";
  return url.toString();
}

async function readLimitedBody(response, maxBytes) {
  if (!response.ok || !response.body) throw new Error("Official skin service is unavailable.");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel();
    throw new Error("Skin response is too large.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) throw new Error("Skin response is too large.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function createAccountSkinService({ fetchImpl = secureFetch, now = Date.now, timeoutMs = 10000, cacheMs = 5 * 60 * 1000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function download(uuid) {
    const signal = AbortSignal.timeout(timeoutMs);
    const profileResponse = await fetchImpl("https://sessionserver.mojang.com/session/minecraft/profile/" + uuid,
      { signal, headers: { Accept: "application/json" } });
    const profile = JSON.parse((await readLimitedBody(profileResponse, 32 * 1024)).toString("utf8"));
    if (normalizeSkinUuid(profile.id) !== uuid) throw new Error("Skin profile does not match this account.");
    const encoded = profile.properties?.find((property) => property.name === "textures")?.value;
    if (typeof encoded !== "string") throw new Error("Skin profile has no texture data.");
    const textures = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    if (textures.profileId && normalizeSkinUuid(textures.profileId) !== uuid) throw new Error("Skin texture belongs to another account.");
    const skin = textures.textures?.SKIN;
    if (!skin) return { ok: true, uuid, textureDataUrl: "", model: "classic" };
    const textureResponse = await fetchImpl(normalizeSkinUrl(skin.url), { signal, headers: { Accept: "image/png" } });
    const png = await readLimitedBody(textureResponse, 128 * 1024);
    if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE) || png.toString("ascii", 12, 16) !== "IHDR" ||
        png.readUInt32BE(16) !== 64 || ![32, 64].includes(png.readUInt32BE(20))) {
      throw new Error("Invalid Minecraft skin PNG.");
    }
    return { ok: true, uuid, textureDataUrl: "data:image/png;base64," + png.toString("base64"), model: skin.metadata?.model === "slim" ? "slim" : "classic" };
  }
  return {
    async get(value) {
      const uuid = normalizeSkinUuid(value);
      if (!uuid) throw new Error("Invalid Minecraft account UUID.");
      const saved = cache.get(uuid);
      if (saved && saved.expiresAt > now()) return saved.value;
      if (pending.has(uuid)) return pending.get(uuid);
      const request = download(uuid).then(value => {
        cache.delete(uuid);
        cache.set(uuid, { value, expiresAt: now() + cacheMs });
        if (cache.size > 32) cache.delete(cache.keys().next().value);
        return value;
      }).catch(error => {
        if (saved) return { ...saved.value, cached: true };
        throw error;
      }).finally(() => pending.delete(uuid));
      pending.set(uuid, request);
      return request;
    }
  };
}

module.exports = { normalizeSkinUuid, normalizeSkinUrl, createAccountSkinService };
