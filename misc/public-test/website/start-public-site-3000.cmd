@echo off
cd /d "%~dp0"
"C:\Python314\python.exe" serve_static.py --port 3000 --bind 0.0.0.0
