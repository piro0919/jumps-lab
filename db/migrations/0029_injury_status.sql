-- ケガの経過（中元さんの弟さんの要望、2026-10-18）。直近14日に痛み・違和感のメモがある人に、メニューを作る画面で
-- 今の具合を4択で聞き、その日の行に残す: healed 完全に治った / better 軽くなった / same まだ痛む / worse 悪化した。
-- 治った以外は今日のアドバイスを「痛む箇所を守る」にし（src/lib/readiness.ts）、AI のメニューの材料にも送る
alter table day_log add column "injuryStatus" text
  check ("injuryStatus" in ('healed', 'better', 'same', 'worse'));
