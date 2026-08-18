$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$expoCmd = Join-Path $projectRoot "node_modules\.bin\expo.cmd"
$openAppScript = Join-Path $PSScriptRoot "open-android-app.ps1"

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "C:\Program Files\Android\Android Studio\jbr\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator;$env:Path"
$env:EXPO_NO_DEPENDENCY_VALIDATION = "1"
$env:EXPO_NO_TELEMETRY = "1"

Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "Start-Sleep -Seconds 8; & '$openAppScript'"
)

& $expoCmd start --clear
