"use strict";

function describeMicrosoftLoginFailure(error, stage = "microsoft-session") {
  const text = String(error?.message || error || "");
  let code = "auth-login-failed";
  let message = "로그인을 완료하지 못했습니다. 잠시 후 다시 로그인해 주세요.";
  if (/login was cancel|access_denied|user_cancel/i.test(text)) {
    code = "auth-login-cancelled";
    message = "로그인을 취소했습니다. 다시 로그인할 수 있습니다.";
  } else if (/2148916233|does not have an Xbox (?:profile|account)/i.test(text)) {
    code = "auth-xbox-profile-required";
    message = "Xbox 프로필이 아직 준비되지 않았습니다. 공식 Minecraft 런처에서 계정 설정을 완료한 뒤 다시 로그인해 주세요.";
  } else if (/214891623[678]|parental permission|family organizer permission|child.account policy/i.test(text)) {
    code = "auth-family-permission-required";
    message = "Xbox 계정에 보호자 동의가 필요합니다. Microsoft 가족 설정에서 동의를 완료한 뒤 다시 로그인해 주세요.";
  } else if (/2148916235|not available for this account region/i.test(text)) {
    code = "auth-xbox-region-unavailable";
    message = "이 계정의 지역 설정으로 Xbox 로그인을 완료할 수 없습니다. 공식 Minecraft 런처에서 계정 상태를 확인해 주세요.";
  } else if (/Java entitlement|Minecraft profile (?:fetch failed.*HTTP 404|response is missing)/i.test(text)) {
    code = "auth-minecraft-profile-unavailable";
    message = "Minecraft Java 프로필을 확인하지 못했습니다. 공식 Minecraft 런처에서 이 계정으로 Java Edition이 실행되는지 확인한 뒤 다시 로그인해 주세요.";
  } else if (/OS encryption|auth cache/i.test(text)) {
    code = "auth-secure-storage-unavailable";
    message = "Windows 보안 저장소를 사용할 수 없습니다. 런처를 다시 실행한 뒤 로그인해 주세요.";
  } else if (/state validation|callback.*(?:invalid|authorization code)/i.test(text)) {
    code = "auth-login-response-invalid";
    message = "로그인 응답을 확인하지 못했습니다. 로그인 창을 새로 열어 다시 시도해 주세요.";
  } else if (/HTTP 429|too many requests/i.test(text)) {
    code = "auth-service-rate-limited";
    message = "로그인 요청이 많아 인증 서비스가 잠시 제한했습니다. 잠시 기다린 뒤 다시 로그인해 주세요.";
  } else if (/HTTP 5\d\d|timeout|timed out|fetch failed|network|ECONNRESET|ENOTFOUND/i.test(text)) {
    code = "auth-service-unavailable";
    message = "인증 서비스에 연결하지 못했습니다. 인터넷 연결을 확인하고 잠시 후 다시 로그인해 주세요.";
  } else if (stage === "microsoft-token-exchange") {
    code = "auth-microsoft-session-failed";
    message = "Microsoft 로그인 응답을 처리하지 못했습니다. 로그인 창을 새로 열어 다시 시도해 주세요.";
  } else if (stage === "minecraft-session") {
    code = "auth-minecraft-session-failed";
    message = "Microsoft 로그인 후 게임 계정 인증을 완료하지 못했습니다. 잠시 후 다시 로그인해 주세요.";
  }
  // Never forward provider payloads, tokens, callback URLs or account details.
  return { code, error: message };
}

module.exports = { describeMicrosoftLoginFailure };
