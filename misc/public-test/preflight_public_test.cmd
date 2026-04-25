@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0preflight_public_test.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /B %EXIT_CODE%
