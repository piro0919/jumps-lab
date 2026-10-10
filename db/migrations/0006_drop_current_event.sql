-- 全画面に効く「見ている種目」をやめた（種目は画面ごとに扱う）。本番の DB を作る前なので、そのまま消す
alter table profile drop column "currentEvent";
