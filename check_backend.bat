@echo off
setlocal
title Backend Server Status Checker

:: Thay đổi địa chỉ IP hoặc hostname của backend server (VM) của bạn ở đây
set "SERVER=192.168.1.100" 

echo =======================================================
echo Checking status of backend server: %SERVER%
echo =======================================================
echo Pinging...

:: Ping 4 lần, có thể đổi số 4 thành số khác nếu muốn
ping -n 4 %SERVER% >nul

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Backend server %SERVER% is ONLINE.
) else (
    echo.
    echo [ERROR] Backend server %SERVER% is OFFLINE or UNREACHABLE.
)

echo =======================================================
pause
endlocal
