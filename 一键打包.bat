@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM WJ Python Manager Tauri build helper.
REM Keep this file ASCII-only so it works with any Windows code page.

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"
title WJ Python Manager Tauri Builder

echo ============================================================
echo    WJ Python Manager Tauri Builder
echo ============================================================
echo.

for /f "delims=" %%i in ('node scripts\set-version.mjs') do set "CUR_VERSION=%%i"
if errorlevel 1 (
  echo [ERROR] Could not read the current version.
  echo         Please install Node.js 24 and run this file from the project root.
  pause
  exit /b 1
)
echo Current version: v%CUR_VERSION%
echo.

set "NEW_VERSION="
set /p "NEW_VERSION=New version (press Enter to keep v%CUR_VERSION%): "
if not "!NEW_VERSION!"=="" (
  node scripts\set-version.mjs --check !NEW_VERSION! >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Invalid version: !NEW_VERSION!
    echo         Expected X.Y.Z or X.Y.Z-beta.1
    pause
    exit /b 1
  )
  node scripts\set-version.mjs !NEW_VERSION!
  if errorlevel 1 (
    echo [ERROR] Could not update the version.
    pause
    exit /b 1
  )
  set "CUR_VERSION=!NEW_VERSION!"
  echo.
)

if not exist node_modules\@tauri-apps\cli (
  echo [INFO] Tauri CLI not found. Running npm install ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo ============================================================
echo Building v!CUR_VERSION! with npm run tauri:build ...
echo Started: %date% %time%
echo ============================================================
call npm run tauri:build
set "BUILD_CODE=%errorlevel%"
echo ============================================================
if not "!BUILD_CODE!"=="0" (
  echo [ERROR] Build failed with code !BUILD_CODE!.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] Build complete.
echo Output: release
for /f "delims=" %%f in ('dir /b /o-d release\*-setup.exe 2^>nul') do echo Installer: release\%%f
for /f "delims=" %%f in ('dir /b /o-d release\*-portable.exe 2^>nul') do echo Portable: release\%%f
:show_done
echo Finished: %date% %time%
echo.
pause
