!include LogicLib.nsh
!include FileFunc.nsh
!include x64.nsh

; The original com.bettermon.launcher appId resolves to this electron-builder
; GUID. Keep it stable so Windows treats the renamed launcher as an upgrade.
!define /ifndef BL_LEGACY_INSTALL_KEY "Software\0e192e02-a904-5be6-bca2-04cae62ae05b"
!define /ifndef BL_LEGACY_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\0e192e02-a904-5be6-bca2-04cae62ae05b"
!define /ifndef BL_LEGACY_USER_ROOT HKCU
!define /ifndef BL_LEGACY_MACHINE_ROOT HKLM

!ifndef BUILD_UNINSTALLER
Var blLegacyName
Var blLegacyExeName
Var blLegacyDirectory
Var blLegacyUninstaller
Var blLegacyCommand
Var blLegacyCheckPath
Var blLegacyExitCode
Var blLegacyParent

Function BL_LegacyMigrationFailed
  DetailPrint "BetterMonLauncher removal failed. BetterLauncher installation was stopped."
  !ifndef BL_MIGRATION_TEST
    MessageBox MB_OK|MB_ICONSTOP "기존 BetterMonLauncher를 제거하지 못해 설치를 중단했습니다.$\r$\n기존 런처를 종료하고 다시 설치해 주세요. 문제가 계속되면 Windows 설정의 앱 목록에서 기존 런처를 먼저 제거해 주세요.$\r$\n로그인 정보와 게임 데이터는 삭제하지 않습니다." /SD IDOK
  !endif
  SetErrorLevel 2
  Quit
FunctionEnd

Function BL_ValidateLegacyDirectory
  ; Resolve the registered target before invoking an uninstaller that removes
  ; its install directory. Reject roots, personal/system folders and junctions.
  GetFullPathName $blLegacyDirectory "$blLegacyDirectory"
  StrLen $0 $blLegacyDirectory
  ${If} $0 < 4
    Call BL_LegacyMigrationFailed
  ${EndIf}
  StrCpy $0 $blLegacyDirectory 2 1
  ${If} $0 != ":\"
    Call BL_LegacyMigrationFailed
  ${EndIf}
  ${If} $blLegacyDirectory == $WINDIR
  ${OrIf} $blLegacyDirectory == $SYSDIR
  ${OrIf} $blLegacyDirectory == $PROFILE
  ${OrIf} $blLegacyDirectory == $APPDATA
  ${OrIf} $blLegacyDirectory == $LOCALAPPDATA
  ${OrIf} $blLegacyDirectory == $PROGRAMFILES
  ${OrIf} $blLegacyDirectory == $PROGRAMFILES64
  ${OrIf} $blLegacyDirectory == $DESKTOP
  ${OrIf} $blLegacyDirectory == $DOCUMENTS
  ${OrIf} $blLegacyDirectory == $TEMP
  ${OrIf} $blLegacyDirectory == $COMMONFILES
  ${OrIf} $blLegacyDirectory == $COMMONFILES64
    Call BL_LegacyMigrationFailed
  ${EndIf}
  StrCpy $blLegacyCheckPath $blLegacyDirectory
  ${DoWhile} $blLegacyCheckPath != ""
    System::Call 'kernel32::GetFileAttributesW(w "$blLegacyCheckPath") i .r0'
    ${If} $0 == -1
      Call BL_LegacyMigrationFailed
    ${EndIf}
    IntOp $0 $0 & 0x400
    ${If} $0 != 0
      Call BL_LegacyMigrationFailed
    ${EndIf}
    ${GetParent} $blLegacyCheckPath $blLegacyCheckPath
  ${Loop}
  IfFileExists "$blLegacyDirectory\$blLegacyExeName.exe" +2 0
    Call BL_LegacyMigrationFailed
  IfFileExists "$blLegacyDirectory\resources\app.asar" +2 0
    Call BL_LegacyMigrationFailed
  IfFileExists "$blLegacyDirectory\Uninstall $blLegacyExeName.exe" +2 0
    Call BL_LegacyMigrationFailed
FunctionEnd

!macro BL_RemoveLegacy ROOT MODE
  ReadRegStr $blLegacyName ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}" "DisplayName"
  StrCpy $blLegacyExeName ""
  StrCpy $0 $blLegacyName 19
  ${If} $blLegacyName == "BetterMon Launcher"
  ${OrIf} $0 == "BetterMon Launcher "
    StrCpy $blLegacyExeName "BetterMon Launcher"
  ${Else}
    StrCpy $0 $blLegacyName 18
    ${If} $blLegacyName == "BetterMonLauncher"
    ${OrIf} $0 == "BetterMonLauncher "
      StrCpy $blLegacyExeName "BetterMonLauncher"
    ${EndIf}
  ${EndIf}

  ${If} $blLegacyExeName != ""
    ReadRegStr $blLegacyDirectory ${ROOT} "${BL_LEGACY_INSTALL_KEY}" "InstallLocation"
    ReadRegStr $blLegacyCommand ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}" "UninstallString"
    ; Read only the quoted executable. Registry-provided arguments are never
    ; executed, especially --delete-app-data or shell commands.
    StrCpy $0 $blLegacyCommand 1
    ${If} $0 != '$\"'
      Call BL_LegacyMigrationFailed
    ${EndIf}
    StrCpy $blLegacyUninstaller ""
    StrCpy $1 1
    ${Do}
      StrCpy $0 $blLegacyCommand 1 $1
      ${If} $0 == ""
        Call BL_LegacyMigrationFailed
      ${EndIf}
      ${If} $0 == '$\"'
        ${ExitDo}
      ${EndIf}
      StrCpy $blLegacyUninstaller "$blLegacyUninstaller$0"
      IntOp $1 $1 + 1
    ${Loop}
    GetFullPathName $blLegacyUninstaller "$blLegacyUninstaller"
    ${GetParent} $blLegacyUninstaller $blLegacyParent
    ${If} $blLegacyDirectory == ""
      StrCpy $blLegacyDirectory $blLegacyParent
    ${EndIf}
    Call BL_ValidateLegacyDirectory
    ${If} $blLegacyUninstaller != "$blLegacyDirectory\Uninstall $blLegacyExeName.exe"
      Call BL_LegacyMigrationFailed
    ${EndIf}

    ; Replace the old default directory name, including the subfolder the
    ; standard directory page adds automatically. Preserve other chosen paths.
    ${If} $INSTDIR == $blLegacyDirectory
    ${OrIf} $INSTDIR == "$blLegacyDirectory\BetterLauncher"
      ${GetParent} $blLegacyDirectory $blLegacyParent
      StrCpy $INSTDIR "$blLegacyParent\BetterLauncher"
    ${EndIf}
    SetOutPath $TEMP
    DetailPrint "Removing the previous BetterMonLauncher installation..."
    ClearErrors
    CopyFiles /SILENT "$blLegacyUninstaller" "$PLUGINSDIR\bettermon-uninstaller.exe"
    ${If} ${Errors}
      Call BL_LegacyMigrationFailed
    ${EndIf}
    ClearErrors
    ; _?= must be last and unquoted: wait for the actual NSIS uninstaller,
    ; not its temporary bootstrap process. Never request app-data deletion.
    ExecWait '$\"$PLUGINSDIR\bettermon-uninstaller.exe$\" /S /KEEP_APP_DATA --updated /${MODE} _?=$blLegacyDirectory' $blLegacyExitCode
    ${If} ${Errors}
      Call BL_LegacyMigrationFailed
    ${EndIf}
    ${If} $blLegacyExitCode != 0
      Call BL_LegacyMigrationFailed
    ${EndIf}
    IfFileExists "$blLegacyDirectory\$blLegacyExeName.exe" 0 +2
      Call BL_LegacyMigrationFailed
    IfFileExists "$blLegacyDirectory\Uninstall $blLegacyExeName.exe" 0 +2
      Call BL_LegacyMigrationFailed
    IfFileExists "$blLegacyDirectory\resources\app.asar" 0 +2
      Call BL_LegacyMigrationFailed
    ReadRegStr $0 ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}" "DisplayName"
    ${If} $0 == $blLegacyName
      Call BL_LegacyMigrationFailed
    ${EndIf}
    ClearErrors
  ${EndIf}
!macroend

!macro customHeader
  ; A hidden first section runs only after Install is pressed. customInit would
  ; uninstall too early, even when the user cancels the installation wizard.
  Section "-ReplaceBetterMonLauncher"
    SectionIn RO
    InitPluginsDir
    SetRegView 32
    !insertmacro BL_RemoveLegacy ${BL_LEGACY_USER_ROOT} currentuser
    !insertmacro BL_RemoveLegacy ${BL_LEGACY_MACHINE_ROOT} allusers
    ${If} ${RunningX64}
      SetRegView 64
      !insertmacro BL_RemoveLegacy ${BL_LEGACY_USER_ROOT} currentuser
      !insertmacro BL_RemoveLegacy ${BL_LEGACY_MACHINE_ROOT} allusers
    ${EndIf}
    ClearErrors
  SectionEnd
!macroend
!endif
