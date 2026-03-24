Add-Type -AssemblyName System.Drawing

$size = 64
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)

# Shoe colors
$soleColor = [System.Drawing.Color]::FromArgb(40, 40, 40)
$bodyColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
$accentColor = [System.Drawing.Color]::FromArgb(255, 180, 0)
$laceColor = [System.Drawing.Color]::White

$soleBrush = New-Object System.Drawing.SolidBrush($soleColor)
$bodyBrush = New-Object System.Drawing.SolidBrush($bodyColor)
$accentBrush = New-Object System.Drawing.SolidBrush($accentColor)
$lacePen = New-Object System.Drawing.Pen($laceColor, 2)

# Draw sole (bottom)
$solePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$solePath.AddArc(4, 46, 16, 14, 180, 90)    # heel curve
$solePath.AddLine(12, 46, 54, 46)             # bottom
$solePath.AddArc(44, 42, 16, 14, 0, 90)      # toe curve
$solePath.AddLine(60, 50, 60, 56)             # toe front
$solePath.AddLine(60, 56, 4, 56)              # sole bottom
$solePath.CloseFigure()
$g.FillPath($soleBrush, $solePath)

# Draw shoe body
$bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bodyPath.AddArc(4, 20, 20, 30, 180, 90)     # heel back curve
$bodyPath.AddLine(14, 20, 36, 14)             # top back
$bodyPath.AddArc(32, 12, 20, 16, -40, 40)    # tongue area
$bodyPath.AddLine(48, 18, 58, 36)             # toe top slope
$bodyPath.AddArc(46, 36, 16, 14, -20, 70)    # toe front curve
$bodyPath.AddLine(58, 46, 4, 46)              # bottom line
$bodyPath.CloseFigure()
$g.FillPath($bodyBrush, $bodyPath)

# Draw accent stripe
$g.FillRectangle($accentBrush, 10, 34, 44, 4)

# Draw laces
$g.DrawLine($lacePen, 26, 18, 34, 22)
$g.DrawLine($lacePen, 30, 16, 38, 20)
$g.DrawLine($lacePen, 34, 14, 42, 18)

# Draw small swoosh/check
$swooshPen = New-Object System.Drawing.Pen($accentColor, 2.5)
$g.DrawArc($swooshPen, 14, 24, 34, 20, 20, 60)

$g.Dispose()

# Save as .ico
$iconPath = Join-Path $PSScriptRoot "rapido.ico"

# Convert bitmap to icon
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create($iconPath)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$bmp.Dispose()

Write-Host "Icon created: $iconPath"
