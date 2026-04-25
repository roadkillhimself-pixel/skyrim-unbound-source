@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_ucp_site.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /B %EXIT_CODE%
