; Called by the NSIS uninstaller after files are removed.
; Cleans up the startup registry entry that the app writes at runtime
; (app.setLoginItemSettings writes to HKCU\...\CurrentVersion\Run).
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Frostbyte"
!macroend
