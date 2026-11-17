# 11/17 早上待辦（Tim，約 20 分鐘）

半夜已在**正式網址**用虛構資料完整模擬過你今天要做的每一步，全部通過，之後已清空。今天你只要照下面做，放入真實資料。

- 正式網址：https://molex-talent-review.netlify.app
- HR 登入：https://molex-talent-review.netlify.app/hr/login
- 測試網址（維持示範，頂端有黃條）：https://papaya-madeleine-31cdad.netlify.app

## 1. 建立你的 HR 帳號（2 分鐘）

在檔案總管雙擊 `C:\dev\talent-review\建立HR帳號.cmd`。跳出的黑色視窗會依序問：

1. 公司 Email（登入用）
2. 顯示名稱
3. 工號：不在名單內就直接按 Enter

接著畫面會出現一次 `Password ...: xxxxxxxx`，**立刻存進密碼管理器或抄下來**，關掉視窗就看不到了。密碼不會存成檔案，也不會經過 Claude。

## 2. 用 HR 帳號登入，建立週期（2 分鐘）

左側「系統設定」→「週期管理」：

| 欄位 | 填 |
|---|---|
| 週期代碼 | `Q4-2026` |
| 季度標籤 | `Q4 2026`（會寫進 Excel A 欄，要和範本一致） |
| 截止日 | 正式截止日 |

按「建立週期」，再按該列的「開啟」，狀態變成「進行中」。

## 3. 上傳名單（3 分鐘）

「名單上傳」→ 選 Namelist xlsx。畫面會顯示「共 N 人，盤點範圍 N 人，Supervisor N 位」：

- 有「必須修正」：照列號修 Excel，再上傳一次。
- 只有「提醒」：看過即可。
- 數字對了，按「確認寫入」。

生日月份會在你的電腦上就被丟掉，不會上傳。

## 4. 產生 PIN、建立 Diana 的帳號（5 分鐘）

「帳號與 PIN」：

1. 勾「全選 Supervisor」→「建立或重設 PIN」→「下載 PIN 清單」。**只能下載一次**，存在只有你能開的地方，不要放 OneDrive 共用資料夾。
2. 下方「HR 帳號」：填 Diana 的 Email、姓名、**她的工號**（她也在名單內，填了才看不到自己被評的那一筆）→「建立 HR 帳號」。畫面顯示的密碼私下交給她，按「我已確認」。

## 5. 抽查（5 分鐘）

1. 「以 Supervisor 身分預覽」選 1–2 位主管，看名單對不對。
2. 用**真正的 Excel** 打開 `C:\dev\talent-review\playwright-report\golive\Excel驗收樣本_虛構資料.xlsx`（昨晚在正式網站匯出的檔案，虛構資料）：不跳修復提示、Planning Tool 的下拉選單可以用。這是目前唯一還沒驗證的項目。剛上傳名單時還沒有人填寫，正式匯出要等主管提交後。

## 6. 開啟正式環境每日備份（1 分鐘，建議）

```powershell
.\scripts\register-backup-task.ps1 -Target production
```

盤點期間每天 12:30 備份到 `C:\dev\talent-review-backups-prod`（只在這台電腦）。半夜已手動跑過一次，成功。

## 11/20 發送

- 每位主管一封：自己的工號＋PIN＋正式網址（PIN 清單一人一行，不要整份寄出）。
- 影片：`C:\dev\talent-review\video-build\release\`
  - 宣傳：`上線宣傳影片\TalentReview_宣傳影片_v3_激勵配樂_41s.mp4`
  - 操作指南：`主管操作指南\TalentReview_主管操作指南_v2_章節版_3m20s.mp4`（上傳 Stream 後照 `Stream章節清單.txt` 設章節）
- 提醒主管：測試網址有黃條，那裡填的不算數。

## 遇到問題

把畫面截圖或錯誤訊息給 Claude。真實姓名、PIN、密碼不要貼進對話。
