-- Initial dropdown values (SPEC section 5). `value` is the export value and matches the template.
-- pbm_principle wording awaits Tim's confirmation against current official Koch terms; HR can edit it.

insert into public.option_lists (list_key, value, label_zh, label_en, sort) values
  ('quarter', 'Q4 2026', '2026 Q4', 'Q4 2026', 1),

  ('retention_risk', 'Low', '低', 'Low', 1),
  ('retention_risk', 'Medium', '中', 'Medium', 2),
  ('retention_risk', 'High', '高', 'High', 3),

  ('mobility', 'Not Now', '目前不考慮', 'Not Now', 1),
  ('mobility', 'Now', '現在可以', 'Now', 2),
  ('mobility', '1-2 years', '1–2 年內', '1-2 years', 3),
  ('mobility', '3+ years', '3 年以上', '3+ years', 4),

  ('readiness', 'Too New to Rate (TNTR)', '太新無法評估', 'Too New to Rate (TNTR)', 1),
  ('readiness', 'Emergency Cover', '緊急代理', 'Emergency Cover', 2),
  ('readiness', 'Ready Now', '已就緒', 'Ready Now', 3),
  ('readiness', '1-2 years', '1–2 年內就緒', '1-2 years', 4),
  ('readiness', '3+ years', '3 年以上就緒', '3+ years', 5),

  ('retention_reason', 'Career Move', '職涯發展', 'Career Move', 1),
  ('retention_reason', 'Competitive Market', '市場競爭', 'Competitive Market', 2),
  ('retention_reason', 'Family Reasons', '家庭因素', 'Family Reasons', 3),
  ('retention_reason', 'Compensation Reasons', '薪酬因素', 'Compensation Reasons', 4),
  ('retention_reason', 'Retirement', '退休', 'Retirement', 5),
  ('retention_reason', 'Hybrid Work', '混合辦公', 'Hybrid Work', 6),
  ('retention_reason', 'Work Environment', '工作環境', 'Work Environment', 7),
  ('retention_reason', 'Risk of burnout', '過勞風險', 'Risk of burnout', 8),
  ('retention_reason', 'Role Development/Role Fit', '職務發展與適配', 'Role Development/Role Fit', 9),
  ('retention_reason', 'Culture Fit', '文化適配', 'Culture Fit', 10),

  ('critical_role', 'Yes--Check Box', '是', 'Yes', 1),
  ('critical_role', 'No--Leave box empty', '否', 'No', 2),

  ('key_talent_reason', 'Critical Role Holder', '關鍵職位任職者', 'Critical Role Holder', 1),
  ('key_talent_reason', 'Strong Performance Impact', '績效貢獻突出', 'Strong Performance Impact', 2),
  ('key_talent_reason', 'Scarce or Hard-to-Replace Skill', '稀缺或難以取代的技能', 'Scarce or Hard-to-Replace Skill', 3),
  ('key_talent_reason', 'Successor Candidate', '關鍵職位接班候選人', 'Successor Candidate', 4),
  ('key_talent_reason', 'High Growth Potential', '成長潛力高', 'High Growth Potential', 5),
  ('key_talent_reason', 'High-Impact Retention Concern', '流失衝擊大', 'High-Impact Retention Concern', 6),

  ('dev_type', 'Experience (70%)', '工作歷練', 'Experience (70%)', 1),
  ('dev_type', 'Exposure (20%)', '人際學習（輔導、導師、標竿）', 'Exposure (20%)', 2),
  ('dev_type', 'Education (10%)', '正式學習（課程、證照）', 'Education (10%)', 3),

  ('plan_status', 'Not Started', '未開始', 'Not Started', 1),
  ('plan_status', 'On Track', '進行中', 'On Track', 2),
  ('plan_status', 'At Risk', '有風險', 'At Risk', 3),
  ('plan_status', 'Completed', '已完成', 'Completed', 4),

  ('pbm_principle', 'Integrity', '誠信', 'Integrity', 1),
  ('pbm_principle', 'Compliance', '合規', 'Compliance', 2),
  ('pbm_principle', 'Value Creation', '價值創造', 'Value Creation', 3),
  ('pbm_principle', 'Principled Entrepreneurship', '原則性企業家精神', 'Principled Entrepreneurship', 4),
  ('pbm_principle', 'Customer Focus', '客戶導向', 'Customer Focus', 5),
  ('pbm_principle', 'Knowledge', '知識', 'Knowledge', 6),
  ('pbm_principle', 'Transformation', '轉型', 'Transformation', 7),
  ('pbm_principle', 'Humility', '謙遜', 'Humility', 8),
  ('pbm_principle', 'Respect', '尊重', 'Respect', 9),
  ('pbm_principle', 'Fulfillment', '成就感', 'Fulfillment', 10);
