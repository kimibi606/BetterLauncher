"use strict";

const dns = require("dns");
const http = require("http");
const https = require("https");
const net = require("net");
const { PassThrough } = require("stream");

const MAX_REDIRECTS = 5;

function mergeOptions(defaults, input) {
  const requestOptions = typeof input === "string" || input instanceof URL ? { url: String(input) } : { ...(input || {}) };
  return {
    ...defaults,
    ...requestOptions,
    headers: {
      ...(defaults.headers || {}),
      ...(requestOptions.headers || {})
    }
  };
}

function isPrivateAddress(address) {
  const normalized = String(address || "").toLowerCase().split("%")[0];
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (/^fe[89ab]/.test(normalized)) {
    return true;
  }
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  const ipv4 = mappedIpv4 || (net.isIP(normalized) === 4 ? normalized : "");
  if (!ipv4) {
    return false;
  }
  const octets = ipv4.split(".").map(Number);
  return (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] >= 224
  );
}

function safeLookup(hostname, options, callback) {
  const lookupOptions = typeof options === "number" ? { family: options } : { ...(options || {}) };
  dns.lookup(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }
    const safeAddresses = addresses.filter((entry) => !isPrivateAddress(entry.address));
    if (safeAddresses.length !== addresses.length || safeAddresses.length === 0) {
      const blockedError = new Error(`Blocked request to private or loopback address: ${hostname}`);
      blockedError.code = "ERR_BLOCKED_PRIVATE_ADDRESS";
      callback(blockedError);
      return;
    }
    if (lookupOptions.all) {
      callback(null, safeAddresses);
      return;
    }
    callback(null, safeAddresses[0].address, safeAddresses[0].family);
  });
}

function normalizeTarget(options) {
  const rawUrl = options.url || options.uri;
  const target = rawUrl instanceof URL ? new URL(rawUrl.toString()) : new URL(String(rawUrl || ""));
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error(`Unsupported request protocol: ${target.protocol || "(empty)"}`);
  }
  if (target.username || target.password) {
    throw new Error("Credentials in request URLs are not allowed.");
  }
  if (isPrivateAddress(target.hostname)) {
    const error = new Error(`Blocked request to private or loopback address: ${target.hostname}`);
    error.code = "ERR_BLOCKED_PRIVATE_ADDRESS";
    throw error;
  }
  return target;
}

function createRequest(defaultOptions, input, callback) {
  const options = mergeOptions(defaultOptions, input);
  const output = new PassThrough();
  let callbackCalled = false;
  let responseForCallback = null;
  const bodyChunks = [];

  const finishCallback = (error, response, body) => {
    if (callbackCalled || typeof callback !== "function") {
      return;
    }
    callbackCalled = true;
    callback(error, response, body);
  };

  if (typeof callback === "function") {
    output.on("response", (response) => {
      responseForCallback = response;
    });
    output.on("data", (chunk) => bodyChunks.push(Buffer.from(chunk)));
    output.on("end", () => {
      const rawBody = Buffer.concat(bodyChunks).toString(options.encoding || "utf8");
      if (options.json) {
        try {
          finishCallback(null, responseForCallback, rawBody ? JSON.parse(rawBody) : null);
        } catch (error) {
          finishCallback(error, responseForCallback, rawBody);
        }
        return;
      }
      finishCallback(null, responseForCallback, rawBody);
    });
    output.on("error", (error) => finishCallback(error, responseForCallback));
  }

  const perform = (targetInput, redirectCount) => {
    let target;
    try {
      target = normalizeTarget({ url: targetInput });
    } catch (error) {
      output.destroy(error);
      return;
    }

    const headers = { ...(options.headers || {}) };
    let body = null;
    if (options.json && typeof options.json === "object") {
      body = Buffer.from(JSON.stringify(options.json), "utf8");
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      headers["Content-Length"] = String(body.length);
    } else if (options.body !== undefined && options.body !== null) {
      body = Buffer.isBuffer(options.body) ? options.body : Buffer.from(String(options.body), "utf8");
      headers["Content-Length"] = String(body.length);
    }

    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, {
      method: options.method || (body ? "POST" : "GET"),
      headers,
      lookup: safeLookup
    });
    const timeoutMs = Math.max(1000, Number(options.timeout) || 50000);
    request.setTimeout(timeoutMs, () => {
      const error = new Error(`Request timed out after ${timeoutMs}ms: ${target.href}`);
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });
    request.on("response", (response) => {
      const isRedirect = [301, 302, 303, 307, 308].includes(response.statusCode);
      const location = response.headers.location;
      if (isRedirect && location) {
        response.resume();
        if (redirectCount >= MAX_REDIRECTS) {
          output.destroy(new Error(`Too many redirects: ${target.href}`));
          return;
        }
        perform(new URL(location, target).toString(), redirectCount + 1);
        return;
      }
      output.emit("response", response);
      response.on("error", (error) => output.destroy(error));
      response.pipe(output);
    });
    request.on("error", (error) => output.destroy(error));
    if (body) {
      request.write(body);
    }
    request.end();
  };

  queueMicrotask(() => perform(options.url || options.uri, 0));
  return output;
}

function createClient(defaultOptions = {}) {
  const client = (input, callback) => createRequest(defaultOptions, input, callback);
  client.get = (input, callback) => createRequest({ ...defaultOptions, method: "GET" }, input, callback);
  client.post = (input, callback) => createRequest({ ...defaultOptions, method: "POST" }, input, callback);
  client.defaults = (options) => createClient(mergeOptions(defaultOptions, options));
  return client;
}

module.exports = createClient();
