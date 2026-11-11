# Changelog

## 接上真實 Supabase（2026-11-11）

**完成**
- 專案 `ap-southeast-1`（Singapore），8 個 migration 與假資料已套用，版本紀錄與 `supabase db push` 相容
- `auth-pin`、`admin-users` 已部署；`ai-generate` 尚未部署（AI 未啟用）
- 12 個示範帳號已建立，`.local` 合成 Email 可用
- `scripts/verify-remote.mjs`：19 項遠端檢查全過（匿名拒絕、PIN 登入與鎖定、範圍、自我排除、草稿不外流、跨團隊寫入被擋、HR 專屬函式）
- 本機 App 接真實後端，示範主管登入後看到正確的 10 位部屬

**公司網路的限制**
- Zscaler 擋下這台電腦直接連 Postgres（5432）與 Supabase CLI 的連線；改用 HTTPS 管理 API（`scripts/apply-migrations.mjs`）
- 本機瀏覽器窗格可連到 `*.supabase.co`；其他主管的公司電腦是否也能連，部署後要實測

**尚未完成**
- push 到 GitHub、Netlify 部署

## P3 儀表板與 AI、P4 部分打磨（2026-11-11 夜）

**完成**
- 指標純函式（`src/lib/metrics`），含手算驗證的單元測試
- 戰略儀表板 A–F 六分頁、全域篩選、點擊下鑽到人員與內容；主管版含全廠平均（只有數值）
- `plant_averages` RPC：只回傳數值，只計入已提交資料
- `ai-generate` Edge Function 與 7 種輸出、可編輯 prompts、AI 工作室、主管版只能複製
- 無障礙：WCAG 2.1 A／AA 的 axe 掃描，涵蓋登入、主管各頁、HR 全部分頁
- README（部署、帳號移轉、已知風險）

**部分完成**
- `translate_en`：可生成並儲存譯文，但「英文版匯出」選項尚未做
- Lighthouse 分數尚未量測（axe 已過）

**尚未驗證**
- AI 從未實際呼叫過 API，需要金鑰

## P2 HR 端與匯出（2026-11-11 夜）

**完成**
- HR RPC：逐人退回、確認、鎖定、解鎖、核准或駁回修改申請；每個動作都寫 review_versions 與 audit_log
- HR 後台：總覽（排序、篩選、匯出進度表、批次確認）、審核佇列（版本歷史與欄位差異）、匯出、以主管身分預覽（唯讀）、下拉選項編輯、題庫編輯、稽核紀錄
- Excel 匯出：以範本為底，重建下拉、新增 Development Plan 與 Key Talent List
- 公開範本去除作者姓名與內嵌 Power Query

**驗證結果**
- SPEC §9 匯出驗收 22 項全過，對照原始範本逐字比對表頭
- HR RPC 測試 22 項全過
- E2E 完整流程在 375 與 1440 通過：提交、HR 退回一人、主管修改、再提交、HR 確認、鎖定、匯出

**尚未驗證**
- 匯出檔尚未用真正的 Excel 開過

## P1 主管端（2026-11-11 夜）

**完成**
- 題庫由 GUIDANCE_BANK 自動產生（14 題雙語）
- 首頁、選關鍵人才、12 題 Wizard、燈泡引導、發展計畫卡與品質提示
- 自動存檔（1.5 秒 debounce、失敗重試、離線暫存）、版本快照、樂觀鎖
- 檢查與提交（完整度、軟性警示逐條確認）、提交後頁面、申請修改、預約討論
- 系統導覽、組織線唯讀分頁、手機提示列
- 本機示範資料模式 `npm run demo`

**驗證結果**
- RLS 與流程 RPC 測試全過，完整度規則以資料庫與前端交叉比對
- E2E 在 375 與 1440 通過

## P0 基礎（2026-11-10 夜）

**完成**
- Vite + React + TS + Tailwind + i18next 骨架，設計 tokens，字級與語言切換
- 資料庫 schema、RLS、狀態機 trigger、名單匯入 RPC、下拉選項初始資料
- Edge Functions：`auth-pin`（登入與鎖定）、`admin-users`（帳號、PIN）
- 主管 PIN 登入、HR 登入、閒置 60 分鐘登出
- HR 後台：週期管理、名單上傳（檢查與差異預覽）、帳號與 PIN（一次性下載）
- 假資料產生器：122 人、108 人在範圍內、11 位評核人

**驗證結果**
- RLS 測試全過（PGlite 真實 Postgres 引擎），並以故意破壞規則確認測試抓得到問題
- 單元測試全過

## 尚未驗證（需要金鑰，全部批次共通）

- migrations 尚未套用到遠端 Supabase
- Edge Functions 只做過語法打包，尚未實際部署執行
- 真實登入流程；`.local` 合成 Email 能否被 Supabase Auth 接受
- E2E 目前跑在示範資料模式，權限則由 RLS 測試獨立驗證
- 尚未 push 到 GitHub、尚未部署 Netlify
