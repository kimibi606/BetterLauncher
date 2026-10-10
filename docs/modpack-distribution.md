# BetterLauncher 모드팩 운영

런처 업데이트는 [kimibi606/BetterLauncher](https://github.com/kimibi606/BetterLauncher)의 GitHub Releases를 사용합니다. 모드팩 배포 기반은 [Cloudflare Pages](https://server.example/)에 준비되어 있습니다. 현재 [ExamplePack](ExamplePack.md)가 등록되어 있습니다. 기존 ExamplePack은 등록하거나 가져오지 않습니다.

## 새 모드팩 등록

관리자가 개발 과정에서 모드팩 이름·접속 서버·원본 파일을 준비한 뒤, `modpack.config.json`의 `projects` 배열에 프로젝트를 추가합니다. 사용자 화면은 등록된 목록을 선택하는 용도이며 모드팩 추가·삭제·서버 주소 편집 기능은 제공하지 않습니다. [관리자 설정 예시](../modpack.config.example.json)를 참고하세요. 다음은 두 프로젝트를 운영할 때의 예시이며, 원본 파일을 업로드하기 전에는 예시 주소에 manifest가 존재하지 않습니다. `.example` 서버 주소는 실제 서버 주소로 바꿔야 합니다.

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
      "server": { "host": "skyblock.example", "port": 25565 },
      "modpack": {
        "manifestUrl": "https://server.example/skyblock/latest.json"
      },
      "serverStatus": {},
      "news": { "items": [] }
    },
    {
      "id": "adventure",
      "name": "Adventure",
      "minecraftVersion": "1.20.1",
      "modLoader": "fabric",
      "javaMajor": 17,
      "server": { "host": "adventure.example", "port": 25566 },
      "modpack": {
        "manifestUrl": "https://server.example/adventure/latest.json"
      },
      "serverStatus": {},
      "news": { "items": [] }
    }
  ],
  "github": {
    "owner": "kimibi606",
    "repo": "BetterLauncher",
    "timeoutMs": 7000
  }
}
```

- `id`는 소문자 영문·숫자·`-`·`_`로 구성된 고유 식별자입니다. 배포 후 바꾸면 다른 설치로 취급합니다.
- 게임 버전, Java, 서버, 공지, Discord와 설치 폴더를 프로젝트별로 관리합니다. 현재 지원하는 모드 로더는 Fabric입니다.
- `server.host`는 도메인 또는 IP만 입력합니다. `https://`나 포트를 포함하지 않습니다. 포트는 `server.port`에 별도로 지정하며 생략하면 25565입니다. 선택 화면과 실행 화면에 주소를 표시하고, 게임 시작 시 선택한 모드팩의 서버로 자동 접속합니다.
- 서버 주소는 선택한 프로젝트의 관리자 설정만 사용합니다. 전역 `BETTERLAUNCHER_SERVER_HOST`·`BETTERMON_SERVER_HOST` 등의 환경변수와 사용자 실행 요청은 접속 주소를 덮어쓰지 않습니다. 기존 `serverStatus.host`·`serverStatus.port`는 `server`가 없는 프로젝트에서 호환용으로 읽으며, 새 프로젝트는 `server`를 사용하세요.
- `loaderVersion`을 지정하면 특정 Fabric 버전을 사용합니다. 서버가 없는 프로젝트는 자동 서버 접속을 생략합니다.
- 공지는 `news.items` 또는 `news.url`로 지정합니다.
- 프로젝트가 없어도 런처와 로그인·설정을 사용할 수 있습니다. 게임 실행은 등록된 모드팩을 선택한 뒤 가능합니다.
- 개발 실행은 프로젝트 루트의 `modpack.config.json`을 읽고, 설치된 런처는 앱에 포함된 관리자 설정만 읽습니다. 실행 파일 옆에 만든 설정으로 배포본의 목록을 바꿀 수 없습니다. 프로젝트 목록 또는 서버 주소를 수정했다면 변경된 설정을 포함한 새 런처 버전을 배포합니다. 모드팩 파일 자체의 업데이트는 기존처럼 Cloudflare에서 별도로 배포합니다.

Minecraft 1.20 이상은 Quick Play 인수를 사용하며, 이전 버전은 `--server`·`--port`를 사용합니다. [Minecraft 공식 1.20 변경 사항](https://feedback.minecraft.net/hc/en-us/articles/16499677456781-Minecraft-Java-Edition-1-20-Trails-Tales)에 따라 게임 버전별로 접속 인수를 생성합니다. 서버 설정이 없는 모드팩은 서버에 자동 접속하지 않고 게임을 실행합니다.

## 새 모드팩 배포

`npm install` 후 아래 명령을 프로젝트 루트에서 실행합니다. Wrangler는 명령 주입 보안 패치가 적용된 4.59.2로 고정했으며, 하위 의존성도 패치 버전으로 고정했습니다.

```powershell
npx wrangler@4.59.2 login --scopes account:read user:read pages:write
npm run modpack:build -- --project skyblock --source "C:\Modpacks\Skyblock" --version 1.0.0
npm run modpack:build -- --project adventure --source "C:\Modpacks\Adventure" --version 1.0.0
npm run modpack:deploy
```

Cloudflare 프로젝트 `ExamplePack`는 이미 만들어져 있으므로 다시 만들 필요가 없습니다. 등록한 프로젝트의 manifest 주소는 `https://server.example/<id>/latest.json`입니다. 모든 프로젝트를 포함한 `distribution` 폴더 전체를 업로드합니다.

[Cloudflare 무료 플랜 제한](https://developers.cloudflare.com/pages/platform/limits/)에 맞춰 파일당 25MiB, 전체 20,000개 파일을 검사합니다. 큰 파일은 20MiB 조각으로 나누고, 런처가 조각과 조립된 파일의 SHA-256을 검증합니다. Pages 정적 파일만 사용하며 R2·Workers 유료 구독은 필요하지 않습니다. [직접 업로드 문서](https://developers.cloudflare.com/pages/get-started/direct-upload/)를 참고하세요.

배포 대상은 `mods`, `cobblemon`, `config`, `defaultconfigs`, `resourcepacks`, `shaderpacks`, `options.txt`입니다. 월드·계정·런처 캐시는 배포하지 않습니다. 원본과 배포 폴더는 Git 저장소에 포함하지 않습니다.

## 모드팩 업데이트

원본을 수정하고 새로운 `--version`으로 빌드한 뒤 `npm run modpack:deploy`를 실행합니다. 변경된 모드는 다운로드하고, 배포에서 빠진 관리 파일은 제거합니다. 기존 `config`, `resourcepacks`, `shaderpacks`, `options.txt`는 사용자 설정으로 보존하며 없는 파일만 처음 설치합니다.

기존 해시 파일은 이전 manifest를 받은 클라이언트를 위해 보존합니다. 파일 수가 서비스 한도에 가까워지면 새 배포 폴더에 모든 프로젝트를 다시 빌드해 정리할 수 있습니다. `--dry-run`은 manifest만 출력하고, `--output`과 `--base-url`로 배포 위치를 바꿀 수 있습니다.

```powershell
npm test
npm run check
npm run modpack:build -- --project skyblock --source "C:\Modpacks\Skyblock" --version 1.0.1 --dry-run
```

## 런처 릴리즈

`package.json`과 `package-lock.json`의 버전을 올리고 소스를 push한 뒤 `v<버전>` 태그를 push하면 GitHub Actions가 검사·테스트·Windows 빌드·릴리즈 파일 업로드를 수행합니다.

- 프로그램·패키지·설치 파일 이름은 BetterLauncher입니다. Windows 설치 GUID는 기존 값을 유지합니다.
- 새 모드팩 설치 위치는 `%APPDATA%\.betterlauncher\instances\<id>`입니다.
- 기존 로그인·런처 설정은 이어받을 수 있지만 기존 Minecraft·모드팩 설치 폴더는 자동으로 가져오지 않습니다. 기존 원본 폴더는 그대로 둡니다.
- 실행 또는 모드팩 업데이트 중에는 프로젝트 변경을 차단합니다. 다른 프로젝트가 사용하는 폴더와 식별자가 다른 manifest도 차단합니다.

[보안 정책과 점검 결과](../SECURITY.md)
