-- 走高跳と棒高跳の、高さごとの結果（O X –。2026-10-14 に本人から任された）。1本の試技に任意で付ける。
-- [{"heightM": 1.8, "trials": ["missed", "cleared"]}, ...] の形で、高さの低い順。trials は cleared・missed・passed。
-- 規則（続けて3回の失敗、パス、1つの高さで3回まで）は src/lib/height-series.ts の checkSeries で確かめ、
-- 記録（"markM"）はいちばん高く越えた高さをサーバーが入れる。規則は高さをまたぐので SQL では書かない
-- （二重に書くとずれる）。DB は配列であることと高さの数と種目だけを見る。
-- いつも試技の行と一緒に読み書きし、高さだけを数える読み手は無いので、別の表にせず jsonb にする
alter table attempt
  add column "heightSeries" jsonb,
  add constraint attempt_height_series_shape check (
    "heightSeries" is null
    or (jsonb_typeof("heightSeries") = 'array' and jsonb_array_length("heightSeries") between 1 and 40)
  ),
  -- 高さごとの結果は走高跳と棒高跳だけ（Server Action もほかの種目では捨てる）
  add constraint attempt_height_series_event check (
    "heightSeries" is null or event in ('high_jump', 'pole_vault')
  );
