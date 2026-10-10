import { getTranslations } from 'next-intl/server';

export default async function Home() {
  const t = await getTranslations('metadata');

  return <main className="p-4 text-2xl font-bold">{t('title')}</main>;
}
