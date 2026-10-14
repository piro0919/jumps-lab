'use client';

import { Copy, LogOut, UserMinus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import {
  createInviteAction,
  deleteTeamAction,
  leaveTeamAction,
  removeMemberAction,
  revokeInviteAction,
} from '@/app/actions/teams';
import { ActionForm } from '@/components/action-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Card, CardTitle, ErrorText, Input } from '@/components/layout-ui';
import { Button } from '@/components/ui/button';
import { safely } from '@/lib/safe-action';

/**
 * チームの操作のボタン（2026-10-14）。消す・抜ける・外すは、確かめてから（ConfirmDialog）
 */

/** チームを消す（/teams/[teamId]/edit の下）。選手の記録は消えない */
export function DeleteTeamButton({ teamId }: { teamId: string }) {
  const t = useTranslations('teams');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="destructive" disabled={pending} onClick={() => setOpen(true)}>
        {t('delete')}
      </Button>
      <ConfirmDialog
        open={open}
        title={t('deleteConfirm')}
        onOpenChange={setOpen}
        onConfirm={() => startTransition(() => deleteTeamAction(teamId))}
      />
    </>
  );
}

/** チームから抜ける（/teams の「入っているチーム」の行）。行の操作なのでアイコンだけ */
export function LeaveTeamButton({ teamId, team }: { teamId: string; team: string }) {
  const t = useTranslations('teams');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={t('leave', { team })}
        onClick={() => setOpen(true)}
      >
        <LogOut aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        title={t('leaveConfirm', { team })}
        onOpenChange={setOpen}
        onConfirm={() => startTransition(() => leaveTeamAction(teamId))}
      />
    </>
  );
}

/** 選手をチームから外す（コーチ。選手の画面の題の横） */
export function RemoveMemberButton({
  teamId,
  memberId,
  name,
}: {
  teamId: string;
  memberId: string;
  name: string;
}) {
  const t = useTranslations('teams');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        <UserMinus aria-hidden />
        {t('remove')}
      </Button>
      <ConfirmDialog
        open={open}
        title={t('removeConfirm', { name })}
        onOpenChange={setOpen}
        onConfirm={() => startTransition(() => removeMemberAction(teamId, memberId))}
      />
    </>
  );
}

/**
 * 招待のリンク（コーチの画面の右の列）。リンクは鍵のハッシュしか残さないので、作った直後にだけ出せる。
 * あとで開いたときは「◯日まで使えるリンクがあります」と出し、作り直すか切る（作り直すと前のリンクは使えない）
 */
export function InviteCard({
  teamId,
  expiresAt,
  timeZone,
}: {
  teamId: string;
  /** 使えるリンクの期限（ISO 8601）。無ければ null */
  expiresAt: string | null;
  /** 期限を出す時間帯（コーチの設定） */
  timeZone: string;
}) {
  const t = useTranslations('teams');
  const tErrors = useTranslations('errors');
  const format = useFormatter();
  const [copied, setCopied] = useState(false);
  // 作った直後のリンク。切ったら消す（切ったリンクを出し続けない）
  const [url, setUrl] = useState<string | null>(null);
  const [revoking, startTransition] = useTransition();
  const [state, create, pending] = useActionState(async () => {
    setCopied(false);
    const result = await safely(() => createInviteAction(teamId));
    setUrl(result.ok ? result.url : null);
    return result;
  }, null);
  const live = expiresAt !== null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardTitle>{t('invite')}</CardTitle>
      <div className="flex flex-col gap-4 text-sm">
        {url ? (
          <div className="flex flex-col gap-2">
            <p>{t('inviteMade')}</p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={url}
                aria-label={t('invite')}
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={t('copy')}
                onClick={() => void copy()}
              >
                <Copy aria-hidden />
              </Button>
            </div>
            {copied && <p className="text-xs text-muted-foreground">{t('copied')}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {live
              ? t('inviteLive', {
                  date: format.dateTime(new Date(expiresAt), {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone,
                  }),
                })
              : t('inviteNone')}
          </p>
        )}
        <ErrorText>{state?.ok === false ? tErrors(state.error as 'generic') : null}</ErrorText>
        <div className="flex flex-wrap justify-end gap-2">
          {live && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={revoking || pending}
              onClick={() => {
                setUrl(null);
                startTransition(() => revokeInviteAction(teamId));
              }}
            >
              {t('revoke')}
            </Button>
          )}
          <ActionForm action={create}>
            <Button type="submit" size="sm" disabled={pending}>
              {live || url ? t('inviteRenew') : t('inviteMake')}
            </Button>
          </ActionForm>
        </div>
      </div>
    </Card>
  );
}
