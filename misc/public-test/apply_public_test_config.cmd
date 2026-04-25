@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0apply_public_test_config.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /B %EXIT_CODE%
