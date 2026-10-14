import { addDays } from '@/lib/dates';
import { LONG_NOTE_MAX_LENGTH, URL_MAX_LENGTH } from '@/lib/limits';

/**
 * 大会の取り込み（2026-10-15 に本人と決めた）。選手が持ち込んだ日程ページの URL・要項の PDF・日程表の写真を
 * AI に読ませ、大会を一覧にする。選手が1つ選ぶと、大会の入力画面に下書きとして入り、確かめて保存する。
 * 47都道府県のサイトを巡回して集めることはしない（転載・規約・日本だけになるため）。
 * 資料は保存しない。AI には大会の項目だけを返させ、人の名前は写させない
 * （名前を残さないことが、他の部員の同意を要らないとした前提。CLAUDE.md の Meet import）
 */

/** AI に使わせるモデル（メニューと同じ安いほう） */
export const MEET_IMPORT_MODEL = 'gpt-6-luna';

/** 一覧に出す大会の数の上限。1年分の日程表でも収まる数（仮決め） */
export const MEET_IMPORT_MAX_MEETS = 60;

/** 大会の名前・会場・招集場所の字数（大会の入力の欄と同じ） */
const COMPETITION_TEXT_MAX_LENGTH = 200;

/** 取り込んだメモの字数。入力の欄より短くし、要点だけにさせる（長いと1年分の日程で返事が遅くなる） */
const IMPORT_NOTE_MAX_LENGTH = 120;

/**
 * AI の返事を待つ上限（ミリ秒）。福岡陸協の日程ページ（本文 4.7万字）で、メニューと同じ 60 秒では
 * 間に合わなかった（2026-10-15）。関数の上限（/competitions/import の maxDuration）より短くする
 */
export const MEET_IMPORT_TIMEOUT_MS = 150_000;

/** 何日先までの大会を出すか。翌年度の日程まで載ったページでも、2年より先は読み違いとみなす（仮決め） */
const MAX_DAYS_AHEAD = 730;

/** 取り込んだ大会1件。大会の入力の欄と同じ並び */
export type ImportedMeet = {
  name: string;
  day: string;
  venue: string | null;
  callRoomPlace: string | null;
  callRoomTime: string | null;
  startTime: string | null;
  entryUrl: string | null;
  notes: string | null;
};

/** 取り込みの結果。誤りは文言の鍵で返す */
export type MeetImportResult =
  { ok: true; meets: ImportedMeet[] } | { ok: false; error: string } | null;

const nullableString = { type: ['string', 'null'] };

/** AI に返させる形（strict のため、どの項目も必ず書かせ、無ければ null） */
export const MEET_IMPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meets'],
  properties: {
    meets: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'day',
          'venue',
          'callRoomPlace',
          'callRoomTime',
          'startTime',
          'entryUrl',
          'notes',
        ],
        properties: {
          name: { type: 'string' },
          day: { type: 'string', description: 'YYYY-MM-DD, the first day' },
          venue: nullableString,
          callRoomPlace: nullableString,
          callRoomTime: { ...nullableString, description: 'HH:MM, 24-hour' },
          startTime: { ...nullableString, description: 'HH:MM, 24-hour' },
          entryUrl: nullableString,
          notes: nullableString,
        },
      },
    },
  },
} as const;

/** AI への指示。today は選手の時間帯の今日（年の書いていない日程を、次に来る日として読ませる） */
export function meetImportInstructions(language: 'en' | 'ja', today: string): string {
  const notesLanguage = language === 'ja' ? 'Japanese' : 'English';
  return [
    'You read a source an athlete gave you: a competition schedule or a meet notice for athletics (track and field).',
    'List every competition in it that is held on or after today; skip earlier ones. Do not invent anything; when a field is not written in the source, use null.',
    'Never copy names of people (athletes, officials, contacts), phone numbers or email addresses into any field.',
    `Today is ${today}. Write dates as YYYY-MM-DD. When the year is not written, use the year that puts the date on or after today.`,
    'name: the competition name as written in the source, in its original language.',
    'day: the first day of the competition. For a meet over several days, mention the other days in notes.',
    'venue: the stadium or place, as written.',
    'callRoomPlace, callRoomTime, startTime: only when the source gives them for the whole competition; times as HH:MM in 24 hours.',
    'entryUrl: an absolute http or https link for entering this competition or for its own notice, only if the source contains one.',
    `notes: at most ${IMPORT_NOTE_MAX_LENGTH} characters in ${notesLanguage} with facts written in the source that help an athlete prepare (other days, entry deadline, jumping events held). Otherwise null.`,
    'If the source is not about athletics competitions, return an empty list.',
  ].join('\n');
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 実在する日付か（2026-02-30 などを弾く） */
function realDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

/** 文字の欄。空白だけなら null、長すぎれば切る */
function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, max);
}

function time(value: unknown): string | null {
  return typeof value === 'string' && TIME.test(value.trim()) ? value.trim() : null;
}

/** 申し込みのサイト。大会の入力と同じく http と https だけ */
function link(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > URL_MAX_LENGTH) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * AI の返事を、一覧に出せる大会だけにする。形はモデルが守るが、中身はここで確かめる:
 * 名前と実在する日付があるもの、今日から2年先まで（過去の大会は取り込む意味が薄い。仮決め）、
 * 同じ名前と日の重複は1つに、日付順、上限まで
 */
export function cleanMeets(raw: unknown, today: string): ImportedMeet[] {
  const list =
    typeof raw === 'object' && raw !== null && Array.isArray((raw as { meets?: unknown }).meets)
      ? ((raw as { meets: unknown[] }).meets as Record<string, unknown>[])
      : [];
  const last = addDays(today, MAX_DAYS_AHEAD);
  const seen = new Set<string>();
  const meets: ImportedMeet[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const name = text(item.name, COMPETITION_TEXT_MAX_LENGTH);
    const day = typeof item.day === 'string' ? item.day.trim() : '';
    if (!name || !realDay(day) || day < today || day > last) continue;
    const key = `${day}\n${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    meets.push({
      name,
      day,
      venue: text(item.venue, COMPETITION_TEXT_MAX_LENGTH),
      callRoomPlace: text(item.callRoomPlace, COMPETITION_TEXT_MAX_LENGTH),
      callRoomTime: time(item.callRoomTime),
      startTime: time(item.startTime),
      entryUrl: link(item.entryUrl),
      notes: text(item.notes, Math.min(IMPORT_NOTE_MAX_LENGTH, LONG_NOTE_MAX_LENGTH)),
    });
  }
  return meets
    .toSorted((a, b) => a.day.localeCompare(b.day) || a.name.localeCompare(b.name))
    .slice(0, MEET_IMPORT_MAX_MEETS);
}

/** 下書きを大会の入力画面へ渡す URL の欄の名前（/competitions/new?name=…） */
const DRAFT_FIELDS = [
  'name',
  'day',
  'venue',
  'callRoomPlace',
  'callRoomTime',
  'startTime',
  'entryUrl',
  'notes',
] as const satisfies readonly (keyof ImportedMeet)[];

/** 取り込んだ大会を、入力画面の URL にする。保存したら取り込みの一覧へ戻る（from=import） */
export function draftHref(meet: ImportedMeet): string {
  const params = new URLSearchParams({ from: 'import' });
  for (const field of DRAFT_FIELDS) {
    const value = meet[field];
    if (value !== null) params.set(field, value);
  }
  return `/competitions/new?${params.toString()}`;
}

/**
 * 入力画面の URL から下書きを読む。URL は誰でも作れるので、取り込みと同じ確かめ方をもう一度かける。
 * 名前か日付が無ければ下書きにしない（日付は過去でもよい: 選手が直して保存する）
 */
export function readDraft(
  params: Record<string, string | string[] | undefined>,
): ImportedMeet | null {
  const one = (field: string) => {
    const value = params[field];
    return typeof value === 'string' ? value : null;
  };
  const name = text(one('name'), COMPETITION_TEXT_MAX_LENGTH);
  const day = one('day') ?? '';
  if (!name || !realDay(day)) return null;
  return {
    name,
    day,
    venue: text(one('venue'), COMPETITION_TEXT_MAX_LENGTH),
    callRoomPlace: text(one('callRoomPlace'), COMPETITION_TEXT_MAX_LENGTH),
    callRoomTime: time(one('callRoomTime')),
    startTime: time(one('startTime')),
    entryUrl: link(one('entryUrl')),
    notes: text(one('notes'), LONG_NOTE_MAX_LENGTH),
  };
}
