InstallDir "D:\Program Files\WeiPython Manager"

!macro customInstall
  StrCpy $0 "WeiPython Manager"
  ${if} $LANGUAGE == 2052
    StrCpy $0 "尉Python 环境管理器"
  ${endif}

  ${if} $installMode == "all"
    SetShellVarContext all
  ${else}
    SetShellVarContext current
  ${endif}

  Delete "$DESKTOP\WeiPython Manager.lnk"
  Delete "$DESKTOP\尉Python 环境管理器.lnk"
  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  CreateShortCut "$DESKTOP\$0.lnk" "$appExe" "" "$INSTDIR\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$DESKTOP\$0.lnk" "${APP_ID}"

  Delete "$SMPROGRAMS\WeiPython Manager.lnk"
  Delete "$SMPROGRAMS\尉Python 环境管理器.lnk"
  Delete "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
  CreateShortCut "$SMPROGRAMS\$0.lnk" "$appExe" "" "$INSTDIR\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$SMPROGRAMS\$0.lnk" "${APP_ID}"

  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ExecWait '"$SYSDIR\ie4uinit.exe" -ClearIconCache'
  ExecWait '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro customUnInstall
  Delete "$DESKTOP\WeiPython Manager.lnk"
  Delete "$DESKTOP\尉Python 环境管理器.lnk"
  Delete "$SMPROGRAMS\WeiPython Manager.lnk"
  Delete "$SMPROGRAMS\尉Python 环境管理器.lnk"
!macroend
