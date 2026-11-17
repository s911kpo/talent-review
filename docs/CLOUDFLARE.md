# 正式網站搬到 Cloudflare Pages（Tim，約 10 分鐘）

搬的只有「網頁檔案」。資料、登入、PIN、匯出、備份都在 Supabase，不受影響。

## 為什麼搬

Netlify 免費方案只剩 30 credits，要撐到 12/14；用完所有網站會暫停。Cloudflare Pages 對純靜態網站（本系統就是）**流量與請求不限、免費**，每月可部署 500 次。

## 步驟

1. 打開 https://dash.cloudflare.com/sign-up ，用公司 Email 註冊並驗證信箱。
2. 左側選單 **Workers & Pages** → **Create** → 上方切到 **Pages** 分頁 → **Connect to Git**（或 Import an existing Git repository）。
3. 選 **GitHub** → 授權 → 只勾選 **talent-review** 這個 repo → **Begin setup**。
4. 設定頁照下表填，其他不用動：

   | 欄位 | 填 |
   |---|---|
   | Project name | `molex-talent-review`（這會變成網址 `molex-talent-review.pages.dev`） |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `node scripts/build-site.mjs` |
   | Build output directory | `dist` |

5. 展開 **Environment variables (advanced)**，新增兩個：

   | Variable name | Value |
   |---|---|
   | `DEPLOY_TARGET` | `production` |
   | `NODE_VERSION` | `22` |

   `DEPLOY_TARGET` 最重要：少了它會連到測試資料庫（網站頂端會出現黃條，一看就知道）。

6. 按 **Save and Deploy**，約 2–3 分鐘，出現 **Success** 就完成。
7. 把網址傳給 Claude（例如 `https://molex-talent-review.pages.dev`）。Claude 會比對新舊網站的檔案是否完全相同，並檢查連到正式資料庫。

## 之後

- 每次 Claude 推送更新，Cloudflare 會自動部署（免費）。需要退回上一版：Cloudflare 專案 → Deployments → 選上一版 → **Rollback**。
- Netlify 正式站保留當備援（連同一個資料庫），但通知信只放 Cloudflare 網址。
- 測試網址維持在 Netlify。若 Netlify 額度用完，測試網址會暫停到 12/15，不影響正式資料。
