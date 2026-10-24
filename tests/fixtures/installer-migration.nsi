Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "BetterLauncher migration test"
OutFile "${TEST_INSTALLER}"
!define BL_MIGRATION_TEST
!define BL_LEGACY_INSTALL_KEY "${TEST_INSTALL_KEY}"
!define BL_LEGACY_UNINSTALL_KEY "${TEST_UNINSTALL_KEY}"
!ifdef TEST_MACHINE_MODE
  ; Exercise /allusers without modifying HKLM or requiring elevation. Only the
  ; test's private HKCU registry subtree ever contains fixture entries.
  !define BL_LEGACY_USER_ROOT HKLM
  !define BL_LEGACY_MACHINE_ROOT HKCU
!endif
!include "${PROJECT_DIR}\build\installer.nsh"
!insertmacro customHeader

Function .onInit
  !ifdef TEST_LOCK_LEGACY
    System::Call 'kernel32::CreateFileW(w "${TEST_LEGACY_EXE}", i 0x80000000, i 1, p 0, i 3, i 0, p 0) p .r0'
    ${If} $0 = -1
      SetErrorLevel 99
      Quit
    ${EndIf}
  !endif
  StrCpy $INSTDIR "${TEST_DESTINATION}"
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/init-only" $1
  ${IfNot} ${Errors}
    SetErrorLevel 0
    Quit
  ${EndIf}
FunctionEnd

Section "Install new launcher fixture"
  FileOpen $0 "${TEST_RECORD}" a
  FileSeek $0 0 END
  FileWrite $0 "install:$INSTDIR$\r$\n"
  FileClose $0
  SetErrorLevel 0
SectionEnd
