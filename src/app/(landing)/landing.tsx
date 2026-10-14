import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AttemptsCard } from '@/components/attempts-card';
import { CompetitionItem } from '@/components/competitions-board';
import { ConditionCard } from '@/components/condition-card';
import { EventHero } from '@/components/event-hero';
import {
  AppIcon,
  Badge,
  Card,
  CardTitle,
  Headline,
  PageTitle,
  PhoneFrame,
  SEGMENTS,
  Stat,
  Watermark,
  Wordmark,
  LP_HALVES,
  LEAD,
  segmentClass,
} from '@/components/layout-ui';
import { TrendChart } from '@/components/trend-chart';
import { buttonVariants } from '@/components/ui/button';
import { EMPTY_DETAILS } from '@/lib/attempt-details';
import type { Attempt } from '@/lib/data';
import { addDays, todayIn } from '@/lib/dates';
import { EVENT_BG, EVENT_MARK, EVENT_TEXT } from '@/lib/events';
import { TEAM_PLAN_FORM_URL } from '@/lib/team-plan';
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

function attempt(
  id: string,
  day: string,
  event: Attempt['event'],
  kind: Attempt['kind'],
  markM: number,
  windMs: number | null,
  note: string | null = null,
): Attempt {
  return { id, day, event, kind, markM, windMs, note, details: EMPTY_DETAILS, heightSeries: null };
}

/** 見本の練習の日（走幅跳）。記録は m、風は m/s。最後の1本にメモを付ける */
const SAMPLE_PRACTICE = [
  { id: 'p1', markM: 6.72, windMs: 1.2, withNote: false },
  { id: 'p2', markM: 6.88, windMs: 0.8, withNote: false },
  { id: 'p3', markM: 7.05, windMs: 1.5, withNote: true },
];
/** 見本の試合の日（三段跳）。14.70 は追い風参考 */
const SAMPLE_MEET = [
  { id: 'c1', markM: 14.52, windMs: 1.1 },
  { id: 'c2', markM: 14.7, windMs: 2.4 },
  { id: 'c3', markM: 14.86, windMs: 1.4 },
];
/** 見本の試合の日は今日の16日前、次の大会は12日後 */
const SAMPLE_MEET_DAYS_AGO = 16;
const SAMPLE_NEXT_MEET_IN_DAYS = 12;
/** 分析の見本は棒高跳の直近10本。1週ごとに1本跳んだことにする。平均の数字は見本の札だけのもの */
const SAMPLE_VAULTS = [
  { markM: 4.1 },
  { markM: 4.2 },
  { markM: 4.15 },
  { markM: 4.3 },
  { markM: 4.2 },
  { markM: 4.35 },
  { markM: 4.3 },
  { markM: 4.4 },
  { markM: 4.35 },
  { markM: 4.5 },
];
const SAMPLE_VAULT_EVERY_DAYS = 7;
const SAMPLE_VAULT_AVERAGE_M = 4.31;

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
    <section className={`${LP_HALVES} gap-10 py-12 lg:gap-16`}>
      <div className={`flex flex-col gap-4 px-4 lg:self-center ${flip ? 'lg:order-last' : ''}`}>
        <Headline size="section" script={script}>
          {title}
        </Headline>
        <p className={LEAD}>{body}</p>
      </div>
      <PhoneFrame>{children}</PhoneFrame>
    </section>
  );
}

/**
 * LP の写真。ChatGPT で生成した架空の選手の写真（2026-10-12）を縮めて public/landing に置いた。
 * 前は Unsplash の写真だったが、Unsplash の規約（5条）は写っている人の姿とロゴをライセンスから外していて、
 * 顔の分かる実在の選手を看板に使えなかった。顔は出したいので、構図だけ元の写真に倣って生成した（本人と決めた）。
 * Vercel の画像の最適化は課金なので使わず、幅 800 と 1600 の WebP を srcSet で出し分ける
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

/** LP の言語の切り替え。言語の名前はその言語のまま（どちらの画面でも探せるように） */
const LANGUAGES = [
  { value: 'en', href: '/', label: 'English' },
  { value: 'ja', href: '/ja', label: '日本語' },
] as const;

export async function Landing() {
  const locale = await getLocale();
  const script = locale === 'ja' ? 'ja' : 'latin';
  const t = await getTranslations('landing');
  const tMeta = await getTranslations('metadata');
  const tNav = await getTranslations('nav');
  const tLog = await getTranslations('log');
  const tAnalysis = await getTranslations('analysis');
  const tCompetitions = await getTranslations('competitions');
  const tTeamPlan = await getTranslations('teamPlan');
  // 見本の日付の「今日」。訪れた人の時間帯は分からないので、日本語は日本、英語は UTC で数える
  const today = todayIn(locale === 'ja' ? 'Asia/Tokyo' : 'UTC');
  const units = 'metric';

  // ホームの見本。走幅跳と三段跳の高校の上位くらいの選手
  const longJump = { pbM: 7.12, sbM: 6.98, practiceBestM: 7.05 };
  const tripleJump = { pbM: 14.86, sbM: 14.86, practiceBestM: 14.52 };
  const noManual = { pbM: null, sbM: null, practiceBestM: null };

  // 1本ずつの記録の見本（練習の日）
  const practiceDay = SAMPLE_PRACTICE.map(({ id, markM, windMs, withNote }) =>
    attempt(id, today, 'long_jump', 'practice', markM, windMs, withNote ? t('sampleNote') : null),
  );
  // 試合の日。14.70 は追い風参考の印付き。いちばん遠い記録を参考にすると「ベスト」と札が2つ並び、
  // スマホの幅で記録が折り返した
  const meetDay = addDays(today, -SAMPLE_MEET_DAYS_AGO);
  const competitionDay = SAMPLE_MEET.map(({ id, markM, windMs }) =>
    attempt(id, meetDay, 'triple_jump', 'competition', markM, windMs),
  );
  // 分析の見本は棒高跳の直近10本
  const vaults = SAMPLE_VAULTS.map(({ markM }, i) => ({
    day: addDays(today, -SAMPLE_VAULT_EVERY_DAYS * (SAMPLE_VAULTS.length - i)),
    kind: 'practice' as const,
    markM,
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-6 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150">
        <Link href={locale === 'ja' ? '/ja' : '/'} className="flex w-fit items-center gap-2.5">
          <AppIcon size="header" />
          <Wordmark size="header">{tMeta('title')}</Wordmark>
        </Link>
        {/* 並びは English・日本語で固定し、今の言語を塗る（今の言語を左に出していて、押すと文字だけ入れ替わって見えた） */}
        <nav aria-label={tNav('language')} className={`ml-auto ${SEGMENTS}`}>
          {LANGUAGES.map(({ value, href, label }) =>
            value === locale ? (
              <span key={value} aria-current="page" className={segmentClass(true)}>
                {label}
              </span>
            ) : (
              // ページを丸ごと読み直す。Link で移ると、外側のレイアウトが前の言語のまま残り、
              // ブラウザで描く部品（Google のボタン・同意の文）と <html lang> が切り替わらなかった
              <a key={value} href={href} hrefLang={value} className={segmentClass(false)}>
                {label}
              </a>
            ),
          )}
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        {/* ヒーロー */}
        <section className={`${LP_HALVES} gap-10 pt-10 pb-12 lg:gap-16 lg:pt-16`}>
          <div className="flex flex-col gap-6 px-4 lg:self-center">
            <Headline as="h1" size="hero" script={script}>
              {t('title')}
            </Headline>
            <p className={LEAD}>{t('lead')}</p>
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
          <AttemptsCard
            sample
            day={today}
            events={['long_jump']}
            units={units}
            attempts={practiceDay}
          />
          <ConditionCard
            sample
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
            sample
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
              sample
              competition={{
                id: 'next',
                name: t('sampleNextMeet'),
                day: addDays(today, SAMPLE_NEXT_MEET_IN_DAYS),
                venue: t('sampleVenue'),
                callRoomPlace: null,
                callRoomTime: '09:40',
                startTime: '10:30',
                notes: null,
                isTarget: false,
                entryUrl: null,
              }}
              results={[]}
              units={units}
              today={today}
            />
          </Card>
          <Card>
            <CardTitle>{tCompetitions('past')}</CardTitle>
            <CompetitionItem
              sample
              competition={{
                id: 'past',
                name: t('samplePastMeet'),
                day: meetDay,
                venue: t('sampleVenue'),
                callRoomPlace: null,
                callRoomTime: null,
                startTime: null,
                notes: null,
                isTarget: false,
                entryUrl: null,
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
              value={formatMarkParts(SAMPLE_VAULT_AVERAGE_M, units)}
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

        {/* チーム向けプランのお知らせ（2026-10-15）。値段が決まるまでは開発中と出し、Google フォームで問い合わせを受ける */}
        <section className="flex flex-col items-center gap-4 px-4 py-12 text-center">
          <Badge tone="accent">{tTeamPlan('badge')}</Badge>
          <Headline size="section" script={script}>
            {tTeamPlan('title')}
          </Headline>
          <p className={LEAD}>{tTeamPlan('body')}</p>
          <a
            href={TEAM_PLAN_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'secondary' })}
          >
            {tTeamPlan('contact')}
            <ExternalLink aria-hidden className="size-4" />
          </a>
        </section>

        {/* 締め。走幅跳の写真に見出しを白で重ね、ボタンをもう一度。夜の写真はダークの地に溶けたので替えた */}
        <section className="flex flex-col items-center gap-4 px-4 pt-12 pb-16 text-center">
          <div className="relative flex h-landing-photo w-full items-end overflow-hidden rounded-3xl lg:h-landing-photo-wide">
            <Photo
              name="long-jump-flight"
              alt={t('photoFlight')}
              className="absolute inset-0 size-full object-landing-photo"
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

      {/* 押す所は高さ 24px 以上（字の高さだけだと 15px だった。2026-10-15） */}
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted-foreground">
        <Link
          href={locale === 'ja' ? '/privacy' : '/en/privacy'}
          className="inline-flex min-h-6 items-center underline"
        >
          {t('privacy')}
        </Link>
        <Link
          href={locale === 'ja' ? '/terms' : '/en/terms'}
          className="inline-flex min-h-6 items-center underline"
        >
          {t('terms')}
        </Link>
        <span className="ml-auto">© kk-web</span>
      </footer>
    </div>
  );
}
