# CLAUDE.md — Talent Review App

## 必讀
- `docs/SPEC.md`：唯一需求來源（§0 的原則不可違反）
- `docs/GUIDANCE_BANK.md`：引導題庫，作為 question_bank 的初始資料
- `docs/CHANGELOG.md`：目前進度；`docs/FEEDBACK.md`：Tim 的驗收問題（每次開始工作時先處理）

## 工作方式
- 無人值守執行：不要停下來提問。未定義的細節依 SPEC §0 原則決定，並寫進 `docs/DECISIONS.md`（日期、決定、理由、替代方案）。
- 依 SPEC §14 批次順序開發；每批結束都要可以部署：測試全綠 → commit 並 push → 更新 CHANGELOG。
- 不能把真實員工資料寫進 repo、測試或 log。只使用 fixtures 假資料。
- secrets 只能放在 `.env.local` 與 Supabase secrets；`.env*` 必須在 .gitignore 內。
- 改動資料庫結構一律透過 `supabase/migrations`，不能手動修改遠端資料庫。
- 每次修改權限相關程式碼後，都要跑 RLS 測試。
- UI 不使用 emoji；圖示一律用 lucide-react；輸入框不放 placeholder 提示。
- 匯出相關的改動，都要跑匯出驗收測試（SPEC §9）。

## 常用指令
- 開發：`npm run dev`
- 全部測試：`npm test`；只跑 RLS：`npm run test:rls`
- 型別與建置：`npm run build`
- 重新產生假資料：`npm run seed:gen`
- 套用 migrations 到遠端：`npm run db:push`（需先 `npx supabase link`）
- 示範帳號：`npm run demo:provision`，上線前必須 `npm run demo:remove`
- 這台電腦的 Node 由 winget 安裝；新開的終端機若找不到 node，重開 app 即可
