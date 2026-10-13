'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { consentAiAction } from '@/app/actions/menu';
import { safely } from '@/lib/safe-action';
import { ActionForm } from '@/components/action-form';
import { FormActions } from '@/components/form-actions';
import { ErrorText } from '@/components/layout-ui';

/**
 * AI コーチの同意の画面の下の行。押すと同意した時刻を入れ、同じ画面がメニューの入力に替わる
 * （Server Action が描き直させる）
 */
export function AiConsentForm() {
  const t = useTranslations('aiConsent');
  const tErrors = useTranslations('errors');
  const [state, action, pending] = useActionState(() => safely(() => consentAiAction()), null);

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
