@echo off
echo ==========================================
echo   Cong cu Cap nhat Icon PWA PronunCheck
echo ==========================================
echo.
echo Dang doc file "app_icon.png" tu thu muc goc...
call venv\Scripts\activate
python update_icons.py
echo.
pause
