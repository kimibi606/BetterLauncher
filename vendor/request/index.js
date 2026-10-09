"use strict";

const http = require("http");
const https = require("https");
const { PassThrough } = require("stream");

const { safeLookup, validateNetworkUrl, redirectHeaders } = require("./network-security");
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

function normalizeTarget(options) {
  return validateNetworkUrl(options.url || options.uri);
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

  const perform = (targetInput, redirectCount, requestOptions = options) => {
    const options = requestOptions;
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
        try {
          const next = normalizeTarget({ url: new URL(location, target) });
          const nextOptions = { ...options, headers: Object.fromEntries(redirectHeaders(headers, target, next)) };
          if (response.statusCode === 303 || ([301, 302].includes(response.statusCode) && request.method === "POST")) {
            nextOptions.method = "GET"; delete nextOptions.body; delete nextOptions.json;
            for (const key of Object.keys(nextOptions.headers)) if (/^content-(length|type)$/i.test(key)) delete nextOptions.headers[key];
          } else if (body && target.origin !== next.origin) {
            throw new Error("Cross-origin redirects cannot forward request bodies.");
          }
          perform(next.toString(), redirectCount + 1, nextOptions);
        } catch (error) { output.destroy(error); }
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
