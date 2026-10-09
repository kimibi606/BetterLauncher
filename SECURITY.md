# 보안

취약점이나 노출된 비밀값은 공개 이슈에 적지 말고 [비공개 취약점 보고](https://github.com/kimibi606/BetterLauncher/security/advisories/new)를 이용하세요.

보안 수정은 최신 릴리즈에 제공됩니다. [최신 버전](https://github.com/kimibi606/BetterLauncher/releases/latest)을 사용하세요.

- 런처와 모드팩 원격 배포는 HTTPS를 사용합니다. HTTP loopback은 개발 실행에서만 허용합니다.
- 모드팩 manifest의 SHA-256은 다운로드 무결성을 검증합니다. 배포 서버 자체가 탈취된 경우에는 배포자의 진위를 보증하지 못하므로 등록된 서버와 배포 계정도 보호해야 합니다.
- 로그인 토큰은 운영체제 암호화로 저장합니다. 암호화를 사용할 수 없으면 디스크에 토큰을 저장하지 않습니다.
- GitHub와 Cloudflare 계정의 다중 인증·복구 수단은 계정 소유자가 직접 관리해야 합니다. 이번 점검으로 계정의 다중 인증 사용 여부를 확인하지 못했습니다.
- Windows 설치 파일은 현재 코드 서명 인증서가 없어 서명되지 않았습니다. GitHub의 공식 릴리즈에서 다운로드하세요.

[2026-10-09 점검 및 수정 내용](docs/security-audit.md)
