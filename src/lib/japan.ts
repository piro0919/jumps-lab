/**
 * 日本の人にだけ出すもの（学年、大会の申し込み、都道府県の陸協の大会日程）。
 * 日本かどうかは時間帯で見る（学年と同じ。2026-10-11 に本人と決めた）
 */
export function inJapan(timeZone: string): boolean {
  return timeZone === 'Asia/Tokyo';
}

/**
 * 日本陸連の申し込みサイト（JAAF Athletic Family）。陸上の大会は日本陸連の登録者しか申し込めず、
 * 個人の申し込みはここで済む（中元さんのフィードバック、2026-10-12）。ログインが要る
 */
export const JAAF_ENTRY_URL = 'https://athleticfamily.jaaf.or.jp/user/?page=menu';

/** 一覧の年度。年度入りの URL（yearly）は、この年を含んでいなければならない */
export const SCHEDULE_YEAR = 2026;

export type PrefectureLink = {
  /** 都道府県の名前（日本語と英語） */
  ja: string;
  en: string;
  /** その県の陸協の大会日程のページ */
  url: string;
  /**
   * 年度ごとに差し替えが要るか。URL に年度が入っているもの（annual）と、年度で検索するもの。
   * 毎年4月の新年度に、ここを見直す（SCHEDULE_YEAR を上げると、test/japan.test.ts が差し替え漏れを見つける）
   */
  yearly: boolean;
};

/**
 * 47都道府県の陸上競技協会の大会日程。2026-10-12 に中元さんが日本陸連の加盟団体一覧
 * （https://www.jaaf.or.jp/about/group/accn/）から確かめた一覧のまま。
 * 中身は読み込まない。転載の可否がわからず、招集の時刻などは本人が要項で確かめるべきなので、リンクだけ出す。
 * 高知県は県陸協の日程のリンクが壊れているため、日本陸連の地域別の大会検索。
 * 秋田・埼玉・千葉・神奈川・大阪・兵庫・奈良・佐賀・熊本は HTTPS が無く http のまま
 */
export const PREFECTURE_LINKS: PrefectureLink[] = [
  {
    ja: '北海道',
    en: 'Hokkaido',
    url: 'https://hokkaido-rikkyo.jp/schedule/index.html',
    yearly: false,
  },
  { ja: '青森県', en: 'Aomori', url: 'https://www.jaafaomori.com/schedule/', yearly: false },
  { ja: '岩手県', en: 'Iwate', url: 'https://iwate-rk.com/competition-info/', yearly: false },
  {
    ja: '宮城県',
    en: 'Miyagi',
    url: 'https://www.jaaf-miyagi.com/category/schedule/',
    yearly: false,
  },
  { ja: '秋田県', en: 'Akita', url: 'http://jaaf-akita.com/calendar', yearly: false },
  {
    ja: '山形県',
    en: 'Yamagata',
    url: 'https://jaaf-yamagata.jp/taikai/index.html',
    yearly: false,
  },
  {
    ja: '福島県',
    en: 'Fukushima',
    url: 'https://gold.jaic.org/fukushima/joho/2026/2026Sche.pdf',
    yearly: true,
  },
  { ja: '茨城県', en: 'Ibaraki', url: 'https://ibariku.com/event/2026.html', yearly: true },
  { ja: '栃木県', en: 'Tochigi', url: 'https://www.jaaftochigi.jp/event2026/', yearly: true },
  { ja: '群馬県', en: 'Gunma', url: 'https://gold.jaic.org/gunma/comp_p.html', yearly: false },
  { ja: '埼玉県', en: 'Saitama', url: 'http://sairiku.net/bace/Event/', yearly: false },
  {
    ja: '千葉県',
    en: 'Chiba',
    url: 'http://www.jaaf-chiba.jp/pdf/2026/2026_schedule_hp2.pdf',
    yearly: true,
  },
  { ja: '東京都', en: 'Tokyo', url: 'https://toriku.or.jp/competition/', yearly: false },
  {
    ja: '神奈川県',
    en: 'Kanagawa',
    url: 'http://www.kanagawariku.org/kana21cal100.html',
    yearly: false,
  },
  { ja: '新潟県', en: 'Niigata', url: 'https://nrkk.net/official-eventschedule', yearly: false },
  { ja: '富山県', en: 'Toyama', url: 'https://www.jaaf-toyama.net/schedule/', yearly: false },
  { ja: '石川県', en: 'Ishikawa', url: 'https://ishiriku.jp/schedule.html', yearly: false },
  { ja: '福井県', en: 'Fukui', url: 'https://www.fukui-jaaf.com/020_schedule/', yearly: false },
  { ja: '山梨県', en: 'Yamanashi', url: 'https://yamanashitf.com/2026nendo-taikai', yearly: true },
  { ja: '長野県', en: 'Nagano', url: 'https://nagano-rk.com/calendar/', yearly: false },
  { ja: '岐阜県', en: 'Gifu', url: 'https://www.gifu-riku.com/schedule/', yearly: false },
  { ja: '静岡県', en: 'Shizuoka', url: 'https://shizuoka-jaaf.com/srkcal.html', yearly: false },
  { ja: '愛知県', en: 'Aichi', url: 'https://www.aichi-rk.jp/01_01nittei.htm', yearly: false },
  {
    ja: '三重県',
    en: 'Mie',
    url: 'https://mierk.jp/taikaiyoukou/2026/schedule_2026.pdf',
    yearly: true,
  },
  { ja: '滋賀県', en: 'Shiga', url: 'https://srkshiga.com/?page_id=1036', yearly: false },
  { ja: '京都府', en: 'Kyoto', url: 'https://www.krk26.jp/pdf/entry/nittei.pdf', yearly: false },
  { ja: '大阪府', en: 'Osaka', url: 'http://www.oaaa.jp/competition/', yearly: false },
  { ja: '兵庫県', en: 'Hyogo', url: 'http://www.haaa.jp/taikai.html', yearly: false },
  { ja: '奈良県', en: 'Nara', url: 'http://www.narariku.com/information.html', yearly: false },
  { ja: '和歌山県', en: 'Wakayama', url: 'https://wariku.com/athletics-list/', yearly: false },
  { ja: '鳥取県', en: 'Tottori', url: 'https://jaaf-tottori.com/competition/', yearly: false },
  { ja: '島根県', en: 'Shimane', url: 'https://www.shimariku.jp/record/16', yearly: false },
  { ja: '岡山県', en: 'Okayama', url: 'https://okariku33.com/?page_id=18', yearly: false },
  {
    ja: '広島県',
    en: 'Hiroshima',
    url: 'https://hiroshimatf.org/competitionandschedule',
    yearly: false,
  },
  {
    ja: '山口県',
    en: 'Yamaguchi',
    url: 'https://yaaf.jp/kyougikai-top/schedule-top/',
    yearly: false,
  },
  {
    ja: '徳島県',
    en: 'Tokushima',
    url: 'https://jaaftokushima.com/wp/schedule_table26/',
    yearly: true,
  },
  { ja: '香川県', en: 'Kagawa', url: 'https://gold.jaic.org/kagawa/right.htm', yearly: false },
  { ja: '愛媛県', en: 'Ehime', url: 'https://www.ehime-rikujyo.jp/01_taikai.html', yearly: false },
  {
    ja: '高知県',
    en: 'Kochi',
    url: 'https://www.jaaf.or.jp/competition/area/?action=search&prefecture=39&area=&coop=&season=2026&month=',
    yearly: true,
  },
  { ja: '福岡県', en: 'Fukuoka', url: 'https://www.fukuriku.com/tournament/', yearly: false },
  {
    ja: '佐賀県',
    en: 'Saga',
    url: 'http://www.sagarikujyo.jp/schedule/schedule_new.html',
    yearly: false,
  },
  {
    ja: '長崎県',
    en: 'Nagasaki',
    url: 'https://jaaf-nagasaki.net/schedule/schedule.shtml',
    yearly: false,
  },
  { ja: '熊本県', en: 'Kumamoto', url: 'http://kumariku.com/schedule/', yearly: false },
  { ja: '大分県', en: 'Oita', url: 'https://oita-rik.com/schedule', yearly: false },
  {
    ja: '宮崎県',
    en: 'Miyazaki',
    url: 'https://www.miyariku.org/maaf/2026/03/05/2026%E5%B9%B4%E5%BA%A6%E7%AB%B6%E6%8A%80%E4%BC%9A%E6%83%85%E5%A0%B1/',
    yearly: true,
  },
  {
    ja: '鹿児島県',
    en: 'Kagoshima',
    url: 'https://kariku.jp/wp-content/uploads/2026/03/2026competition.pdf',
    yearly: true,
  },
  {
    ja: '沖縄県',
    en: 'Okinawa',
    url: 'https://jaaf-okinawa.com/user.php?CMD=115401400000000',
    yearly: false,
  },
];
