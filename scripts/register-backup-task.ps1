# 建立 Windows 排程：每週五 12:30 備份。電腦當時沒開，下次開機登入後會補做。
# 重新執行會覆蓋同名排程；移除：Unregister-ScheduledTask -TaskName 'TalentReviewWeeklyBackup'
$script = Join-Path $PSScriptRoot 'backup-weekly.ps1'
$shell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $shell) { $shell = (Get-Command powershell).Source }
$action = New-ScheduledTaskAction -Execute $shell `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At '12:30'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName 'TalentReviewWeeklyBackup' -Description 'Talent Review weekly local backup' `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Get-ScheduledTask -TaskName 'TalentReviewWeeklyBackup' | Select-Object TaskName, State
