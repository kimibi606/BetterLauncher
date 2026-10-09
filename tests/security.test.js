"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { secureFetch } = require("../lib/secure-fetch");
const { isPrivateAddress, validateNetworkUrl, safeLookup } = require("../vendor/request/network-security");
const { redactSensitiveText } = require("../lib/log-security");

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

test("DNS answers pointing public hostnames at private addresses are rejected", async () => {
  const dns = require("node:dns");
  const original = dns.lookup;
  try {
    dns.lookup = (_host, _options, callback) => callback(null, [{ address: "192.168.1.2", family: 4 }]);
    await assert.rejects(new Promise((resolve, reject) => safeLookup("public.example", { all: true },
      (error, addresses) => error ? reject(error) : resolve(addresses))), /private or loopback/);
  } finally { dns.lookup = original; }
});
