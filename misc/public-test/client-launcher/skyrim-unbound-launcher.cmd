@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0skyrim-unbound-launcher.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Skyrim Unbound launcher failed with code %EXIT_CODE%.
  pause
)
endlocal & exit /B %EXIT_CODE%
