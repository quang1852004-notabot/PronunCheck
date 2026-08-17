@echo off
echo Dang dong bo thu muc len Git...
git add .
git commit -m "Auto sync: %date% %time%"
git push origin main
echo Dong bo hoan tat!
pause
