import type { Metadata } from 'next';
import Link from 'next/link';
import { Legal } from '../../legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  alternates: { canonical: './', languages: { ja: '/privacy', en: '/en/privacy' } },
};

/** プライバシーポリシーの英訳。節は日本語版（/privacy）と1対1 */
export default function PrivacyEn() {
  return (
    <Legal title="Privacy Policy" doc="privacy" locale="en" updated="October 11, 2026">
      <h2>1. Operator</h2>
      <dl>
        <dt>Operator</dt>
        <dd>kk-web</dd>
        <dt>Service</dt>
        <dd>Jumps Lab (jumpslab.kkweb.io)</dd>
        <dt>Contact</dt>
        <dd>kk.web.kawamura@gmail.com</dd>
      </dl>

      <h2>2. Information we keep</h2>
      <ul>
        <li>
          Your Google account identifier, email address, display name and profile image URL (used
          for sign-in)
        </li>
        <li>
          Your profile (name, grade, date of birth, gender, height, weight, events, units, season
          start and time zone)
        </li>
        <li>Your marks (date, event, practice or competition, mark, wind and note)</li>
        <li>
          Your condition, fatigue, sleep, injuries or discomfort and practice notes for each day
        </li>
        <li>
          Your competitions (name, date, venue, call room place and time, start time and notes)
        </li>
        <li>Your goal marks and the bests you enter by hand</li>
      </ul>
      <p>
        Grade, date of birth, gender, height, weight and the injury field are optional. Write only
        what you need about injuries or discomfort.
      </p>

      <h2>3. How we use it</h2>
      <ol>
        <li>To save your marks and show them to you</li>
        <li>To calculate and show your personal best, season best and progress</li>
        <li>To sign you in and confirm who you are</li>
      </ol>
      <p>We use it for nothing else. We do not use it for advertising or sell it to anyone.</p>

      <h2>4. Who can see it</h2>
      <p>Only you can see your information. There is no feature that shows it to other users.</p>

      <h2>5. What we share with other services</h2>
      <dl>
        <dt>Neon</dt>
        <dd>All of the information above. Used as our database, stored in Singapore</dd>
        <dt>Vercel</dt>
        <dd>Your requests to the site. Used to serve the site, processed in Singapore</dd>
        <dt>Google</dt>
        <dd>
          The sign-in process. We receive your identifier, email address, display name and profile
          image URL from Google
        </dd>
        <dt>Open-Meteo</dt>
        <dd>
          The latitude and longitude of your location, rounded to about 100 m. Sent directly from
          your browser only when you ask to show the weather. It is not sent to our servers and is
          not stored
        </dd>
      </dl>

      <h2>6. Cookies</h2>
      <p>We use only the cookie that keeps you signed in.</p>

      <h2>7. How long we keep it</h2>
      <p>
        We keep it until you delete your account. When you do, we delete all of the information
        above.
      </p>

      <h2>8. Access, correction and deletion</h2>
      <p>
        You can correct your marks and profile on your own screens. For account deletion or any
        other request, contact us at the address above.
      </p>

      <h2>9. Minors</h2>
      <p>
        If you are a minor, get your parent&apos;s or guardian&apos;s consent before using Jumps
        Lab.
      </p>

      <h2>10. Changes</h2>
      <p>
        When we change this policy, we will update this page. The terms of use are in the{' '}
        <Link href="/en/terms" className="underline">
          Terms of Use
        </Link>
        .
      </p>
    </Legal>
  );
}
