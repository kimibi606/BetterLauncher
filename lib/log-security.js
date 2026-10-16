"use strict";

function redactSensitiveText(value, secrets = []) {
  let text = String(value ?? "");
  for (const secret of secrets.filter(secret => typeof secret === "string" && secret.length >= 8).sort((a, b) => b.length - a.length)) {
    text = text.split(secret).join("[REDACTED]");
  }
  return text
    .replace(/(Bearer\s+)[^\s"',}]+/gi, "$1[REDACTED]")
    .replace(/((?:--accessToken|--clientToken|--userProperties)\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s]+)/gi, "$1[REDACTED]")
    .replace(/((?:access_?token|refresh_?token|id_?token|client_?token|client_secret|password|oauth_token)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, "$1[REDACTED]")
    .replace(/(XBL3\.0\s+x=)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/([?&](?:code|token|access_token|refresh_token|sig|signature)=)[^\s&#]+/gi, "$1[REDACTED]");
}

function redactPrivateDiagnostics(value, secrets = []) {
  let text = String(value ?? "");
  for (const secret of [...new Set(secrets)].filter(secret => typeof secret === "string" && secret.length >= 3).sort((a, b) => b.length - a.length)) {
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\[?${escaped}\\]?(?::\\d{1,5})?`, "gi"), "[REDACTED]");
  }
  return redactSensitiveText(text)
    .replace(/\b(?:https?|wss?|file):\/\/[^\s<>"']+/gi, "[PRIVATE URL]")
    .replace(/\b[A-Z]:[\\/][^\r\n"'<>|]*/gi, "[PRIVATE PATH]")
    .replace(/\\\\[^\r\n"'<>|]+/g, "[PRIVATE PATH]")
    .replace(/(^|[\s("'=])\/(?:[^/\s"'<>]+\/)*[^/\s"'<>]+/g, "$1[PRIVATE PATH]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[PRIVATE ACCOUNT]")
    .replace(/\b(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|[a-f0-9]{32})\b/gi, "[PRIVATE ACCOUNT]")
    .replace(/\[?(?:[a-f0-9]{0,4}:){2,}[a-f0-9:.]+(?:%[a-z0-9]+)?\]?(?::\d{1,5})?/gi, "[PRIVATE ADDRESS]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g, "[PRIVATE ADDRESS]")
    .replace(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}\b(?::\d{1,5})?/gi, "[PRIVATE ADDRESS]");
}

// Only diagnostic fields are redacted. Paths and identifiers required to launch
// the game or render account skins must retain their original values.
function sanitizeDiagnosticPayload(value, redact = redactPrivateDiagnostics) {
  if (Array.isArray(value)) return value.map(entry => sanitizeDiagnosticPayload(entry, redact));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "stack") continue;
    result[key] = ["error", "lastError", "message", "errorMessage"].includes(key) && typeof entry === "string"
      ? redact(entry) : sanitizeDiagnosticPayload(entry, redact);
  }
  return result;
}

const launcherPrivacy = { redactSensitiveText, redactPrivateDiagnostics, sanitizeDiagnosticPayload };
if (typeof module !== "undefined" && module.exports) module.exports = launcherPrivacy;
else globalThis.launcherPrivacy = Object.freeze(launcherPrivacy);
