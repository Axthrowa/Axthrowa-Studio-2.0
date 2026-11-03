@echo off
cd /d "%~dp0"
echo.
echo === AxthrowA Studio (Tauri) ===
echo Gelistirme: npm run tauri:dev
echo Cikti:      cikti\portable\Baslat.bat
echo Kurulum:    cikti\AxthrowA Studio_1.0.0_x64-setup.exe
echo Eski web:   legacy\Sunucuyu-Baslat.bat
echo.
if exist "cikti\portable\Baslat.bat" (
  call "cikti\portable\Baslat.bat"
) else (
  echo Portable cikti yok. Once: npm run tauri:build
  pause
)
