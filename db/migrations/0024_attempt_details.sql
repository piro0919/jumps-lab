-- 試技ごとの跳躍の細かい記録（2026-10-14 に本人から任された）。跳躍の選手は助走の歩数や踏切の位置、
-- ポールの長さ・硬さをノートに書いていて、ほかのアプリには置く場所がない。どれも任意で、空のままでよい。
-- 長さはメートル（記録と同じく 0.1mm まで。フィート・インチで入れた値を戻すため）、短い長さは cm（0.1cm まで。
-- インチで入れた値を戻すため）、ポールの硬さはポンドで持つ（業界がどの国でもポンドで書くため）。
-- jsonb ひとつにせず列に分けたのは、範囲の check を DB にかけられ、型が数で決まり、node-postgres が
-- numeric を文字で返すのも記録と同じ扱いで済むため。種目ごとの列は数が決まっていて、増えても列を足せばよい。
-- 範囲は src/lib/limits.ts と同じ値（画面と Server Action も同じ柵をかける）
alter table attempt
  -- 助走の歩数（全種目）
  add column "approachSteps" smallint check ("approachSteps" between 1 and 30),
  -- 助走の距離（全種目）
  add column "approachLengthM" numeric(6, 4) check ("approachLengthM" between 1 and 60),
  -- 踏切板の前の端（踏切線）からつま先までの距離（走幅跳・三段跳）。
  -- 正は踏切線より手前（損をした距離）、負は踏切線を越えた（ファウル）。0 はちょうど線の上
  add column "boardOffsetCm" numeric(4, 1) check ("boardOffsetCm" between -30 and 100),
  -- ポールの長さ（棒高跳）
  add column "poleLengthM" numeric(5, 4) check ("poleLengthM" between 2 and 6),
  -- ポールの硬さ（棒高跳）。ポールに書かれたポンドの数
  add column "poleStiffnessLb" smallint check ("poleStiffnessLb" between 50 and 250),
  -- グリップの高さ（棒高跳）。上の手からポールの下の端まで
  add column "gripHeightM" numeric(5, 4) check ("gripHeightM" between 1 and 6),
  -- 支柱の位置（棒高跳）。ボックスの奥の端から着地場所の向きへ。規則で 0〜80cm
  add column "standardsCm" numeric(4, 1) check ("standardsCm" between 0 and 80),
  -- 種目に合わない細かい記録は持たない（Server Action も種目に合わない欄は捨てる）
  add constraint attempt_board_offset_event check (
    "boardOffsetCm" is null or event in ('long_jump', 'triple_jump')
  ),
  add constraint attempt_pole_event check (
    event = 'pole_vault'
    or ("poleLengthM" is null and "poleStiffnessLb" is null and "gripHeightM" is null
      and "standardsCm" is null)
  ),
  -- グリップはポールより高く握れない
  add constraint attempt_grip_within_pole check ("gripHeightM" <= "poleLengthM");
