@echo off
cd /d "%~dp0"
echo Yayin Yonetim Araci sunucusu baslatiliyor...
echo.
echo Bu pencereyi KAPATMAYIN - yayin sirasinda acik kalmali.
echo.
echo Duzenleme ekrani: http://localhost:8843/index.html
echo OBS Giris Ekrani : http://localhost:8843/obs-giris-ekrani.html
echo OBS Cikis Ekrani : http://localhost:8843/obs-cikis-ekrani.html
echo OBS Giris URL    : http://localhost:8843/obs-giris-ekrani.html?obs=1
echo OBS Cikis URL    : http://localhost:8843/obs-cikis-ekrani.html?obs=1
echo.
start "" "http://localhost:8843/index.html"
python serve.py 8843
pause
