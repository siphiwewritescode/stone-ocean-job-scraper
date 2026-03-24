$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopPath = [System.Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Stone Ocean.lnk"
$targetPath = Join-Path $scriptDir "run_job_search.bat"
$iconPath = Join-Path $scriptDir "rapido.ico"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $scriptDir
$shortcut.IconLocation = "$iconPath, 0"
$shortcut.Description = "Rapido - Stone Ocean"
$shortcut.WindowStyle = 7  # Minimized
$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath"
