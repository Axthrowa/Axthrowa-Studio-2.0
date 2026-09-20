@echo off
setlocal
cd /d "%~dp0"
echo [restart-app] npm run restart
call npm run restart %*
exit /b %ERRORLEVEL%
