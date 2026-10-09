"use strict";

const { Agent } = require("undici");
const { safeLookup, validateNetworkUrl, redirectHeaders } = require("../vendor/request/network-security");
const publicDispatcher = new Agent({ connect: { lookup: safeLookup } });

async function secureFetch(url, options = {}, { allowHttpLoopback = false, fetchImpl = fetch } = {}) {
  let target = validateNetworkUrl(url, { allowHttpLoopback });
  let request = { ...options, headers: new Headers(options.headers || {}), redirect: "manual" };
  for (let count = 0; count <= 5; count++) {
    const local = allowHttpLoopback && target.protocol === "http:";
    const response = await fetchImpl(target.toString(), { ...request, ...(local ? {} : { dispatcher: publicDispatcher }) });
    const location = response.headers.get("location");
    if (![301, 302, 303, 307, 308].includes(response.status) || !location) return response;
    await response.body?.cancel();
    if (count === 5) throw new Error("Too many HTTP redirects.");
    const next = validateNetworkUrl(new URL(location, target), { allowHttpLoopback });
    if (target.protocol === "https:" && next.protocol !== "https:") throw new Error("HTTPS redirects cannot downgrade to HTTP.");
    request.headers = redirectHeaders(request.headers, target, next);
    if (response.status === 303 || ([301, 302].includes(response.status) && request.method === "POST")) {
      request = { ...request, method: "GET", body: undefined };
      request.headers.delete("content-length");
      request.headers.delete("content-type");
    } else if (request.body && target.origin !== next.origin) {
      throw new Error("Cross-origin redirects cannot forward request bodies.");
    }
    target = next;
  }
}

module.exports = { secureFetch };
