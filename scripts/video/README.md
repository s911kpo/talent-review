# 上線影片製作工具

兩支影片都從**示範環境的假資料**截圖產生，不使用真實員工資料。UI 改版後可以重新產生。

| 影片 | 檔案 | 長度 | 內容 |
|---|---|---|---|
| 上線宣傳 | `video-build/promo.mp4` | 36 秒 | 產品亮點、功能重點、上線日期，配原創合成音樂 |
| 主管操作指南 | `video-build/guide.mp4` | 約 5 分 50 秒 | 8 章：開始之前 → 登入 → 選人 → 12 題 → 提交 → HRBP 討論 → 用數據帶團隊 → 盤點之後 |

## 重新產生

1. 啟動兩個開發伺服器：示範模式（`vite --mode demo`，port 5173）與 showcase 模式（port 5174）。在 Claude Code 中是 `.claude/launch.json` 的 `talent-review-demo` 與 `talent-review-showcase`。
2. `node scripts/video/capture.mjs`：截圖到 `video-build/shots/`（1920×1080，並記錄每個重點元件的位置）。
3. `node scripts/video/render.mjs promo`、`node scripts/video/render.mjs guide`：輸出 MP4（H.264＋AAC，在瀏覽器內以 WebCodecs 編碼，不需要 ffmpeg）。
4. `node scripts/video/verify.mjs video-build/promo.mp4 10`：確認可播放、有聲音，並輸出一張畫面檢查。
5. 預覽單張畫面：`node scripts/video/render.mjs guide --stills 30,100`，輸出到 `video-build/stills/`。

## 修改內容

- 宣傳影片的文案與節奏：`promo.js`（120 BPM，每 0.5 秒一拍，切換都落在拍點上）。
- 操作指南的每一步：`guide.js` 的 `step(...)`，依序是章節、截圖、重點元件、標題、說明、為什麼重要。
- 上線日期寫在 `promo.js` 與 `guide.js` 的結尾卡片；截止日刻意不寫（示範資料的日期不是正式日期）。
- AI 功能在正式環境關閉，截圖時會自動隱藏 AI 選單。

`video-build/` 不進 git（影片檔很大）。
