"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSkinUuid, normalizeSkinUrl, createAccountSkinService } = require("../lib/account-skin");
const { skinPng } = require("./skin-fixture.cjs");
const uuid = "0123456789abcdef0123456789abcdef";
const hash = "a".repeat(64);
function profile({ id = uuid, textureId = uuid, url = "http://textures.minecraft.net/texture/" + hash, model = "slim" } = {}) {
  return new Response(JSON.stringify({ id, properties: [{ name: "textures", value: Buffer.from(JSON.stringify({ profileId: textureId, textures: { SKIN: { url, metadata: { model } } } })).toString("base64") }] }));
}

test("skins use official HTTPS endpoints, bounded PNG data and slim/classic models", async () => {
  const requests = [];
  const service = createAccountSkinService({ fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return requests.length === 1 ? profile() : new Response(skinPng());
  } });
  const result = await service.get(uuid);
  assert.equal(result.uuid, uuid);
  assert.equal(result.model, "slim");
  assert.ok(result.textureDataUrl.startsWith("data:image/png;base64,"));
  assert.equal(requests[0].url, "https://sessionserver.mojang.com/session/minecraft/profile/" + uuid);
  assert.equal(requests[1].url, "https://textures.minecraft.net/texture/" + hash);
  assert.ok(requests.every(({ options }) => !options.headers.Authorization));
  assert.equal(normalizeSkinUuid("01234567-89ab-cdef-0123-456789abcdef"), uuid);
  assert.equal(normalizeSkinUuid("not-a-uuid"), "");
  for (const url of ["https://evil.example/texture/"+hash, "https://textures.minecraft.net.evil.example/texture/"+hash,
    "https://textures.minecraft.net/texture/"+hash+"?token=secret", "https://user:secret@textures.minecraft.net/texture/"+hash]) {
    assert.throws(() => normalizeSkinUrl(url));
  }
});

test("skin requests deduplicate, cache successful results and retry failures", async () => {
  let count = 0;
  let timestamp = 0;
  let offline = false;
  const service = createAccountSkinService({ now: () => timestamp, cacheMs: 100,
    fetchImpl: async (url) => {
      count++;
      if (offline) throw new Error("offline");
      return url.includes("sessionserver") ? profile({ model: "classic" }) : new Response(skinPng({ height: 32 }));
    } });
  const [first, same] = await Promise.all([service.get(uuid), service.get(uuid)]);
  assert.deepEqual(first, same);
  assert.equal(count, 2);
  await service.get(uuid);
  assert.equal(count, 2);
  timestamp = 101;
  offline = true;
  assert.equal((await service.get(uuid)).cached, true);
  offline = false;
  assert.equal((await service.get(uuid)).cached, undefined);
  assert.equal(count, 5);
  let failures = 0;
  const retry = createAccountSkinService({ fetchImpl: async () => { failures++; throw new Error("offline"); } });
  await assert.rejects(retry.get(uuid));
  await assert.rejects(retry.get(uuid));
  assert.equal(failures, 2);
});

test("untrusted profiles, oversized replies and invalid PNGs fail without fetching foreign URLs", async () => {
  for (const reply of [profile({ id: "b".repeat(32) }), profile({ textureId: "b".repeat(32) }), profile({ url: "https://evil.example/secret" })]) {
    let calls = 0;
    const service = createAccountSkinService({ fetchImpl: async () => { calls++; return reply; } });
    await assert.rejects(service.get(uuid));
    assert.equal(calls, 1);
  }
  for (const texture of [new Response("<html>not an image</html>"), new Response(Buffer.alloc(129 * 1024)),
    new Response(skinPng({ height: 16 }))]) {
    const service = createAccountSkinService({ fetchImpl: async (url) => url.includes("sessionserver") ? profile() : texture });
    await assert.rejects(service.get(uuid));
  }
  const oversized = createAccountSkinService({ fetchImpl: async () => new Response("{}", { headers: { "content-length": "65536" } }) });
  await assert.rejects(oversized.get(uuid), /large/);
});

test("an unavailable official service has a bounded deadline", async () => {
  const service = createAccountSkinService({ timeoutMs: 20, fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(profile()), 500);
    signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  }) });
  await assert.rejects(service.get(uuid), { name: "TimeoutError" });
});
