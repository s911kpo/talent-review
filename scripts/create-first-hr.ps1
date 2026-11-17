# 雙擊「建立HR帳號.cmd」執行：問你的 Email 與姓名，在正式環境建立第一個 HR 帳號。
# 密碼只顯示在這個視窗一次，不會寫進任何檔案，也不會經過 Claude。
param([string]$DefaultEmail = '')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $node = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS*\node-*\node.exe" -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $node) { Write-Host '找不到 Node，請把這個視窗截圖給 Claude。' -ForegroundColor Red; Read-Host '按 Enter 關閉'; exit 1 }

# Company laptops send web traffic through the local Zscaler proxy (same as the backup task).
$pacUrl = (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue).AutoConfigURL
if ($pacUrl -and ([uri]$pacUrl).Host -eq '127.0.0.1') {
  $env:HTTPS_PROXY = "http://127.0.0.1:$(([uri]$pacUrl).Port)"
  $env:NODE_USE_ENV_PROXY = '1'
}
$env:TR_TARGET = 'production'

Write-Host ''
Write-Host '建立正式環境的 HR 帳號' -ForegroundColor Cyan
Write-Host '----------------------------------------'
$prompt = if ($DefaultEmail) { "你的公司 Email（登入用，直接按 Enter 會用 $DefaultEmail）" } else { '你的公司 Email（登入用）' }
$email = (Read-Host $prompt).Trim()
if (-not $email) { $email = $DefaultEmail }
$name = (Read-Host '顯示名稱（例如 Tim Huang）').Trim()
$emp = (Read-Host '你的工號（不在名單內就直接按 Enter）').Trim()
if (-not $email -or -not $name) { Write-Host 'Email 與姓名都要填。' -ForegroundColor Red; Read-Host '按 Enter 關閉'; exit 1 }

$nodeArgs = @('--use-system-ca', 'scripts/create-first-hr.mjs', '--email', $email, '--name', $name)
if ($emp) { $nodeArgs += @('--employee-id', $emp) }
Write-Host ''
& $node @nodeArgs
if ($LASTEXITCODE -eq 0) {
  Write-Host ''
  Write-Host '請立刻把上面的密碼存進密碼管理器（或抄下來），關閉視窗後就看不到了。' -ForegroundColor Yellow
  Write-Host '登入網址：https://molex-talent-review.pages.dev/hr/login' -ForegroundColor Green
} else {
  Write-Host '建立失敗，請把這個視窗截圖給 Claude（截圖前先遮住 Email 也可以）。' -ForegroundColor Red
}
Read-Host '按 Enter 關閉'
