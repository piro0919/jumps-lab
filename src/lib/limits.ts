/**
 * 入力の範囲。画面の欄（maxLength・min・max）と Server Action の検査で同じ値を使う。
 * 画面とサーバーの両方から読むので、server-only にしない
 */

/** 試技・動画のメモと、けがのメモの字数 */
export const NOTE_MAX_LENGTH = 500;
/** その日の練習メモと、大会のメモの字数 */
export const LONG_NOTE_MAX_LENGTH = 2000;

/** 大会の申し込みのサイトの URL の字数 */
export const URL_MAX_LENGTH = 2000;

/** 記録（メートル）の下限と上限 */
export const MARK_MIN_M = 0.01;
export const MARK_MAX_M = 29.99;

/** 風（m/s）の上限。下限はこの負の値 */
export const WIND_LIMIT_MS = 20;

/** 体調と疲れの段階の上限（1〜10） */
export const SCALE_MAX = 10;

/** 身長（cm）と体重（kg）の範囲 */
export const HEIGHT_MIN_CM = 50;
export const HEIGHT_MAX_CM = 250;
export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 300;

/** シーズンの始まりの月の上限（12月） */
export const MONTHS_PER_YEAR = 12;

/** 保護者のメールアドレスの字数（メールアドレスの上限の 254 文字） */
export const EMAIL_MAX_LENGTH = 254;

/** チームの名前の字数 */
export const TEAM_NAME_MAX_LENGTH = 50;

/** 利用者の id（Better Auth が振る文字列）の長さの上限。これより長いものは探さない（コーチの画面と Server Action） */
export const USER_ID_MAX_LENGTH = 200;

/** コーチと選手のコメントの字数（DB の上限は 2000。余裕を持たせる） */
export const COMMENT_MAX_LENGTH = 1000;

/**
 * 1人が直近24時間に書けるコメントの数（仮決め）。コーチが毎日チーム全員に書いても足りる数にし、
 * 押し続け・作りの誤りで知らせが鳴り続けるのを止める
 */
export const COMMENTS_PER_DAY = 100;

/*
 * 試技の細かい記録の範囲（db/migrations/0024_attempt_details.sql の check と同じ値）。
 * 長さはメートル、短い長さは cm、ポールの硬さはポンド
 */
/** 助走の歩数 */
export const APPROACH_STEPS_MIN = 1;
export const APPROACH_STEPS_MAX = 30;
/** 助走の距離（メートル） */
export const APPROACH_LENGTH_MIN_M = 1;
export const APPROACH_LENGTH_MAX_M = 60;
/** 踏切板からの距離（cm）。負は踏切線を越えた（ファウル） */
export const BOARD_OFFSET_MIN_CM = -30;
export const BOARD_OFFSET_MAX_CM = 100;
/** ポールの長さ（メートル） */
export const POLE_LENGTH_MIN_M = 2;
export const POLE_LENGTH_MAX_M = 6;
/** ポールの硬さ（ポンド） */
export const POLE_STIFFNESS_MIN_LB = 50;
export const POLE_STIFFNESS_MAX_LB = 250;
/** グリップの高さ（メートル） */
export const GRIP_HEIGHT_MIN_M = 1;
export const GRIP_HEIGHT_MAX_M = 6;
/** 支柱の位置（cm）。規則で 0〜80cm */
export const STANDARDS_MIN_CM = 0;
export const STANDARDS_MAX_CM = 80;

/*
 * 走高跳・棒高跳の高さごとの結果（src/lib/height-series.ts、db/migrations/0025_height_series.sql）。
 * バーの高さはメートル。下限は子どもの走高跳、上限は棒高跳の世界記録（6m 台）に余裕を持たせた値（仮決め）
 */
export const BAR_HEIGHT_MIN_M = 0.5;
export const BAR_HEIGHT_MAX_M = 7;
/** 1本の試技に入れられる高さの数（DB の check と同じ） */
export const HEIGHT_SERIES_MAX_ROWS = 40;

/*
 * 動画の上で手で測る角度（src/lib/video-angles.ts、db/migrations/0026_video_angles.sql）。
 * 1本に保存できる測定の数（仮決め。踏み切りの前後数コマで膝・腰・体幹を測っても足りる数）
 */
export const ANGLES_PER_VIDEO = 30;
/** 動画の本来の幅・高さの上限（ピクセル、8K の長い辺。DB の check と同じ） */
export const ANGLE_FRAME_MAX_PX = 8192;
