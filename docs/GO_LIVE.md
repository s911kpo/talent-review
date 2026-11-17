# 上線手冊（正式環境）

最後更新：2026-11-16。上線日：2026-11-20（五）。

## 兩個網址，兩個資料庫

| | 測試網址（維持示範用途） | 正式網址 |
|---|---|---|
| 網址 | https://papaya-madeleine-31cdad.netlify.app（另有 `/demo/` 展示站，Netlify） | https://molex-talent-review.pages.dev（Cloudflare Pages）；備援 https://molex-talent-review.netlify.app（Netlify，同一個資料庫） |
| 資料庫 | Supabase 專案 `cnytmdpvzpezijadohxl`，全部虛構資料 | 新的 Supabase 專案，只放真實資料 |
| 帳號 | 示範主管與示範 HR（帳密在 repo，任何人都可能看到） | 真實主管 PIN、Tim 與 Diana 的 HR 帳號 |
| 畫面標示 | 每頁頂端黃條：「測試環境：請勿填寫真實員工資料」 | 無標示 |
| 指令目標 | 預設 | 指令前加 `TR_TARGET=production` |
| 本機設定檔 | `.env.local` | `.env.production.local`（已建立空白範本，不進 git） |

兩邊用同一份程式碼。Netlify 的每個網站用環境變數 `DEPLOY_TARGET` 決定連哪個資料庫；公開值寫在 `deploy/targets.json`。正式版建置時會檢查：打包檔裡不能出現測試資料庫的網址。

## 主機（2026-11-17 更新）

- 正式網站在 **Cloudflare Pages**：純靜態網站流量不限、免費，每次 push 自動部署（每月 500 次）。設定見 `docs/CLOUDFLARE.md`；退回上一版：Cloudflare 專案 → Deployments → Rollback。
- Netlify 免費方案只剩 30 credits（重置日 12/14），所以 Netlify 只在 commit 訊息含 `[deploy prod]`／`[deploy staging]`／`[deploy all]` 時建置。測試網址留在 Netlify。
- **正式資料庫已有真實資料**：`test:golive`、`test:rehearsal`、`prelaunch-reset` 不要再對正式環境執行（三者都有保護：找不到虛構主管、系統不是空的、出現真實工號時會自動停止）。

## 目前進度（2026-11-17 凌晨）

第 1–3 步已完成：正式 Supabase 專案 `talent-review-prod`、Netlify 正式站、所有驗收（含在正式網站上模擬第 4 步全流程與手機寬度），驗收後已清空。今天從第 4 步開始，簡化版見 `docs/MORNING_TODO.md`。

上線前模擬：`TR_TARGET=production GOLIVE_BASE_URL=<正式網址> npm run test:rehearsal`（系統必須是空的；跑完用 `prelaunch-reset --confirm` 清空）。

## 步驟與負責人

### 1. 建立正式環境帳號資源（Tim，約 10 分鐘）

1. Supabase：New project，名稱例如 `talent-review-prod`，Region 選 **Singapore**，記下 DB 密碼。免費方案可以有 2 個專案。
2. 把 `.env.local` 的 `SUPABASE_ACCESS_TOKEN` 那一行複製到 `.env.production.local`（同一個 Supabase 帳號，可以共用）。或者告訴我「可以複製」，我在本機搬，不會顯示內容。
3. Netlify：Add new site → Import from GitHub → 同一個 repo。Site settings → Environment variables 新增 `DEPLOY_TARGET` = `production`。網站名稱可改成好記的，例如 `molex-talent-review`。
4. 告訴我「正式專案建好了」以及正式網址。

### 2. 架設正式後端（Claude，約 20 分鐘）

```
TR_TARGET=production node scripts/fill-supabase-keys.mjs talent-review-prod
TR_TARGET=production node scripts/apply-migrations.mjs
TR_TARGET=production node scripts/with-env.mjs npx supabase functions deploy auth-pin admin-users --project-ref <ref> --use-api
TR_TARGET=production node scripts/check-auth-config.mjs --apply
```

接著把正式的 URL 和 anon key 填進 `deploy/targets.json` 的 `production`，然後 push。Netlify 正式站會自動建置。

### 3. 正式環境上線前驗收（Claude，用虛構資料，約 30 分鐘）

先在正式資料庫放入假資料與示範帳號，跑完整驗收，再全部清空。

```
TR_TARGET=production node scripts/apply-migrations.mjs --seed --prelaunch-test
TR_TARGET=production node scripts/provision-demo-users.mjs --prelaunch-test
TR_TARGET=production node scripts/verify-remote.mjs
TR_TARGET=production GOLIVE_BASE_URL=<正式網址> npm run test:golive
TR_TARGET=production npm run test:resilience
TR_TARGET=production node scripts/prelaunch-reset.mjs            （先看會刪什麼）
TR_TARGET=production node scripts/prelaunch-reset.mjs --confirm  （清空並確認是 0）
```

`prelaunch-reset` 只要發現任何不在虛構範圍（900001–900999）的工號就會停止，所以不可能刪到真實資料。題庫與下拉選項會保留。

### 4. 放入真實資料（Tim 與 Diana，真實資料不經過 Claude、不進 repo）

1. 在自己的終端機建立第一個 HR 帳號，密碼只會顯示在你的螢幕一次：
   `TR_TARGET=production node scripts/create-first-hr.mjs --email <你的 Email> --name "<姓名>" --employee-id <你的工號>`
2. 用 HR 帳號登入正式網址 → 後台 → 週期管理：建立 `Q4 2026`，設定截止日，開啟。
3. 名單上傳：上傳 Namelist xlsx，檢查差異預覽，確認寫入。
4. 帳號：建立所有主管帳號 → 下載 PIN 清單（明碼只能下載一次）。在後台為 Diana 建立 HR 帳號（填她的工號）。
5. 用「以主管身分預覽」抽看 2 位主管的畫面；找一位主管實際登入，填一位員工的一題，確認「已儲存」。
6. 匯出一次 Excel，用真正的 Excel 打開：沒有修復提示、下拉選單可用。

### 5. 上線當天（11/20）

- 寄出 PIN（每位主管只收到自己的）、正式網址、兩支影片（見 `video-build/release/版本紀錄.md`）。
- 提醒主管：測試網址上有黃條，那裡填的內容不算數。

### 6. 上線後

- 備份：`.\scripts\register-backup-task.ps1 -Target production`，盤點期間每天 12:30 備份到 `C:\dev\talent-review-backups-prod`（只在本機，不加 remote、不放 OneDrive）。
- 防暫停：GitHub Actions 每週一、四會自動呼叫 `deploy/targets.json` 裡的每個資料庫。
- 每週一早上看 HR 後台「總覽」的進度。

## 資料保存與匯出：已驗證的項目

`npm run test:golive`（`tests/golive/golive.spec.ts`）連真實資料庫，以虛構主管 900003 跑完整流程，跑完自動清除：

| 檢查 | 怎麼驗證 |
|---|---|
| 12 題全部存進資料庫 | 兩位員工、每題都填，含第 2 筆核心價值、發展領域、下一職務、接班人與發展計畫。用 service key 直接讀資料庫逐欄比對 |
| 換一台電腦重新登入 | 全新瀏覽器登入，摘要與各題內容都在 |
| 打字後 1.5 秒內關掉分頁 | 瀏覽器先跳出「離開網站？」；內容暫存在這台裝置，重開後自動送出並寫入資料庫 |
| 資料品質提醒 | 關鍵職位只有 TBH 時出現提醒，未勾「我已確認」不能提交 |
| 主管匯出草稿 | 標題列註明 DRAFT |
| HR 確認後匯出給 Diana | 工作表名稱與順序、第 3 列 19 個表頭與公司範本逐字相同、每位員工 19 欄逐格比對、儲存格沒有換行或 Tab、下拉選單重建、Development Plan 每項一列（具體行動保留換行）、Key Talent List 狀態為 confirmed |

刻意放進答案的特殊字元：換行、Tab、雙引號、逗號、`&`、前後空白、中英混排。

其他相關測試：`npm run test:resilience`（斷線、伺服器錯誤、另一台裝置同時修改、逾時、被鎖定）、`npm test`（權限、匯出單元測試）、`npx playwright test`（完整流程與無障礙）。

## 目前沒有的功能

- **Email 或 Teams 提醒**：系統沒有自動寄信。現有的提醒是畫面內的：首頁截止日與剩餘天數、提交前的資料品質提醒、HR 後台的進度表。催繳需要 HR 依進度表手動發送。
