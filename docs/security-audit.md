# 2026-10-09 보안 점검

BetterLauncher 0.4.2에 적용했습니다. 코드·Git 이력·의존성·GitHub 저장소 설정을 점검했으며, 전체 침투 테스트는 아닙니다.

| 발견 사항 | 수정 |
| --- | --- |
| npm 감사에서 취약 패키지 22개: 높음 14개, 보통 8개 | Electron·빌드 도구·ZIP 처리·Wrangler 및 하위 의존성을 패치 버전으로 변경. 깨끗한 npm ci 후 전체 npm audit 0개 |
| Windows 예약 파일명·대체 데이터 스트림·경로 별칭 처리 누락 | 잘못된 경로 차단. 심볼릭 링크·정션을 통해 인스턴스 밖에 쓰거나 삭제하는 작업 차단 |
| manifest가 관리 대상 밖의 파일·전체 Minecraft 폴더 삭제를 요청할 수 있음 | 배포 관리 폴더·파일만 허용. 전체 폴더 삭제 요청 및 SHA-256 없는 파일 거부 |
| IPC 호출의 창·프레임 출처 검사 누락 | 런처 메인 창의 로컬 문서·메인 프레임만 호출 허용 |
| 암호화 실패 시 로그인 토큰 평문 저장 가능 | 평문 저장 중단. 이전 평문 캐시는 암호화하거나 암호화 불가능 시 제거 |
| 로그에 게임 실행 토큰 등이 포함될 가능성 | 로그인·GitHub 토큰, Bearer 헤더, 게임 토큰 인자, OAuth 코드 마스킹 |
| HTTP 배포·리다이렉트의 다운그레이드 및 인증 정보 전달 가능 | HTTPS·실제 연결 DNS 주소 검사. 사설 주소 차단. 다른 origin으로 인증 헤더·쿠키·요청 본문 전달 차단 |
| 취약 의존성 알림·보호 규칙 미설정 | Dependabot 알림·보안 업데이트, main 강제 push·삭제 방지, 릴리즈 태그 수정·삭제 방지 활성화 |
| 빌드 과정에 저장소 쓰기 권한 및 이동 가능한 액션 태그 사용 | 빌드 읽기 권한과 게시 쓰기 권한 분리. checkout 인증 정보 저장 중단. 액션을 전체 SHA로 고정하고 GitHub에서도 SHA 고정 필수 설정 |
| 태그 이름을 셸 코드에 직접 삽입·기존 릴리즈 덮어쓰기 | 환경 변수로 전달하고 버전·main 포함 여부 검증. 게시된 릴리즈 덮어쓰기 거부 |

전체 Git 이력 55개 커밋을 Gitleaks로 검사했습니다. 공개 OAuth 클라이언트 ID를 제외한 실제 비밀값 유출은 발견되지 않았습니다. GitHub 비밀값 검사와 push protection도 활성화 상태를 확인했습니다. OAuth 앱 ID의 제한된 예외만 `.gitleaks.toml`에 기록했습니다.

앞으로 main과 PR에서 의존성 감사·회귀 테스트·비밀값 검사·CodeQL 검사를 수행합니다. 사용 가능한 액션은 GitHub 소유 액션으로 제한하고, 비공개 취약점 보고를 활성화했습니다.

남은 항목은 Windows 코드 서명과 계정 소유자가 관리하는 GitHub·Cloudflare 다중 인증입니다. 개인용 인증 정보를 새로 발급하거나 폐기하지 않았으며, 공개 저장소는 자동 업데이트 배포에 필요한 상태로 유지했습니다.

근거: [Electron 보안 지침](https://www.electronjs.org/docs/latest/tutorial/security), [GitHub Actions 보안 지침](https://docs.github.com/en/actions/reference/security/secure-use), [Wrangler 명령 주입 취약점](https://github.com/cloudflare/workers-sdk/security/advisories/GHSA-36p8-mvp6-cv38).
