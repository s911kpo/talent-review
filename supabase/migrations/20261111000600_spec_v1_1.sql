-- SPEC v1.1: PBM values become Molex "Our Values" (8 items, in this order). The four retired values
-- are deactivated rather than deleted, so any older record still shows a label.
update public.option_lists set is_active = false
where list_key = 'pbm_principle' and value in ('Compliance', 'Value Creation', 'Customer Focus', 'Fulfillment');

insert into public.option_lists (list_key, value, label_zh, label_en, sort) values
  ('pbm_principle', 'Integrity', '誠信', 'Integrity', 1),
  ('pbm_principle', 'Stewardship & Compliance', '當責管理與合規', 'Stewardship & Compliance', 2),
  ('pbm_principle', 'Principled Entrepreneurship', '原則性企業家精神', 'Principled Entrepreneurship', 3),
  ('pbm_principle', 'Transformation', '轉型', 'Transformation', 4),
  ('pbm_principle', 'Knowledge', '知識', 'Knowledge', 5),
  ('pbm_principle', 'Humility', '謙遜', 'Humility', 6),
  ('pbm_principle', 'Respect', '尊重', 'Respect', 7),
  ('pbm_principle', 'Self-Actualize', '自我實現', 'Self-Actualize', 8)
on conflict (list_key, value) do update
  set label_zh = excluded.label_zh, label_en = excluded.label_en, sort = excluded.sort, is_active = true;

-- Question wording for the two PBM questions, from docs/GUIDANCE_BANK.md v1.1.
update public.question_bank set
  title_zh = $gb$PBM 文化強項$gb$,
  title_en = $gb$PBM Cultural Strengths$gb$,
  question_zh = $gb$在 PBM 核心價值（Our Values）中，這位員工最常實踐哪 1–3 項？$gb$,
  question_en = $gb$Which 1–3 PBM Values (Our Values) does this person demonstrate most frequently?$gb$,
  hint_zh = $gb$先選價值，再用一句話描述你實際看到的行為。$gb$,
  hint_en = $gb$Pick the value(s), then describe one behavior you actually observed.$gb$,
  guide_zh = $gb$PBM 看的是「做事的方式」，不只是結果。Molex 的 8 項核心價值是：誠信（Integrity）、當責管理與合規（Stewardship & Compliance）、原則性企業家精神（Principled Entrepreneurship）、轉型（Transformation）、知識（Knowledge）、謙遜（Humility）、尊重（Respect）、自我實現（Self-Actualize）。請選他經常展現的價值，並寫出具體行為：在什麼情境下，他做了什麼。例如「謙遜」可以是主動承認自己的錯誤並修正；「原則性企業家精神」可以是主動找出為客戶與公司創造價值的機會，並在規範內推動。一句行為證據就夠了。$gb$,
  guide_en = $gb$PBM is about how work gets done, not only results. Molex's eight values are Integrity, Stewardship & Compliance, Principled Entrepreneurship, Transformation, Knowledge, Humility, Respect and Self-Actualize. Select values the person shows frequently and write the specific behavior: in what situation, what did they do. For example, Humility can look like openly owning a mistake and fixing it; Principled Entrepreneurship can look like proactively spotting a way to create value for customers and the company, and driving it within the rules. One behavioral sentence is enough.$gb$,
  good_example_zh = $gb$- 知識：每次異常處理後都主動整理成 one-page lesson，分享給全組。
- 尊重：與產線組長溝通時會先聽完現場的意見，再提方案，現場配合度高。$gb$,
  good_example_en = $gb$- Knowledge: after each abnormality, proactively writes a one-page lesson learned and shares it with the team.
- Respect: listens fully to line leaders before proposing solutions, earning strong cooperation on the floor.$gb$,
  weak_example_zh = $gb$誠信：他很誠實。$gb$,
  weak_example_en = $gb$Integrity: he is honest.$gb$,
  pitfalls_zh = $gb$只寫價值名稱而沒有行為；選太多項，每項都沒有證據。$gb$,
  pitfalls_en = $gb$Naming a value without behavior; selecting many values with no evidence.$gb$
where key = 'PBM_STRENGTHS';
update public.question_bank set
  title_zh = $gb$PBM 文化改善機會$gb$,
  title_en = $gb$PBM Cultural Improvement Opportunities$gb$,
  question_zh = $gb$在哪 1–3 項 PBM 核心價值上，這位員工如果改善，能對團隊文化帶來更大的貢獻？$gb$,
  question_en = $gb$In which 1–3 PBM Values could this person improve to contribute even more to our culture?$gb$,
  hint_zh = $gb$描述可以觀察到的行為與期待的改變，不評論個性。$gb$,
  hint_en = $gb$Describe observable behavior and the desired change, not personality.$gb$,
  guide_zh = $gb$句型：「在＿＿情境下，目前會＿＿；如果能＿＿，對團隊的影響是＿＿」。重點在「可以改變的行為」，不是貼標籤。每個人都有改善空間，寫出來是為了後續的發展計畫，不是扣分。$gb$,
  guide_en = $gb$Pattern: "In ___ situations, currently ___; if they could ___, the impact on the team would be ___." Focus on changeable behavior, not labels. Everyone has room to grow; this feeds the development plan and is not a penalty.$gb$,
  good_example_zh = $gb$轉型：面對新系統導入時，傾向沿用舊的 Excel 流程；如果能主動試用 MES 新功能並回饋，可以帶動組內數位化。$gb$,
  good_example_en = $gb$Transformation: tends to stick to legacy Excel workflows when new systems roll out; proactively piloting new MES features and giving feedback would help the team digitalize.$gb$,
  weak_example_zh = $gb$個性太固執。$gb$,
  weak_example_en = $gb$Too stubborn.$gb$,
  pitfalls_zh = $gb$寫成人格評語；寫了改善點，發展計畫卻完全沒有對應。$gb$,
  pitfalls_en = $gb$Writing personality judgments; listing improvements with no link to the development plan.$gb$
where key = 'PBM_IMPROVE';
