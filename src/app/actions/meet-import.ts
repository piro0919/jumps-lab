'use server';

import { getLocale } from 'next-intl/server';
import { type AiAttachment, AiError, aiUsable, askJson } from '@/lib/ai';
import { overAiLimit } from '@/lib/ai-limit';
import { getProfile, recordAiCall } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { fetchSource, looksLikePdf, SourceError } from '@/lib/fetch-source';
import { MEET_FILE_MAX_BYTES, URL_MAX_LENGTH } from '@/lib/limits';
import {
  cleanMeets,
  MEET_IMPORT_MODEL,
  MEET_IMPORT_SCHEMA,
  MEET_IMPORT_TIMEOUT_MS,
  meetImportInstructions,
  type MeetImportResult,
} from '@/lib/meet-import';
import { requireViewer } from '@/lib/viewer';

/** 送れる写真の種類（ブラウザが JPEG に縮めて送る。縮められなかったものはそのまま） */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** AI が答えられなかったときの文言の鍵（メニューと同じ分け方。分からないものは importFailed） */
function aiFailure(error: AiError): string {
  if (error.kind === 'auth' || error.kind === 'quota') return 'aiUnavailable';
  if (error.kind === 'busy') return 'aiBusy';
  return 'importFailed';
}

const SOURCE_ERRORS: Record<SourceError['kind'], string> = {
  url: 'importUrl',
  unreachable: 'importUnreachable',
  tooLarge: 'importTooLarge',
  type: 'importType',
};

/** 送られたファイルを、AI に添える資料にする。PDF と写真だけ */
async function attachmentOf(file: File): Promise<AiAttachment | SourceError['kind']> {
  if (file.size > MEET_FILE_MAX_BYTES) return 'tooLarge';
  const data = Buffer.from(await file.arrayBuffer());
  if (file.type === 'application/pdf' || looksLikePdf(data)) {
    return { kind: 'pdf', data: data.toString('base64') };
  }
  if (IMAGE_TYPES.has(file.type)) {
    return { kind: 'image', mimeType: file.type, data: data.toString('base64') };
  }
  return 'type';
}

/**
 * 日程ページの URL か、要項の PDF・日程表の写真を AI に読ませ、大会の一覧を返す（保存はしない）。
 * 選手が一覧から選ぶと、大会の入力画面に下書きとして入る。資料も一覧も残さない。
 * Premium で同意した人だけ（aiUsable）。呼ぶ前に ai_call に記録し、1日・1か月の上限で止める
 */
export async function importMeetsAction(formData: FormData): Promise<MeetImportResult> {
  const viewer = await requireViewer();
  const profile = await getProfile(viewer.userId);
  if (!profile || !aiUsable(profile)) return { ok: false, error: 'generic' };
  const today = todayIn(profile.timeZone);
  const url = formData.get('url');
  const file = formData.get('file');

  // 資料を読む（AI を呼ぶ前。読めない URL やファイルで回数を使わせない）
  let input: string;
  let attachment: AiAttachment | undefined;
  try {
    if (typeof url === 'string' && url.trim() !== '') {
      if (url.length > URL_MAX_LENGTH) return { ok: false, error: 'importUrl' };
      const source = await fetchSource(url);
      if (source.kind === 'text') {
        if (source.text === '') return { ok: false, error: 'importNone' };
        input = `Source page (${url.trim()}):\n${source.text}`;
      } else {
        input = `The attached file is from ${url.trim()}.`;
        attachment =
          source.kind === 'pdf'
            ? { kind: 'pdf', data: source.data.toString('base64') }
            : { kind: 'image', mimeType: source.mimeType, data: source.data.toString('base64') };
      }
    } else if (file instanceof File && file.size > 0) {
      const read = await attachmentOf(file);
      if (typeof read === 'string') return { ok: false, error: SOURCE_ERRORS[read] };
      input = 'The attached file is the source.';
      attachment = read;
    } else {
      return { ok: false, error: 'importUrl' };
    }
  } catch (error) {
    if (error instanceof SourceError) {
      console.error(error);
      return { ok: false, error: SOURCE_ERRORS[error.kind] };
    }
    console.error(error);
    return { ok: false, error: 'importUnreachable' };
  }

  try {
    if (await overAiLimit(viewer.userId, today, 'meetImport')) {
      return { ok: false, error: 'importLimit' };
    }
    // 呼ぶ前に記録する（失敗しても上限に数える）
    await recordAiCall(viewer.userId, today, 'meetImport', MEET_IMPORT_MODEL);
    const answer = await askJson<unknown>({
      model: MEET_IMPORT_MODEL,
      instructions: meetImportInstructions((await getLocale()) === 'ja' ? 'ja' : 'en', today),
      input,
      schemaName: 'meet_import',
      schema: MEET_IMPORT_SCHEMA,
      attachment,
      timeoutMs: MEET_IMPORT_TIMEOUT_MS,
    });
    const meets = cleanMeets(answer, today);
    if (meets.length === 0) return { ok: false, error: 'importNone' };
    return { ok: true, meets };
  } catch (error) {
    console.error(error);
    return { ok: false, error: error instanceof AiError ? aiFailure(error) : 'importFailed' };
  }
}
