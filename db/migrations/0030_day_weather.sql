-- その日の天気（中元さんの弟さんの要望、2026-10-18）。コンディションを入れるときに、端末の位置で Open-Meteo から取った
-- 天気・気温・風速・風向を、その日の行に残す。位置は残さない。試技の風（走路の風速計）には写さない。
-- weatherCode は WMO の天気の番号（0〜99）、weatherIsDay は絵を昼と夜で替えるため。4つは全部あるか全部無いか
alter table day_log
  add column "weatherCode" smallint check ("weatherCode" between 0 and 99),
  add column "weatherTempC" numeric(4, 1) check ("weatherTempC" between -90 and 60),
  add column "weatherWindMs" numeric(4, 1) check ("weatherWindMs" between 0 and 120),
  add column "weatherWindDeg" smallint check ("weatherWindDeg" between 0 and 359),
  add column "weatherIsDay" boolean,
  add constraint day_log_weather_all_or_none check (
    ("weatherCode" is null) = ("weatherTempC" is null)
    and ("weatherCode" is null) = ("weatherWindMs" is null)
    and ("weatherCode" is null) = ("weatherWindDeg" is null)
    and ("weatherCode" is null) = ("weatherIsDay" is null)
  );

-- 共同利用（プライバシーポリシー 4.）の項目の、どの版に同意したか。天気は版 2 で足した項目で、
-- 同意した人の天気だけを保存する（src/lib/joint-use.ts）。今いる人は null（版 1 のまま）。
-- これから作るプロフィールは、版 2 の一覧を載せたポリシーにログインの画面で同意しているので、保存のときに版を入れる
alter table profile
  add column "jointUseVersion" smallint,
  add column "jointUseAgreedAt" timestamptz;
