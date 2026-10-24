Unicode true
RequestExecutionLevel user
SilentInstall silent
SilentUnInstall silent
Name "BetterLauncher migration fixture"
OutFile "${TEST_GENERATOR}"
!include LogicLib.nsh
!include FileFunc.nsh

Section
  WriteUninstaller "${TEST_UNINSTALLER}"
SectionEnd

Section "Uninstall"
  SetRegView ${TEST_REG_VIEW}
  FileOpen $0 "${TEST_RECORD}" a
  FileSeek $0 0 END
  ${GetParameters} $1
  FileWrite $0 "uninstall:$1$\r$\n"
  FileClose $0
  !if ${TEST_RESULT} == 5
    SetErrorLevel 5
    Quit
  !endif
  !if ${TEST_RESULT} == 3
    ; A broken uninstaller reports success without removing anything.
    SetErrorLevel 0
    Quit
  !endif
  ; Every file below belongs to the isolated fixture directory. No recursive
  ; removal and no real application/Windows registry keys are used by tests.
  Delete "$INSTDIR\${TEST_EXE_NAME}.exe"
  Delete "$INSTDIR\resources\app.asar"
  RMDir "$INSTDIR\resources"
  Delete "$INSTDIR\Uninstall ${TEST_EXE_NAME}.exe"
  RMDir "$INSTDIR"
  !if ${TEST_RESULT} != 6
    DeleteRegKey HKCU "${TEST_INSTALL_KEY}"
    DeleteRegKey HKCU "${TEST_UNINSTALL_KEY}"
  !endif
  SetErrorLevel 0
SectionEnd
