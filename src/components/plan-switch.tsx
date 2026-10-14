'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { setPlanAction, setTeamPlanAction } from '@/app/actions/admin';
import { ErrorText, SEGMENTS, segmentClass } from '@/components/layout-ui';
import { PLANS, type Plan, TEAM_PLANS, type TeamPlan } from '@/lib/profile-options';
import { safely } from '@/lib/safe-action';

/** 切り替える相手。人なら Free・Premium、チームなら Free・Team */
type Target =
  { kind: 'user'; id: string; plan: Plan } | { kind: 'team'; id: string; plan: TeamPlan };

/**
 * 管理の画面の1人分か1チーム分のプランの切り替え。押した時点で保存する。
 * 保存している間は次の押下を受けない（連打で2回送らないように）
 */
export function PlanSwitch({ target, name }: { target: Target; name: string }) {
  const t = useTranslations('admin');
  const tErrors = useTranslations('errors');
  const [pending, startTransition] = useTransition();
  const sending = useRef(false);
  const [failed, setFailed] = useState(false);
  const plans: readonly (Plan | TeamPlan)[] = target.kind === 'user' ? PLANS : TEAM_PLANS;

  const choose = (next: Plan | TeamPlan) => {
    if (next === target.plan || sending.current) return;
    sending.current = true;
    setFailed(false);
    startTransition(async () => {
      // 通信が切れるなどで投げられても、誤りを出して次の押下を受けられるように戻す
      try {
        const result = await safely(() =>
          target.kind === 'user'
            ? setPlanAction({ userId: target.id, plan: next })
            : setTeamPlanAction({ teamId: target.id, plan: next }),
        );
        if (!result?.ok) setFailed(true);
      } finally {
        sending.current = false;
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <div
        role="radiogroup"
        aria-label={target.kind === 'user' ? t('planOf', { name }) : t('teamPlanOf', { name })}
        className={SEGMENTS}
      >
        {plans.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={target.plan === value}
            disabled={pending}
            onClick={() => choose(value)}
            className={segmentClass(target.plan === value)}
          >
            {t(value)}
          </button>
        ))}
      </div>
      <ErrorText>{failed ? tErrors('generic') : null}</ErrorText>
    </div>
  );
}
