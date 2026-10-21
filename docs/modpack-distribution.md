# BetterLauncher 모드팩 운영

운영 모드팩과 서버 정보는 Git에서 제외한 `.private/modpack.config.json`에 관리합니다. 저장소에 포함한 설정은 빈 목록이며 실제 운영값을 커밋하지 않습니다. 런처 자동 업데이트는 현재 비활성화되어 있습니다.

## 모드팩 설정

관리자는 `.private/modpack.config.json`의 `projects` 배열에 모드팩 하나를 설정하고 그 `id`를 `defaultProject`로 지정합니다. `projects` 형식은 기존 설치 폴더와 설정 호환을 위해 유지합니다. 로그인하면 선택 화면 없이 기본 모드팩의 Java와 업데이트를 준비하고 실행 화면을 표시합니다. 예전에 저장한 최근 모드팩 선택 값은 사용하지 않습니다. [관리자 설정 예시](../modpack.config.example.json)를 참고하세요. 아래 주소는 예시이므로 실제 운영 주소는 로컬 설정에만 입력하세요.

```json
{
  "defaultProject": "skyblock",
  "projects": [
    {
      "id": "skyblock",
      "name": "Skyblock",
      "minecraftVersion": "1.21.1",
      "modLoader": "fabric",
      "javaMajor": 21,
      "server": {
        "host": "skyblock.example",
        "port": 25565
      },
      "modpack": {
        "manifestUrl": "https://YOUR_PROJECT.pages.dev/skyblock/latest.json"
      },
      "serverStatus": {},
      "news": {
        "items": []
      }
    }
  ],
  "github": {
    "owner": "kimibi606",
    "repo": "BetterLauncher",
    "timeoutMs": 7000,
    "enabled": false
  }
}
```

- `id`는 소문자 영문·숫자·`-`·`_`로 구성된 고유 식별자입니다. 배포 후 바꾸면 다른 설치로 취급합니다.
- 게임 버전, Java, 서버, 공지, Discord와 설치 폴더를 프로젝트별로 관리합니다. Fabric과 NeoForge를 지원합니다.
- `server.host`는 도메인 또는 IP만 입력합니다. `https://`나 포트를 포함하지 않습니다. 포트는 `server.port`에 별도로 지정하며 생략하면 25565입니다. 런처 화면에는 주소를 표시하지 않으며, 게임 시작 시 설정한 서버로 자동 접속합니다.
- 서버 주소는 기본 모드팩의 관리자 설정만 사용합니다. 전역 `BETTERLAUNCHER_SERVER_HOST`·`BETTERMON_SERVER_HOST` 등의 환경변수와 사용자 실행 요청은 접속 주소를 덮어쓰지 않습니다. 기존 `serverStatus.host`·`serverStatus.port`는 `server`가 없는 프로젝트에서 호환용으로 읽으며, 새 프로젝트는 `server`를 사용하세요.
- `loaderVersion`을 지정하면 특정 Fabric 버전을 사용합니다. 서버가 없는 프로젝트는 자동 서버 접속을 생략합니다.
- NeoForge는 `modLoader: "neoforge"`와 Minecraft 버전에 맞는 `loaderVersion`을 반드시 지정합니다. 예를 들어 Minecraft `1.21.1`은 NeoForge `21.1.x`와 Java 21을 사용합니다. `loaderInstallerSha256`에 공식 설치 파일의 SHA-256을 지정할 수 있습니다. 실제 운영 버전과 해시는 비공개 설정에만 보관하세요. 공식 설치 프로그램이 전용 폴더에 실행 환경을 준비하며, 설치 실패·무결성 오류·잘못된 링크 경로는 실행을 중단합니다.
- 공지는 `news.items` 또는 `news.url`로 지정합니다.
- 모드팩이 없어도 로그인과 설정을 사용할 수 있습니다. 같은 실행 화면에 미설정 상태를 표시하고 게임 실행을 비활성화합니다. 배포 주소가 없는 모드팩은 배포 준비 상태로 안내합니다.
- 개발 실행은 `.private/modpack.config.json`을 먼저 읽습니다. 설치된 런처는 앱에 포함된 관리자 설정만 읽습니다. `npm run dist:private`로 운영 설정을 포함한 설치 파일을 로컬에서 만들고 지인에게 직접 전달하세요. `.private` 폴더와 그 안의 설치 파일은 Git·GitHub 릴리즈·Actions에 업로드하지 않습니다.

Minecraft 1.20 이상은 Quick Play 인수를 사용하며, 이전 버전은 `--server`·`--port`를 사용합니다. [Minecraft 공식 1.20 변경 사항](https://feedback.minecraft.net/hc/en-us/articles/16499677456781-Minecraft-Java-Edition-1-20-Trails-Tales)에 따라 게임 버전별로 접속 인수를 생성합니다. 서버 설정이 없는 모드팩은 서버에 자동 접속하지 않고 게임을 실행합니다.

## 새 모드팩 배포

`npm install` 후 아래 명령을 프로젝트 루트에서 실행합니다. Wrangler는 명령 주입 보안 패치가 적용된 4.59.2로 고정했으며, 하위 의존성도 패치 버전으로 고정했습니다.

```powershell
npx wrangler@4.59.2 login --scopes account:read user:read pages:write
npm run modpack:build -- --project skyblock --source "C:\Modpacks\Skyblock" --version 1.0.0
$env:CLOUDFLARE_PAGES_PROJECT = "YOUR_PROJECT"
npm run modpack:deploy
```

Pages 프로젝트는 관리자가 직접 만들고 `CLOUDFLARE_PAGES_PROJECT` 환경변수로 지정합니다. 계정이 여러 개면 `CLOUDFLARE_ACCOUNT_ID`도 지정합니다. 해당 모드팩을 빌드한 `distribution` 폴더 전체를 업로드합니다. 정적 호스팅은 공개 배포이므로 서버 주소·초대 링크·계정 정보를 업로드하지 마세요.

[Cloudflare 무료 플랜 제한](https://developers.cloudflare.com/pages/platform/limits/)에 맞춰 파일당 25MiB, 전체 20,000개 파일을 검사합니다. 큰 파일은 20MiB 조각으로 나누고, 런처가 조각과 조립된 파일의 SHA-256을 검증합니다. Pages 정적 파일만 사용하며 R2·Workers 유료 구독은 필요하지 않습니다. [직접 업로드 문서](https://developers.cloudflare.com/pages/get-started/direct-upload/)를 참고하세요.

배포 대상은 `mods`, `cobblemon`, `config`, `defaultconfigs`, `resourcepacks`, `shaderpacks`, `options.txt`입니다. 월드·계정·런처 캐시는 배포하지 않습니다. 원본과 배포 폴더는 Git 저장소에 포함하지 않습니다.

## 모드팩 업데이트

원본을 수정하고 새로운 `--version`으로 빌드한 뒤 `npm run modpack:deploy`를 실행합니다. 변경된 모드는 다운로드하고, 배포에서 빠진 관리 파일은 제거합니다. 기존 `config`, `resourcepacks`, `shaderpacks`, `options.txt`는 사용자 설정으로 보존하며 없는 파일만 처음 설치합니다.

기존 해시 파일은 이전 manifest를 받은 클라이언트를 위해 보존합니다. 파일 수가 서비스 한도에 가까워지면 새 배포 폴더에 모드팩을 다시 빌드해 정리할 수 있습니다. `--dry-run`은 manifest만 출력하고, `--output`과 `--base-url`로 배포 위치를 바꿀 수 있습니다.

```powershell
npm test
npm run check
npm run modpack:build -- --project skyblock --source "C:\Modpacks\Skyblock" --version 1.0.1 --dry-run
```

## 런처 릴리즈

현재 저장소는 비공개이며 GitHub Actions와 공개 자동 업데이트를 중지했습니다. 지인용 설치 파일은 `npm run dist:private`로 생성합니다. 저장소의 빈 설정을 사용하는 일반 빌드에는 운영 모드팩이 포함되지 않습니다.

- 프로그램·패키지·설치 파일 이름은 BetterLauncher입니다. Windows 설치 GUID는 기존 값을 유지합니다.
- 설치를 누르면 사용자별·전체 사용자 설치의 32비트·64비트 등록 정보에서 기존 BetterMonLauncher를 확인하고, 해당 앱의 제거 프로그램으로 교체합니다. 설치 마법사를 취소하면 기존 앱은 유지합니다. 제거 명령에는 데이터 보존 옵션을 전달하며, 제거 실패·잘못된 설치 경로·심볼릭 링크 경로는 새 설치를 중단합니다. 일반 BetterLauncher 재설치는 기존 업데이트 절차를 사용합니다.
- 새 모드팩 설치 위치는 `%APPDATA%\.betterlauncher\instances\<id>`입니다.
- 기존 로그인·런처 설정은 이어받을 수 있지만 기존 Minecraft·모드팩 설치 폴더는 자동으로 가져오지 않습니다. 기존 원본 폴더는 그대로 둡니다.
- 기존 설치 폴더를 계속 사용하도록 모드팩 `id`를 유지합니다. 관리자가 기본 모드팩을 바꿀 때도 다른 모드팩이 사용하는 폴더나 식별자가 다른 manifest는 차단합니다.

[보안 정책과 점검 결과](../SECURITY.md)
