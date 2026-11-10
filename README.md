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

## 部署

1. 在 `.env.local` 填入 Supabase 與 Anthropic 的值。
2. `npx supabase login`，`npx supabase link --project-ref <ref>`
3. `npm run db:push`。Staging 才加 `--include-seed` 放假資料，正式環境不要。
4. 部署函式：`npx supabase functions deploy auth-pin admin-users ai-generate`
5. 設定函式的 secrets：`npx supabase secrets set ANTHROPIC_API_KEY=... ANTHROPIC_MODEL=...`
6. Netlify 連 GitHub repo，環境變數設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。**不要設定 `VITE_DATA_MODE`。**
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
3. **Supabase 免費方案閒置 7 天會暫停專案**，盤點期間建議升級 Pro 或設定每日 keep-alive。
4. 主管 PIN 的鎖定由 `auth-pin` 執行，但持有 anon key 的人仍可直接呼叫 Supabase Auth 而繞過這層。8 碼 PIN 有約 8.5 兆種組合，且 Supabase 另有速率限制，風險可接受；改用 SSO 後即消除。

## 帳號移轉

1. **GitHub**：Settings → Transfer ownership 到公司組織。
2. **Supabase**：Organization → 邀請新擁有者 → Project → Transfer project。專案 URL 與金鑰不變。
3. **Netlify**：Site settings → Transfer site，移轉後重新連結 GitHub。
4. **Anthropic**：在公司帳號建立新 API key，執行 `npx supabase secrets set ANTHROPIC_API_KEY=...`，再停用舊 key。
5. 移轉後請重新產生 Supabase service_role key 並更新 secrets，舊擁有者不應再持有。

## 未來擴充

資料存取集中在 `src/data/`，改用 Azure 或公司內部系統時只需替換這一層。`cycles.site` 已預留多廠區；登入層獨立，可換成 Entra ID。
