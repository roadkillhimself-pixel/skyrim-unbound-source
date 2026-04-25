@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0open_public_test_ports.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /B %EXIT_CODE%
