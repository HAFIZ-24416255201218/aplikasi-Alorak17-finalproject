@echo off
REM
cd /d "%~dp0"

REM 
set ANDROID_STUDIO_PATH=C:\Program Files\Android\Android Studio\bin\studio64.exe

REM
if not exist "android" (
    echo Error: Folder 'android' tidak ditemukan!
    echo Jalankan: npm run cap:build
    pause
    exit /b 1
)

REM
start "" "%ANDROID_STUDIO_PATH%" "android"

echo
