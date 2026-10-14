'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { agreeGuardianAction } from '@/app/actions/guardian';
import { ActionForm } from '@/components/action-form';
import { FormActions } from '@/components/form-actions';
import { ErrorText } from '@/components/layout-ui';
import { safely } from '@/lib/safe-action';

/**
 * 保護者が同意するボタン（/guardian-consent/[token]）。同意できたらお礼の文に替える。
 * リンクは1回で使い終わるので、描き直さずにこの場で替える（描き直すと「もう使えません」になる）
 */
export function GuardianAgreeForm({ token, name }: { token: string; name: string }) {
  const t = useTranslations('guardianConsent');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(
    () => safely(() => agreeGuardianAction(token)),
    null,
  );

  if (state?.ok) return <p className="font-semibold">{t('done', { name })}</p>;
  return (
    <ActionForm action={action}>
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
