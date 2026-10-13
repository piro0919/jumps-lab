'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { setPlanAction } from '@/app/actions/admin';
import { ErrorText, SEGMENTS, segmentClass } from '@/components/layout-ui';
import { PLANS, type Plan } from '@/lib/profile-options';

/**
 * 管理の画面の1人分のプランの切り替え（Free・Premium）。押した時点で保存する。
 * 保存している間は次の押下を受けない（連打で2回送らないように）
 */
export function PlanSwitch({ userId, name, plan }: { userId: string; name: string; plan: Plan }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  const [failed, setFailed] = useState(false);

  const choose = (next: Plan) => {
    if (next === plan || sending.current) return;
    sending.current = true;
    setFailed(false);
    startTransition(async () => {
      const result = await setPlanAction({ userId, plan: next });
      sending.current = false;
      if (!result?.ok) setFailed(true);
    });
  };

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <div role="radiogroup" aria-label={t('planOf', { name })} className={SEGMENTS}>
        {PLANS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={plan === value}
            disabled={pending}
            onClick={() => choose(value)}
            className={segmentClass(plan === value)}
          >
            {t(value)}
          </button>
        ))}
      </div>
      <ErrorText>{failed ? tErrors('generic') : null}</ErrorText>
    </div>
  );
}
