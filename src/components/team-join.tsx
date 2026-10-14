'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { joinTeamAction } from '@/app/actions/teams';
import { ActionForm } from '@/components/action-form';
import { GuardianRequestForm, type SentRequest } from '@/components/ai-consent';
import { FormActions } from '@/components/form-actions';
import { ErrorText, FieldLabel, SEGMENTS, segmentClass } from '@/components/layout-ui';
import type { Consenter } from '@/lib/guardian';
import { safely } from '@/lib/safe-action';

/**
 * 招待の画面（/join/[token]）の下の部分。だれが同意するかで替わる（src/lib/guardian.ts。AI コーチの同意と同じ線）:
 * - 16歳以上: 「同意して参加」のボタン。押すことがチームのコーチに記録を見せることへの同意
 * - 16歳未満: 保護者のメールアドレスの欄（保護者が同意したら入る）。本人のボタンは出さない
 * - 生年月日が無く16歳以上かを答えていない人: 「16歳以上ですか」を先に聞き、答えでどちらかを出す
 * サーバーも同じ判定で断る（src/lib/data.ts の joinTeamBySelf）。ここは見せ方だけ
 */
export function TeamJoinChoice({
  token,
  team,
  consenter,
  askAge,
  request,
  linkDays,
}: {
  /** 招待のリンクの鍵（押した先で招待を確かめる） */
  token: string;
  team: string;
  consenter: Consenter;
  /** 生年月日が無く、16歳以上かを本人に聞く */
  askAge: boolean;
  /** このチームへの、保護者へのお願い（送ったもの） */
  request: SentRequest | null;
  linkDays: number;
}) {
  const t = useTranslations('teams');
  const tAi = useTranslations('aiConsent');
  const [answer, setAnswer] = useState<'self' | 'guardian' | null>(
    consenter === 'ask' ? null : consenter,
  );
  // サーバーが年齢で断ったとき（画面を出したあとで生年月日を変えたなど）の、サーバーの判定。画面をそれに合わせる
  const [server, setServer] = useState<'guardian' | 'ask' | null>(null);
  const asking = server === 'ask' || (server === null && askAge);
  const shown = server === 'guardian' ? 'guardian' : asking ? answer : consenter;

  return (
    <>
      {asking && (
        <div className="flex flex-col gap-1.5">
          <FieldLabel label={tAi('ageQuestion')} />
          {/* 1つだけ選ぶので切り替えの形 */}
          <div role="radiogroup" aria-label={tAi('ageQuestion')} className={SEGMENTS}>
            {(['self', 'guardian'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={answer === value}
                onClick={() => setAnswer(value)}
                className={segmentClass(answer === value)}
              >
                {value === 'self' ? tAi('ageYes') : tAi('ageNo')}
              </button>
            ))}
          </div>
        </div>
      )}
      {shown === 'self' && (
        <JoinForm
          token={token}
          declared={asking}
          onRefused={(next) => {
            setAnswer(null);
            setServer(next);
          }}
        />
      )}
      {shown === 'guardian' && (
        <GuardianRequestForm
          declared={asking}
          request={request}
          linkDays={linkDays}
          intro={t('guardianNeeded', { team })}
          fields={{ purpose: 'team', token }}
        />
      )}
    </>
  );
}

/**
 * 本人が同意して入るボタン。入れたらチームの一覧へ移る（Server Action が送る）。
 * サーバーが「保護者の同意が要る」「16歳以上かを聞く」で断ったら、onRefused で保護者の欄か年齢の問いに切り替える
 */
function JoinForm({
  token,
  declared,
  onRefused,
}: {
  token: string;
  declared: boolean;
  onRefused: (next: 'guardian' | 'ask') => void;
}) {
  const t = useTranslations('teams');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => {
      const result = await safely(() => joinTeamAction(null, formData));
      if (result?.ok === false && result.error === 'teamNeedsGuardian') onRefused('guardian');
      if (result?.ok === false && result.error === 'teamAskAge') onRefused('ask');
      return result;
    },
    null,
  );

  return (
    <ActionForm action={action}>
      <input type="hidden" name="token" value={token} />
      {declared && <input type="hidden" name="adult" value="yes" />}
      <FormActions
        label={pending ? t('joining') : t('join')}
        pending={pending}
        message={
          <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        }
      />
    </ActionForm>
  );
}
