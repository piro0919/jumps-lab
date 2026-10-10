import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AttemptsCard } from '@/components/attempts-card';
import { CompetitionItem } from '@/components/competitions-board';
import { ConditionCard } from '@/components/condition-card';
import { EventHero } from '@/components/event-hero';
import {
  AppIcon,
  Card,
  CardTitle,
  Headline,
  PageTitle,
  PhoneFrame,
  SEGMENTS,
  Stat,
  Watermark,
  Wordmark,
  HALVES,
  segmentClass,
} from '@/components/layout-ui';
import { TrendChart } from '@/components/trend-chart';
import type { Attempt } from '@/lib/data';
import { todayIn } from '@/lib/dates';
import { EVENT_BG, EVENT_MARK, EVENT_TEXT } from '@/lib/events';
import { formatMarkParts } from '@/lib/units';
import { Consent } from '../sign-in/consent';
import { GoogleButton } from '../sign-in/google-button';

/**
 * LP。ログインしていない人の / （英語）と /ja （日本語）。言語は URL で決まる（src/proxy.ts）。
 * 上から: ヒーロー（見出し・Google のボタン・ホームの見本）、仕様の帯、機能の4節、締め（2026-10-11 に本人と決めた）。
 * 画面は画像にせず、アプリの部品に見本のデータを流して描く（言語・テーマ・画面の変更にそのまま付いてくる）。
 * 見本の選手は走幅跳と三段跳。分析だけ棒高跳にして、高跳と棒高跳の人にも自分の画面だと伝える。
 * DB には触らない（ログインしていない人の表示で DB を起こさない）
 */

/** day から n 日ずらした日（YYYY-MM-DD）。見本の日付を今日からの距離で置き、残りの日数が古びないようにする */
function shift(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

function attempt(
  id: string,
  day: string,
  event: Attempt['event'],
  kind: Attempt['kind'],
  markM: number,
  windMs: number | null,
  note: string | null = null,
): Attempt {
  return { id, day, event, kind, markM, windMs, note };
}

/** 機能の1節。スマホは文の下に画面、PC は2列で、節ごとに画面の左右を入れ替える */
function Feature({
  title,
  body,
  script,
  flip = false,
  children,
}: {
  title: string;
  body: string;
  script: 'latin' | 'ja';
  flip?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`${HALVES} gap-10 py-12 lg:gap-16`}>
      <div className={`flex flex-col gap-4 px-4 lg:self-center ${flip ? 'lg:order-last' : ''}`}>
        <Headline size="section" script={script}>
          {title}
        </Headline>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <PhoneFrame>{children}</PhoneFrame>
    </section>
  );
}

/**
 * LP の写真。Unsplash の無料の写真（Unsplash License: 商用可・クレジット不要）を縮めて public/landing に置いた。
 * Vercel の画像の最適化は課金なので使わず、幅 800 と 1600 の WebP を srcSet で出し分ける。
 * 走幅跳 Peter Zhan（unsplash.com/photos/RWpEFLH86jA）、走高跳 Steve Hillman（1eMdn8dCPQ4）、
 * 締めの走幅跳 Peter Zhan（UKRycPqHtdg）
 */
function Photo({ name, alt, className }: { name: string; alt: string; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/landing/${name}-1600.webp`}
      srcSet={`/landing/${name}-800.webp 800w, /landing/${name}-1600.webp 1600w`}
      sizes="(min-width: 1024px) 50vw, 100vw"
      alt={alt}
      loading="lazy"
      className={`object-cover ${className}`}
    />
  );
}

function SignInBlock() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <GoogleButton />
      <Consent />
    </div>
  );
}

export async function Landing() {
  const locale = await getLocale();
  const script = locale === 'ja' ? 'ja' : 'latin';
  const t = await getTranslations('landing');
  const tMeta = await getTranslations('metadata');
  const tNav = await getTranslations('nav');
  const tLog = await getTranslations('log');
  const tAnalysis = await getTranslations('analysis');
  const tCompetitions = await getTranslations('competitions');
  const today = todayIn('UTC');
  const units = 'metric';

  // ホームの見本。走幅跳と三段跳の高校の上位くらいの選手
  const longJump = { pbM: 7.12, sbM: 6.98, practiceBestM: 7.05 };
  const tripleJump = { pbM: 14.86, sbM: 14.86, practiceBestM: 14.52 };
  const noManual = { pbM: null, sbM: null, practiceBestM: null };

  // 1本ずつの記録の見本（練習の日）
  const practiceDay = [
    attempt('p1', today, 'long_jump', 'practice', 6.72, 1.2),
    attempt('p2', today, 'long_jump', 'practice', 6.88, 0.8),
    attempt('p3', today, 'long_jump', 'practice', 7.05, 1.5, t('sampleNote')),
  ];
  // 試合の日。14.70 は追い風参考の印付き。いちばん遠い記録を参考にすると「ベスト」と札が2つ並び、
  // スマホの幅で記録が折り返した
  const meetDay = shift(today, -16);
  const competitionDay = [
    attempt('c1', meetDay, 'triple_jump', 'competition', 14.52, 1.1),
    attempt('c2', meetDay, 'triple_jump', 'competition', 14.7, 2.4),
    attempt('c3', meetDay, 'triple_jump', 'competition', 14.86, 1.4),
  ];
  // 分析の見本は棒高跳の直近10本
  const vaults = [4.1, 4.2, 4.15, 4.3, 4.2, 4.35, 4.3, 4.4, 4.35, 4.5].map((markM, i) => ({
    day: shift(today, -7 * (10 - i)),
    kind: 'practice' as const,
    markM,
  }));

  const other =
    locale === 'ja' ? { href: '/', label: 'English' } : { href: '/ja', label: '日本語' };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-6 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150">
        <Link href={locale === 'ja' ? '/ja' : '/'} className="flex w-fit items-center gap-2.5">
          <AppIcon size="header" />
          <Wordmark size="header">{tMeta('title')}</Wordmark>
        </Link>
        <nav aria-label={tNav('language')} className={`ml-auto ${SEGMENTS}`}>
          <span aria-current="page" className={segmentClass(true)}>
            {locale === 'ja' ? '日本語' : 'English'}
          </span>
          <Link
            href={other.href}
            hrefLang={other.href === '/' ? 'en' : 'ja'}
            className={segmentClass(false)}
          >
            {other.label}
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        {/* ヒーロー */}
        <section className={`${HALVES} gap-10 pt-10 pb-12 lg:gap-16 lg:pt-16`}>
          <div className="flex flex-col gap-6 px-4 lg:self-center">
            <Headline as="h1" size="hero" script={script}>
              {t('title')}
            </Headline>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">{t('lead')}</p>
            <SignInBlock />
          </div>
          <PhoneFrame>
            <PageTitle as="p">{tNav('home')}</PageTitle>
            <EventHero
              event="long_jump"
              goalM={7.2}
              bests={longJump}
              manual={noManual}
              units={units}
            />
            <EventHero
              event="triple_jump"
              goalM={15}
              bests={tripleJump}
              manual={noManual}
              units={units}
            />
          </PhoneFrame>
        </section>

        {/* 仕様の帯。利用者数やレビューはまだ無いので、何ができるかを数字で並べる */}
        <Card className="grid grid-cols-2 gap-6 sm:grid-cols-5">
          <Stat value="4" label={t('specEvents')} />
          <Stat value={{ value: '+2.0', unit: 'm/s' }} label={t('specWind')} />
          <Stat value="m / ft" label={t('specUnits')} />
          <Stat value="EN / JA" label={t('specLanguages')} />
          <Stat value={t('specFreeValue')} label={t('specFree')} />
        </Card>

        {/* 実写の帯。数字ばかりにせず、跳ぶ場面を見せる（本人、2026-10-11） */}
        <div className="mt-3 grid gap-3 px-4 sm:grid-cols-2">
          <Photo
            name="long-jump"
            alt={t('photoLongJump')}
            className="h-72 w-full rounded-3xl lg:h-96"
          />
          <Photo
            name="high-jump"
            alt={t('photoHighJump')}
            className="h-72 w-full rounded-3xl lg:h-96"
          />
        </div>

        <Feature title={t('logTitle')} body={t('logBody')} script={script}>
          <PageTitle as="p">{tLog('today')}</PageTitle>
          <AttemptsCard day={today} events={['long_jump']} units={units} attempts={practiceDay} />
          <ConditionCard
            log={{
              condition: 8,
              fatigue: 3,
              sleepHours: 7.5,
              injury: null,
              note: t('sampleDayNote'),
            }}
            editHref="/"
          />
        </Feature>

        <Feature title={t('bestsTitle')} body={t('bestsBody')} script={script} flip>
          <AttemptsCard
            day={meetDay}
            events={['triple_jump']}
            units={units}
            attempts={competitionDay}
          />
          <EventHero
            event="triple_jump"
            goalM={15}
            bests={tripleJump}
            manual={noManual}
            units={units}
          />
        </Feature>

        <Feature title={t('meetsTitle')} body={t('meetsBody')} script={script}>
          <PageTitle as="p">{tNav('competitions')}</PageTitle>
          <Card>
            <CardTitle>{tCompetitions('upcoming')}</CardTitle>
            <CompetitionItem
              competition={{
                id: 'next',
                name: t('sampleNextMeet'),
                day: shift(today, 12),
                venue: t('sampleVenue'),
                callRoomPlace: null,
                callRoomTime: '09:40',
                startTime: '10:30',
                notes: null,
              }}
              results={[]}
              units={units}
              today={today}
            />
          </Card>
          <Card>
            <CardTitle>{tCompetitions('past')}</CardTitle>
            <CompetitionItem
              competition={{
                id: 'past',
                name: t('samplePastMeet'),
                day: meetDay,
                venue: t('sampleVenue'),
                callRoomPlace: null,
                callRoomTime: null,
                startTime: null,
                notes: null,
              }}
              results={[
                { event: 'long_jump', bestM: 6.98, windAided: false },
                { event: 'triple_jump', bestM: 14.86, windAided: false },
              ]}
              units={units}
              today={today}
            />
          </Card>
        </Feature>

        <Feature title={t('analysisTitle')} body={t('analysisBody')} script={script} flip>
          <PageTitle as="p">{tNav('analysis')}</PageTitle>
          <Card
            className={`relative grid grid-cols-2 gap-4 overflow-hidden text-white ${EVENT_BG.pole_vault}`}
          >
            <Watermark>{EVENT_MARK.pole_vault}</Watermark>
            <Stat size="hero" inverse value={48} label={tAnalysis('total')} />
            <Stat
              size="hero"
              inverse
              value={formatMarkParts(4.31, units)}
              label={tAnalysis('average')}
            />
          </Card>
          <Card>
            <CardTitle>{tAnalysis('trend')}</CardTitle>
            <TrendChart
              rows={vaults}
              units={units}
              locale={locale}
              colorClass={EVENT_TEXT.pole_vault}
            />
          </Card>
        </Feature>

        {/* 締め。走幅跳の写真に見出しを白で重ね、ボタンをもう一度。夜の写真はダークの地に溶けたので替えた */}
        <section className="flex flex-col items-center gap-4 px-4 pt-12 pb-16 text-center">
          <div className="relative flex h-[420px] w-full items-end overflow-hidden rounded-3xl lg:h-[520px]">
            <Photo
              name="long-jump-flight"
              alt={t('photoFlight')}
              className="absolute inset-0 size-full object-[50%_20%]"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
            <div className="relative flex w-full flex-col items-center gap-6 p-6 text-white lg:p-10">
              <Headline size="section" script={script}>
                {t('title')}
              </Headline>
              <div className="w-full max-w-xs">
                <GoogleButton />
              </div>
            </div>
          </div>
          <Consent />
        </section>
      </main>

      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted-foreground">
        <Link href={locale === 'ja' ? '/privacy' : '/en/privacy'} className="underline">
          {t('privacy')}
        </Link>
        <Link href={locale === 'ja' ? '/terms' : '/en/terms'} className="underline">
          {t('terms')}
        </Link>
        <span className="ml-auto">© kk-web</span>
      </footer>
    </div>
  );
}
