@echo off
cd /d "%~dp0"
"C:\Python314\python.exe" serve_static.py --port 8081 --bind 127.0.0.1
