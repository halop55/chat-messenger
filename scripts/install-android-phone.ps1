$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$apkPath = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "C:\Program Files\Android\Android Studio\jbr\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator;$env:Path"
$env:NODE_ENV = "development"

$devices = adb devices |
  Select-Object -Skip 1 |
  Where-Object { $_ -match "\sdevice$" } |
  ForEach-Object { ($_ -split "\s+")[0] }

$phoneDevices = @($devices | Where-Object { $_ -notmatch "^emulator-" })

if ($phoneDevices.Count -eq 0) {
  throw "Khong tim thay dien thoai Android da bat USB debugging."
}

if ($phoneDevices.Count -gt 1) {
  throw "Dang co nhieu dien thoai ket noi. Hay chi de lai mot dien thoai khi cai ban native."
}

$phoneSerial = $phoneDevices[0]

Push-Location $androidRoot
try {
  .\gradlew.bat app:assembleDebug --max-workers 1 --no-parallel -PreactNativeArchitectures=arm64-v8a
} finally {
  Pop-Location
}

adb -s $phoneSerial install -r $apkPath
adb -s $phoneSerial reverse tcp:8081 tcp:8081
adb -s $phoneSerial shell am start -n com.fpt.chatmessenger/.MainActivity
