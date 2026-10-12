'use client';

import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardTitle, Select } from '@/components/layout-ui';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { PREFECTURE_LINKS } from '@/lib/japan';

/**
 * 都道府県の陸協の大会日程へのリンク（日本の人だけ。中元さんのフィードバック、2026-10-12）。
 * 県を選んで、その県の陸協のページを開く。中身は取り込まない：招集の時刻などは本人が要項で確かめる
 */
export function PrefectureLinks() {
  const t = useTranslations('competitions');
  const locale = useLocale();
  const [index, setIndex] = useState('');
  const chosen = index === '' ? null : PREFECTURE_LINKS[Number(index)];

  return (
    <Card>
      <CardTitle>{t('prefectureSchedules')}</CardTitle>
      <div className="flex gap-2">
        <Select
          aria-label={t('prefecture')}
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          className="min-w-0 flex-1"
        >
          <option value="">{t('choosePrefecture')}</option>
          {PREFECTURE_LINKS.map((prefecture, i) => (
            <option key={prefecture.url} value={i}>
              {locale === 'ja' ? prefecture.ja : prefecture.en}
            </option>
          ))}
        </Select>
        {chosen ? (
          <a href={chosen.url} target="_blank" rel="noreferrer" className={buttonVariants()}>
            {t('openSchedule')}
            <ExternalLink aria-hidden />
          </a>
        ) : (
          <span aria-disabled className={cn(buttonVariants(), 'pointer-events-none opacity-50')}>
            {t('openSchedule')}
            <ExternalLink aria-hidden />
          </span>
        )}
      </div>
    </Card>
  );
}
