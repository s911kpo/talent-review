# Saves the Supabase access token and database password into .env.local. No network access.
# Claude then fills the remaining keys with scripts/fill-supabase-keys.mjs.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env.local'
$title = 'Talent Review 設定'

function Show([string]$text, [string]$icon = 'Information') {
  [System.Windows.Forms.MessageBox]::Show($text, $title, 'OK', $icon) | Out-Null
}

function Set-EnvValue([string]$name, [string]$value) {
  $lines = [IO.File]::ReadAllLines($envFile)
  $found = $false
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "^$name=") { $lines[$i] = "$name=$value"; $found = $true }
  }
  if (-not $found) { $lines += "$name=$value" }
  [IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding $false))
}

try {
  $token = [Microsoft.VisualBasic.Interaction]::InputBox(
    "第 1 項：Supabase Access Token`n`n在 Supabase 網頁點左下頭像 → Account preferences → Access Tokens → Generate new token。權限請選可以寫入的（不要選 Read-only），按 Copy 後貼到下面。",
    $title, '').Trim()
  if (-not $token) { Show '沒有貼上 Token，已取消。' 'Warning'; exit 1 }
  if ($token -notmatch '^sbp_') { Show "這看起來不像 Access Token（應該以 sbp_ 開頭）。`n請重新複製後再執行一次。" 'Warning'; exit 1 }
  Set-EnvValue 'SUPABASE_ACCESS_TOKEN' $token

  $password = [Microsoft.VisualBasic.Interaction]::InputBox(
    "第 2 項：資料庫密碼`n`n先前已經存過的話，直接按確定略過，會保留原本那組。",
    $title, '').Trim()
  if ($password) { Set-EnvValue 'SUPABASE_DB_PASSWORD' $password }

  $done = if ($password) { 'Token 與資料庫密碼都已存好。' } else { 'Token 已存好，資料庫密碼略過。' }
  Show "$done`n`n回到 Claude 說「好了」，其餘的金鑰由 Claude 接手。"
} catch {
  Show "發生錯誤：$($_.Exception.Message)`n`n請把這個畫面告訴 Claude。" 'Error'
  exit 1
}
