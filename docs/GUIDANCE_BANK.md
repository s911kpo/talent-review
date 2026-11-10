# 引導題庫 Guidance Bank（繁中 / English）

用途：灌入 `question_bank` 資料表的初始內容，HR 之後可以在後台編輯。
結構：每題包含 **題目／一行提示（顯示在題目下方，不放在輸入框內）／燈泡內容（為什麼問、怎麼填）／好範例／弱範例／常見陷阱**。
範例中的人物、職務、數字都是虛構的示範，不是真實案例。

給 Claude Code：每題的 key 對應規格書 §6.4。燈泡內容用 markdown 存入 `guide_*`，好範例與弱範例分別存入 `good_example_*` 與 `weak_example_*`。

---

## KT_SELECT — 選出關鍵人才 / Identify Key Talent

**題目**
- 中：在你的團隊中，哪些人是需要重點關注與培養的關鍵人才？
- EN: Who on your team are the key talents that need focused attention and development?

**一行提示**
- 中：勾選後請至少選一個原因。不設比例，以業務需要為準。
- EN: Select at least one reason for each person. There is no quota; base it on business need.

**燈泡：為什麼問 / 怎麼判斷**
- 中：
  這次盤點只針對關鍵人才，好讓你把時間花在最重要的人身上。判斷時可以問自己五個問題，符合任一項就可以考慮列入：
  1. 他是否擔任「關鍵職位」：這個職位空缺 3–6 個月，會明顯影響出貨、品質、客戶或營收？
  2. 他的績效貢獻是否明顯、持續，而且團隊依賴他？
  3. 他是否掌握稀缺或難以取代的技能，例如特定製程、光學設計或關鍵客戶關係？
  4. 他是否是某個關鍵職位（包括你自己）的接班候選人？
  5. 如果他離開，衝擊會不會很大，而你目前已經感受到流失的訊號？

  不需要選很多人，也不需要每個人都選。被選中不代表「比較好」，而是代表「現在需要投資注意力」。
- EN:
  This review focuses only on key talent so your time goes to the people who matter most right now. Ask yourself five questions; meeting any one is enough to consider the person:
  1. Do they hold a critical role, one whose 3–6 month vacancy would significantly hurt delivery, quality, customers or revenue?
  2. Is their performance contribution clear and sustained, with the team relying on them?
  3. Do they hold scarce or hard-to-replace skills, such as a specific process, optical design expertise or a key customer relationship?
  4. Are they a successor candidate for a critical role, including your own?
  5. Would their departure have high impact, and are you already seeing retention signals?

  There is no target number. Being selected does not mean "better than others"; it means "needs focused attention now."

**好範例**
- 中：Process Engineer 陳○○，原因：稀缺技能、關鍵職位接班候選人。說明：唯一能獨立調整 FA 線熔接參數的人，也是 PE 副理的接班人選。
- EN: Process Engineer Chen, reasons: Scarce Skill, Successor Candidate. Note: The only engineer who can independently tune splicing parameters on the FA line; a successor candidate for the PE Associate Manager.

**弱範例**
- 中：全組 13 人都勾選，原因都選「績效貢獻突出」。
- EN: All 13 team members selected, each with "Strong Performance Impact" as the only reason.

**常見陷阱**
- 中：把「資深」當成「關鍵」；忘了把自己的接班人列入；只選跟自己比較熟的人。
- EN: Treating seniority as criticality; forgetting to include your own successor; selecting only people you work closely with.

---

## 1. CRITICAL_ROLE — 關鍵職位 / Critical Role（S 欄）

**題目**
- 中：這位員工目前的職位，是關鍵職位嗎？
- EN: Is this employee's current role a critical role?

**一行提示**
- 中：判斷的是「職位」，不是「這個人」。如果這個職位空缺 3–6 個月，會不會嚴重影響營運成果？
- EN: Judge the role, not the person. Would a 3–6 month vacancy significantly impact results?

**燈泡**
- 中：關鍵職位是能創造最大價值、影響最大的職位。判斷方式：想像這個職位明天空出來，而 3–6 個月都補不到人，出貨、良率、客戶交付、新產品導入或法規遵循會不會出現重大問題？會的話就選「是」。同一團隊可以有好幾個關鍵職位，也可以沒有。
- EN: A critical role delivers the most value and strategic impact. Imagine it is vacant tomorrow and cannot be filled for 3–6 months: would shipments, yield, customer delivery, new product introduction or compliance be significantly affected? If yes, select Yes. A team may have several critical roles, or none.

**好範例**
- 中：是。品質工程師負責主要客戶的 8D 與稽核窗口，空缺時客訴回覆會超出 SLA。
- EN: Yes. The quality engineer owns 8D and audit liaison for a top customer; a vacancy would breach complaint-response SLAs.

**弱範例**
- 中：是，因為他很認真。
- EN: Yes, because he works hard.

**常見陷阱**
- 中：把個人表現和職位重要性混在一起。
- EN: Mixing individual performance with role criticality.

---

## 2. PERF_STRENGTHS — 績效強項 / Performance Strengths（O 欄）

**題目**
- 中：這位員工最常展現、而且比別人更突出的工作強項是什麼？
- EN: What performance strengths does this person demonstrate often, where they have a comparative advantage?

**一行提示**
- 中：寫 1–3 項，每項最好附一個具體事例或成果。
- EN: List 1–3 strengths, ideally each with a concrete example or result.

**燈泡**
- 中：用「強項＋事例＋影響」的句型：他擅長什麼 → 在哪件事情上展現 → 帶來什麼結果（數字更好）。避免形容詞堆疊。「比較優勢」是指他做得比團隊中其他人更好、更快或更穩的地方。
- EN: Use "strength + example + impact": what they are good at → where it showed → what result it produced (numbers help). Avoid stacking adjectives. "Comparative advantage" means what they do better, faster or more reliably than others on the team.

**好範例**
- 中：
  1. 製程問題分析：2026 Q3 主導 MPO 端面不良分析，三週內把不良率從 2.1% 降到 0.6%。
  2. 跨部門協調：新產品導入時同時對接 R&D 與產線，試產一次通過。
- EN:
  1. Process problem-solving: led MPO end-face defect analysis in Q3 2026, cutting the defect rate from 2.1% to 0.6% in three weeks.
  2. Cross-functional coordination: bridged R&D and production during NPI; pilot run passed first time.

**弱範例**
- 中：認真負責、配合度高、表現不錯。
- EN: Hardworking, cooperative, good performance.

**常見陷阱**
- 中：只描述職責而不是強項；所有人都寫一樣的內容。
- EN: Describing job duties instead of strengths; writing the same text for everyone.

---

## 3. PBM_STRENGTHS — PBM 文化強項 / PBM Cultural Strengths（M 欄）

**題目**
- 中：在 PBM（原則導向管理）中，這位員工最常實踐哪 1–3 項原則？
- EN: Which 1–3 PBM Guiding Principles does this person demonstrate most frequently?

**一行提示**
- 中：先選原則，再用一句話描述你實際看到的行為。
- EN: Pick the principle(s), then describe one behavior you actually observed.

**燈泡**
- 中：PBM 看的是「做事的方式」，不只是結果。請選他經常展現的原則，並寫出具體行為：在什麼情境下，他做了什麼。例如「謙遜」可以是主動承認自己的錯誤並修正；「客戶導向」可以是先站在客戶的角度確認需求再動手。一句行為證據就夠了。
- EN: PBM is about how work gets done, not only results. Select principles the person shows frequently and write the specific behavior: in what situation, what did they do. For example, Humility can look like openly owning a mistake and fixing it; Customer Focus can look like confirming the customer's real need before acting. One behavioral sentence is enough.

**好範例**
- 中：
  - 知識：每次異常處理後都主動整理成 one-page lesson，分享給全組。
  - 尊重：與產線組長溝通時會先聽完現場的意見，再提方案，現場配合度高。
- EN:
  - Knowledge: after each abnormality, proactively writes a one-page lesson learned and shares it with the team.
  - Respect: listens fully to line leaders before proposing solutions, earning strong cooperation on the floor.

**弱範例**
- 中：誠信：他很誠實。
- EN: Integrity: he is honest.

**常見陷阱**
- 中：只寫原則名稱而沒有行為；選太多項原則，每項都沒有證據。
- EN: Naming a principle without behavior; selecting many principles with no evidence.

---

## 4. PBM_IMPROVE — PBM 文化改善機會 / PBM Cultural Improvement Opportunities（N 欄）

**題目**
- 中：在哪 1–3 項原則上，這位員工如果改善，能對團隊文化帶來更大的貢獻？
- EN: In which 1–3 principles could this person improve to contribute even more to our culture?

**一行提示**
- 中：描述可以觀察到的行為與期待的改變，不評論個性。
- EN: Describe observable behavior and the desired change, not personality.

**燈泡**
- 中：句型：「在＿＿情境下，目前會＿＿；如果能＿＿，對團隊的影響是＿＿」。重點在「可以改變的行為」，不是貼標籤。每個人都有改善空間，寫出來是為了後續的發展計畫，不是扣分。
- EN: Pattern: "In ___ situations, currently ___; if they could ___, the impact on the team would be ___." Focus on changeable behavior, not labels. Everyone has room to grow; this feeds the development plan and is not a penalty.

**好範例**
- 中：轉型：面對新系統導入時，傾向沿用舊的 Excel 流程；如果能主動試用 MES 新功能並回饋，可以帶動組內數位化。
- EN: Transformation: tends to stick to legacy Excel workflows when new systems roll out; proactively piloting new MES features and giving feedback would help the team digitalize.

**弱範例**
- 中：個性太固執。
- EN: Too stubborn.

**常見陷阱**
- 中：寫成人格評語；寫了改善點，發展計畫卻完全沒有對應。
- EN: Writing personality judgments; listing improvements with no link to the development plan.

---

## 5. DEV_AREAS — 發展領域 / Development Areas（P 欄）

**題目**
- 中：為了在現職做出更大貢獻，或為下一個職位做好準備，這位員工最需要發展的 1–3 個領域是什麼？
- EN: What 1–3 key areas should this person develop to contribute more in the current role or to be ready for the next role?

**一行提示**
- 中：可以是經驗、能力或原則。每項一句，越具體越好；下一步會為每一項各建立一張發展計畫卡。
- EN: These can be experiences, attributes or principles. One sentence each, as specific as possible. Each area becomes a development plan card later.

**燈泡**
- 中：好的發展領域是「縮小差距」：對照下一個職位（或現職的更高標準）還缺什麼。三種常見類型：
  - 經驗缺口：例如沒帶過跨部門專案、沒有直接面對客戶的經驗。
  - 能力缺口：例如數據分析、成本概念、英文簡報。
  - 原則或行為：例如授權、衝突處理、主動回報。

  最多 3 項，聚焦比全面更重要。
- EN: Good development areas close a gap against the next role (or a higher bar in the current role). Common types:
  - Experience gaps, e.g. never led a cross-functional project, no direct customer exposure.
  - Capability gaps, e.g. data analysis, cost awareness, presenting in English.
  - Principles or behaviors, e.g. delegation, handling conflict, proactive escalation.

  Three at most; focus beats coverage.

**好範例**
- 中：
  1. 帶領跨部門專案的經驗（目前只在部門內主導）
  2. 用數據向主管簡報與爭取資源
- EN:
  1. Experience leading cross-functional projects (so far only within the department)
  2. Using data to present to management and secure resources

**弱範例**
- 中：加強管理能力、提升溝通、多學習。
- EN: Improve management skills, communicate better, learn more.

**常見陷阱**
- 中：寫太多項；寫得太空泛，後續無法擬定行動。
- EN: Too many areas; too vague to turn into actions.

---

## 6. ASPIRATIONS — 個人職涯期望 / Personal Aspirations（Q 欄）

**題目**
- 中：這位員工自己希望未來的職涯怎麼發展？
- EN: How does this person want to grow their career in the future?

**一行提示**
- 中：寫員工本人說過的想法。如果還沒聊過，請勾選「尚未與本人討論」。
- EN: Record what the employee has told you. If you have not discussed it, tick "Not yet discussed."

**燈泡**
- 中：這題記錄的是「員工的期望」，不是你對他的期待。如果你不確定，代表需要一場職涯對話。建議在 11/30 前找 15 分鐘問三個問題：
  1. 未來 2–3 年你希望自己在做什麼？
  2. 你最想累積哪種經驗？
  3. 有沒有什麼會讓你考慮離開？

  勾選「尚未與本人討論」不會扣分，HR 會統計這個缺口來規劃支援。
- EN: This captures the employee's own aspirations, not your expectations of them. If you are unsure, that signals a career conversation is needed. Before 11/30, take 15 minutes and ask:
  1. What do you want to be doing in 2–3 years?
  2. What experience do you most want to build?
  3. Is there anything that would make you consider leaving?

  Ticking "Not yet discussed" is not a penalty; HR tracks it to plan support.

**好範例**
- 中：希望 2–3 年內往技術專家（光學設計）發展，暫時不考慮管理職；有興趣參與海外客戶的專案。
- EN: Wants to grow toward a technical expert track (optical design) within 2–3 years, not management for now; interested in projects with overseas customers.

**弱範例**
- 中：應該想升官。
- EN: Probably wants a promotion.

**常見陷阱**
- 中：用主管的猜測代替員工本人的說法。
- EN: Substituting the manager's guess for the employee's actual voice.

---

## 7. NEXT_ROLES — 可能的下一個職位與準備度 / Possible Next Roles & Readiness（I、J 欄）

**題目**
- 中：這位員工未來可以成長並勝任哪些職位？分別需要多久才能準備好？
- EN: Which roles could this person grow into, and how long until they are ready for each?

**一行提示**
- 中：最多 3 個職位，可以是升遷、平調或跨部門。準備度依每個職位各自選擇。
- EN: Up to 3 roles: promotion, lateral or cross-functional. Choose readiness for each role.

**燈泡**
- 中：準備度定義：
  - Ready Now（已就緒）：現在就能勝任，只需要一般的交接。
  - 1–2 years（1–2 年內就緒）：還有 1–2 個明確的缺口，透過發展計畫可以補上。
  - 3+ years（3 年以上就緒）：方向正確，但還需要多項經驗累積。
  - Emergency Cover（緊急代理）：職位突然空缺時可以暫代，但不是長期人選。
  - TNTR（太新無法評估）：在現職或在 Molex 未滿 6 個月。

  職位名稱可以寫公司內的實際職稱，也可以寫職能方向，例如「資深製程工程師」、「PE 副理」、「品質系統工程師（跨部門）」。下一個職位不一定是升遷，平調擴展經驗也很有價值。
- EN: Readiness definitions:
  - Ready Now: could step in now with a normal handover.
  - 1-2 years: 1–2 clear gaps that the development plan can close.
  - 3+ years: right direction, several experiences still needed.
  - Emergency Cover: could cover temporarily if the role suddenly became vacant, but not a long-term fit.
  - TNTR (Too New to Rate): less than 6 months in the current role or at Molex.

  Use an actual job title or a functional direction, such as "Sr. Process Engineer," "PE Associate Manager" or "Quality Systems Engineer (cross-functional)." The next role need not be a promotion; lateral moves that broaden experience are valuable too.

**好範例**
- 中：1. Sr. Process Engineer — 1–2 年內就緒；2. 製程副理 — 3 年以上就緒。
- EN: 1. Sr. Process Engineer — 1-2 years; 2. Process Associate Manager — 3+ years.

**弱範例**
- 中：主管 — Ready Now（沒有指出是哪個職位，也沒有發展領域支撐）。
- EN: Manager — Ready Now (no specific role, no development area to support it).

**常見陷阱**
- 中：到職未滿 6 個月卻選 Ready Now；所有人的準備度都選同一個值。
- EN: Choosing Ready Now for someone under 6 months; giving everyone the same readiness.

---

## 8. MOBILITY — 流動意願 / Mobility Status（G、H 欄）

**題目**
- 中：這位員工是否有意願、也能夠調動到其他城市或國家工作？
- EN: Is this person interested in and available to move to a different city or country?

**一行提示**
- 中：依你所知或本人表達過的意願選擇；若選擇可以流動，再填寫期望地點。
- EN: Based on what you know or what they have said; if mobile, add desired locations.

**燈泡**
- 中：Not Now = 目前不考慮；Now = 現在就可以；1–2 years / 3+ years = 未來時間點。這題影響的是跨廠、跨國的發展機會（例如支援其他 Molex 據點）。不確定時，選擇最接近你所知的狀況，並把它加進職涯對話的問題清單。期望地點請寫「城市＋國家」，例如「Lisle, USA」、「Dongguan, China」。
- EN: Not Now / Now / 1-2 years / 3+ years. This affects cross-site and international opportunities, such as supporting other Molex sites. If unsure, choose the closest to what you know and add it to the career conversation. Write locations as "City, Country," e.g., "Lisle, USA" or "Dongguan, China."

**好範例**
- 中：1–2 years；期望地點：Penang, Malaysia（家庭因素，短期派駐可以接受）。
- EN: 1-2 years; desired location: Penang, Malaysia (short-term assignments acceptable due to family).

**弱範例**
- 中：Now（沒有問過本人）。
- EN: Now (never asked the employee).

**常見陷阱**
- 中：替員工決定他的意願。
- EN: Deciding on the employee's behalf.

---

## 9. RETENTION — 留任風險與原因 / Retention Risk & Reasons（E、F 欄）

**題目**
- 中：這位員工在未來 12 個月內離開公司的風險有多高？
- EN: How likely is this person to leave the company in the next 12 months?

**一行提示**
- 中：依可觀察的訊號判斷。選中或高時，請選 1–2 個主要原因。
- EN: Judge by observable signals. If Medium or High, choose the 1–2 main reasons.

**燈泡**
- 中：參考訊號：
  - 近期職涯期望沒有被回應
  - 市場上同類職缺很搶手
  - 薪酬明顯低於市場行情
  - 工作量長期過高
  - 家庭或通勤狀況改變
  - 投入度下降，例如不再主動提出意見

  定義：
  - Low（低）：沒有明顯訊號。
  - Medium（中）：有 1–2 個訊號，但目前仍然投入。
  - High（高）：有多個訊號，或已經明確表達要離開，或在面試其他公司。

  這題內容只有你、你的上級主管與 HR 看得到，不會讓員工本人看到。請如實填寫，才能及早介入。
- EN: Signals to consider:
  - Unaddressed career aspirations
  - Hot market demand for similar roles
  - Pay clearly below market
  - Sustained excessive workload
  - Changes in family or commute situation
  - Declining engagement, such as no longer volunteering ideas

  Definitions:
  - Low: no clear signals.
  - Medium: 1–2 signals, still engaged.
  - High: multiple signals, explicit intent to leave, or actively interviewing.

  Only you, your manager and HR can see this; the employee cannot. Be candid so action can be taken early.

**好範例**
- 中：中；原因：Competitive Market、Role Development/Role Fit。同業近期積極挖角光學工程師，而本人提過希望接觸新產品開發。
- EN: Medium; reasons: Competitive Market, Role Development/Role Fit. Competitors are actively recruiting optical engineers, and the employee has asked for exposure to new product development.

**弱範例**
- 中：全組都選 Low。
- EN: Low for the whole team by default.

**常見陷阱**
- 中：怕「看起來管理不好」而低報；只憑感覺，沒有訊號。
- EN: Under-reporting to avoid looking bad; judging by gut with no signals.

---

## 10. SUCCESSORS — 現職接班人 / Successors for Current Role（K、L 欄）

**題目**
- 中：在 Molex 或 Koch 內，誰可以接手這位員工的職位，並為團隊帶來加分？
- EN: Within Molex or Koch, who could fill this person's role and be additive to the team?

**一行提示**
- 中：最多 3 位。可以從名單中選擇、輸入名單外的姓名，或選擇 TBH（需要外部招募）。
- EN: Up to 3. Pick from the list, type a name not on the list, or choose TBH (external hire needed).

**燈泡**
- 中：接班人不一定是同部門的人，也可以是其他部門或其他 Molex 據點的同仁。準備度的定義與第 7 題相同。如果組織內確實沒有合適人選，請選 TBH（To-Be-Hired）。這代表目前沒有接班梯隊，需要積極外部獵才，HR 會據此規劃招募。坦白標示 TBH，比勉強填一個人更有價值。
- EN: Successors need not be from the same department; they can come from other functions or other Molex sites. Readiness definitions match question 7. If there is genuinely no internal candidate, choose TBH (To-Be-Hired). It means there is no bench and proactive external search is needed, and HR will plan recruiting accordingly. An honest TBH is more valuable than a forced name.

**好範例**
- 中：1. Lin, A（PE）— 1–2 年內就緒；2. TBH。
- EN: 1. Lin, A (PE) — 1-2 years; 2. TBH.

**弱範例**
- 中：每個人的接班人都填同一位資深同事，而且都是 Ready Now。
- EN: The same senior colleague named as Ready Now successor for everyone.

**常見陷阱**
- 中：同一個人被列為太多職位的接班人；明明沒有人選，卻不願意選 TBH。
- EN: Naming one person as successor for too many roles; avoiding TBH when there is no real candidate.

---

## 11. DEV_PLAN — 發展計畫 / Development Plan（Development Plan 工作表）

**題目**
- 中：針對每個發展領域，接下來要怎麼做？
- EN: For each development area, what will happen next?

**一行提示**
- 中：每個領域一張卡：寫出條列式行動、時間軸與評核方式。
- EN: One card per area: bulleted actions, timeline and how progress will be evaluated.

**燈泡：好計畫的四個要件**
- 中：
  1. **具體**：寫「做什麼事」，不是「加強什麼」。每行一個行動，至少 2 項。
  2. **70-20-10**：70% 來自工作歷練（新任務、輪調、專案），20% 來自人（導師、影子學習、回饋），10% 來自課程。只寫「上課」通常不夠。
  3. **時間軸**：設定開始日與目標日，建議 3–9 個月，並在中間設一個檢查點。
  4. **評核機制**：寫清楚怎麼確認做到了、由誰確認、什麼時候檢視，例如「2027/3 季度面談時，以專案結案報告確認」。

  負責人通常是員工本人，主管是支持者。
- EN:
  1. **Specific**: write what will be done, not "improve X." One action per line, at least two.
  2. **70-20-10**: 70% from on-the-job experience (stretch tasks, rotations, projects), 20% from people (mentoring, shadowing, feedback), 10% from courses. "Attend training" alone is rarely enough.
  3. **Timeline**: set start and target dates, ideally 3–9 months, with a midpoint checkpoint.
  4. **Evaluation**: state how completion is confirmed, by whom and when, e.g., "Confirmed via project close-out report at the March 2027 quarterly check-in."

  The owner is usually the employee; the manager is the sponsor.

**好範例**
- 中：
  - 發展領域：帶領跨部門專案的經驗
  - 目標：2027/6 前獨立主導一個跨 PE／QA／R&D 的改善專案，並如期結案
  - 類型：Experience (70%)
  - 行動：
    - 2026/12 擔任 FA 線換線時間改善專案的 PM
    - 每兩週主持專案會議，並向 PE 副理報告進度
    - 2027/1 起每月與 R&D 資深經理進行 30 分鐘導師對談
  - 資源：PE 副理擔任 sponsor；外訓預算：專案管理基礎課程 1 堂
  - 負責人：員工本人
  - 期間：2026/12/1 – 2027/6/30
  - 評核機制：2027/3 期中檢視專案里程碑；2027/6 以結案報告與換線時間是否降低 20% 確認，由 PE 副理確認
- EN:
  - Area: Experience leading cross-functional projects
  - Goal: Independently lead and close one PE/QA/R&D improvement project by June 2027
  - Type: Experience (70%)
  - Actions:
    - Serve as PM for the FA-line changeover reduction project from Dec 2026
    - Chair bi-weekly project meetings and report to the PE Associate Manager
    - Monthly 30-minute mentoring with the R&D Senior Manager from Jan 2027
  - Support: PE Associate Manager as sponsor; one external project-management fundamentals course
  - Owner: Employee
  - Dates: 2026/12/1 – 2027/6/30
  - Evaluation: Mid-point milestone review in March 2027; confirmed in June 2027 by close-out report and a 20% changeover-time reduction, verified by the PE Associate Manager

**弱範例**
- 中：行動：參加管理課程、多跟主管學習。期間：明年。評核：看表現。
- EN: Actions: attend a management course, learn from manager. Dates: next year. Evaluation: see performance.

**常見陷阱**
- 中：只有課程；沒有日期；評核方式寫「看表現」；計畫和發展領域對不起來。
- EN: Courses only; no dates; "see performance" as the evaluation; the plan does not match the development area.

---

## 12. COMMENTS — 其他補充 / Additional Comments（R 欄）

**題目**
- 中：還有什麼是 HR 或你的主管應該知道的嗎？
- EN: Anything else HR or your manager should know?

**一行提示**
- 中：選填。例如近期的重要變化、需要 HR 協助的事項。
- EN: Optional, e.g., recent important changes or support needed from HR.

**燈泡**
- 中：可以補充：
  - 近期角色變動
  - 正在進行的留才措施
  - 需要 HR 協助的事，例如調薪評估、輪調機會、外部招募

  請避免寫入與工作無關的個人隱私，例如健康或家庭細節。
- EN: You may add:
  - Recent role changes
  - Retention actions in progress
  - Support needed from HR, such as a pay review, rotation opportunity or external hiring

  Avoid non-work private details such as health or family specifics.

**好範例**
- 中：已在 10 月提出調薪評估申請，需要 HR 協助確認市場行情。
- EN: Submitted a pay review request in October; needs HR support on market benchmarking.

**弱範例**
- 中：（寫入員工家庭或健康的細節）
- EN: (Detailing the employee's family or health situation)

**常見陷阱**
- 中：寫入敏感個資。
- EN: Including sensitive personal data.

---

## SUBMIT_HRBP — 提交後：與 HRBP 討論 / After Submission: Discuss with HRBP

**標題**
- 中：下一步：與 HRBP 討論並定稿
- EN: Next: Review and finalize with your HRBP

**內文**
- 中：提交不是結束。請在 11/30 前與 HRBP 約 30–45 分鐘，一起確認三件事：
  1. 優先行動：哪些關鍵人才需要先處理留任或發展？
  2. 接班缺口：哪些關鍵職位沒有已就緒的接班人？要內部培養還是外部招募？
  3. 發展計畫：計畫是否具體可行？需要哪些資源？

  系統已經依你的資料整理好討論重點與團隊摘要，可以列印帶到會議上。
- EN: Submission is not the end. Before 11/30, book 30–45 minutes with your HRBP to align on three things:
  1. Priority actions: which key talents need retention or development action first?
  2. Succession gaps: which critical roles lack a ready successor, and should you build internally or hire externally?
  3. Development plans: are they specific and feasible, and what resources are needed?

  The system has prepared discussion points and a team summary from your data, which you can print and bring.

---

## UI 固定字串（部分）/ Core UI strings (excerpt)

| key | zh-TW | en |
|---|---|---|
| autosave.saved | 已儲存 · {time} | Saved · {time} |
| autosave.saving | 儲存中… | Saving… |
| autosave.error | 儲存失敗，正在重試 | Save failed, retrying |
| badge.tntr | 到職未滿 6 個月 | Under 6 months |
| badge.key | 關鍵人才 | Key talent |
| kt.counter | 已選 {n} / {total} 位 | {n} of {total} selected |
| kt.no_quota | 不設比例，以業務需要為準 | No quota; based on business need |
| tbh.desc | 目前組織內沒有接班人選，需要外部招募 | No internal bench; external hire needed |
| aspiration.not_discussed | 尚未與本人討論 | Not yet discussed with employee |
| submit.reopen | 申請修改 | Request changes |
| ai.disclaimer | AI 生成，僅供參考 | AI-generated, for reference only |
| mobile.banner | 建議使用電腦填寫，手機適合查看與小修改 | Desktop recommended; mobile is best for viewing and quick edits |
