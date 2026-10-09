# BetterLauncher

Electron 기반 Minecraft 런처입니다. 여러 모드팩 프로젝트를 선택하고 각각 독립된 설치 폴더·게임 버전·Java·서버·공지·설정을 사용합니다. 현재 지원하는 모드 로더는 Fabric입니다.

[최신 Windows 설치 파일 다운로드](https://github.com/kimibi606/BetterLauncher/releases/latest)

- 런처 업데이트: 기존 GitHub Releases
- 모드팩 배포: Cloudflare Pages Free의 HTTP(S) manifest와 파일 직접 업로드
- 개발 실행: `npm install` 후 `npm start`
- 검증: `npm run check`, `npm test`
- Windows 패키징: `npm run dist:win`

[모드팩 프로젝트 등록과 무료 배포 안내](docs/modpack-distribution.md)를 참고하세요. 현재 등록된 모드팩은 없습니다. 기존 ExamplePack은 가져오지 않습니다. 새 모드팩을 등록한 뒤 `npm run modpack:deploy`로 배포합니다.

[보안 정책과 점검 결과](SECURITY.md)
