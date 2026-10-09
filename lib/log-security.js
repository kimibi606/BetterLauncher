"use strict";

function redactSensitiveText(value, secrets = []) {
  let text = String(value ?? "");
  for (const secret of secrets.filter(secret => typeof secret === "string" && secret.length >= 8).sort((a, b) => b.length - a.length)) {
    text = text.split(secret).join("[REDACTED]");
  }
  return text
    .replace(/(Bearer\s+)[^\s"',}]+/gi, "$1[REDACTED]")
    .replace(/((?:--accessToken|--clientToken)\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:access_token|refresh_token|refreshToken|client_secret|password|oauth_token)["']?\s*[:=]\s*["']?)[^\s"'&,}]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:code|token|access_token|refresh_token)=)[^\s&#]+/gi, "$1[REDACTED]");
}

module.exports = { redactSensitiveText };
