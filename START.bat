@echo off
chcp 65001 >nul
title Mobile Store - Server
color 0D

echo.
echo  ========================================
echo    Mobile Store - تشغيل السيرفر
echo  ========================================
echo.

cd /d "%~dp0"

echo  [1/2] جاري تشغيل السيرفر...
echo.
echo  ⚠️  لا تغلق هذه النافذة!
echo  ⚠️  لا تستخدم localhost:3000 (برنامج تاني)
echo.
echo  ✅  افتح: http://localhost:3002
echo.
echo  Login: admin / 123456
echo  ========================================
echo.

start "" "http://localhost:3002"

npm run dev

pause
