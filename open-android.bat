@echo off
REM Batch file untuk membuka Android project di Android Studio
cd /d "%~dp0"

REM Definisikan path Android Studio
set ANDROID_STUDIO_PATH=C:\Program Files\Android\Android Studio\bin\studio64.exe

REM Check jika folder android ada
if not exist "android" (
    echo Error: Folder 'android' tidak ditemukan!
    echo Jalankan: npm run cap:build
    pause
    exit /b 1
)

REM Jalankan Android Studio dengan project android
start "" "%ANDROID_STUDIO_PATH%" "android"

echo Android Studio sedang dibuka...
