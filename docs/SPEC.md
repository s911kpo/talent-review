# Talent Review App — 開發規格書（交付 Claude Code）

版本：v1.1 ｜ 2026-11-10（v1.1：PBM 核心價值改為 Molex Our Values 8 項；+1 主管流程說明） ｜ 需求方：Tim Hsu（HRBP, Molex Taiwan Xindian）
配套文件：`02_GUIDANCE_BANK.md`（引導題庫，中英）、`docs/template/DSS_Talent_Assessment_Succession_tool_template.xlsx`（匯出範本）

> 給 Claude Code：本文件是唯一需求來源。遇到本文件未定義的細節，選擇「最簡單、可替換、不影響匯出格式」的做法，並記錄在 `docs/DECISIONS.md`。不要停下來等待回覆。

---

## 0. 專案目標與不可違反的原則

**目標**：把 Excel 人才盤點範本（Criteria & Definitions / Planning Tool / Drop Down Options）轉成線上 App。部門主管透過「一次一題＋引導提示」完成關鍵人才盤點與發展計畫；HR 有後台追蹤進度，並有戰略儀表板（組織畫像、接班梯隊、人才發展地圖）。這是長期、反覆執行的系統，不是一次性工具。

**不可違反（違反＝驗收不通過）**
1. **權限隔離**：主管只能看到自己直屬部屬，以及（唯讀）下屬主管那條線；**任何人都看不到「自己被評的那一筆」**。權限由資料庫 RLS 強制執行，不能只靠前端隱藏。
2. **匯出對齊**：匯出的 `Planning Tool ` 工作表欄位 A–S，表頭文字、順序與範本**完全一致**（含尾端空白）。一位員工一列，不能錯位或跳列。
3. **不強制分配**：系統任何地方都不出現九宮格、強制比例、配額或排名。Molex 文化排斥強制分配。
4. **引導不遮蓋輸入**：輸入框**不使用 placeholder 放範例或提示**。引導一律放在題目下方的一行說明，或點燈泡 icon 開啟的側欄／彈窗。
5. **不使用 emoji**。圖示一律用 Lucide（`lucide-react`）。
6. **真實員工資料不進 Git repo**。repo 只放假資料（fixtures）；真實名單由 HR 從後台上傳。
7. **生日月份永不儲存**。上傳名單時直接丟棄該欄。

---

## 1. 範圍（Phase 1 = Q4 2026）

- 地點：台灣新店廠區（OSBU-Connectivity）。
- 盤點週期：`Q4 2026`，預計 2026/11/30 前由主管與 HRBP 討論、定稿。
- 資料來源：`Talent_Review_Emit - V2.xlsx`，工作表 `11.10 Namelist`，共 122 人：
  - `Talent Review = Y`：本次可盤點範圍（108 人，含修正後的 Tommy Wang 191886）。
  - `Supervisor ID = 0`：主管不在新店廠區；這類主管不登入，其部屬不在範圍內。
- 評核人（主管）：所有 `Talent Review=Y` 員工的 `Supervisor ID`（目前 11 位）。其中 5 位本身也是被評者（Lai H.J、Eason Yu、Terry Shen、Vincent Liao、Antonio Liu，都向 Terence Wang 報告）。
- 主管看到的是自己所有 Y 部屬，**第一步由主管自選「關鍵人才」**，只有被選中的人進入完整盤點。

---

## 2. 技術架構

| 層 | 選擇 | 說明 |
|---|---|---|
| 前端 | Vite + React 18 + TypeScript + Tailwind CSS | SPA，RWD；可加 shadcn/ui 元件 |
| 圖示 | lucide-react | 禁用 emoji |
| 圖表 | Apache ECharts（`echarts-for-react`） | 需要 heatmap、sankey、treemap、drill-down |
| i18n | i18next | `zh-TW`（預設）、`en`；UI 字串與題庫都雙語 |
| 後端／DB | Supabase（Postgres + Auth + RLS + Edge Functions） | Region：ap-southeast-1 (Singapore) 或 ap-northeast-1 (Tokyo) |
| 匯出 | ExcelJS（瀏覽器端） | 以範本檔為底寫入，詳見 §9 |
| AI | Supabase Edge Function 代理呼叫 Anthropic Messages API | API key 只存在 Edge Function secret，前端永不接觸 |
| 部署 | Netlify 或 Cloudflare Pages（前端）＋ Supabase（後端） | 不要用 Vercel Hobby（條款禁止商業用途） |
| 測試 | Vitest（單元）＋ Playwright（E2E）＋ pgTAP 或 SQL 測試腳本（RLS） | |

**可替換性**：資料存取集中在 `src/data/` repository 層，元件不直接呼叫 supabase client。未來若改用 Azure／公司內部系統，只需替換這一層。

**目錄建議**
```
/docs  SPEC.md(本檔) GUIDANCE_BANK.md DECISIONS.md CHANGELOG.md template/
/supabase  migrations/  functions/(auth-pin, admin-users, ai-generate)  seed/fake_seed.sql
/src  app/ components/ features/(manager, review, devplan, hr, dashboard, admin, ai) data/ i18n/ lib/(export, metrics, permissions)
/tests  unit/ e2e/ rls/
```

---

## 3. 角色與權限

| 角色 | 登入方式 | 可看 | 可改 |
|---|---|---|---|
| `manager`（評核人；含 +1 主管） | 主管工號 ＋ HR 發的 PIN | 自己直屬 Y 部屬；下屬主管那條線（唯讀，且只看「已提交」以後的內容）；自己範圍的儀表板＋全廠平均（只有比例） | 自己直屬部屬的盤點內容（在 Draft／Returned 狀態時） |
| `hr` | Email ＋ 密碼（Tim、Diana） | 全部 | 全部；確認／退回／鎖定／解鎖；後台管理 |

**+1 主管**：系統內只有唯讀權限，不做簽核。最後的對齊（HRBP 促進討論、+1 主管做最後決定）在線下進行，結果由 HR 在系統內確認並鎖定。

**定義**
- **直屬範圍**：本週期 snapshot 中 `supervisor_id = me` 且 `in_scope = true` 的員工。
- **線範圍（唯讀）**：沿 supervisor 鏈遞迴往下，所有下屬主管的直屬範圍（不含我的直屬，那是可編輯的）。
- **自我排除**：任何查詢都排除 `employee_id = me` 的評核紀錄（例如 Eason 看不到 Terence 寫的 Eason）。
- 遞迴鏈遇到 `supervisor_id = 0` 即停止；匯入時偵測循環並拒絕。

**RLS 實作**
- `app_users(user_id uuid pk → auth.users, employee_id bigint null, role text check in ('manager','hr'), display_name, locale, font_scale, is_active)`
- SQL function `public.my_employee_id()`、`public.is_hr()`、`public.direct_scope(cycle_id)`、`public.line_scope(cycle_id)`（recursive CTE，`security definer`，`stable`）。
- 每張含員工資料的表都要有 RLS policy，並寫 RLS 測試（§13）：manager A 不能讀寫 manager B 的資料、不能讀到自己的評核、上一級主管讀不到下屬主管的 Draft。

**登入（PIN）**
- 每位主管建立一個 Supabase Auth 使用者，email 用合成格式 `{employeeId}@talentreview.local`（不寄信），password = PIN。
- 登入畫面：輸入「工號」與「PIN」，前端組成合成 email 呼叫 `signInWithPassword`。
- PIN 規則：8 碼，大寫英文＋數字，排除易混淆字元（0/O/1/I/L）。由 Edge Function `admin-users` 用 service role 產生；明碼只顯示一次（HR 可下載 PIN 清單 xlsx 用來發送），DB 不存明碼。
- HR 可以重設 PIN、停用帳號。
- 登入一律經過 Edge Function `auth-pin`：先查 `login_attempts`（同一工號 15 分鐘內失敗 5 次就鎖 15 分鐘）→ 在伺服器端呼叫 `signInWithPassword` → 記錄結果 → 回傳 session 給前端（`supabase.auth.setSession`）。錯誤訊息一律寫「工號或 PIN 不正確」，不透露是哪一個錯。
- Session 閒置 60 分鐘自動登出；登出前會先自動存檔。

---

## 4. 資料模型（Postgres）

所有表都有 `created_at`、`updated_at`（trigger 維護）、`updated_by`（uuid）。

```sql
cycles(id uuid pk, code text unique,            -- 'Q4-2026'
       quarter_label text,                       -- 'Q4 2026'（匯出 A 欄用，須等於 option_lists.quarter 的值）
       site text default 'Xindian',
       status text check in ('setup','open','closed'),
       open_at timestamptz, due_at timestamptz, notes text)

employees(employee_id bigint pk, local_name text, full_name text, gender text,
          start_date date, is_active bool)       -- 主檔：最新資料

cycle_population(cycle_id, employee_id, in_scope bool, supervisor_id bigint,  -- 0 = 外部
                 supervisor_name_raw text, dept text, dept_no text, position text,
                 primary key(cycle_id, employee_id))  -- 每週期的 snapshot，保留歷史組織關係

reviews(id uuid pk, cycle_id, employee_id, reviewer_id bigint,
        is_key_talent bool default false,
        key_talent_reasons text[],               -- option_lists: key_talent_reason
        key_talent_note text,
        status text check in ('not_selected','draft','submitted','returned','confirmed','locked'),
        -- 對應 Planning Tool 欄位（單值欄）
        retention_risk text, retention_reasons text[],          -- E, F（最多 2，只有 Medium/High 才填）
        mobility_status text, desired_locations text,           -- G, H（H 只有 G≠Not Now 才填）
        pbm_strengths jsonb,      -- M: [{principle:'Integrity', evidence:'...'}] 最多 3
        pbm_improvements jsonb,   -- N: 同上 最多 3
        performance_strengths text,   -- O
        development_areas jsonb,      -- P: [{idx:1, text:'...'}] 1–3 項
        personal_aspirations text,    -- Q
        additional_comments text,     -- R
        is_critical_role bool,        -- S
        completed_steps text[],       -- 已完成的題目 key
        version int default 1,
        submitted_at, confirmed_at, locked_at,
        unique(cycle_id, employee_id))

next_roles(id, review_id fk, rank int check 1..3, role_title text, readiness text)        -- I, J
successors(id, review_id fk, rank int check 1..3,
           successor_type text check in ('internal','external','tbh'),
           successor_employee_id bigint null, external_name text null, readiness text null) -- K, L；tbh 沒有 readiness
dev_plan_items(id, review_id fk, area_idx int,           -- 對應 development_areas.idx
               goal text,                 -- 發展目標／成功樣貌
               dev_type text,             -- 70/20/10
               actions text,              -- 條列式具體行動
               support text,              -- 資源／導師／預算
               owner text,                -- 負責人
               start_date date, target_date date,
               checkpoint text,           -- 評核機制：怎麼確認做到了、誰確認、何時檢視
               status text,               -- plan_status
               progress_notes text)
review_versions(id, review_id, version int, action text,  -- save|submit|return|confirm|lock|unlock|reopen
                snapshot jsonb, actor uuid, comment text, created_at)
team_submissions(cycle_id, reviewer_id, status text check in ('draft','submitted','returned','confirmed','locked'),
                 submitted_at, reopen_requested_at, reopen_reason text, hr_comment text,
                 discussion_status text check in ('not_scheduled','scheduled','done'), discussion_date date,
                 primary key(cycle_id, reviewer_id))
review_comments(id, review_id, author uuid, body text, created_at, resolved bool)  -- HR 退回時逐人留言
option_lists(id, list_key text, value text,   -- value = 匯出用英文原值（與範本 Drop Down Options 一致）
             label_zh text, label_en text, sort int, is_active bool, export_column text null)
question_bank(key text pk, step_order int, section text, field_ref text,  -- e.g. 'E','F','I/J'
              title_zh, title_en, question_zh, question_en, hint_zh, hint_en,   -- hint=題目下方一行
              guide_zh, guide_en,      -- 燈泡內容（markdown）
              good_example_zh, good_example_en, weak_example_zh, weak_example_en,
              pitfalls_zh, pitfalls_en,
              input_type text, list_key text null, required bool, condition jsonb null, is_active bool)
ai_outputs(id, cycle_id, scope_type text, scope_ref text, output_type text, model text,
           input_hash text, content_md text, created_by uuid, created_at)
audit_log(id, actor uuid, action text, entity text, entity_id text, detail jsonb, created_at)
login_attempts(employee_id bigint, success bool, created_at)
```

**狀態機（人與團隊兩層）**
```
review:  not_selected ⇄ draft → (team submit) submitted → confirmed → locked
                                   ↘ returned(HR 逐人退回並留言) → draft …
team:    draft → submitted → confirmed → locked
         submitted/confirmed 時主管可按「申請修改」(reopen_reason 必填) → HR 核准 → 回到 draft（只開放被指定的人或整隊）
         HR 可直接 unlock（locked → confirmed 或 draft），全部寫進 review_versions + audit_log
```
- 主管在 `draft`／`returned` 才能編輯。
- 提交以團隊為單位：所有關鍵人才必填題都完成後才能按提交；有軟性警示時可以提交，但要逐條確認。
- **退回彈性**：HR 可以只退回特定員工，其餘維持 submitted。

**版本管理**
- 自動存檔：欄位變更 1.5 秒 debounce 寫入；畫面右上顯示「已儲存 · 2026/11/15 21:03」。存檔失敗時顯示紅色狀態並重試，離線時暫存在 localStorage 佇列。
- 版本快照：以下時機寫入 `review_versions`：離開某位員工、提交、退回、確認、鎖定、解鎖、核准修改。`reviews.version` 遞增。
- UI 顯示「v7 · 最後更新 2026/11/15 21:03 · Eason Yu」。HR 可以看版本歷史，並以欄位為單位比對差異。
- 樂觀鎖：寫入時帶 `version`；不一致（例如同時在兩個裝置編輯）就提示重新載入，不能靜默覆蓋。

---

## 5. 下拉選項（= Drop Down Options，HR 可在後台編輯）

`value` 一律與範本相同（匯出用）；`label_zh`/`label_en` 是 UI 顯示。範本值的尾端空白在匯入時 trim。

| list_key | value（匯出值） | label_zh |
|---|---|---|
| quarter | Q4 2026 | 2026 Q4 |
| retention_risk | Low / Medium / High | 低 / 中 / 高 |
| mobility | Not Now / Now / 1-2 years / 3+ years | 目前不考慮 / 現在可以 / 1–2 年內 / 3 年以上 |
| readiness | Too New to Rate (TNTR) / Emergency Cover / Ready Now / 1-2 years / 3+ years | 太新無法評估 / 緊急代理 / 已就緒 / 1–2 年內就緒 / 3 年以上就緒 |
| retention_reason | Career Move / Competitive Market / Family Reasons / Compensation Reasons / Retirement / Hybrid Work / Work Environment / Risk of burnout / Role Development/Role Fit / Culture Fit | 職涯發展 / 市場競爭 / 家庭因素 / 薪酬因素 / 退休 / 混合辦公 / 工作環境 / 過勞風險 / 職務發展與適配 / 文化適配 |
| critical_role | Yes--Check Box / No--Leave box empty | 是 / 否 |
| key_talent_reason（新） | Critical Role Holder / Strong Performance Impact / Scarce or Hard-to-Replace Skill / Successor Candidate / High Growth Potential / High-Impact Retention Concern | 關鍵職位任職者 / 績效貢獻突出 / 稀缺或難以取代的技能 / 關鍵職位接班候選人 / 成長潛力高 / 流失衝擊大 |
| dev_type（新） | Experience (70%) / Exposure (20%) / Education (10%) | 工作歷練 / 人際學習（輔導、導師、標竿） / 正式學習（課程、證照） |
| plan_status（新） | Not Started / On Track / At Risk / Completed | 未開始 / 進行中 / 有風險 / 已完成 |
| pbm_principle（新） | Integrity / Stewardship & Compliance / Principled Entrepreneurship / Transformation / Knowledge / Humility / Respect / Self-Actualize | 誠信 / 當責管理與合規 / 原則性企業家精神 / 轉型 / 知識 / 謙遜 / 尊重 / 自我實現 |

> `pbm_principle` 採用 Molex PBM「Our Values」8 項（已與 Tim 的 Molex 專案資料交叉確認）。UI 稱為「PBM 核心價值（Our Values）」。英文 value 是匯出 M、N 欄時用的原文，不能翻譯；中文標籤 HR 可以在後台調整。
> 注意：Criteria 頁的文字寫「Ready 1-2 Years」，下拉值是「1-2 years」。匯出一律用下拉值。

---

## 6. 主管端流程（Manager Experience）

### 6.1 首次登入
1. 選語言（繁中／English），選擇會記在 `app_users.locale`。
2. 系統導覽：4 步，可略過、可從「說明」重開。用 driver.js 或自製元件：
   ①你的團隊與進度 → ②選出關鍵人才 → ③一次一題＋燈泡提示 → ④自動存檔、提交與找 HRBP 討論。
3. 手機版首次進入時，顯示可關閉的提示列：「建議使用電腦填寫，手機適合查看與小修改」。

### 6.2 首頁（My Team）
- 頂部：週期名稱、截止日倒數、團隊狀態標籤（草稿／已提交／已退回／已確認／已鎖定）、整體進度環。
- 主要行動按鈕（依狀態變化）：「開始選出關鍵人才」→「繼續填寫：XXX」→「檢查並提交」→「預約 HRBP 討論」。
- 部屬卡片網格：中英文姓名、職稱、部門、年資（年＋月）、徽章（`到職未滿 6 個月`、`關鍵人才`、`已完成 x/12 題`、`HR 退回`）。
- 若我也是上一級主管：多一個分頁「我的組織線（唯讀）」，列出下屬主管與其團隊狀態，可以點進去唯讀檢視（只看已提交以後的內容）。
- 分頁「我的儀表板」（§8.3）。

### 6.3 第一步：選出關鍵人才
- 顯示所有直屬 Y 部屬。每人一列，可勾選「列為關鍵人才」；勾選後**必須至少選 1 個原因**（`key_talent_reason` 複選），可加一句說明（選填）。
- 題目下方一行提示，加上燈泡（內容見題庫 `KT_SELECT`）：說明判準、提醒「不設比例、以業務需要為準」、提醒「每個關鍵職位任職者都應考慮列入」。
- **不顯示任何比例目標或上限**。只顯示中性的資訊：「已選 4 / 13 位」。
- 選 0 人時可以繼續，但要彈窗確認原因（例如團隊都是新人），原因存在 `team_submissions.hr_comment` 前綴 `[NO_KEY_TALENT]`。
- 取消勾選已有內容的人時要警示：內容保留但不會匯出（status 回到 `not_selected`）。

### 6.4 第二步：逐人逐題（Wizard）
版面（桌機）：左側是員工清單與每人進度；中間是題目卡（一次一題）；右側是燈泡展開時才出現的引導側欄（手機改成底部彈出面板）。
- 題目卡結構：區段標籤（例如「C. 職涯發展」）→ 題目 → 一行提示（灰字，不在輸入框內）→ 燈泡 icon（`Lightbulb`，aria-label「查看引導與範例」）→ 輸入區 → 上一題／下一題。
- 進度：「第 5 / 12 題」與細進度條；可以從題目目錄跳題。
- 員工資訊列固定在頂部：姓名、職稱、年資、`到職未滿 6 個月` 提示（**只提示，不代填 TNTR**）。
- 鍵盤：`Ctrl/Cmd+Enter` 下一題。
- 員工所有必填完成後顯示「本員工摘要」頁，可直接點欄位回去改。

**題目順序（step key → 欄位）**
| # | key | 欄位 | 輸入 | 必填 | 條件 |
|---|---|---|---|---|---|
| 1 | CRITICAL_ROLE | S | 是／否單選 | 是 | |
| 2 | PERF_STRENGTHS | O | 多行文字 | 是 | |
| 3 | PBM_STRENGTHS | M | 選 PBM 核心價值（1–3，option_lists: pbm_principle）＋每項一句行為證據 | 是（至少 1） | |
| 4 | PBM_IMPROVE | N | 同上（1–3） | 是（至少 1） | |
| 5 | DEV_AREAS | P | 1–3 項，每項一句 | 是（至少 1） | |
| 6 | ASPIRATIONS | Q | 多行文字＋勾選框「尚未與本人討論」 | 是（勾選框可以代替） | |
| 7 | NEXT_ROLES | I + J | 1–3 列：職務名稱（可從名單職稱自動完成，也可以自由輸入）＋ readiness | 是（至少 1） | |
| 8 | MOBILITY | G (+H) | 單選；選擇非 Not Now 時出現「期望地點」文字欄 | G 必填 | H：G≠Not Now |
| 9 | RETENTION | E (+F) | 單選；選 Medium/High 時出現原因複選（最多 2） | E 必填；F 在條件成立時必填 | F：E∈{Medium,High} |
| 10 | SUCCESSORS | K + L | 1–3 列：類型（名單內員工／名單外輸入姓名／TBH）＋ readiness（TBH 不填） | 是（至少 1 列；可選 TBH） | |
| 11 | DEV_PLAN | Development Plan 工作表 | 依第 5 題每個發展領域各一張計畫卡（§6.5） | 每個發展領域至少 1 張完整卡片 | |
| 12 | COMMENTS | R | 多行文字 | 否 | |

- 名單內接班人選擇器：搜尋**全廠 122 人的主檔**（姓名、職稱、部門），排除本人。只顯示姓名、職稱、部門，不顯示任何評核內容。
- TBH 的意思是「目前組織內沒有接班梯隊，需要積極外部獵才」。選取時顯示這句說明。

### 6.5 發展計畫卡（Development Plan）
每個發展領域（第 5 題）各一張卡，欄位：發展目標／成功樣貌、類型（70/20/10）、具體行動（條列，每行一項，至少 2 項）、資源與支援、負責人、開始日、目標日、評核機制（怎麼確認做到、誰確認、何時檢視）、狀態（預設 Not Started）。
- 品質提示（軟性警示，顯示在卡片底部，不阻擋）：行動少於 2 項；目標日超過 12 個月或早於今天；三張卡都是 Education；評核機制少於 10 字；目標或行動含有「加強、提升、多學習」這類空泛詞，卻沒有可衡量的名詞或數字（中英文關鍵字清單放在 config）。
- 引導全部放燈泡（題庫 `DEV_PLAN`），**輸入框保持空白**。

### 6.6 檢查與提交
- 完整度檢查表：每位關鍵人才顯示「完成」（lucide `CircleCheck`）或缺少哪幾題（可以點擊直接跳過去）。
- 資料品質軟警示（逐條確認後才可提交）：
  - High 離職風險，但沒有發展計畫或接班人
  - 關鍵職位的接班人只有 TBH
  - 同一人被列為 3 個以上職位的接班人（本團隊內）
  - Next role 為 Ready Now，但沒有發展領域
  - 到職未滿 6 個月卻選了 Ready Now
- 提交後的頁面：
  1. 團隊摘要（可列印成 PDF，給主管與 HRBP 討論用）：關鍵人才名單、風險熱點、接班缺口、發展計畫時間軸。
  2. 引導卡「與 HRBP 討論」：建議討論的 3 個焦點（依資料自動產生，例如「2 位關鍵職位缺少已就緒接班人」）、按鈕「已預約討論」（填日期 → `discussion_status`）。
  3. 「申請修改」按鈕（需要填寫原因）。

---

## 7. HR 後台（HR Console）

1. **總覽／進度**：11 位評核人一覽表：直屬人數、已選關鍵人才數、填寫完成度、團隊狀態、最後更新時間、討論狀態、待處理修改申請。可排序、篩選，可匯出進度表。
2. **審核佇列**：逐團隊或逐人檢視 → 確認、退回（逐人留言）、鎖定、解鎖、核准或駁回修改申請。可以批次確認。
3. **戰略儀表板**：§8（HR 看全廠，可依部門或評核人篩選）。
4. **匯出**：§9。
5. **AI 工作室**：§10。
6. **後台管理**
   - 週期管理：建立週期，設定季度標籤與截止日，開啟或關閉。
   - 名單上傳：上傳與 `11.10 Namelist` 同格式的 xlsx（§11）→ 預覽差異（新增、離開、主管變更、範圍變更）→ 確認寫入 snapshot。
   - 帳號：自動列出應有的評核人帳號 → 一鍵建立或重設 PIN → 下載 PIN 清單（含工號、姓名、PIN，明碼只能下載一次）。也可以管理 HR 帳號。
   - 下拉選項編輯器（option_lists）：新增、停用、排序、雙語標籤。
   - 題庫編輯器（question_bank）：雙語編輯題目、提示、燈泡內容、範例，可預覽。
   - 稽核紀錄查詢。
7. **視角切換**：HR 可以「以某主管身分預覽」（唯讀，畫面頂部顯示黃色標示列），用來確認主管看到的畫面。

---

## 8. 儀表板（組織畫像 × 接班梯隊 × 人才發展地圖）

原則：**不做九宮格、不做排名、不做比例目標**。從現有欄位萃取指標，每張圖都可以點擊下鑽（drill-down）→ 篩選後的員工清單 → 員工卡片（唯讀全內容）。全域篩選：部門、評核人、關鍵職位（是／否）、年資區間、資料狀態（含草稿／只看已提交）。

### 8.1 KPI 磚（頂部）
盤點完成率｜關鍵人才數（佔範圍 %，**標示為「參考，非目標」**）｜關鍵職位數｜「關鍵職位 × 高流失風險」人數｜接班覆蓋率（有 Ready Now 接班人的關鍵職位比例）｜TBH 職位數｜發展計畫完整率。

### 8.2 分頁
**A. 組織畫像**
- 部門 treemap：面積 = 範圍內人數，顏色 = 關鍵人才佔比。
- 部門 × 指標熱力表：每部門的範圍人數、關鍵人才數、平均年資、Med/High 風險比例、接班強度分數、發展計畫完整率、TNTR 人數。
- 年資結構：關鍵人才的年資分布（<6 個月、6–12 個月、1–3 年、3–5 年、5–10 年、10 年以上）對照整體範圍人口。
- 性別組成：只顯示部門層級的比例，且人數 <5 時不顯示（避免識別個人）。

**B. 留任風險**
- 風險矩陣：離職風險（L/M/H）× 關鍵職位（是／否）的 3×2 格，格內是人數，點擊可下鑽。右上格（H × 關鍵職位）標為「優先行動」。
- 離職原因 Pareto（只算 Med/High）。
- 風險 × 準備度交叉：高風險且 Ready Now 的人＝最可能被挖角的人才。

**C. 接班梯隊（Bench Strength）**
- 每個關鍵職位的接班強度：取最佳接班人的 readiness → Ready Now=3、1–2 年=2、3 年以上=1、Emergency Cover=1、TNTR=0、TBH 或無=0。分成 4 類：強（3）、發展中（2）、薄弱（1）、缺口（0）。用堆疊條形圖依部門呈現。
- 單點失效清單：關鍵職位且接班強度 ≤1。
- 接班集中度：同一位接班人被列入 ≥2 個職位（跨團隊計算，只有 HR 看得到跨團隊結果）。
- 接班網絡圖（sankey 或 graph）：任職者 → 接班人，線的顏色代表 readiness。外部或 TBH 節點用不同樣式。
- 外部依賴度：外部或 TBH 佔所有接班列的比例。

**D. 人才流動與職涯**
- Next role readiness 漏斗：Ready Now → 1–2 年 → 3 年以上 → TNTR。
- 流動意願分布，以及期望地點列表。
- 「尚未與本人討論職涯期望」的人數（第 6 題勾選框），作為對話缺口指標。

**E. 人才發展地圖**
- 70/20/10 實際組合，對照 70/20/10 參考線（只是參考）。
- 發展計畫時間軸（甘特式）：依目標月份，可以看出哪些月份 checkpoint 集中。
- 負責人負荷：每位 owner 名下的行動數。
- 發展主題：由 AI（§10）把 P 欄與計畫目標歸類成能力主題（例如專案管理、跨部門溝通、技術深度、領導力），再以主題 × 部門矩陣呈現，作為學習地圖的輸入。沒有執行 AI 時，這張圖顯示「尚未生成」並提供按鈕。
- PBM 核心價值分布：M（強項）與 N（改善）中各項價值被提及的次數，用雙向條形圖呈現。

**F. 盤點進度（工作看板）**：同 §7.1，但以圖形呈現。

### 8.3 主管版儀表板
- 範圍：直屬主管 = 自己團隊；上一級主管 = 整條線（下屬主管團隊只計入已提交以後的資料；自己團隊包含草稿）。
- 對照：每個比例型指標旁邊顯示「全廠平均」（只有數值，不列出其他團隊名稱或人名）。全廠平均只用 submitted 以後的資料計算。
- 不包含：跨團隊接班集中度、其他團隊清單、AI 全廠分析。

### 8.4 指標實作
- 所有指標寫成純函式 `src/lib/metrics/*.ts`，輸入是 reviews 陣列，並附單元測試。
- 資料量：設計目標為 5,000 名員工 × 多週期仍然流暢。查詢做分頁，聚合用 SQL view 或 RPC。

---

## 9. 匯出（Excel，對齊範本）

**來源**：`docs/template/DSS_Talent_Assessment_Succession_tool_template.xlsx` 打包進前端 `public/templates/`（範本不含個資）。

**做法（ExcelJS）**
1. 載入範本。
2. `Criteria & Definitions`：保留原樣。
3. `Drop Down Options `：用 option_lists 現值覆寫 A–F 欄（順序同範本：Retention Risk / Mobility Status / Role Readiness / Retention Reasons / Quarter / Critical Role），新增 G 欄 Development Type、H 欄 Plan Status。
4. `Planning Tool `：從第 4 列開始寫，一位關鍵人才一列，依「部門 → 評核人 → 員工英文名」排序。
5. 重建資料驗證：ExcelJS 讀範本時會丟失 x14 延伸格式的下拉。寫入後要用 ExcelJS 標準 dataValidation 重新加上：A→Quarter、E→Risk、F→Reasons、G→Mobility、J 與 L→Readiness、S→Critical Role，公式引用 `'Drop Down Options '!$X$2:$X$n`。資料列範圍 4–500。移除範本中錯位的 `T4:T36` 驗證。
   - 註：F、J、K、L 這類多值格寫入後，不會符合單選驗證；設定 `showErrorMessage=false`，讓檔案開啟時不跳錯。
6. 新增工作表 `Development Plan`：每個計畫項目一列。欄位：Employee ID｜Employee｜Supervisor｜Quarter｜Dev Area #｜Development Area｜Goal / Success Measure｜Development Type｜Specific Actions｜Support / Resources｜Owner｜Start Date｜Target Date｜Checkpoint / Evaluation｜Status｜Progress Notes。
7. 新增工作表 `Key Talent List`：Employee ID｜Employee｜Dept｜Position｜Supervisor｜Key Talent Reasons｜Note｜Review Status｜Version｜Last Updated。
8. 檔名：`TalentReview_{cycle}_{scope}_{yyyyMMdd-HHmm}.xlsx`（scope = All／評核人姓名）。

**Planning Tool 欄位映射（表頭文字必須完全一致）**
| 欄 | 範本表頭（逐字） | 寫入內容 |
|---|---|---|
| A | `Quarter ` | cycles.quarter_label → `Q4 2026` |
| B | `Supervisor` | 評核人 Full Name（例：`Yu, Eason`） |
| C | `Employee` | `{Full Name} {LocalName}`（例：`Chen, Tom 陳正川`） |
| D | `Position Description\nLocation Description\nState\nCountry` | `{Position} / Xindian District / New Taipei City / Taiwan` |
| E | `Retention Risk ` | value |
| F | `Retention Reason` | 多值用 `; ` 連接；Low 時留白 |
| G | `Mobility Status` | value |
| H | `Desired Location(s),\n if known` | 文字；G=Not Now 時留白 |
| I | `Possible Next Role(s)` | `1. {role}; 2. {role}` |
| J | `Readiness for Next Role(s)` | `1. {readiness}; 2. {readiness}`（編號與 I 對齊） |
| K | `Possible Successors for Current Role (within Molex or Koch)` | `1. {Full Name 或外部姓名}; 2. TBH (To-Be-Hired)` |
| L | `Successor Readiness \nfor Current Role` | `1. Ready Now; 2. -`（TBH 寫 `-`，編號與 K 對齊） |
| M | `PBM:  Cultural Strengths (up to 3)` | `1. {Principle}: {evidence}; 2. …` |
| N | `PBM:  Cultural Improvement Opportunities (up to 3)` | 同上 |
| O | `Performance Strengths` | 文字 |
| P | `Development Areas ` | `1. …; 2. …` |
| Q | `Personal Aspirations` | 文字；勾選「尚未討論」時寫 `Not yet discussed with employee` |
| R | `Additional Comments` | 文字 |
| S | `Is this a Critical Role?` | 是 → `Yes--Check Box`；否 → 留白（依範本 F 欄說明「No--Leave box empty」） |

**文字清理（避免錯位）**：所有寫入 Planning Tool 的文字把 `\r\n`、`\n`、`\t` 轉成 `; ` 或空白，去頭尾空白，長度上限 32,000 字元。Development Plan 的「Specific Actions」保留單格內換行（wrapText）。

**匯出權限**：HR 可以匯出全部或指定團隊；主管只能匯出自己直屬團隊（含草稿，並在檔案標題列註明「DRAFT」）。

**匯出驗收測試（自動）**：用 fixtures 產生檔案 → 重新讀取 → 斷言：第 3 列表頭與範本逐字相同；資料列數 = 關鍵人才數；每列 C 欄對應的員工 ID 與 Key Talent List 一致；所有儲存格不含 `\n`（Planning Tool）；I/J、K/L 的編號數一致。

---

## 10. AI 功能（第一版就上線）

- Edge Function `ai-generate`：驗證 JWT 與角色 → 依 scope 從 DB 撈資料（經 RLS 或 service role，並以 `is_hr`／scope 檢查）→ 組 prompt → 呼叫 Anthropic Messages API → 存入 `ai_outputs` → 回傳 markdown。
- Secrets：`ANTHROPIC_API_KEY`、`ANTHROPIC_MODEL`（預設填寫 Tim 指定的模型 ID，可隨時更換）。
- 傳送資料：依 Tim 決策，**送原始資料（含姓名）**，不做去識別化。介面在 AI 工作室頂部常駐顯示一行：「AI 分析會將盤點內容傳送至 Anthropic API 處理」。
- **使用權限**：HR 可以用全部功能、全部範圍；主管只能用「我的團隊發展建議」，範圍限直屬團隊。
- AI 輸出**永不自動寫回表單**。主管端只提供「複製」，由主管自行決定是否採用。
- 每份輸出都標註「AI 生成，僅供參考 · 模型 · 時間」，並可以重新生成、儲存版本、匯出 markdown 或 PDF。

**輸出類型**
| type | 誰 | 內容 |
|---|---|---|
| team_dev_suggestions | 主管、HR | 針對每位關鍵人才：依 P 欄與現有計畫，補充 70/20/10 具體行動建議，並檢查計畫是否具體、有時間軸、有評核機制 |
| org_health_summary | HR | 組織健康度敘述：風險熱點、接班缺口、流動與職涯對話缺口，以及 3–5 個優先行動 |
| succession_risk_brief | HR | 關鍵職位接班風險簡報、TBH 外部獵才優先序建議 |
| learning_map | HR | 把發展領域歸類成能力主題 → 主題 × 部門 → 建議學習方案（內部輪調、導師、課程類型） |
| dev_theme_tagging | HR | 把每個 P 項目和計畫目標貼上主題標籤（結構化 JSON），供 §8.2E 使用 |
| translate_en | HR | 把中文自由文字翻成英文，產生「英文版匯出」選項（原文不覆寫，另存翻譯欄位） |
| hrbp_discussion_brief | HR | 依單一團隊資料，產生 HRBP 與主管討論的提綱 |

**Prompt 原則**（寫進 `supabase/functions/ai-generate/prompts/*.md`，可以編輯）：
- 背景：Molex（Koch 子公司），PBM 文化，**禁止強制分配、排名、九宮格**。
- 只根據提供的資料推論；資料不足時明說缺口，不要編造。
- 語言：依使用者 locale；HR 可以選雙語輸出。
- 結構化輸出（dev_theme_tagging）使用 JSON schema 驗證，失敗就重試一次。

---

## 11. 名單匯入規格

- 接受 xlsx。第一個工作表的表頭（換行或空白正規化後比對）：`Talent Review, ID, LocalName, Full Name, Supervisor ID, Supervisor, Dept., Dept. No., Position, Gender, Birth month, Start Date`。
- **`Birth month` 在前端解析時就丟棄，不送進 DB。**
- 驗證（錯誤會阻擋匯入，警告可以繼續）：
  - 錯誤：ID 重複；Supervisor ID 不是 0 也不在名單內；`Talent Review=Y` 但 Supervisor ID=0；主管鏈出現循環；有人的主管是自己。
  - 警告：姓名有頭尾空白（自動 trim）；職稱疑似錯字（只列出，不自動改）；Dept. No. 非數字。
- 寫入：upsert `employees`；寫入當週期的 `cycle_population` snapshot；週期開啟後重新匯入時，顯示差異，並處理已有 review 的員工（例如換主管時，review 轉給新評核人並寫 audit）。
- 匯入後自動計算評核人清單 → 提示 HR 建立或重設 PIN。

---

## 12. UI／UX 設計規範

- **對標**：外部人才測評類產品（例如 Lattice、Culture Amp、SHL 受測端）的特性：一次一題、留白充足、進度清楚、溫和而專業。
- **設計 tokens**
  - 背景：暖白 `#FAF8F5`；卡片：`#FFFFFF`；主要文字：`#1F2328`；次要文字：`#5B616B`；分隔線：`#E6E1DA`
  - 品牌強調：Molex 紅 `#C8102E`（只用在主要按鈕、選中狀態、重點數字，避免大面積使用）
  - 功能色塊（低飽和底色＋深色字）：資訊 `#E8F1FB/#1D4E89`；成功 `#E7F4EC/#1E6B3A`；警示 `#FDF3E1/#8A5A00`；風險 `#FBE9E9/#9B1C1C`
  - 圖表色盤：用色盲友善的類別色（6 色），風險用 L 綠／M 琥珀／H 紅
  - 字體：`Noto Sans TC`、`Inter`、系統字
  - 圓角 10px；陰影要輕；間距 8pt 系統
- **字級縮放**：頂部列 `A−`／`A+`，四段（87.5%／100%／112.5%／125%），作用在 root font-size，記在 `app_users.font_scale`。所有尺寸用 rem。
- **語言切換**：頂部列繁中／EN，即時切換，不重新整理頁面。
- **RWD**：≥1280 用三欄；768–1279 時燈泡側欄改為覆蓋層；<768 單欄，燈泡改為底部面板，員工清單收進抽屜。
- **無障礙**：WCAG 2.1 AA 對比、全鍵盤可操作、focus ring、所有 icon 按鈕都有 aria-label、表單錯誤用文字說明（不能只靠顏色）。
- **文字語氣**：專業、簡潔、不說教；按鈕用動詞（「儲存並下一題」）。
- **空狀態與錯誤**：每個列表都要有空狀態說明。網路錯誤顯示可重試的訊息，不顯示技術堆疊。

---

## 13. 測試與驗收

**自動測試（CI 必須全綠）**
1. RLS（SQL 測試）：manager 跨團隊讀寫被拒；讀不到自己的 review；上一級主管讀不到下屬團隊的 draft；HR 可以讀全部；未登入什麼都讀不到。
2. 狀態機：非法轉換被拒（例如主管改 submitted 的資料）。
3. 匯出：§9 的驗收斷言。
4. 指標函式：用 fixtures 跑，結果與手算一致。
5. E2E（Playwright）：主管登入 → 選關鍵人才 → 完成一位員工 12 題 → 重新整理後資料還在 → 提交 → HR 退回其中一人 → 主管修改 → 再提交 → HR 確認、鎖定 → 匯出。在 375px 與 1440px 兩種寬度各跑一次。
6. i18n：沒有遺漏的翻譯 key（測試掃描）。

**假資料 fixtures**：`supabase/seed/fake_seed.sql` 要複製真實的組織結構形狀（1 位 GM 帶 15 人，其中 5 位是主管；另外 6 位主管的上級是外部主管；共 108 位在範圍內、14 位在範圍外），但所有姓名、工號都是虛構的。附上一組示範主管帳號與 PIN，以及一個 HR 帳號，寫在 `docs/DEMO_ACCOUNTS.md`。

**人工驗收清單**：見 `03_操作指引.md` 的「早晨驗收」。

---

## 14. 開發順序（建議 4 個夜間批次，每批結束都要可以部署）

| 批次 | 內容 | 完成定義 |
|---|---|---|
| P0 基礎 | repo、Vite、Tailwind、i18n、Supabase schema 與 migrations、RLS、PIN 登入、HR 登入、fake seed、名單匯入、帳號與 PIN 產生 | RLS 測試全綠；用假帳號可以登入並看到正確範圍 |
| P1 主管端 | 首頁、選關鍵人才、12 題 wizard、燈泡引導（從 question_bank 讀取，先灌入 `02_GUIDANCE_BANK.md` 的內容）、發展計畫卡、自動存檔、版本、提交、申請修改、導覽、字級與語言 | E2E 主管流程通過 |
| P2 HR 端與匯出 | 進度總覽、審核佇列（確認、退回、鎖定、解鎖、核准修改）、Excel 匯出、選項與題庫編輯器、稽核紀錄、以主管身分預覽 | 匯出驗收測試通過 |
| P3 儀表板與 AI | §8 全部分頁、主管版儀表板、§10 AI 功能 | 指標單元測試通過；AI 可以生成並儲存 |
| P4 打磨 | RWD 細修、無障礙、效能、錯誤處理、文件（README、DECISIONS、CHANGELOG） | Lighthouse 可及性 ≥90；全部測試全綠 |

每批結束時：commit 並推送、部署到 staging、在 `docs/CHANGELOG.md` 寫下完成項目、已知問題與下一步。

---

## 15. 未來擴充（現在就要預留，不用實作）

- 多廠區、多 BU：`cycles.site`、`cycle_population` 已經可以容納；權限加上 `site` 維度。
- 週期對比：同一員工跨週期的風險、準備度變化，以及接班強度趨勢。
- 公司 SSO（Entra ID）取代 PIN：auth 層已抽象化。
- 發展計畫季度追蹤：plan_status 與 progress_notes 已經預留。
- 搬遷到公司內部雲：透過 repository 層替換。

---

## 16. 已知風險（Tim 已知悉並決定接受的項目，標記在 README）

1. **系統掛在 Tim 個人帳號**（Supabase、Netlify、Anthropic）：人員異動時有交接與資料歸屬風險。README 要寫明帳號移轉步驟。
2. **AI 傳送原始個資到 Anthropic API**：依 Tim 決策執行，前提是 IT 核准。
3. **Supabase 免費方案閒置 7 天會暫停專案**：盤點期間建議升級 Pro 方案，或設定每日 keep-alive。
4. **時程**：用 3 個夜間（加上週五白天）完成 P0–P4 全部功能，屬於高風險。如果 P3 未完成，降級方案是儀表板先上 A／B／C／F 分頁，AI 功能延後；這個降級不影響主管填寫與匯出。
