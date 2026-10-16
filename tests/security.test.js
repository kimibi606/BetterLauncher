"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { secureFetch } = require("../lib/secure-fetch");
const { isPrivateAddress, validateNetworkUrl, safeLookup } = require("../vendor/request/network-security");
const { redactSensitiveText, redactPrivateDiagnostics, sanitizeDiagnosticPayload } = require("../lib/log-security");

test("remote downloads reject HTTP, URL credentials and private IP forms", () => {
  for (const url of ["http://example.com/mod.jar", "https://user:password@example.com/", "https://127.1/",
    "https://0x7f000001/", "https://[::ffff:7f00:1]/", "https://[::1]/", "https://192.168.1.1/"]) {
    assert.throws(() => validateNetworkUrl(url));
  }
  assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateAddress("fc.example.com"), false);
  assert.equal(validateNetworkUrl("https://example.com/mod.jar").protocol, "https:");
});

test("redirects strip credentials and reject HTTPS downgrade or private destinations", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, headers: options.headers });
    return requests.length === 1 ? new Response(null, { status: 302, headers: { location: "https://cdn.example.com/mod.jar" } }) : new Response("data");
  };
  await secureFetch("https://example.com/mod.jar", { headers: { Authorization: "Bearer secret", Cookie: "private-cookie" } }, { fetchImpl });
  assert.equal(requests[0].headers.get("authorization"), "Bearer secret");
  assert.equal(requests[1].headers.get("authorization"), null);
  assert.equal(requests[1].headers.get("cookie"), null);
  for (const target of ["http://example.com/mod.jar", "https://127.0.0.1/secret"]) {
    await assert.rejects(secureFetch("https://example.com/", {}, { fetchImpl: async () => new Response(null, { status: 302, headers: { location: target } }) }));
  }
  await assert.rejects(secureFetch("https://example.com/token", { method: "POST", body: "refresh_token=secret" },
    { fetchImpl: async () => new Response(null, { status: 307, headers: { location: "https://evil.example/" } }) }), /request bodies/);
});

test("logs redact runtime tokens, bearer headers and launch arguments", () => {
  const result = redactSensitiveText('Bearer header-secret --accessToken game-secret refresh_token=refresh-secret runtime-sensitive https://example.com/?code=auth-secret', ["runtime-sensitive"]);
  for (const secret of ["header-secret", "game-secret", "refresh-secret", "runtime-sensitive", "auth-secret"]) assert.equal(result.includes(secret), false);
});

test("diagnostics redact IPv4/IPv6, DNS names, signed URLs, personal paths and account identifiers", () => {
  const values = ["203.0.113.42:25565", "[2001:db8::42]:25565", "::ffff:203.0.113.42", "ALPHA.EXAMPLE:25565",
    "https://cdn.example/secret?sig=signed-secret", "C:\\Users\\Friend Name\\instance", "/home/friend/game/logs/latest.log",
    "\\\\private-host\\share\\instance", "friend@example.com", "01234567-89ab-cdef-0123-456789abcdef", "0123456789abcdef0123456789abcdef"];
  for (const value of values) {
    const result = redactPrivateDiagnostics(`Failed: ${value}`);
    assert.equal(result.includes(value), false, `unredacted diagnostic: ${value}`);
    assert.match(result, /PRIVATE/);
  }
  assert.equal(redactPrivateDiagnostics("Minecraft 1.21.1 Java 21 downloading 2/8"), "Minecraft 1.21.1 Java 21 downloading 2/8");
  assert.equal(redactPrivateDiagnostics("connect LAN", ["lan"]).includes("LAN"), false);
  const tokens = 'accessToken=game-secret idToken=id-secret refreshToken=refresh-secret XBL3.0 x=123;xbox-secret --accessToken "quoted secret"';
  assert.doesNotMatch(redactPrivateDiagnostics(tokens), /game-secret|id-secret|refresh-secret|xbox-secret|quoted secret/);
});

test("diagnostic filtering preserves functional account, path and skin data and omits stack traces", () => {
  const source = { minecraftDirectory: "C:\\Users\\Friend\\game", uuid: "0123456789abcdef0123456789abcdef", textureDataUrl: "data:image/png;base64,fixture",
    error: "connect 203.0.113.42:25565", nested: [{ lastError: "https://cdn.example/private?token=secret", message: "Bearer secret", stack: "raw stack" }] };
  const filtered = sanitizeDiagnosticPayload(source);
  assert.equal(filtered.minecraftDirectory, source.minecraftDirectory);
  assert.equal(filtered.uuid, source.uuid);
  assert.equal(filtered.textureDataUrl, source.textureDataUrl);
  assert.doesNotMatch(JSON.stringify(filtered.error), /203\.0\.113\.42/);
  assert.doesNotMatch(JSON.stringify(filtered.nested), /cdn\.example|token=secret|Bearer secret|raw stack/);
  assert.equal("stack" in filtered.nested[0], false);
  assert.equal(source.error, "connect 203.0.113.42:25565");
});

test("DNS answers pointing public hostnames at private addresses are rejected", async () => {
  const dns = require("node:dns");
  const original = dns.lookup;
  try {
    dns.lookup = (_host, _options, callback) => callback(null, [{ address: "192.168.1.2", family: 4 }]);
    await assert.rejects(new Promise((resolve, reject) => safeLookup("public.example", { all: true },
      (error, addresses) => error ? reject(error) : resolve(addresses))), /private or loopback/);
  } finally { dns.lookup = original; }
});
