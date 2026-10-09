# BetterLauncher 모드팩 운영

런처 프로그램 업데이트는 기존 `kimibi606/BetterLauncher` GitHub Releases를 사용합니다. 모드팩 파일은 GitHub API·릴리즈·토큰 없이 HTTP(S)로 배포합니다. 무료 기본 배포처는 **Cloudflare Pages Free / Direct Upload**입니다.

Cloudflare 공식 문서의 [무료 플랜 제한](https://developers.cloudflare.com/pages/platform/limits/)과 [직접 업로드 절차](https://developers.cloudflare.com/pages/get-started/direct-upload/)를 기준으로 구현했습니다. Wrangler 업로드 기준 최대 20,000개 파일, 개별 파일 최대 25MiB입니다. 배포 도구가 큰 파일을 20MiB 조각으로 나누므로 대형 모드 파일도 배포할 수 있습니다. 런처는 각 조각과 조립된 파일의 SHA-256을 검사합니다. Pages 정적 파일만 사용하며 R2·Workers 유료 구독은 필요하지 않습니다. 서비스 한도를 넘기면 배포 구조나 무료 서비스의 선택을 다시 검토해야 합니다.

## 프로젝트 등록

`modpack.config.json`의 `projects` 배열에 모드팩을 추가합니다. 현재 BetterMon만 등록되어 있으며, 다음은 두 프로젝트를 운영할 때의 설정 예시입니다. 예시 URL은 실제 Pages 배포 주소로 바꾸세요.

```json
{
  "defaultProject": "bettermon",
  "projects": [
    {
      "id": "bettermon",
      "name": "BetterMon",
      "minecraftVersion": "1.21.1",
      "modLoader": "fabric",
      "javaMajor": 21,
      "modpack": {
        "manifestUrl": "https://YOUR-PAGES-PROJECT.pages.dev/bettermon/latest.json"
      },
      "serverStatus": { "host": "server.example", "port": 25565 },
      "news": { "items": ["BetterMon 공지"] },
      "discordUrl": "https://example.invalid/private"
    },
    {
      "id": "adventure",
      "name": "Adventure",
      "description": "별도 모험 모드팩",
      "minecraftVersion": "1.20.1",
      "modLoader": "fabric",
      "javaMajor": 17,
      "modpack": {
        "manifestUrl": "https://YOUR-PAGES-PROJECT.pages.dev/adventure/latest.json"
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
- `minecraftVersion`, `javaMajor`, `serverStatus`, `news`, `discordUrl`은 프로젝트별로 적용됩니다. 서버 주소가 없으면 서버 자동 접속을 생략합니다.
- 현재 모드 로더는 Fabric을 지원합니다. `loaderVersion`을 지정하면 특정 Fabric 버전을 사용하고, 생략하면 설치할 때 안정 버전을 선택합니다.
- 공지는 `news.items`에 직접 넣거나 `news.url`에 별도 HTTP(S) JSON 주소를 지정할 수 있습니다.
- BetterMon의 `manifestUrl`은 `https://example.invalid/private`으로 연결되어 있습니다. 새 프로젝트는 각자의 배포 주소를 지정하세요.
- 패키징된 런처는 실행 파일 옆의 `modpack.config.json`을 우선 읽습니다. 해당 파일로 프로젝트 목록과 배포 주소를 관리할 수 있습니다. 프로그램 실행 중 목록을 수정했다면 런처를 다시 시작하세요.

## 무료 배포 절차

1. 무료 Cloudflare 계정을 만들고 아래 명령으로 로그인합니다.

   ```powershell
   npx wrangler@4.59.0 login
   npx wrangler@4.59.0 pages project create ExamplePack --production-branch main
   ```

   프로젝트 이름이 이미 사용 중이면 다른 이름을 정하고 Cloudflare가 안내하는 실제 주소를 사용하세요.

2. 각 모드팩의 원본 폴더에서 배포 파일을 생성합니다. 실행 위치는 이 저장소의 루트입니다.

   ```powershell
   npm run modpack:build -- --project bettermon --source "C:\Modpacks\BetterMon" --version 1.0.0
   npm run modpack:build -- --project adventure --source "C:\Modpacks\Adventure" --version 1.0.0
   ```

   두 번째 명령은 `adventure`를 설정에 등록한 뒤 실행합니다. 동일한 `distribution` 폴더 안에 각 프로젝트의 `latest.json`과 해시 파일이 만들어집니다. `mods`, `cobblemon`, `config`, `defaultconfigs`, `resourcepacks`, `shaderpacks`, `options.txt`만 배포하며 월드·계정·런처 캐시는 포함하지 않습니다.

3. 모든 프로젝트가 들어 있는 **전체 폴더**를 업로드합니다.

   ```powershell
   npx wrangler@4.59.0 pages deploy distribution --project-name ExamplePack --branch main
   ```

4. `projects[].modpack.manifestUrl`을 실제 주소의 `/<id>/latest.json`으로 설정합니다. 배포 폴더의 내용만 업로드하며 런처 소스·계정 정보는 업로드하지 않습니다.

5. 런처의 모드팩 선택에서 프로젝트를 고른 뒤 “업데이트”를 눌러 설치합니다. 설치 후 게임을 시작할 수 있습니다.

BetterMon 원본은 기존 배포 ZIP에서 복원해 `.deployment-source/bettermon`에 보관하고, `distribution` 폴더로 배포합니다. 두 폴더와 Cloudflare 인증 정보는 Git 저장소에 포함하지 않습니다. 새 PC에서 후속 배포할 때는 위 로그인 절차와 원본 파일 준비가 필요합니다.

Wrangler는 Pages 직접 업로드를 위해 4.59.0으로 고정했습니다. 최신 버전의 Pages 명령은 Workers 배포로 전환될 수 있으므로, 아래 후속 배포에는 `npm run modpack:deploy`를 사용하세요.

## 업데이트와 검증

모드팩 원본을 수정하고 새로운 `--version`으로 빌드한 뒤 `distribution` 전체를 다시 업로드하세요. 변경된 파일만 런처에서 다운로드하고, 이전 manifest에 있었지만 새 manifest에서 빠진 관리 파일은 제거합니다. 다른 프로젝트의 설치 폴더는 수정하지 않습니다.

기존 `config`, `resourcepacks`, `shaderpacks`, `options.txt`는 사용자 설정으로 보존합니다. 해당 위치에서는 빠진 파일만 처음 설치하며 기존 파일을 덮어쓰거나 삭제하지 않습니다. 실행 무결성 검사도 사용자가 수정할 수 있는 이 파일들을 제외하고 모드와 관리 파일을 검사합니다.

배포 도구는 기존 해시 파일을 보존합니다. 이전 manifest를 이미 받은 런처도 다운로드를 마칠 수 있고 다른 프로젝트의 파일도 유지됩니다. 여러 버전을 오래 보관해 파일 수가 20,000개에 가까워지면 배포 폴더를 새로 생성하고 모든 프로젝트를 다시 빌드해 정리할 수 있습니다. 정리 직후 이전 manifest를 가진 클라이언트는 업데이트 확인을 다시 해야 합니다.

```powershell
npm run modpack:build -- --project bettermon --source "C:\Modpacks\BetterMon" --version 1.0.1 --dry-run
npm test
npm run check
```

`--dry-run`은 manifest를 출력하고 파일을 쓰지 않습니다. `--output`으로 배포 폴더를 바꿀 수 있고, `--base-url`을 지정하면 manifest에 절대 다운로드 URL을 넣습니다. 기본 상대 URL은 manifest 주소를 기준으로 해석하므로 다른 HTTP 서버로 옮겨도 같은 파일 구조를 사용할 수 있습니다. 기존 `npm run modpack:publish` 명령도 같은 빌드 도구로 연결됩니다.

## 기존 설치와 이름 변경

- 프로그램·패키지·설치 파일 이름은 BetterLauncher로 변경했습니다. 설치 프로그램 GUID는 기존 값을 유지해 이전 Windows 설치를 업데이트할 수 있도록 했습니다.
- 런처 데이터는 `%APPDATA%\.betterlauncher`, 프로젝트 설치는 그 아래 `instances\<id>`를 사용합니다.
- 기존 `%APPDATA%\.bettermonlauncher`의 로그인·설정·BetterMon 설치를 새 데이터 위치로 이전합니다. 기존 원본 폴더는 보존합니다. 사용자 지정 BetterMon 설치 폴더도 이전 설정을 통해 계속 사용할 수 있습니다.
- 모드팩 내부의 런처 상태 폴더는 `.bettermon`에서 `.betterlauncher`로 이전합니다.
- 실행 중이거나 업데이트 적용 중이면 프로젝트 변경을 차단합니다. 다른 프로젝트가 사용하는 폴더와 manifest 식별자가 다른 배포도 차단합니다.
