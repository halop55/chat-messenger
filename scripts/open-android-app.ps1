$ErrorActionPreference = "Stop"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator;$env:Path"

$devices = adb devices |
  Select-Object -Skip 1 |
  Where-Object { $_ -match "\sdevice$" } |
  ForEach-Object { ($_ -split "\s+")[0] }

foreach ($device in $devices) {
  adb -s $device reverse tcp:8081 tcp:8081 | Out-Null
  adb -s $device shell am start -n com.fpt.chatmessenger/.MainActivity
}
