-- 大会の取り込み（2026-10-15）。日程ページや要項を AI に読ませた回数も ai_call に数え、
-- 1日・1か月の上限（src/lib/menu.ts の AI_CALL_LIMITS）をメニューと同じように効かせる
alter table ai_call drop constraint ai_call_kind_check;
alter table ai_call add constraint ai_call_kind_check
  check (kind in ('menu', 'chat', 'meetImport'));
