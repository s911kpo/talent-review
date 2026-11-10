# Changelog

## P0 基礎（2026-11-10 夜）

**完成**
- Vite + React + TS + Tailwind + i18next 骨架，設計 tokens，字級與語言切換
- 資料庫 schema、RLS、狀態機 trigger、名單匯入 RPC、下拉選項初始資料
- Edge Functions：`auth-pin`（登入與鎖定）、`admin-users`（帳號、PIN）
- 主管 PIN 登入、HR 登入、閒置 60 分鐘登出
- HR 後台：週期管理、名單上傳（檢查與差異預覽）、帳號與 PIN（一次性下載）
- 假資料產生器：122 人、108 人在範圍內、11 位評核人

**驗證結果**
- RLS 測試 51 項全過（PGlite 真實 Postgres 引擎），並以故意破壞規則確認測試抓得到問題
- 單元測試全過：PIN、鎖定、名單檢查、年資、i18n、SPEC §0 守則
- 建置通過；登入頁已在 1440 與 375 寬度實際檢查

**尚未驗證（需要金鑰）**
- migrations 尚未套用到遠端 Supabase
- Edge Functions 只做過語法打包，尚未實際部署執行
- 真實登入流程
