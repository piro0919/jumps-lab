'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useMemo, useState, useSyncExternalStore } from 'react';
import { importMeetsAction } from '@/app/actions/meet-import';
import { ActionForm } from '@/components/action-form';
import { FormActions } from '@/components/form-actions';
import {
  Badge,
  Card,
  CardTitle,
  ErrorText,
  Field,
  FieldLabel,
  Input,
  SEGMENTS,
  segmentClass,
} from '@/components/layout-ui';
import { cn } from '@/lib/cn';
import { MEET_FILE_MAX_BYTES, MEET_IMAGE_MAX_EDGE_PX, URL_MAX_LENGTH } from '@/lib/limits';
import { draftHref, type ImportedMeet, type MeetImportResult } from '@/lib/meet-import';
import { safely } from '@/lib/safe-action';

/** 読み込んだ一覧を、入力画面から戻ったときに出し直すための置き場（このタブの間だけ。大会の情報だけで、資料は入れない） */
const STORAGE_KEY = 'jumps-lab:meet-import';
/** 縮めた写真の画質 */
const JPEG_QUALITY = 0.85;

/** 写真を、長い辺が MEET_IMAGE_MAX_EDGE_PX までの JPEG に縮める。読めない写真（HEIC など）はそのまま返す */
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MEET_IMAGE_MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    // 透明な部分（PNG の地）は JPEG にすると黒くなり、黒い字が読めなくなる。白で塗ってから描く
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    return blob ? new File([blob], 'schedule.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function saveMeets(meets: ImportedMeet[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(meets));
  } catch {
    // 置けない（非公開のウィンドウなど）ときは、戻ったら読み込み直す
  }
}

/** 置いてある一覧（文字のまま。useSyncExternalStore は同じ値を返し続ける必要があるため） */
function readSaved(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseSaved(saved: string | null): ImportedMeet[] | null {
  try {
    return saved ? (JSON.parse(saved) as ImportedMeet[]) : null;
  } catch {
    return null;
  }
}

/** sessionStorage は別のタブから変わらないので、見張らない */
const noSubscribe = () => () => {};

/**
 * 大会の取り込み（/competitions/import）。日程ページの URL か、要項の PDF・日程表の写真を送り、
 * AI が読んだ大会を一覧にする。1つ押すと大会の入力画面に下書きが入り、保存するとこの一覧へ戻る。
 * もう同じ名前と日の大会があるものには「追加済み」を付ける
 */
export function MeetImport({ added }: { added: string[] }) {
  const t = useTranslations('meetImport');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fresh, setFresh] = useState<ImportedMeet[] | null>(null);
  // 入力画面から戻ったとき、前に読み込んだ一覧を出し直す（読み込み直すと AI の回数を使う）。サーバーでは無し
  const saved = useSyncExternalStore(noSubscribe, readSaved, () => null);
  const restored = useMemo(() => parseSaved(saved), [saved]);
  const meets = fresh ?? restored;
  const [state, action, pending] = useActionState(
    async (_previous: MeetImportResult, formData: FormData): Promise<MeetImportResult> => {
      const sent = new FormData();
      if (mode === 'url') {
        sent.set('url', String(formData.get('url') ?? ''));
      } else if (file) {
        const shrunk = file.type.startsWith('image/') ? await shrinkImage(file) : file;
        if (shrunk.size > MEET_FILE_MAX_BYTES) return { ok: false, error: 'importTooLarge' };
        sent.set('file', shrunk);
      }
      const result = await safely(() => importMeetsAction(sent));
      if (result?.ok) {
        setFresh(result.meets);
        saveMeets(result.meets);
      }
      return result;
    },
    null,
  );

  const addedSet = new Set(added);
  const ready = mode === 'url' ? url.trim() !== '' : file !== null;

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <ActionForm action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel label={t('source')} />
            {/* 1つだけ選ぶので切り替えの形 */}
            <div
              role="radiogroup"
              aria-label={t('source')}
              className={cn(SEGMENTS, 'grid w-full grid-cols-2')}
            >
              {(['url', 'file'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(segmentClass(mode === value), 'px-2')}
                >
                  {value === 'url' ? t('fromUrl') : t('fromFile')}
                </button>
              ))}
            </div>
          </div>
          {mode === 'url' ? (
            <Field label={t('url')}>
              <Input
                key="url"
                name="url"
                type="url"
                inputMode="url"
                maxLength={URL_MAX_LENGTH}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </Field>
          ) : (
            <Field label={t('file')}>
              <Input
                key="file"
                type="file"
                accept="application/pdf,image/*"
                className="py-2"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </Field>
          )}
          <FormActions
            label={pending ? t('reading') : t('read')}
            pending={pending}
            disabled={!ready}
            message={
              <ErrorText>
                {state?.ok === false ? tErrors(state.error as 'generic') : null}
              </ErrorText>
            }
          />
        </ActionForm>
      </Card>
      {meets && meets.length > 0 && (
        <Card>
          <CardTitle>{t('found', { count: meets.length })}</CardTitle>
          <ul className="flex flex-col divide-y divide-border">
            {meets.map((meet) => {
              const isAdded = addedSet.has(`${meet.day}\n${meet.name}`);
              return (
                <li key={`${meet.day}\n${meet.name}`}>
                  <Link
                    href={draftHref(meet)}
                    className="flex items-center gap-3 py-3"
                    aria-label={t('addThis', { name: meet.name })}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-xs font-bold text-muted-foreground">
                        {format.dateTime(new Date(`${meet.day}T00:00:00Z`), {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                          timeZone: 'UTC',
                        })}
                      </span>
                      <span className="text-sm font-bold">{meet.name}</span>
                      {meet.venue && (
                        <span className="text-xs text-muted-foreground">{meet.venue}</span>
                      )}
                    </div>
                    {isAdded && <Badge tone="neutral">{t('added')}</Badge>}
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
