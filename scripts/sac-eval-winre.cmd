@echo off
REM Microsoft test procedure: Evaluation = 2. NEVER write 0 (Off).
set "OSD=%~1"
if "%OSD%"=="" set "OSD=C:"
set "LOG=%OSD%\Windows\Temp\sac-eval-winre.log"
echo %DATE% %TIME% start drive=%OSD%>>"%LOG%"

reg load HKLM\sac "%OSD%\Windows\System32\config\SYSTEM"
if errorlevel 1 (
  echo FAIL load SYSTEM>>"%LOG%"
  exit /b 1
)

reg add "HKLM\sac\ControlSet001\Control\CI\Policy" /v VerifiedAndReputablePolicyState /t REG_DWORD /d 2 /f
reg add "HKLM\sac\ControlSet001\Control\CI\Protected" /v VerifiedAndReputablePolicyStateMinValueSeen /t REG_DWORD /d 2 /f
reg add "HKLM\sac\ControlSet001\Control\CI\Policy" /v SAC_PreviousState /t REG_DWORD /d 2 /f

reg query "HKLM\sac\ControlSet001\Control\CI\Policy" /v VerifiedAndReputablePolicyState >>"%LOG%"
reg query "HKLM\sac\ControlSet001\Control\CI\Protected" /v VerifiedAndReputablePolicyStateMinValueSeen >>"%LOG%"

reg unload HKLM\sac

reg load HKLM\sac2 "%OSD%\Windows\System32\config\SOFTWARE"
if not errorlevel 1 (
  rem SacLearningModeSwitch=0 is Microsoft's Evaluation test switch, not SAC Off.
  reg add "HKLM\sac2\Microsoft\Windows Defender" /v SacLearningModeSwitch /t REG_DWORD /d 0 /f
  reg unload HKLM\sac2
)

echo DONE value=2>>"%LOG%"
echo 2>"%OSD%\Windows\Temp\sac-eval-winre.done"
del /f /q "%OSD%\Windows\Temp\sac-eval-winre.cmd"
exit /b 0
