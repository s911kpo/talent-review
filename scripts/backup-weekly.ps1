# 由每週排程執行：備份到本機 git 資料夾，結果寫進 backup.log，失敗時跳出提示。
param([string]$BackupDir = 'C:\dev\talent-review-backups')
$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force $BackupDir | Out-Null
$log = Join-Path $BackupDir 'backup.log'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $node = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS*\node-*\node.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not $node) {
  $out = 'node.exe not found'
  $code = 9
} else {
  Set-Location $repo
  # Company laptops send web traffic through the local Zscaler proxy named in the PAC address.
  # Node only uses a proxy when told to, so pass it on; --use-system-ca trusts Zscaler's certificate.
  $pacUrl = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue).AutoConfigURL
  if ($pacUrl -and ([uri]$pacUrl).Host -eq '127.0.0.1') {
    $env:HTTPS_PROXY = "http://127.0.0.1:$(([uri]$pacUrl).Port)"
    $env:NODE_USE_ENV_PROXY = '1'
  }
  # --use-system-ca: trust the company TLS inspection certificate from the Windows store.
  $out = & $node --use-system-ca scripts/backup-remote.mjs --dir $BackupDir 2>&1 | Out-String
  $code = $LASTEXITCODE
}
Add-Content -Path $log -Encoding UTF8 -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') exit $code`r`n$out"

if ($code -ne 0) {
  Add-Type -AssemblyName PresentationFramework
  $msg = if ($code -eq 2) { "備份完成，但資料筆數比上次少一半以上，請確認是否有人誤刪。`n`n詳情：$log" }
         else { "人才盤點每週備份失敗，請把這個檔案的最後幾行給 Claude：`n`n$log" }
  [System.Windows.MessageBox]::Show($msg, 'Talent Review 備份') | Out-Null
}
exit $code
