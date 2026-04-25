@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_public_test_server_background.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Failed to start Skyrim Unbound server in background.
  pause
)
endlocal & exit /B %EXIT_CODE%
