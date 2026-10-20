@echo off
cd /d "%~dp0"
title Resonance
echo Resonance artik uygulamanin icinde: Panel ust cubugundaki "Muzik" sekmesi.
echo Bu dosya yalnizca tarayicida acmak isteyenler icin.
echo.
echo Uygulama:  http://127.0.0.1:8843/resonance/
echo Overlay:   http://127.0.0.1:8843/resonance/overlay
echo.
echo Once YayinYonetimAraci.exe / Baslat.bat acik olmali.
echo Spotify redirect URI: http://127.0.0.1:8843/api/player/spotify/callback
echo.
start "" "http://127.0.0.1:8843/resonance/"
pause
