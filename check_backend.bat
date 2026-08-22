@echo off
title PronunCheck Backend Deep Health Checker
chcp 65001 >nul
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0check_backend.ps1"
echo.
pause
