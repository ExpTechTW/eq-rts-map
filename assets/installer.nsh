!macro customInstall
  DetailPrint "Register eq-rts-map URI Handler"
  DeleteRegKey HKCU "Software\Classes\eq-rts-map"
  WriteRegStr HKCU "Software\Classes\eq-rts-map" "" "URL:eq-rts-map"
  WriteRegStr HKCU "Software\Classes\eq-rts-map" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\eq-rts-map\shell" "" ""
  WriteRegStr HKCU "Software\Classes\eq-rts-map\shell\open" "" ""
  WriteRegStr HKCU "Software\Classes\eq-rts-map\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro customUnInstall
  DetailPrint "Unregister eq-rts-map URI Handler"
  DeleteRegKey HKCU "Software\Classes\eq-rts-map"
!macroend
