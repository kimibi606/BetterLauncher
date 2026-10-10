# BetterLauncher

Electron 기반 Minecraft 런처입니다. 여러 모드팩 프로젝트를 선택하고 각각 독립된 설치 폴더·게임 버전·Java·서버·공지·설정을 사용합니다. 현재 지원하는 모드 로더는 Fabric입니다.

운영 서버 주소와 모드팩 정보는 Git에서 제외한 `.private/modpack.config.json`에 보관합니다. 저장소의 `modpack.config.json`에는 빈 목록만 포함합니다. 실제 운영값을 문서·테스트·커밋 메시지에 적지 마세요.

- 개발 실행: `npm install` 후 `npm start` — 로컬 운영 설정을 먼저 읽습니다.
- 검증: `npm run check`, `npm test`
- 지인용 설치 파일: `npm run dist:private` — 운영 설정을 포함해 `.private/builds`에 생성하며 자동 업로드하지 않습니다.
- 일반 패키징: `npm run dist:win` — 저장소의 빈 목록으로 빌드합니다.

[모드팩 프로젝트 등록과 배포 안내](docs/modpack-distribution.md)를 참고하세요. 현재 저장소는 비공개이며 GitHub Actions와 공개 자동 업데이트를 중지했습니다. 설치 파일은 지인에게 직접 전달합니다. GitHub 접근 토큰을 런처에 포함하지 마세요.

관리자는 `.private/modpack.config.json`에 프로젝트와 서버를 등록합니다. 사용자는 원하는 모드팩을 선택하면 해당 서버로 접속합니다. 배포본은 앱에 포함된 관리자 목록만 사용합니다. 서버 상태는 해당 서버에 직접 조회합니다. [관리자 설정 예시](modpack.config.example.json)

카드를 선택하면 해당 프로젝트의 Java와 업데이트 상태를 준비합니다. `모드팩 변경`으로 선택 화면에 돌아가며, 최근 선택한 모드팩은 다음 실행 때 표시됩니다. 게임 실행·설치 중에는 모드팩을 바꿀 수 없습니다. 모드팩이 없어도 계정 관리와 런처 업데이트는 사용할 수 있습니다. 런처에는 BGM이 없습니다.

UI 흐름 검증은 `npm run test:ui`로 실행합니다. 테스트용 모드팩과 계정만 사용하며 실제 다운로드나 서버 접속을 하지 않습니다. [공용 배경 제작 정보](docs/launcher-background.md)

[보안 정책과 점검 결과](SECURITY.md)
