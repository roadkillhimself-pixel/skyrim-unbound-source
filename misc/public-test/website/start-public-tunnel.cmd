@echo off
cd /d "%~dp0"
"C:\Users\justa knifewound\AppData\Local\CodexTools\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8081 --no-autoupdate --logfile "%~dp0cloudflared.err.log"
