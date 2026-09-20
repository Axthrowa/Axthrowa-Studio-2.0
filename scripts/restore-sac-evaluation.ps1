# Restore Smart App Control Evaluation (2). Never writes Off (0).
# Microsoft test procedure: offline SYSTEM hive via WinRE, then reboot.
# https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/test-your-app-with-smart-app-control

#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"
$proj = Split-Path $PSScriptRoot -Parent
$srcCmd = Join-Path $PSScriptRoot "sac-eval-winre.cmd"
$srcVerify = Join-Path $PSScriptRoot "sac-eval-verify.ps1"
$destCmd = "C:\Windows\Temp\sac-eval-winre.cmd"
$destVerify = "C:\Windows\Temp\sac-eval-verify.ps1"
$mount = "C:\Windows\Temp\winre-mount"
$wimLocal = "C:\Windows\System32\Recovery\Winre.wim"
$startnetBackup = "C:\Windows\Temp\winre-startnet.cmd.orig"
$log = "C:\Windows\Temp\sac-eval-orchestrate.log"

function W([string]$m) {
  $line = "{0:u} {1}" -f (Get-Date), $m
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
  Write-Host $line
}

if (-not (Test-Path -LiteralPath $srcCmd)) { throw "missing $srcCmd" }
Copy-Item -LiteralPath $srcCmd -Destination $destCmd -Force
Copy-Item -LiteralPath $srcVerify -Destination $destVerify -Force
Unblock-File -LiteralPath $destCmd, $destVerify -ErrorAction SilentlyContinue
W "copied helper scripts"

# One-shot verify after Windows returns from WinRE
cmd /c 'schtasks /delete /tn YYA-SAC-EvalVerify /f >nul 2>&1' | Out-Null
$create = cmd /c "schtasks /create /tn YYA-SAC-EvalVerify /sc onstart /ru SYSTEM /rl HIGHEST /f /tr `"powershell.exe -NoProfile -ExecutionPolicy Bypass -File $destVerify`""
W "scheduled YYA-SAC-EvalVerify: $create"

W "reagentc /disable (stage Winre.wim on C:)"
$dis = & reagentc.exe /disable 2>&1 | Out-String
W $dis.Trim()
if (-not (Test-Path -LiteralPath $wimLocal)) {
  throw "Winre.wim not staged at $wimLocal"
}

if (Test-Path -LiteralPath $mount) {
  & dism.exe /Unmount-Image /MountDir:$mount /Discard 2>$null | Out-Null
  Remove-Item -LiteralPath $mount -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $mount -Force | Out-Null
W "mounting WinRE"
$mntOut = & dism.exe /Mount-Image /ImageFile:$wimLocal /Index:1 /MountDir:$mount 2>&1 | Out-String
W $mntOut.Trim()
$startnet = Join-Path $mount "Windows\System32\startnet.cmd"
if (-not (Test-Path -LiteralPath $startnet)) { throw "startnet.cmd missing in WinRE image" }
Copy-Item -LiteralPath $startnet -Destination $startnetBackup -Force
$startnetBody = @'
@echo off
wpeinit.exe
ping -n 15 127.0.0.1 >nul
echo rescan> X:\sac-dp.txt
echo list volume>> X:\sac-dp.txt
echo exit>> X:\sac-dp.txt
diskpart /s X:\sac-dp.txt >nul
for %%D in (C D E F G H I J K L M N O P) do (
  if exist %%D:\Windows\explorer.exe if exist %%D:\Windows\System32\config\SYSTEM (
    echo %DATE% %TIME% os=%%D>> %%D:\Windows\Temp\sac-eval-winre.log
    reg load HKLM\sac %%D:\Windows\System32\config\SYSTEM
    if not errorlevel 1 (
      rem Evaluation=2 only. Never write PolicyState 0 (Off).
      reg add HKLM\sac\ControlSet001\Control\CI\Policy /v VerifiedAndReputablePolicyState /t REG_DWORD /d 2 /f
      reg add HKLM\sac\ControlSet001\Control\CI\Protected /v VerifiedAndReputablePolicyStateMinValueSeen /t REG_DWORD /d 2 /f
      reg add HKLM\sac\ControlSet001\Control\CI\Policy /v SAC_PreviousState /t REG_DWORD /d 2 /f
      reg query HKLM\sac\ControlSet001\Control\CI\Policy /v VerifiedAndReputablePolicyState >> %%D:\Windows\Temp\sac-eval-winre.log
      reg query HKLM\sac\ControlSet001\Control\CI\Protected /v VerifiedAndReputablePolicyStateMinValueSeen >> %%D:\Windows\Temp\sac-eval-winre.log
      reg unload HKLM\sac
    )
    reg load HKLM\sac2 %%D:\Windows\System32\config\SOFTWARE
    if not errorlevel 1 (
      rem Microsoft test switch for Evaluation; this is not SAC Off.
      reg add "HKLM\sac2\Microsoft\Windows Defender" /v SacLearningModeSwitch /t REG_DWORD /d 0 /f
      reg unload HKLM\sac2
    )
    echo 2> %%D:\Windows\Temp\sac-eval-winre.done
  )
)
wpeutil reboot
'@
$evalStart = Join-Path $mount "Windows\System32\sac-eval-start.cmd"
Set-Content -LiteralPath $evalStart -Value $startnetBody -Encoding Ascii
Set-Content -LiteralPath $startnet -Value $startnetBody -Encoding Ascii
$winpeshl = Join-Path $mount "Windows\System32\winpeshl.ini"
if (Test-Path -LiteralPath $winpeshl) {
  Copy-Item -LiteralPath $winpeshl -Destination "C:\Windows\Temp\winpeshl.ini.orig" -Force
}
Set-Content -LiteralPath $winpeshl -Value "[LaunchApps]`r`n%SYSTEMDRIVE%\Windows\System32\sac-eval-start.cmd`r`n" -Encoding Ascii
W "patched startnet.cmd, sac-eval-start.cmd, winpeshl.ini"
$commit = & dism.exe /Unmount-Image /MountDir:$mount /Commit 2>&1 | Out-String
W $commit.Trim()

W "reagentc /enable"
$en = & reagentc.exe /enable 2>&1 | Out-String
W $en.Trim()
W "reagentc /boottore"
$bt = & reagentc.exe /boottore 2>&1 | Out-String
W $bt.Trim()

$info = & reagentc.exe /info 2>&1 | Out-String
W $info.Trim()
$id = [regex]::Match($info, "BCD identifier:\s*([0-9a-f-]+)").Groups[1].Value
if ($id) {
  $bs = cmd /c "bcdedit /bootsequence {$id}"
  W "bootsequence ${id}: $bs"
}
W "READY: next reboot enters WinRE, writes Evaluation=2, returns to Windows. SAC Off is not written."
exit 0
