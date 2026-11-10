# 明早待辦（Tim）

## 先看成果（不需要任何金鑰，5 分鐘）

在 `C:\dev\talent-review` 開終端機，執行：

```
npm run demo
```

瀏覽器開 http://localhost:5173 ：
- 主管：工號 `900002`（一般主管）或 `900001`（GM，看得到組織線），PIN 任填 8 碼
- HR：登入頁點「HR 登入」，Email 填 `demo-hr@talentreview.local`，密碼任填

這是瀏覽器內的示範資料，全部虛構，只用來看畫面與流程。正式打包不含這些資料。

## 只有你能做的設定

### 1. 開帳號（對應操作指引 A1）
| 服務 | 要做的事 | 要記下的值 |
|---|---|---|
| GitHub | 建 **Private** repo，例如 `talent-review` | repo 網址 |
| Supabase | New project，Region 選 **Singapore** | Project URL、anon key、service_role key、DB 密碼、Personal Access Token、Project ref |
| Anthropic Console | 建 API key，設用量上限 | API key、模型 ID |
| Netlify | 用 GitHub 登入 | 無 |

### 2. 填 `C:\dev\talent-review\.env.local`
8 個欄位的空白範本已放好。**金鑰不要貼到對話裡**，直接存進這個檔案。

### 3. 告訴我「金鑰填好了」，並給我 GitHub repo 網址
我接著會做：套用 migrations、部署 Edge Functions、建立示範帳號、在真實 Supabase 上重跑權限驗證、push、接 Netlify。

## 上線前必須決定

1. **IT 核准範圍。** 真實名單上傳前（最遲 11/13），需確認 IT 同意下列兩項：108 人的離職風險與接班資料放在你個人的 Supabase；盤點內容含姓名送到 Anthropic API。SPEC §16 只把 IT 核准寫在 AI 那一項。
2. **PBM 十項原則用詞。** 目前依 SPEC 暫定（例如 Transformation），請對照公司最新官方用詞，可在後台「下拉選項」直接改。
3. **HR 帳號要連結工號。** 你和 Diana 若也在名單內，建立 HR 帳號時要填工號，否則系統無從排除「自己被評的那一筆」。

## 請實際用 Excel 開一次匯出檔

匯出的自動驗收全部通過，但都是程式讀回檔案驗證，**還沒有用真正的 Excel 開過**。請在示範模式完成一位員工、用 HR 匯出，確認開檔無修復提示、下拉選單能用。匯出格式是不能上線的項目。

## 上線前必做

- 執行 `npm run demo:remove` 移除示範帳號（帳密存在 repo 裡，留在正式環境等於開後門）
- 正式環境不要用 `--include-seed`，假資料只給 staging
