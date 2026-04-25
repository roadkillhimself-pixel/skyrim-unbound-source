@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_server_shortcuts.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Failed to create Skyrim Unbound shortcuts.
  pause
)
endlocal & exit /B %EXIT_CODE%
