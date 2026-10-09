# BetterLauncher

Electron 기반 Minecraft 런처입니다. 여러 모드팩 프로젝트를 선택하고 각각 독립된 설치 폴더·게임 버전·Java·서버·공지·설정을 사용합니다. 현재 지원하는 모드 로더는 Fabric입니다.

[최신 Windows 설치 파일 다운로드](https://github.com/kimibi606/BetterLauncher/releases/latest)

- 런처 업데이트: 기존 GitHub Releases
- 모드팩 배포: Cloudflare Pages Free의 HTTP(S) manifest와 파일 직접 업로드
- 개발 실행: `npm install` 후 `npm start`
- 검증: `npm run check`, `npm test`
- Windows 패키징: `npm run dist:win`

[모드팩 프로젝트 등록과 무료 배포 안내](docs/modpack-distribution.md)를 참고하세요. 현재 등록된 모드팩은 없습니다. 기존 ExamplePack은 가져오지 않습니다. 새 모드팩을 등록한 뒤 `npm run modpack:deploy`로 배포합니다.

로그인하면 모드팩 선택 화면이 먼저 열립니다. 카드를 선택하면 해당 프로젝트의 Java와 업데이트 상태를 준비한 뒤 게임을 시작할 수 있습니다. `모드팩 변경`으로 선택 화면에 돌아가며, 최근 선택한 모드팩은 다음 실행 때 표시됩니다. 게임 실행·설치 중에는 모드팩을 바꿀 수 없습니다. 모드팩이 없어도 계정 관리와 런처 업데이트는 사용할 수 있습니다.

UI 흐름 검증은 `npm run test:ui`로 실행합니다. 테스트용 모드팩과 계정만 사용하며 실제 다운로드나 서버 접속을 하지 않습니다. [공용 배경 제작 정보](docs/launcher-background.md)

[보안 정책과 점검 결과](SECURITY.md)
