@echo off
setlocal
call "%~dp0preflight_public_test.cmd"
if errorlevel 1 (
  echo.
  echo Public-test preflight reported blocking issues. Fix them before opening the server to remote testers.
  pause
  endlocal & exit /B 1
)

echo.
echo Publishing website...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_website.ps1"
if errorlevel 1 (
  echo.
  echo Website publishing failed. Fix it before opening the server to remote testers.
  pause
  endlocal & exit /B 1
)

echo.
echo Publishing UCP site...
call "%~dp0publish_ucp_site.cmd"
if errorlevel 1 (
  echo.
  echo UCP site publishing failed. Fix it before opening the server to remote testers.
  pause
  endlocal & exit /B 1
)

echo.
echo Publishing admin panel...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publish_admin_panel.ps1"
if errorlevel 1 (
  echo.
  echo Admin panel publishing failed. Fix it before opening the server to remote testers.
  pause
  endlocal & exit /B 1
)

echo.
echo Publishing laptop client package...
call "%~dp0publish_client_package.cmd"
if errorlevel 1 (
  echo.
  echo Warning: laptop client package publishing failed. The server will still start, but remote launcher updates may be stale.
)

pushd "%~dp0..\..\build\dist\server"
call launch_server.bat
set "EXIT_CODE=%ERRORLEVEL%"
popd
endlocal & exit /B %EXIT_CODE%
