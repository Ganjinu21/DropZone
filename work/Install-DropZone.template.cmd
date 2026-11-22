@echo off
setlocal
chcp 65001 >nul
set "DZS_INSTALLER_SOURCE=%~f0"
set "DZS_INSTALL_DIR=%~dp0"
powershell.exe -NoLogo -NoProfile -Command "$text = [IO.File]::ReadAllText($env:DZS_INSTALLER_SOURCE); $body = [regex]::Split($text, '(?m)^#--POWERSHELL--\r?$')[-1]; & ([scriptblock]::Create($body))"
set "DZS_RESULT=%errorlevel%"
echo(
echo 키를 누르면 창을 닫습니다.
pause >nul
exit /b %DZS_RESULT%
#--POWERSHELL--
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$expectedCode = '__VERSION_CODE__'
$expectedVersion = '__VERSION_NAME__'
$package = 'kr.dropzone.squad'

function Run-Adb([string[]] $Arguments) {
    $previous = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $lines = @(& $adb @Arguments 2>&1 | ForEach-Object { "$_" })
        $status = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($status -ne 0) {
        throw ($lines -join [Environment]::NewLine)
    }
    return $lines
}

function Get-Phones {
    foreach ($line in (Run-Adb @('devices','-l'))) {
        if ($line -match '^(\S+)\s+(device|offline|unauthorized)\b') {
            $id = $Matches[1]
            $state = $Matches[2]
            if ($id -notmatch '^emulator-') {
                [pscustomobject]@{Serial=$id; State=$state}
            }
        }
    }
}

try {
    Write-Host "Drop Zone Squad $expectedVersion | Android 설치"
    $apk = Join-Path $env:DZS_INSTALL_DIR 'DropZoneSquad.apk'
    if (!(Test-Path -LiteralPath $apk -PathType Leaf)) {
        throw 'ZIP을 먼저 모두 압축 해제하고, APK와 이 설치 파일을 같은 폴더에 두세요.'
    }

    $adbPaths = @()
    if ($env:ANDROID_SDK_ROOT) { $adbPaths += Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe' }
    if ($env:ANDROID_HOME) { $adbPaths += Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }
    $adbPaths += 'C:\Android\platform-tools\adb.exe'
    $adbPaths += Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
    $onPath = Get-Command adb.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($onPath) { $adbPaths += $onPath.Source }
    $adb = $adbPaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (!$adb) { throw 'PC에서 Android SDK Platform-Tools를 찾지 못했습니다. 휴대폰에 DropZoneSquad.apk를 복사한 후 내 파일 앱에서 열어 설치할 수 있습니다.' }

    $phones = @(Get-Phones)
    $multipleMessage = '연결된 Android 기기가 여러 대입니다. 설치할 휴대폰 하나만 연결해 주세요. 같은 휴대폰이 Wi-Fi로도 연결됐다면 무선 디버깅을 끄고 다시 실행하세요.'
    if ($phones.Count -eq 1 -and $phones[0].State -eq 'unauthorized') {
        $waitingFor = $phones[0].Serial
        Write-Host '휴대폰 잠금을 풀고 USB 디버깅 허용 창에서 허용을 누르세요. 45초 동안 기다리며, 승인하면 바로 설치합니다.'
        $timer = [Diagnostics.Stopwatch]::StartNew()
        do {
            Start-Sleep -Seconds 1
            $phones = @(Get-Phones)
            if ($phones.Count -gt 1) { throw $multipleMessage }
            if ($phones.Count -eq 1 -and $phones[0].Serial -ne $waitingFor) {
                throw '대기 중 연결된 기기가 바뀌었습니다. 설치할 휴대폰만 연결한 뒤 다시 실행하세요.'
            }
            if ($phones.Count -eq 1 -and $phones[0].State -eq 'device') { break }
        } while ($timer.Elapsed.TotalSeconds -lt 45)
        if ($phones.Count -ne 1 -or $phones[0].State -ne 'device') {
            throw '45초 안에 USB 디버깅 승인이 확인되지 않았습니다. 휴대폰에서 연결을 허용한 뒤 다시 실행하세요.'
        }
    }
    $authorized = @()
    $awaitingAuth = $false
    $offline = $false
    foreach ($phone in $phones) {
        $serial = $phone.Serial
        $state = $phone.State
        if ($state -eq 'unauthorized') { $awaitingAuth = $true; continue }
        if ($state -eq 'offline') { $offline = $true; continue }
        $emulated = (Run-Adb @('-s',$serial,'shell','getprop','ro.kernel.qemu')) -join ''
        if ($emulated.Trim() -eq '1') { continue }
        $authorized += $serial
    }
    if (!$authorized.Count) {
        if ($awaitingAuth -and $phones.Count -gt 1) { throw $multipleMessage }
        if ($offline) { throw '휴대폰 연결이 오프라인입니다. 데이터 케이블을 다시 연결하고 휴대폰 잠금을 푼 후 다시 실행하세요.' }
        throw '연결된 Android 휴대폰을 찾지 못했습니다. USB 데이터 케이블로 PC에 연결하고 휴대폰 개발자 옵션에서 USB 디버깅을 켜세요.'
    }
    if ($authorized.Count -gt 1) { throw $multipleMessage }
    $serial = $authorized[0]
    $model = ((Run-Adb @('-s',$serial,'shell','getprop','ro.product.model')) -join '').Trim()
    Write-Host "연결 기기  $model"
    Write-Host '설치하는 중… 휴대폰에 설치 확인 창이 나타나면 승인해 주세요.'
    Push-Location -LiteralPath $env:DZS_INSTALL_DIR
    try { $result = @(Run-Adb @('-s',$serial,'install','-r','DropZoneSquad.apk')) } finally { Pop-Location }
    if (!($result -match '^Success\s*$')) { throw ($result -join [Environment]::NewLine) }
    $details = (Run-Adb @('-s',$serial,'shell','dumpsys','package',$package)) -join [Environment]::NewLine
    $codePattern = '(?m)^\s*versionCode=' + [regex]::Escape($expectedCode) + '(?:\s|$)'
    $versionPattern = '(?m)^\s*versionName=' + [regex]::Escape($expectedVersion) + '\s*$'
    if ($details -notmatch $codePattern -or $details -notmatch $versionPattern) {
        throw "설치 명령이 완료됐지만 휴대폰에서 버전 $expectedVersion 확인에 실패했습니다. 앱 정보에서 버전을 확인하세요."
    }
    Write-Host "설치 확인  $expectedVersion (빌드 $expectedCode)"
    $launched = @(Run-Adb @('-s',$serial,'shell','am','start','-W','-n',"$package/.ArenaActivity"))
    if (!($launched -match '^\s*Status:\s*ok\s*$')) { throw ("휴대폰에 설치됐습니다. 홈 화면에서 Drop Zone Squad를 열어 주세요." + [Environment]::NewLine + ($launched -join [Environment]::NewLine)) }
    Write-Host "실행 확인  $model" -ForegroundColor Green
    exit 0
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    if ($_.Exception.Message -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE|INSTALL_FAILED_VERSION_DOWNGRADE') {
        Write-Host '기존 앱의 서명 또는 버전이 달라 업데이트할 수 없습니다. 기존 게임 기록을 보호하기 위해 설치를 중단했습니다.'
    } elseif ($_.Exception.Message -match 'INSTALL_FAILED_USER_RESTRICTED|INSTALL_CANCELED_BY_USER') {
        Write-Host '휴대폰의 설치 승인 화면과 설치 제한 설정을 확인한 뒤 다시 실행하세요.'
    } elseif ($_.Exception.Message -match 'cannot connect to daemon|failed to start daemon') {
        Write-Host 'PC에서 Android 연결 서비스를 시작하지 못했습니다. 휴대폰으로 APK를 내려받아 내 파일 앱에서 열 수도 있습니다.'
    }
    exit 1
}
