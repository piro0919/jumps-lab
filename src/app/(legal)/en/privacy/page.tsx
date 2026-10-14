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
    <Legal title="Privacy Policy" doc="privacy" locale="en" updated="October 14, 2026">
      <h2>1. Operator</h2>
      <dl>
        <dt>Operator</dt>
        <dd>kk-web</dd>
        <dt>Address</dt>
        <dd>
          4F Kabutocho No. 6 Hayama Building, 17-2 Nihonbashi Kabutocho, Chuo-ku, Tokyo 103-0026,
          Japan
        </dd>
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
          start, week start and time zone)
        </li>
        <li>Your marks (date, event, practice or competition, mark, wind and note)</li>
        <li>
          Your condition, fatigue, sleep, injuries or discomfort and practice notes for each day
        </li>
        <li>
          Your competitions (name, date, venue, call room place and time, start time, notes and
          whether it is your main goal meet)
        </li>
        <li>Your goal marks and the bests you enter by hand</li>
        <li>
          Your practice and competition videos (the video files with their date, event, practice or
          competition, linked attempt and note)
        </li>
        <li>Your plan (Free or Premium)</li>
        <li>
          If you use the AI coach: the menus it made, your conversations with it, when you agreed to
          it, and when and how often you used AI
        </li>
        <li>
          Whether you are 16 or older (worked out from your date of birth if you entered one, and
          kept if you remove it later; otherwise your own answer on the AI coach consent screen)
        </li>
        <li>
          If you are under 16 and use the AI coach: your parent&apos;s or guardian&apos;s email
          address, and when they agreed
        </li>
        <li>
          If you turn notifications on: where to deliver them on that device (the push service
          address and its encryption keys) and the language of the notification text
        </li>
      </ul>
      <p>
        Grade, date of birth, gender, height, weight and the injury field are optional. Write only
        what you need about injuries or discomfort.
      </p>

      <h2>3. How we use it</h2>
      <ol>
        <li>To save your marks and show them to you</li>
        <li>To calculate and show your personal best, season best and progress</li>
        <li>
          To suggest how hard to train each day from your condition, sleep, injuries and competition
          schedule
        </li>
        <li>
          To make the day&apos;s practice menu and answer your questions when you use the AI coach
          on Premium
        </li>
        <li>
          If you are under 16, to email your parent or guardian a request to agree to the AI coach
          and to keep a record of their agreement
        </li>
        <li>To remind you the day before a competition, if you turn notifications on</li>
        <li>To sign you in and confirm who you are</li>
      </ol>
      <p>We use it for nothing else. We do not use it for advertising or sell it to anyone.</p>

      <h2>4. Who can see it</h2>
      <p>
        Only you and the joint users below can see your information. There is no feature that shows
        it to other users. Each time you watch a video, we issue an address that stops working after
        a set time.
      </p>
      <p>We use your information jointly as follows.</p>
      <dl>
        <dt>Information used jointly</dt>
        <dd>All of the information in section 2</dd>
        <dt>Joint users</dt>
        <dd>kk-web and Renya Nakamoto (中元廉弥)</dd>
        <dt>Purposes</dt>
        <dd>The purposes in section 3, and managing plans</dd>
        <dt>Responsible for managing it</dt>
        <dd>kk-web (address and contact in section 1)</dd>
      </dl>

      <h2>5. What we share with other services</h2>
      <dl>
        <dt>Neon</dt>
        <dd>
          All of the information above except video files. Used as our database, stored in Singapore
        </dd>
        <dt>Cloudflare R2</dt>
        <dd>Video files. Used to store videos, in the Asia-Pacific region</dd>
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
        <dt>Vercel Web Analytics</dt>
        <dd>
          Used to learn which pages are viewed and how often. It counts the page viewed, the
          referring site, country or region, and device, operating system and browser type, in a
          form that does not identify you. It uses no cookies
        </dd>
        <dt>OpenAI</dt>
        <dd>
          Only if you use the AI coach, and only after you agree (if you are under 16, after your
          parent or guardian agrees), we send the following to make your menu and answer your
          questions: the date; your age, gender, height, weight and events; your personal best and
          season best for each event; your condition, fatigue, sleep, injuries or discomfort and
          practice notes for the last 14 days; your attempts in the last 14 days (event, practice or
          competition, mark, wind and note); the days left to each competition in the next 8 weeks
          and which one is your main goal meet; the day&apos;s training level and its reasons; the
          practice time and note you enter; your messages and the current menu; and on a competition
          day, that meet&apos;s venue, call room place and time, start time and notes. We never send
          your name or email address. OpenAI is a US company. The United States has no single
          federal privacy law; sector-specific federal laws and state laws apply (
          <a
            href="https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            summary by Japan&apos;s Personal Information Protection Commission
          </a>
          , as of October 2021). OpenAI says it does not use data sent to its API to train its
          models unless the account opts in, and keeps abuse monitoring logs for up to 30 days
          unless the law requires longer (
          <a
            href="https://developers.openai.com/api/docs/guides/your-data"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            OpenAI: Data controls
          </a>
          ). Jumps Lab asks OpenAI not to store the replies for later retrieval
        </dd>
        <dt>Resend</dt>
        <dd>
          Only when someone under 16 sends their parent or guardian a request to agree to the AI
          coach: the parent&apos;s or guardian&apos;s email address and the email (the display name
          of the person asking, what the AI coach sends, and the link to agree). Used to deliver the
          email. Resend is a US company
        </dd>
        <dt>Browser and OS push services (Google, Apple, Mozilla, Microsoft)</dt>
        <dd>
          Only if you turn notifications on: the notification (that a competition is tomorrow and
          its name) is delivered to your device through the push service your browser uses. It is
          sent encrypted. Notifications never include your marks, notes, condition, injuries or
          discomfort
        </dd>
        <dt>Sentry</dt>
        <dd>
          Used to notice errors on our server. We send only the error and the address of the page
          where it happened, never your records, profile, IP address or cookies
        </dd>
      </dl>

      <h2>6. Cookies</h2>
      <p>We use only the cookie that keeps you signed in.</p>

      <h2>7. How long we keep it</h2>
      <p>
        We delete each video 90 days after you upload it, and show the date under each video. We
        delete where to deliver notifications when you turn them off, when you sign out on that
        device, when the push service reports it no longer works, or when you delete your account. A
        parent&apos;s or guardian&apos;s email address is deleted within 2 days after its link
        expires (7 days after it is sent) if it was not used to agree; if it was, we keep it as the
        record of their agreement until a newer agreement replaces it or you delete your account. We
        keep the rest of the information until you delete your account. When you do, we delete all
        of the information above. Your videos are deleted at that time too, and any that could not
        be deleted then are removed within 91 days of their upload.
      </p>

      <h2>8. Access, correction and deletion</h2>
      <p>
        You can correct your marks and profile on your own screens, and delete your account yourself
        under Account in Settings. For any other request, contact us at the address above.
      </p>

      <h2>9. Minors</h2>
      <p>
        If you are a minor, get your parent&apos;s or guardian&apos;s consent before using Jumps
        Lab. If you are under 16, you can use the AI coach only after your parent or guardian agrees
        through the link we email them.
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
