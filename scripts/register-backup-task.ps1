# 建立 Windows 排程。電腦當時沒開，下次開機登入後會補做。重新執行會覆蓋同名排程。
#   測試環境：.\scripts\register-backup-task.ps1                     每週五 12:30（TalentReviewWeeklyBackup）
#   正式環境：.\scripts\register-backup-task.ps1 -Target production  每天 12:30（TalentReviewProdDailyBackup）
# 移除：Unregister-ScheduledTask -TaskName '<排程名稱>'
param([string]$Target = 'staging')
$script = Join-Path $PSScriptRoot 'backup-weekly.ps1'
$name = if ($Target -eq 'production') { 'TalentReviewProdDailyBackup' } else { 'TalentReviewWeeklyBackup' }
$shell = (Get-Command pwsh -ErrorAction SilentlyContinue).Source
if (-not $shell) { $shell = (Get-Command powershell).Source }
$action = New-ScheduledTaskAction -Execute $shell `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Target $Target"
$trigger = if ($Target -eq 'production') { New-ScheduledTaskTrigger -Daily -At '12:30' }
           else { New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At '12:30' }
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName $name -Description "Talent Review local backup ($Target)" `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Get-ScheduledTask -TaskName $name | Select-Object TaskName, State
