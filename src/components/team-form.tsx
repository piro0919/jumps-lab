'use client';

// 線（components/progress.tsx）を出すため、移るのは @bprogress の useRouter で
import { useRouter } from '@bprogress/next/app';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { createTeamAction, renameTeamAction } from '@/app/actions/teams';
import { ActionForm } from '@/components/action-form';
import { FormActions } from '@/components/form-actions';
import { ErrorText, Field, Input } from '@/components/layout-ui';
import { TEAM_NAME_MAX_LENGTH } from '@/lib/limits';
import { safely } from '@/lib/safe-action';

/**
 * チームの名前の入力（/teams/new と /teams/[teamId]/edit の画面）。作るときと名前を変えるときで同じものを使う。
 * 作ったらそのチームの画面へ（Server Action が送る）、変えたらチームの画面へ戻る
 */
export function TeamForm({ team }: { team: { id: string; name: string } | null }) {
  const router = useRouter();
  const t = useTranslations('teams');
  const tErrors = useTranslations('errors');
  const tProfile = useTranslations('profile');
  const [state, action, pending] = useActionState(
    async (_previous: unknown, formData: FormData) => {
      if (!team) return safely(() => createTeamAction(null, formData));
      const result = await safely(() => renameTeamAction(null, formData));
      if (result?.ok) router.push(`/teams/${team.id}`);
      return result;
    },
    null,
  );

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      {team && <input type="hidden" name="teamId" value={team.id} />}
      <Field label={t('name')} required={tProfile('required')}>
        <Input
          name="name"
          defaultValue={team?.name ?? ''}
          required
          maxLength={TEAM_NAME_MAX_LENGTH}
        />
      </Field>
      <FormActions
        label={tProfile('save')}
        pending={pending}
        message={
          <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        }
      />
    </ActionForm>
  );
}
