# Run this before every commit that changes anything in css/ or js/. It gives those files a new version number in index.html,
# so phones fetch the new files instead of using a copy they cached earlier. (index.html itself is not versioned.)
$p = Join-Path $PSScriptRoot 'index.html'
$v = Get-Date -Format 'yyyyMMddHHmmss'
$t = [System.IO.File]::ReadAllText($p)
$t = [regex]::Replace($t, '\?v=[0-9a-z]+', '?v=' + $v)
[System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding($false)))
"Stamped version $v"