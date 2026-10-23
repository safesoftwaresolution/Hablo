; Electron (sandbox) necesita que "ALL APPLICATION PACKAGES" pueda leer la carpeta de instalacion.
; Si el ACL de la carpeta solo trae una entrada AppContainer, la app se cierra al abrir. Se concede aqui.
!macro customInstall
  nsExec::Exec 'icacls "$INSTDIR" /grant *S-1-15-2-1:(OI)(CI)(RX) /T /C /Q'
  Pop $0
!macroend
