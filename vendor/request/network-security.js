"use strict";

const dns = require("node:dns");
const net = require("node:net");

function isPrivateAddress(address) {
  let host = String(address || "").toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (net.isIP(host) === 6) {
    // URL canonicalization also handles IPv4-mapped addresses expressed in hex.
    host = new URL(`http://[${host}]`).hostname.slice(1, -1);
    const mapped = host.match(/^::ffff:([\da-f]+):([\da-f]+)$/);
    if (mapped) {
      const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return host === "::" || host === "::1" || /^(f[cd]|fe[89ab]|ff)/.test(host);
  }
  if (net.isIP(host) !== 4) return false;
  const [a, b] = host.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function safeLookup(hostname, options, callback) {
  const lookupOptions = typeof options === "number" ? { family: options } : { ...(options || {}) };
  dns.lookup(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) {
      const blocked = new Error("Blocked request to a private or loopback address.");
      blocked.code = "ERR_BLOCKED_PRIVATE_ADDRESS";
      return callback(blocked);
    }
    if (lookupOptions.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

function validateNetworkUrl(value, { allowHttpLoopback = false } = {}) {
  const target = new URL(String(value));
  const host = target.hostname.replace(/^\[|\]$/g, "");
  const developmentLoopback = allowHttpLoopback &&
    (host === "localhost" || host === "127.0.0.1" || host === "::1");
  if (target.username || target.password) throw new Error("Credentials in request URLs are not allowed.");
  if (target.protocol !== "https:" && !(target.protocol === "http:" && developmentLoopback)) {
    throw new Error("Remote requests must use HTTPS.");
  }
  if (isPrivateAddress(host) && !developmentLoopback) {
    throw new Error("Blocked request to a private or loopback address.");
  }
  return target;
}

function redirectHeaders(headers, from, to) {
  const output = new Headers(headers || {});
  if (from.origin !== to.origin) {
    for (const name of ["authorization", "cookie", "proxy-authorization"]) output.delete(name);
  }
  return output;
}

module.exports = { isPrivateAddress, safeLookup, validateNetworkUrl, redirectHeaders };
