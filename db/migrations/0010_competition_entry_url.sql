-- 大会のエントリーサイト（2026-10-12 に本人と決めた。中元さんのフィードバック）。アプリから申し込みのサイトへ移れるようにする。
-- 日本の人は新しい大会を足すとき、日本陸連の申し込みサイト（JAAF Athletic Family）を初めから入れておく。ほかの国は空
alter table competition add column "entryUrl" text check (char_length("entryUrl") <= 2000);
