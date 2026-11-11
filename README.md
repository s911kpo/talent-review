# Talent Review

Molex 新店廠區的線上人才盤點系統：主管以一次一題的方式完成關鍵人才盤點與發展計畫，HR 追蹤進度、審核、匯出，並有戰略儀表板。

規格見 `docs/SPEC.md`，進度見 `docs/CHANGELOG.md`，未定義細節的決定見 `docs/DECISIONS.md`。

## 快速開始

```
npm install
npm run demo      # 全部虛構資料，不需要任何金鑰
npm test          # 單元與 RLS 測試
npx playwright test   # E2E（375 與 1440 兩種寬度）
```

## 示範站（給主管與 Diana 看）

- 網址：`https://papaya-madeleine-31cdad.netlify.app/demo/`
- 600 位虛構員工，所有評核已填好。登入頁有一鍵進入 HR、廠長、部門主管、課級主管。
- 資料只存在瀏覽器裡，頁面頂端的「重設示範資料」可以回到初始狀態。
- 本機：`npm run demo:showcase`（600 人）或 `npx vite --mode stress`（5,000 人）

## 測試

| 指令 | 內容 | 時間 |
|---|---|---|
| `npm test` | 單元、權限（RLS）、匯出驗收 | 約 10 秒 |
| `npx playwright test` | 主管與 HR 完整流程、無障礙，375 與 1440 寬度 | 約 40 秒 |
| `npm run test:stress` | 資料庫與儀表板計算，5,000 人 | 約 1 分鐘 |
| `npm run test:stress:ui` | 5,000 人的畫面操作 | 約 30 秒 |
| `npm run test:resilience` | 8 種報錯情境，連到 Supabase | 約 1 分鐘 |
| `node scripts/load-remote.mjs` | 11 位主管同時存檔，連到 Supabase | 約 10 秒 |

最近一次結果：`docs/TEST_REPORT_SCALE.md`。

## 部署

1. 在 `.env.local` 填入 Supabase 與 Anthropic 的值。
2. `npx supabase login`，`npx supabase link --project-ref <ref>`
3. `npm run db:push`。Staging 才加 `--include-seed` 放假資料，正式環境不要。
4. 部署函式：`npx supabase functions deploy auth-pin admin-users ai-generate`
5. 設定函式的 secrets：`npx supabase secrets set ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=...`
6. Netlify 連 GitHub repo，環境變數設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。**不要設定 `VITE_DATA_MODE`。** 要開放 AI 時再加 `VITE_AI_ENABLED=true`，未設定時 AI 選單隱藏。
7. 上線前 `npm run demo:remove` 移除示範帳號。

修改題庫來源或提示詞後：`node scripts/gen-question-bank.mjs`、`npm run prompts:gen`。範本更新後：`node scripts/sanitize-template.mjs`。

## 測試涵蓋範圍

| 項目 | 怎麼驗證 |
|---|---|
| 權限隔離（SPEC §0.1） | `tests/rls`，在 PGlite（真實 Postgres）跑實際 migrations |
| 匯出對齊（§0.2） | `tests/unit/export.test.ts`，對照原始範本 |
| 不強制分配、無 placeholder、無 emoji、不存生日月份（§0.3–0.7） | `tests/unit/guardrails.test.ts` 掃描原始碼 |
| 主管與 HR 完整流程 | `tests/e2e`，跑在示範資料模式 |
| 無障礙 WCAG 2.1 AA | `tests/e2e/a11y.spec.ts`（axe） |

## 已知風險（Tim 已知悉，SPEC §16）

1. **系統掛在個人帳號**（Supabase、Netlify、Anthropic）。人員異動時有交接與資料歸屬風險，移轉步驟如下。
2. **AI 會傳送含姓名的盤點內容到 Anthropic API**，前提是 IT 核准。
3. **Supabase 免費方案閒置 7 天會暫停專案，且沒有自動備份**。已用 GitHub 排程防暫停、本機每週備份降低風險，見「免費方案的防護」。
4. 主管 PIN 的鎖定由 `auth-pin` 執行，但持有 anon key 的人仍可直接呼叫 Supabase Auth 而繞過這層。8 碼 PIN 有約 8.5 兆種組合，且 Supabase 另有速率限制，風險可接受；改用 SSO 後即消除。

## 免費方案的防護

### 防暫停
- `.github/workflows/keep-supabase-awake.yml` 每週一、四 09:00（台灣時間）呼叫 `keep_alive()`。這個函式只回傳時間，不含任何資料。
- 執行失敗時，GitHub 會寄信給 repo 擁有者。要手動執行：GitHub repo → Actions → Keep Supabase awake → Run workflow。
- 已知限制：repo 連續 60 天沒有 commit，GitHub 會停用排程並寄信通知。到同一頁按 Enable workflow 即可恢復。
- 萬一專案還是暫停了：到 Supabase Dashboard 按 Restore project，資料不會遺失。

### 本機每週備份（含版本控制）
- 每週五 12:30 由 Windows 排程 `TalentReviewWeeklyBackup` 執行。當時電腦沒開，下次登入時會補做。
- 備份位置是 `C:\dev\talent-review-backups`，這是本機的獨立 git repo。每次備份是一個 commit 加一個 `backup-日期` tag，可以比對任兩次之間的差異。
- 內容包含所有業務資料表與登入帳號清單；不含 PIN（Supabase 也不提供）。
- 這個資料夾會含真實員工資料：**不能加 remote、不能 push、不能放進 OneDrive**。
- 失敗會跳出提示，紀錄在 `backup.log`。資料筆數比上次少一半以上也會提示。
- 立即備份（PowerShell）：`Start-ScheduledTask TalentReviewWeeklyBackup`
- 重新建立排程（PowerShell）：`scripts\register-backup-task.ps1`

### 還原
1. 列出所有版本：`git -C C:\dev\talent-review-backups tag`
2. 產生還原 SQL：`node scripts/restore-backup.mjs --at <tag>`。不加 `--at` 就用最新一版。
3. 檢查 `C:\dev\talent-review-backups\restore\` 底下的 SQL 檔，再貼到 Supabase SQL Editor 執行。**這會用備份取代所有業務資料。**
4. 登入帳號只會還原仍存在的使用者。如果專案是重建的，請先重跑 migrations，再由 HR 重新發 PIN。

`tests/rls/backup.test.ts` 驗證還原流程：每張表、狀態與版本歷史都能逐筆還原。

## 帳號移轉

1. **GitHub**：Settings → Transfer ownership 到公司組織。
2. **Supabase**：Organization → 邀請新擁有者 → Project → Transfer project。專案 URL 與金鑰不變。
3. **Netlify**：Site settings → Transfer site，移轉後重新連結 GitHub。
4. **Anthropic**：在公司帳號建立新 API key，執行 `npx supabase secrets set ANTHROPIC_API_KEY=...`，再停用舊 key。
5. 移轉後請重新產生 Supabase service_role key 並更新 secrets，舊擁有者不應再持有。

## 未來擴充

資料存取集中在 `src/data/`，改用 Azure 或公司內部系統時只需替換這一層。`cycles.site` 已預留多廠區；登入層獨立，可換成 Entra ID。
