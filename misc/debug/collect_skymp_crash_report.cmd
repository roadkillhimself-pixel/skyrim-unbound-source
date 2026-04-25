@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0collect_skymp_crash_report.ps1" %*
