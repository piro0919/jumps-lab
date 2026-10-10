import { Landing } from '../landing';
import { landingMetadata } from '../metadata';

/** 日本語の LP。ログインした人が開くと、src/proxy.ts がホーム（/）へ送る */
export const generateMetadata = () => landingMetadata('/ja');

export default function LandingJa() {
  return <Landing />;
}
