# BetterLauncher

Electron 기반의 단일 모드팩 Minecraft 런처입니다. 로그인하면 해당 모드팩의 실행 화면으로 이동해 Java와 업데이트를 준비하고 게임을 시작할 수 있습니다. 현재 지원하는 모드 로더는 Fabric입니다.

운영 서버 주소와 모드팩 정보는 Git에서 제외한 `.private/modpack.config.json`에 보관합니다. 저장소의 `modpack.config.json`에는 빈 목록만 포함합니다. 실제 운영값을 문서·테스트·커밋 메시지에 적지 마세요.

- 개발 실행: `npm install` 후 `npm start` — 로컬 운영 설정을 먼저 읽습니다.
- 검증: `npm run check`, `npm test`
- 지인용 설치 파일: `npm run dist:private` — 운영 설정을 포함해 `.private/builds`에 생성하며 자동 업로드하지 않습니다.
- 기존 BetterMonLauncher가 설치돼 있으면 새 설치 프로그램의 설치 단계에서 기존 앱을 제거하고 BetterLauncher로 교체합니다. 로그인 정보와 게임 데이터는 보존하며, 기존 앱 제거에 실패하면 새 설치를 중단합니다.
- 일반 패키징: `npm run dist:win` — 저장소의 빈 목록으로 빌드합니다.

[모드팩 프로젝트 등록과 배포 안내](docs/modpack-distribution.md)를 참고하세요. 현재 저장소는 비공개이며 GitHub Actions와 공개 자동 업데이트를 중지했습니다. 설치 파일은 지인에게 직접 전달합니다. GitHub 접근 토큰을 런처에 포함하지 마세요.

소스 push와 GitHub 릴리즈·파일 업로드는 관리자가 명시적으로 요청했을 때만 수행합니다. 일반 수정은 로컬에서 검증하고 빌드합니다.

관리자는 `.private/modpack.config.json`에 모드팩 하나와 서버를 설정합니다. 배포본은 앱에 포함된 설정을 사용하고, 게임 시작 시 해당 서버에 접속합니다. 서버 상태는 해당 서버에 직접 조회합니다. [관리자 설정 예시](modpack.config.example.json)

모드팩 선택 화면이나 변경 버튼은 없습니다. 실행할 모드팩은 관리자 설정의 `defaultProject`로 정하며, 예전에 저장한 최근 선택 값은 사용하지 않습니다. 기존 설치 폴더와 모드팩별 게임 설정은 유지합니다. 모드팩 미설정·배포 준비 상태도 같은 실행 화면에서 안내하며 계정 관리와 런처 설정을 사용할 수 있습니다. 런처에는 BGM이 없습니다.

UI 흐름 검증은 `npm run test:ui`로 실행합니다. 테스트용 모드팩과 계정만 사용하며 실제 다운로드나 서버 접속을 하지 않습니다. [공용 배경 제작 정보](docs/launcher-background.md)

Windows 설치 교체 검증은 `npm run test:installer`로 실행합니다. NSIS 컴파일러가 필요하며, 첫 Windows 빌드 후 자동으로 찾습니다. 실제 설치된 앱 대신 `dist/installer-tests`의 테스트 파일과 별도 레지스트리 키를 사용합니다.

계정 스킨은 공식 Minecraft 서버에서 받아 메뉴와 계정 설정에 3D 전신 모델로 표시합니다. 렌더러는 앱에 포함하며 외부 아바타 서비스에 계정 정보를 보내지 않습니다. 로컬 렌더러 의존성을 갱신한 뒤에는 `npm run vendor:skin`으로 브라우저 번들과 라이선스를 동기화합니다.

[보안 정책과 점검 결과](SECURITY.md)
