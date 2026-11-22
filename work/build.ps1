param([string] $OutputDirectory)

$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent

function Invoke-BuildTool([string] $Tool, [string[]] $Arguments) {
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$(Split-Path $Tool -Leaf) failed with exit code $LASTEXITCODE."
    }
}

$androidPlayer = (Resolve-Path 'C:\Program Files\Unity\Hub\Editor\*\Editor\Data\PlaybackEngines\AndroidPlayer' | Select-Object -First 1).Path
$env:JAVA_HOME = Join-Path $androidPlayer 'OpenJDK'
$buildTools = Join-Path $androidPlayer 'SDK\build-tools\36.0.0'
$androidJar = Join-Path $androidPlayer 'SDK\platforms\android-36\android.jar'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

if (!$OutputDirectory) { $OutputDirectory = Join-Path $project 'dist' }
$destination = (New-Item -ItemType Directory -Force $OutputDirectory).FullName
$stage = (New-Item -ItemType Directory -Force (Join-Path $project 'work\android-build')).FullName
$classes = (New-Item -ItemType Directory -Force (Join-Path $stage 'classes')).FullName
$keystore = Join-Path $stage 'test.jks'
$apk = Join-Path $destination 'DropZoneSquad.apk'

if (!(Test-Path -LiteralPath $keystore)) {
    if ((Test-Path -LiteralPath $apk) -or (Test-Path -LiteralPath (Join-Path $project 'dist\DropZoneSquad.apk'))) {
        throw "The existing application's signing keystore is missing at $keystore."
    }
    Invoke-BuildTool "$env:JAVA_HOME\bin\keytool.exe" @('-genkeypair', '-keystore', $keystore, '-storepass', 'android', '-keypass', 'android', '-alias', 'prototype', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '3000', '-dname', 'CN=Drop Zone Prototype')
}

Invoke-BuildTool "$env:JAVA_HOME\bin\javac.exe" @('-source', '8', '-target', '8', '-bootclasspath', "$androidJar;$buildTools\core-lambda-stubs.jar", '-d', $classes, "$project\android\ArenaActivity.java")
Invoke-BuildTool "$buildTools\d8.bat" @('--min-api', '26', '--lib', $androidJar, '--output', $stage, "$classes\kr\dropzone\squad\ArenaActivity.class")
Push-Location -LiteralPath $project
try {
    # aapt2's resource scanner on Windows expects a relative path in Unicode workspaces.
    Invoke-BuildTool "$buildTools\aapt2.exe" @('compile', '--dir', 'android/res', '-o', 'work/android-build/resources.zip')
    Invoke-BuildTool "$buildTools\aapt2.exe" @('link', '-I', $androidJar, '--manifest', 'android/AndroidManifest.xml', '-A', 'game', '-o', 'work/android-build/base.apk', 'work/android-build/resources.zip')
} finally {
    Pop-Location
}
Push-Location -LiteralPath $stage
try {
    Invoke-BuildTool "$buildTools\aapt.exe" @('add', 'base.apk', 'classes.dex')
} finally {
    Pop-Location
}
Invoke-BuildTool "$buildTools\zipalign.exe" @('-f', '4', "$stage\base.apk", "$stage\aligned.apk")
Invoke-BuildTool "$buildTools\apksigner.bat" @('sign', '--ks', $keystore, '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', "$stage\signed.apk", "$stage\aligned.apk")
Invoke-BuildTool "$buildTools\apksigner.bat" @('verify', '--verbose', '--print-certs', "$stage\signed.apk")
Push-Location -LiteralPath $stage
try {
    Invoke-BuildTool "$buildTools\aapt.exe" @('dump', 'badging', 'signed.apk')
} finally {
    Pop-Location
}
Copy-Item -LiteralPath "$stage\signed.apk" -Destination $apk -Force
if (Test-Path -LiteralPath "$stage\signed.apk.idsig") {
    Copy-Item -LiteralPath "$stage\signed.apk.idsig" -Destination "$apk.idsig" -Force
}
