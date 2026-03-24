Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconPath    = Join-Path $scriptDir "stone_ocean.ico"
$progressLog = Join-Path $scriptDir "search_progress.log"
$statusFile  = Join-Path $scriptDir "status.txt"
$INTERVAL_MS = 30 * 60 * 1000  # 30 minutes in milliseconds

#  System Tray Setup 
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Text = "Rapido - Stone Ocean"
$notifyIcon.Visible = $true

if (Test-Path $iconPath) {
    $notifyIcon.Icon = New-Object System.Drawing.Icon($iconPath)
} else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

#  Context Menu 
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

$menuStatus = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStatus.Text = "Status: Starting..."
$menuStatus.Enabled = $false
$contextMenu.Items.Add($menuStatus) | Out-Null

$menuNextRun = New-Object System.Windows.Forms.ToolStripMenuItem
$menuNextRun.Text = "Next run: --"
$menuNextRun.Enabled = $false
$contextMenu.Items.Add($menuNextRun) | Out-Null

$contextMenu.Items.Add("-") | Out-Null

$menuRunNow = New-Object System.Windows.Forms.ToolStripMenuItem
$menuRunNow.Text = "Run Now"
$menuRunNow.Add_Click({
    if (-not $script:nodeProcess -or $script:nodeProcess.HasExited) {
        $script:forceRun = $true
    }
})
$contextMenu.Items.Add($menuRunNow) | Out-Null

$menuViewLog = New-Object System.Windows.Forms.ToolStripMenuItem
$menuViewLog.Text = "View Progress Log"
$menuViewLog.Add_Click({
    if (Test-Path $progressLog) {
        Start-Process notepad.exe $progressLog
    } else {
        [System.Windows.Forms.MessageBox]::Show("No progress log yet.", "Stone Ocean")
    }
})
$contextMenu.Items.Add($menuViewLog) | Out-Null

$menuViewJson = New-Object System.Windows.Forms.ToolStripMenuItem
$menuViewJson.Text = "Open Today's Data"
$menuViewJson.Add_Click({
    $todayStr = (Get-Date).ToString("yyyy-MM-dd")
    $jf = Join-Path $scriptDir "sa_data_jobs_$todayStr.json"
    if (Test-Path $jf) {
        Start-Process notepad.exe $jf
    } else {
        [System.Windows.Forms.MessageBox]::Show("No data found for today yet.", "Stone Ocean")
    }
})
$contextMenu.Items.Add($menuViewJson) | Out-Null

$menuOpenFolder = New-Object System.Windows.Forms.ToolStripMenuItem
$menuOpenFolder.Text = "Open Folder"
$menuOpenFolder.Add_Click({
    Start-Process explorer.exe $scriptDir
})
$contextMenu.Items.Add($menuOpenFolder) | Out-Null

$contextMenu.Items.Add("-") | Out-Null

$menuExit = New-Object System.Windows.Forms.ToolStripMenuItem
$menuExit.Text = "Exit"
$menuExit.Add_Click({
    $script:exitRequested = $true
    if ($script:nodeProcess -and -not $script:nodeProcess.HasExited) {
        $script:nodeProcess.Kill()
    }
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$contextMenu.Items.Add($menuExit) | Out-Null

$notifyIcon.ContextMenuStrip = $contextMenu

#  Show startup balloon 
$notifyIcon.BalloonTipTitle = "Rapido - Stone Ocean"
$notifyIcon.BalloonTipText = "Stone Ocean started. Runs every 30 minutes."
$notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notifyIcon.ShowBalloonTip(3000)

#  State 
$script:exitRequested = $false
$script:nodeProcess = $null
$script:forceRun = $false
$script:runCount = 0
$script:lastStatus = ""
$script:nextRunTime = $null

#  Helper: Start a search run 
function Start-SearchRun {
    $script:runCount++

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node"
    $psi.Arguments = "`"$(Join-Path $scriptDir 'job_search.js')`""
    $psi.WorkingDirectory = $scriptDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError = $false

    # Pass environment variable
    $envPass = [System.Environment]::GetEnvironmentVariable("GMAIL_APP_PASSWORD", "User")
    if ($envPass) {
        $psi.EnvironmentVariables["GMAIL_APP_PASSWORD"] = $envPass
    }

    $script:nodeProcess = [System.Diagnostics.Process]::Start($psi)
    $script:nextRunTime = $null
    $menuRunNow.Enabled = $false

    $notifyIcon.BalloonTipTitle = "Stone Ocean - Run #$($script:runCount)"
    $notifyIcon.BalloonTipText = "Stone Ocean started..."
    $notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
    $notifyIcon.ShowBalloonTip(2000)
}

#  Start first run immediately 
Start-SearchRun

#  Timer to poll status + schedule next run 
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000  # Check every 2 seconds

$timer.Add_Tick({
    if ($script:exitRequested) { return }

    # Update status from status.txt
    if (Test-Path $statusFile) {
        try {
            $currentStatus = (Get-Content $statusFile -Raw -ErrorAction SilentlyContinue).Trim()
            if ($currentStatus -and $currentStatus -ne $script:lastStatus) {
                $script:lastStatus = $currentStatus
                $menuStatus.Text = "Status: $currentStatus"
                $truncated = $currentStatus.Substring(0, [Math]::Min(60, $currentStatus.Length))
                $notifyIcon.Text = "Stone Ocean: $truncated"

                # Show balloon for key milestones
                if ($currentStatus -match "NEW jobs added") {
                    $notifyIcon.BalloonTipTitle = "Stone Ocean - Found!"
                    $notifyIcon.BalloonTipText = $currentStatus
                    $notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
                    $notifyIcon.ShowBalloonTip(5000)
                }
                elseif ($currentStatus -match "Email sent") {
                    $notifyIcon.BalloonTipTitle = "Stone Ocean - Sent"
                    $notifyIcon.BalloonTipText = $currentStatus
                    $notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
                    $notifyIcon.ShowBalloonTip(3000)
                }
                elseif ($currentStatus -match "DONE") {
                    $notifyIcon.BalloonTipTitle = "Stone Ocean - Complete"
                    $notifyIcon.BalloonTipText = "Run #$($script:runCount) complete. Next in 30 min."
                    $notifyIcon.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
                    $notifyIcon.ShowBalloonTip(5000)
                }
            }
        } catch {}
    }

    # Check if node process finished  schedule next run
    if ($script:nodeProcess -and $script:nodeProcess.HasExited -and -not $script:nextRunTime) {
        $script:nextRunTime = (Get-Date).AddMilliseconds($INTERVAL_MS)
        $menuRunNow.Enabled = $true
        $menuStatus.Text = "Status: Idle - waiting for next run"
        $notifyIcon.Text = "Stone Ocean: Idle"
    }

    # Update countdown in menu
    if ($script:nextRunTime) {
        $remaining = $script:nextRunTime - (Get-Date)
        if ($remaining.TotalSeconds -gt 0) {
            $mins = [Math]::Floor($remaining.TotalMinutes)
            $secs = [Math]::Floor($remaining.TotalSeconds % 60)
            $menuNextRun.Text = "Next run: ${mins}m ${secs}s"
        }
    }

    # Force run requested from menu
    if ($script:forceRun) {
        $script:forceRun = $false
        $script:nextRunTime = $null
        Start-SearchRun
        return
    }

    # Time for next scheduled run
    if ($script:nextRunTime -and (Get-Date) -ge $script:nextRunTime) {
        $script:nextRunTime = $null
        Start-SearchRun
    }
})
$timer.Start()

#  Run message loop (keeps tray icon alive) 
[System.Windows.Forms.Application]::Run()
