param(
    [string] $ApkPath,
    [string] $OutputDirectory
)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
if (!$ApkPath) { $ApkPath = Join-Path $project 'dist/DropZoneSquad.apk' }
if (!$OutputDirectory) { $OutputDirectory = Join-Path $project 'dist' }
$apk = (Get-Item -LiteralPath $ApkPath).FullName
$output = (New-Item -Type Directory -Force $OutputDirectory).FullName
$aapt = (Get-Item 'C:/Program Files/Unity/Hub/Editor/*/Editor/Data/PlaybackEngines/AndroidPlayer/SDK/build-tools/*/aapt.exe' | Select-Object -Last 1).FullName
Push-Location -LiteralPath (Split-Path -Parent $apk)
try {
    $package = (& $aapt dump badging ([IO.Path]::GetFileName($apk)) | Select-String '^package:' | Select-Object -First 1).Line
} finally { Pop-Location }
if ($package -notmatch "^package: name='kr\.dropzone\.squad' versionCode='(\d+)' versionName='([0-9.]+)'") { throw 'Unexpected APK package or version.' }
$code = $Matches[1]
$version = $Matches[2]
$template = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Install-DropZone.template.cmd'))
$script = $template.Replace('__VERSION_CODE__',$code).Replace('__VERSION_NAME__',$version) -replace '\r?\n',"`r`n"
$utf8 = [Text.UTF8Encoding]::new($false)
$name = "DropZoneSquad-Android-v$version.zip"
$destination = Join-Path $output $name
$temporary = "$destination.partial"
Add-Type -AssemblyName System.IO.Compression,System.IO.Compression.FileSystem
$stream = [IO.File]::Open($temporary, [IO.FileMode]::Create)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$true)
    try {
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$apk,'DropZoneSquad.apk',[IO.Compression.CompressionLevel]::NoCompression)
        $entry = $archive.CreateEntry('Install-DropZone.cmd')
        $writer = [IO.StreamWriter]::new($entry.Open(),$utf8)
        try { $writer.Write($script) } finally { $writer.Dispose() }
        $projectFiles = @(Get-ChildItem -LiteralPath (Join-Path $project 'game'), (Join-Path $project 'android') -File -Recurse)
        foreach ($buildFile in @('build.ps1','package-usb.ps1','Install-DropZone.template.cmd','build-streets.py','export-map-assets.py','build-roof-damage.py','build-city-kit.py','build-transit-kit.py','build-ground-kit.py','build-street-fixtures.py','pavement.png')) {
            $projectFiles += Get-Item -LiteralPath (Join-Path $PSScriptRoot $buildFile)
        }
        foreach ($projectFile in $projectFiles) {
            $relativeName = $projectFile.FullName.Substring($project.Length + 1).Replace('\','/')
            [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $projectFile.FullName, "project/$relativeName", [IO.Compression.CompressionLevel]::Optimal)
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($temporary)
try {
    if ($check.GetEntry('DropZoneSquad.apk').Length -ne (Get-Item $apk).Length -or !$check.GetEntry('Install-DropZone.cmd')) { throw 'Package verification failed.' }
} finally { $check.Dispose() }
Move-Item -LiteralPath $temporary -Destination $destination -Force
[IO.File]::WriteAllText((Join-Path $output 'Install-DropZone.cmd'),$script,$utf8)
Write-Output "$destination (Android $version, build $code)"
