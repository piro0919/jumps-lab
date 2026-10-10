import type messages from '../messages/en.json';
import type { Locale } from './i18n/locales';

// 文言のキーを型で確かめる。英語のファイルを正とし、日本語はこれと同じ形にそろえる
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
