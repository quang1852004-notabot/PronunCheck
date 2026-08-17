@echo off
cd /d "%~dp0"
echo Dang dong bo toan bo thu muc len Git (%CD%)...
git add -A
git commit -m "Auto sync: %date% %time%"
git push origin main
echo.
echo Dong bo hoan tat!
pause

