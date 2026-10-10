import { Landing } from '../landing';
import { landingMetadata } from '../metadata';

/** 英語の LP。ログインしていない人が / を開くと、src/proxy.ts がここを描かせる */
export const generateMetadata = () => landingMetadata('/');

export default function LandingEn() {
  return <Landing />;
}
