!include LogicLib.nsh
!include FileFunc.nsh
!include x64.nsh

; Keep the original installation identity so the rename remains an upgrade.
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
Var blLegacyDirectorySafe
Var blLegacyCanUninstall

Function BL_ValidateLegacyDirectory
  StrCpy $blLegacyDirectorySafe "false"
  ; Missing files are normal for stale registrations; validate paths separately.
  StrCpy $0 $blLegacyDirectory 2 1
  ${If} $0 != ":\"
    Return
  ${EndIf}
  GetFullPathName $blLegacyDirectory "$blLegacyDirectory"
  StrLen $0 $blLegacyDirectory
  ${If} $0 < 4
    Return
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
    Return
  ${EndIf}
  StrCpy $blLegacyCheckPath $blLegacyDirectory
  ${DoWhile} $blLegacyCheckPath != ""
    System::Call 'kernel32::GetFileAttributesW(w "$blLegacyCheckPath") i .r0'
    ${If} $0 <> -1
      IntOp $0 $0 & 0x400
      ${If} $0 != 0
        Return
      ${EndIf}
    ${EndIf}
    ${GetParent} $blLegacyCheckPath $blLegacyCheckPath
  ${Loop}
  StrCpy $blLegacyDirectorySafe "true"
FunctionEnd

Function BL_ReadLegacyUninstaller
  StrCpy $blLegacyUninstaller ""
  StrCpy $0 $blLegacyCommand 1
  ${If} $0 != '$\"'
    ; Accept an unquoted complete executable path, never arbitrary arguments.
    IfFileExists "$blLegacyCommand" 0 +2
      StrCpy $blLegacyUninstaller "$blLegacyCommand"
    Return
  ${EndIf}
  StrCpy $1 1
  ${Do}
    StrCpy $0 $blLegacyCommand 1 $1
    ${If} $0 == ""
      StrCpy $blLegacyUninstaller ""
      Return
    ${EndIf}
    ${If} $0 == '$\"'
      ${ExitDo}
    ${EndIf}
    StrCpy $blLegacyUninstaller "$blLegacyUninstaller$0"
    IntOp $1 $1 + 1
  ${Loop}
FunctionEnd

Function BL_RebaseLegacyDestination
  ; A failed uninstall must not make the new installer overwrite the old tree.
  StrCpy $0 "$blLegacyDirectory\"
  StrLen $1 $0
  StrCpy $2 "$INSTDIR\" $1
  ${If} $2 == $0
    ${GetParent} $blLegacyDirectory $blLegacyParent
    StrCpy $INSTDIR "$blLegacyParent\BetterLauncher"
  ${EndIf}
FunctionEnd

!macro BL_UseSafeDestination
  !ifdef BL_MIGRATION_TEST
    StrCpy $INSTDIR "${TEST_SAFE_DESTINATION}"
  !else
    ${If} $installMode == "all"
      StrCpy $INSTDIR "$PROGRAMFILES64\BetterLauncher"
    ${Else}
      StrCpy $INSTDIR "$LOCALAPPDATA\Programs\BetterLauncher"
    ${EndIf}
  !endif
!macroend

Function BL_PreserveLegacyBinaries
  ; Retire only exact old binary names, preserving every resource/user file.
  ; A locked file or existing backup is retained rather than forcing deletion.
  IfFileExists "$blLegacyDirectory\BetterLauncher.exe" 0 +2
    Return
  IfFileExists "$blLegacyDirectory\$blLegacyExeName.exe.betterlauncher-backup" +2 0
    Rename "$blLegacyDirectory\$blLegacyExeName.exe" "$blLegacyDirectory\$blLegacyExeName.exe.betterlauncher-backup"
  IfFileExists "$blLegacyDirectory\Uninstall $blLegacyExeName.exe.betterlauncher-backup" +2 0
    Rename "$blLegacyDirectory\Uninstall $blLegacyExeName.exe" "$blLegacyDirectory\Uninstall $blLegacyExeName.exe.betterlauncher-backup"
  ClearErrors
FunctionEnd

!macro BL_RemoveLegacy ROOT MODE
  ReadRegStr $blLegacyName ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}" "DisplayName"
  !ifndef BL_MIGRATION_TEST
    !if "${ROOT}" == "HKLM"
      ; The normal silent installer elevates in its main section. Defer HKLM
      ; migration to that elevated child; per-user installation needs no HKLM.
      ${IfNot} ${UAC_IsAdmin}
        StrCpy $blLegacyName ""
      ${EndIf}
    !endif
  !endif
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
    Call BL_ReadLegacyUninstaller
    ${If} $blLegacyDirectory == ""
    ${AndIf} $blLegacyUninstaller != ""
      ${GetParent} $blLegacyUninstaller $blLegacyDirectory
    ${EndIf}
    Call BL_ValidateLegacyDirectory
    ${If} $blLegacyDirectorySafe == "true"
      Call BL_RebaseLegacyDestination
      StrCpy $blLegacyCanUninstall "true"
      ${If} $blLegacyUninstaller != "$blLegacyDirectory\Uninstall $blLegacyExeName.exe"
        StrCpy $blLegacyCanUninstall "false"
      ${EndIf}
      IfFileExists "$blLegacyDirectory\$blLegacyExeName.exe" +2 0
        StrCpy $blLegacyCanUninstall "false"
      IfFileExists "$blLegacyDirectory\resources\app.asar" +2 0
        StrCpy $blLegacyCanUninstall "false"
      IfFileExists "$blLegacyDirectory\Uninstall $blLegacyExeName.exe" +2 0
        StrCpy $blLegacyCanUninstall "false"
      IfFileExists "$blLegacyDirectory\BetterLauncher.exe" 0 +2
        StrCpy $blLegacyCanUninstall "false"
      ${ForEach} $1 0 1 + 1
        ${If} $1 == 0
          StrCpy $blLegacyCheckPath "$blLegacyDirectory\resources"
        ${Else}
          StrCpy $blLegacyCheckPath "$blLegacyDirectory\Uninstall $blLegacyExeName.exe"
        ${EndIf}
        System::Call 'kernel32::GetFileAttributesW(w "$blLegacyCheckPath") i .r0'
        ${If} $0 <> -1
          IntOp $0 $0 & 0x400
          ${If} $0 != 0
            StrCpy $blLegacyCanUninstall "false"
          ${EndIf}
        ${EndIf}
      ${Next}
      ${If} $blLegacyCanUninstall == "true"
        SetOutPath $TEMP
        DetailPrint "Removing the previous BetterMonLauncher installation..."
        ClearErrors
        CopyFiles /SILENT "$blLegacyUninstaller" "$PLUGINSDIR\bettermon-uninstaller.exe"
        ${IfNot} ${Errors}
          ; _?= must be last/unquoted. Never execute registry arguments.
          ExecWait '$\"$PLUGINSDIR\bettermon-uninstaller.exe$\" /S /KEEP_APP_DATA --updated /${MODE} _?=$blLegacyDirectory' $blLegacyExitCode
        ${EndIf}
      ${EndIf}
      Call BL_PreserveLegacyBinaries
    ${Else}
      ; Do not execute or modify files at an untrusted/stale path.
      !insertmacro BL_UseSafeDestination
    ${EndIf}

    ; Detach only the still-matching legacy registration in this hive/view.
    ; Otherwise the normal installer would invoke the broken command again.
    ReadRegStr $0 ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}" "DisplayName"
    ${If} $0 == $blLegacyName
      DeleteRegKey ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}"
      DeleteRegKey ${ROOT} "${BL_LEGACY_INSTALL_KEY}"
      ReadRegStr $0 ${ROOT} "${BL_LEGACY_UNINSTALL_KEY}" "UninstallString"
      ${If} $0 != ""
        ; Do not let the standard installer execute a legacy command that
        ; could not be detached because this registry entry is protected.
        !ifndef BL_MIGRATION_TEST
          MessageBox MB_OK|MB_ICONSTOP "이전 설치 정보를 변경할 권한이 없습니다. 설치 파일을 관리자 권한으로 다시 실행해 주세요. 로그인 정보와 게임 데이터는 삭제하지 않습니다." /SD IDOK
        !endif
        SetErrorLevel 2
        Quit
      ${EndIf}
    ${EndIf}
    DetailPrint "Legacy launcher migration finished. Continuing BetterLauncher installation."
    ClearErrors
  ${EndIf}
!macroend

!macro customHeader
  ; Run only after Install is pressed, so canceling the wizard is harmless.
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
