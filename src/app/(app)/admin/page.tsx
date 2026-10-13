import { Search } from 'lucide-react';
import Form from 'next/form';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PlanSwitch } from '@/components/plan-switch';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, EmptyState, Input, PageTitle } from '@/components/layout-ui';
import { ADMIN_LIST_LIMIT, ADMIN_QUERY_MAX_LENGTH, isAdmin } from '@/lib/admin';
import { listUsersForAdmin } from '@/lib/data';
import { requireViewer } from '@/lib/viewer';

/**
 * 管理の画面。本人と中元さんだけが使い、できるのは人を探してプランを切り替えることだけ（2026-10-14）。
 * 管理者でない人には、画面が在ることも見せない（404）。
 * ?q= でメールか名前を探す。無ければ登録の新しい人から ADMIN_LIST_LIMIT 人
 */
export default async function Admin({ searchParams }: PageProps<'/admin'>) {
  const viewer = await requireViewer();
  if (!isAdmin(viewer.email)) notFound();
  const raw = (await searchParams).q;
  const query = (typeof raw === 'string' ? raw.trim() : '').slice(0, ADMIN_QUERY_MAX_LENGTH);
  const users = await listUsersForAdmin(query === '' ? null : query, ADMIN_LIST_LIMIT);
  const t = await getTranslations('admin');
  const tNav = await getTranslations('nav');

  return (
    <main className="flex flex-col gap-3 pb-6">
      <PageTitle>{tNav('admin')}</PageTitle>
      <Card>
        <Form action="/admin" role="search" className="flex items-center gap-2">
          {/* 探すたびに欄を作り直す（入れたままの欄に既定の値を後から渡すと Base UI が警告する） */}
          <Input
            key={query}
            type="search"
            name="q"
            defaultValue={query}
            maxLength={ADMIN_QUERY_MAX_LENGTH}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="secondary" size="icon" aria-label={t('search')}>
            <Search aria-hidden />
          </Button>
        </Form>
      </Card>
      <Card>
        <CardTitle>
          {query === ''
            ? t('recent')
            : users.length === ADMIN_LIST_LIMIT
              ? t('resultsCapped', { count: users.length })
              : t('results', { count: users.length })}
        </CardTitle>
        {users.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
                <PlanSwitch userId={user.id} name={user.name} plan={user.plan} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
