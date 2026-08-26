@echo off
chcp 65001 >nul
title Mobile Store - إعادة تشغيل
color 0D

echo.
echo  ========================================
echo    إصلاح وإعادة تشغيل Mobile Store
echo  ========================================
echo.

cd /d "%~dp0"

echo  [1/4] إيقاف السيرفر القديم...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo  [2/4] مسح الكاش التالف...
if exist .next rmdir /s /q .next

echo  [3/4] تحديث قاعدة البيانات...
call npx prisma generate
call npx prisma db push --skip-generate

echo  [4/4] تشغيل السيرفر...
echo.
echo  ✅  افتح: http://localhost:3002
echo  Login: admin / 123456
echo.

start "" "http://localhost:3002"
npm run dev

pause
