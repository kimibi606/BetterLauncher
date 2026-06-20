# BetterMon Launcher

Custom Minecraft launcher scaffold using Electron (JS + CSS UI).

## Features

- Fabric 1.21.1 fixed launch target
- Isolated launcher instance directory (separate from default `.minecraft`)
- Memory controls
- Minecraft directory / Java binary picker
- Load registered installations from `launcher_profiles.json`
- Live launcher logs in UI
- Microsoft Entra OAuth 2.0 (Authorization Code + PKCE) login flow
- Cached Microsoft session restore between app restarts
- Login gate: launcher menu is blocked until Microsoft sign-in completes

## Run

```bash
npm install
npm start
```

## Microsoft Auth Setup

Register a Microsoft Entra app (personal Microsoft accounts included), then configure:

```bash
set BETTERMON_MICROSOFT_CLIENT_ID=your-entra-app-client-id
set BETTERMON_MICROSOFT_TENANT=consumers
set BETTERMON_MICROSOFT_REDIRECT_URI=http://localhost
```

Optional:

```bash
set BETTERMON_MICROSOFT_PROMPT=select_account
```

Notes:
- `BETTERMON_MICROSOFT_CLIENT_ID` is optional (launcher default: `19d2cd2f-06f2-40b7-a7d0-fe3bf47f56d1`).
- Redirect URI must be loopback HTTP (`http://localhost` or `http://127.0.0.1/...`).
- In Entra app registration, enable public client/native flow for desktop login.

## Build / Release

```bash
npm run dist:win
# or publish directly to GitHub Releases
npm run release:github
```

Set GitHub token before publish:

```bash
set GH_TOKEN=your-github-personal-access-token
```

GitHub Actions release flow:

```bash
git tag v0.2.3
git push origin v0.2.3
```

The `Release Launcher` workflow builds on Windows and publishes the launcher release to
`kimibi606/ExamplePack`.

If `rcedit` cannot be auto-detected on Windows, set one of:

```bash
set BETTERMON_RCEDIT_EXE=C:\path\to\rcedit-x64.exe
# or
set BETTERMON_RCEDIT_PATH=C:\path\to\rcedit-folder
```

`release:github` now generates `resources/app-update.yml` in the prepackaged output
before creating NSIS installer, so `electron-updater` can resolve update config at runtime.

Release target repository is `kimibi606/ExamplePack` (public).

Packaged launcher checks GitHub Releases automatically and downloads updates in background.  
Downloaded update is applied on next launcher restart.
Dev mode(`npm start`) auto-update is disabled by default. Use `BETTERMON_ENABLE_DEV_UPDATER=1` to force-check.

## Modpack Update

GitHub Release manifest mode is the default modpack install/update path.

1. Copy `modpack.config.example.json` to `modpack.config.json`.
2. Set `modpack.githubRepository` to the repository that publishes the modpack Release assets.
3. Publish these two assets in the latest GitHub Release:
   - `latest.json`
   - the ZIP archive referenced by `latest.json`

`latest.json` format:

```json
{
  "id": "bettermon",
  "version": "2026.06.17.1130",
  "minecraftVersion": "1.21.1",
  "archive": {
    "url": "bettermon-modpack.zip",
    "sha1": "...",
    "size": 179160910
  }
}
```

Example:

```json
{
  "modpack": {
    "githubRepository": "ExamplePack",
    "manifestAsset": "latest.json"
  },
  "serverStatus": {
    "host": "play.example.com",
    "port": 25565,
    "molangUrl": "https://status.example.com/molang",
    "molangField": "status",
    "molangOnlineValue": "online"
  },
  "news": {
    "url": "https://raw.githubusercontent.com/kimibi606/ExamplePack/main/launcher-news.json",
    "itemsPath": "items",
    "refreshMs": 60000,
    "maxItems": 8
  }
}
```

On startup, launcher checks `latest.json`. If `archive.sha1` matches the saved state, it skips the modpack install. If it changed, the launcher downloads the ZIP, verifies SHA1, removes previously managed files, and extracts only allowed modpack paths.

Legacy archive and distribution-index modes are still supported with `archiveUrl`/`archiveByPreset` and `distributionUrl`/`distributionByPreset`.

## Launcher News JSON

`news.url` (or `news.path`) should return JSON array/object.  
`news.url` supports `https://...` and `s3://bucket/key.json` formats.  
If it is an object, `news.itemsPath` (default auto-detect) can point to the item array.

GitHub Raw JSON config example:

```json
{
  "news": {
    "url": "https://raw.githubusercontent.com/kimibi606/ExamplePack/main/launcher-news.json",
    "itemsPath": "items",
    "refreshMs": 30000,
    "maxItems": 8
  }
}
```

S3 URI config example:

```json
{
  "news": {
    "url": "s3://bettermon-launcher-bucket/news/launcher-news.json",
    "fallbackUrl": "https://example.com/news/launcher-news.json",
    "awsRegion": "ap-northeast-2",
    "itemsPath": "items",
    "refreshMs": 30000,
    "maxItems": 8
  }
}
```

For private buckets, launcher needs AWS credentials in the runtime environment (default provider chain) and region (`news.awsRegion` or `BETTERMON_NEWS_AWS_REGION`).
If runtime AWS credentials are unavailable, set `news.fallbackUrl` to a public HTTPS JSON endpoint.

News payload example:

```json
{
  "items": [
    {
      "type": "UPDATE",
      "date": "2026-03-06",
      "text": "Launcher news has been updated."
    },
    {
      "type": "NOTICE",
      "date": "2026-03-06",
      "text": "Maintenance starts at 23:00 KST."
    }
  ]
}
```

## Notes

- First launch of a version downloads game files, so it can take time.
- Launcher target is fixed to Fabric `1.21.1`.
- Default game directory is `app.getPath("userData")/minecraft` (launcher-only instance).
- Launcher user data root is forced to `.bettermonlauncher` under OS appData path.
- Chromium session/cache data is stored under `runtime/session` inside launcher user data.
- Launcher state files are grouped under `state/*` (for example: `state/auth/microsoft_auth.json`, `state/updater/app-update.yml`).
- Launcher auto-installs Fabric `1.21.1` profile to the launcher instance directory when needed.
- Fabric runtime preparation runs during startup loading before launcher becomes interactive.
- Distribution mode file entries must include at least one hash (`sha256` or `md5`).
- Launcher requires Java 21+ for Minecraft 1.21.1 and auto-installs a bundled runtime on Windows when needed.
- Microsoft sign-in uses Authorization Code + PKCE in an embedded login window.
- Existing legacy user-data files are migrated automatically on startup.
- Server status panel reads `serverStatus` from `modpack.config.json`.
- Game launch auto-connect uses the same `serverStatus.host` and `serverStatus.port` values through Minecraft quickPlay.
- If `serverStatus.molangUrl` is empty, MOJANG health is checked via `https://api.minecraftservices.com/health`.
- News panel can poll JSON from `news.url` (`http(s)`, `s3://bucket/key`, `file://`, absolute path, or relative path).
- `news.itemsPath` supports nested JSON (example: `data.items`).
- Relative `news.path` is resolved from the folder that contains `modpack.config.json`.
- Optional news env overrides:
  - `BETTERMON_NEWS_URL`, `BETTERMON_NEWS_ITEMS_PATH`
  - `BETTERMON_NEWS_FALLBACK_URL`
  - `BETTERMON_NEWS_REFRESH_MS`, `BETTERMON_NEWS_TIMEOUT_MS`, `BETTERMON_NEWS_MAX_ITEMS`
  - `BETTERMON_NEWS_AWS_REGION` (for `s3://` news source)
- Optional server-status env overrides:
  - `BETTERMON_SERVER_HOST`, `BETTERMON_SERVER_PORT`
  - `BETTERMON_MOLANG_STATUS_URL`, `BETTERMON_MOLANG_FIELD`
  - `BETTERMON_MOLANG_ONLINE_FIELD`, `BETTERMON_MOLANG_ONLINE_VALUE`
- `modpack.config.json` location:
  - Dev: project root
  - Packaged: same folder as launcher `.exe`
