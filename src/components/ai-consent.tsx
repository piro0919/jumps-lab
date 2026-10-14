'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { sendGuardianRequestAction } from '@/app/actions/guardian';
import { consentAiAction } from '@/app/actions/menu';
import { ActionForm } from '@/components/action-form';
import { FormActions } from '@/components/form-actions';
import {
  ErrorText,
  Field,
  FieldLabel,
  Input,
  SEGMENTS,
  segmentClass,
} from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import type { Consenter } from '@/lib/guardian';
import { EMAIL_MAX_LENGTH } from '@/lib/limits';
import { safely } from '@/lib/safe-action';

/** 送るボタンを押せるメールアドレスの形（@ の前後に文字があり、ドメインに点がある）。細かい検査はサーバーで行う */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 保護者へ送ったお願い。メールアドレスは伏せたもの（g***@example.com） */
type SentRequest = { email: string; live: boolean };

/**
 * 同意の画面の下の部分。だれが同意するかで替わる（src/lib/guardian.ts）:
 * - 16歳以上: 同意のボタン
 * - 16歳未満: 保護者のメールアドレスの欄。送ったあとは、送った宛先（伏せたもの）と送り直し・宛先を変えるボタン
 * - 生年月日の無い人: 「16歳以上ですか」の切り替えを先に出し、答えでどちらかを出す。答えは保存したときに残し、次から選んだ状態で出す。
 *   16歳未満と答えた（分かった）人には切り替えを出さない（askAge が false。src/lib/ai.ts の asksAge）
 */
export function AiConsentChoice({
  consenter,
  askAge,
  request,
  linkDays,
}: {
  consenter: Consenter;
  /** 生年月日が無く、16歳以上かを本人に聞く */
  askAge: boolean;
  request: SentRequest | null;
  linkDays: number;
}) {
  const t = useTranslations('aiConsent');
  const [answer, setAnswer] = useState<'self' | 'guardian' | null>(
    consenter === 'ask' ? null : consenter,
  );
  const shown = askAge ? answer : consenter;

  return (
    <>
      {askAge && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={t('ageQuestion')} />
          {/* 1つだけ選ぶので切り替えの形 */}
          <div role="radiogroup" aria-label={t('ageQuestion')} className={SEGMENTS}>
            {(['self', 'guardian'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={answer === value}
                onClick={() => setAnswer(value)}
                className={segmentClass(answer === value)}
              >
                {value === 'self' ? t('ageYes') : t('ageNo')}
              </button>
            ))}
          </div>
        </div>
      )}
      {shown === 'self' && <AiConsentForm declared={askAge} />}
      {shown === 'guardian' && (
        <GuardianRequestForm declared={askAge} request={request} linkDays={linkDays} />
      )}
    </>
  );
}

/**
 * 本人が同意するボタン。押すと同意した時刻を入れ、同じ画面がメニューの入力に替わる（Server Action が描き直させる）。
 * declared は「16歳以上です」と答えて押したこと（生年月日の無い人）
 */
function AiConsentForm({ declared }: { declared: boolean }) {
  const t = useTranslations('aiConsent');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(
    (_previous: unknown, formData: FormData) => safely(() => consentAiAction(formData)),
    null,
  );

  return (
    <ActionForm action={action}>
      {declared && <input type="hidden" name="adult" value="yes" />}
      <FormActions
        label={pending ? t('agreeing') : t('agree')}
        pending={pending}
        message={
          <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        }
      />
    </ActionForm>
  );
}

/**
 * 保護者へお願いを送る（16歳未満）。送ったあとは宛先を伏せて出し、同じ宛先へ送り直すか、宛先を変えて送る。
 * declared は「16歳未満です」と答えて送ること（生年月日の無い人）
 */
function GuardianRequestForm({
  declared,
  request,
  linkDays,
}: {
  declared: boolean;
  request: SentRequest | null;
  linkDays: number;
}) {
  const t = useTranslations('aiConsent');
  const tErrors = useTranslations('errors');
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => {
      const result = await safely(() => sendGuardianRequestAction(formData));
      // 送れたら、送った宛先の表示に戻す（画面は Server Action が描き直す）
      if (result?.ok) {
        setEditing(false);
        setEmail('');
      }
      return result;
    },
    null,
  );
  const message = (
    <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
  );
  const showSent = request !== null && !editing;

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold">{t('guardianNeeded')}</p>
      <ActionForm action={action} className="flex flex-col gap-4">
        {declared && <input type="hidden" name="adult" value="no" />}
        {showSent ? (
          <>
            <p>
              {request.live
                ? t('sent', { email: request.email, days: linkDays })
                : t('expired', { email: request.email })}
            </p>
            <div className="flex items-center justify-end gap-3">
              {message}
              <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                {t('changeEmail')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('sending') : t('resend')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label={t('guardianEmail')}>
              <Input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                maxLength={EMAIL_MAX_LENGTH}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <FormActions
              label={pending ? t('sending') : t('send')}
              pending={pending}
              disabled={!EMAIL_SHAPE.test(email.trim())}
              message={message}
            />
          </>
        )}
      </ActionForm>
    </div>
  );
}
