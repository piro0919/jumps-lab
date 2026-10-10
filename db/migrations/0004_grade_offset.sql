-- 学年は生年月日から毎回計算する（日本の時間帯の人だけ。日本の数え方なので）。
-- 計算と合わない人（浪人・留年・飛び級）のずれを年数で持つ。
-- grade の列は、生年月日が無い人と日本以外の人が手で選んだ学年に使う
alter table profile add column "gradeOffset" smallint not null default 0
  check ("gradeOffset" between -10 and 10);
