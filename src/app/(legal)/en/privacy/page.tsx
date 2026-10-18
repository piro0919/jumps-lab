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
    <Legal title="Privacy Policy" doc="privacy" locale="en" updated="October 18, 2026">
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
        <li>
          Your marks (date, event, practice or competition, mark, wind and note, and, if you enter
          them, approach steps and length, distance from the take-off board, pole length and
          stiffness, grip height and standards setting, and per-height results for high jump and
          pole vault)
        </li>
        <li>
          Your condition, fatigue, sleep, injuries or discomfort with how they are healing, and
          practice notes for each day
        </li>
        <li>
          Your competitions (name, date, venue, call room place and time, start time, notes and
          whether it is a goal meet)
        </li>
        <li>Your goal marks and the bests you enter by hand</li>
        <li>
          Your practice and competition videos (the video files with their date, event, practice or
          competition, linked attempt and note, and the timing marks and the angles you measure by
          hand on them in the compare view)
        </li>
        <li>Your plan (Free or Premium)</li>
        <li>
          If you use the AI coach: the menus it made, your conversations with it, when you agreed to
          it, and when and how often you used AI
        </li>
        <li>
          If you import competitions: the address and content of the page, or the PDF or photo, you
          choose (used only to read the competitions from it, and not saved)
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
        <li>
          If you use teams: the names of the teams you create, the teams you coach, the teams you
          are in with when you joined, when consent was given and whether you or your parent or
          guardian gave it, and invite links (we store their keys only in a form that cannot be
          turned back into the link) with when they expire
        </li>
        <li>
          If you are under 16 and join a team: your parent&apos;s or guardian&apos;s email address,
          and when they agreed
        </li>
        <li>
          Comments that team coaches and athletes write on each day (the text, who wrote it, which
          athlete and day it belongs to, which team, and when it was written)
        </li>
        <li>Each team&apos;s plan (Free or Premium)</li>
        <li>
          If you send us the Premium for teams inquiry form: your name, email address, school or
          club name, number of athletes, events and message
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
          on Premium or as an athlete on a team with Premium for teams
        </li>
        <li>
          To read the competitions in the schedule page, PDF or photo you choose and list them for
          you when you import competitions on Premium
        </li>
        <li>
          If you are under 16, to email your parent or guardian a request to agree to the AI coach
          and to keep a record of their agreement
        </li>
        <li>
          To remind you the day before a competition and to tell you a comment has arrived, if you
          turn notifications on
        </li>
        <li>
          To show your records to the coaches of a team you join, with your consent (or, if you are
          under 16, your parent&apos;s or guardian&apos;s consent, including emailing them a request
          and keeping a record of their agreement)
        </li>
        <li>To let team coaches and athletes exchange comments about each day&apos;s records</li>
        <li>To sign you in and confirm who you are</li>
        <li>To reply to Premium for teams inquiries and tell you about it</li>
      </ol>
      <p>We use it for nothing else. We do not use it for advertising or sell it to anyone.</p>

      <h2>4. Who can see it</h2>
      <p>
        Only you and the joint users below can see your information, except that if you join a team,
        we also show what is listed under &quot;Team coaches&quot; below to that team&apos;s coaches
        (who are Jumps Lab users). There is no other feature that shows it to other users. Each time
        you watch a video, we issue an address that stops working after a set time.
      </p>
      <dl>
        <dt>What team coaches see</dt>
        <dd>
          The coaches of a team you join can see, without being able to change anything, your
          display name and events, your attempts (date, event, practice or competition, mark, wind,
          note, the approach, board and pole details and per-height results), your condition,
          fatigue, sleep, injuries or discomfort with how they are healing, and practice notes for
          each day, your competitions and their results, and your videos and their notes. They do
          not see your email address. Coaches cannot change or delete your records
        </dd>
        <dt>Comments</dt>
        <dd>
          Coaches and you can comment on each of your last 14 days (you can start a comment, not
          only reply). Comments are kept per team, and only you and that team&apos;s coaches can see
          them (coaches of your other teams cannot). Only the person who wrote a comment can delete
          it
        </dd>
        <dt>Consent</dt>
        <dd>
          Showing your records to coaches means providing them to a third party on your behalf, so
          we ask for your consent when you join a team, after showing what they will see (the
          &quot;Join and share&quot; button). This includes information about your body, such as
          injuries or discomfort, so we never show it without consent. If you are under 16, you join
          when your parent or guardian agrees through the link we email them
        </dd>
        <dt>Stopping</dt>
        <dd>
          You can leave a team anytime from Teams in your account menu. Coaches can no longer see
          your records or comments from the moment you leave, a coach removes you, the team is
          deleted or you delete your account. The comments of a team you left stay visible to you
        </dd>
      </dl>
      <p>We use your information jointly as follows.</p>
      <dl>
        <dt>Information used jointly</dt>
        {/* Items are listed, not "all of section 2" (2026-10-14): see the note in the Japanese page */}
        <dd>
          The following information in section 2: your Google account identifier, email address,
          display name and profile image URL; your profile; your marks, including attempt details;
          your condition, fatigue, sleep, injuries or discomfort and practice notes; your
          competitions; your goal marks and the bests you enter by hand; your videos; your plan;
          your AI coach menus, conversations, consent time and usage times and counts; whether you
          are 16 or older; a parent or guardian&apos;s email address and the time they agreed; your
          notification destinations and their language; team information (team names, coach and
          membership records, consent records and invite links); and team comments
        </dd>
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
          image URL from Google. The Premium for teams inquiry form is a Google Form, and what you
          send through it is stored by Google. Google is a US company
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
          Only if you use the AI coach or import competitions, and only after you agree (if you are
          under 16, after your parent or guardian agrees), we send the following to make your menu
          and answer your questions: the date; your age, gender, height, weight and events; your
          personal best and season best for each event; your condition, fatigue, sleep, injuries or
          discomfort with how they are healing, and practice notes for the last 14 days; your
          attempts in the last 14 days (event, practice or competition, mark, wind and note); the
          days left to each competition in the next 8 weeks and which ones are goal meets; the
          day&apos;s training level and its reasons; the practice time and note you enter; your
          messages and the current menu; and on a competition day, that meet&apos;s venue, call room
          place and time, start time and notes. When you import competitions, we send the address
          and content of the page, or the PDF or photo, you choose; only the competitions are read
          from it, and it is not saved. We never send your name or email address. OpenAI is a US
          company. The United States has no single federal privacy law; sector-specific federal laws
          and state laws apply (
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
          coach or to joining a team: the parent&apos;s or guardian&apos;s email address and the
          email (the display name of the person asking, what the AI coach sends or what the
          team&apos;s coaches see, the team name and the coach&apos;s display name, and the link to
          agree). Used to deliver the email. Resend is a US company
        </dd>
        <dt>Browser and OS push services (Google, Apple, Mozilla, Microsoft)</dt>
        <dd>
          Only if you turn notifications on: the notification (that a competition is tomorrow and
          its name, or that a comment has arrived and the team name, plus the athlete&apos;s display
          name in notifications to coaches) is delivered to your device through the push service
          your browser uses. It is sent encrypted. Notifications never include the text of comments,
          your marks, notes, condition, injuries or discomfort
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
        record of their agreement until a newer agreement replaces it or you delete your account
        (for joining a team, until you leave or are removed from that team). We keep teams and
        invite links until a coach deletes the team or the team has no coach left. We delete a
        comment when its writer deletes it, when the team is deleted, or when its writer or the
        athlete it belongs to deletes their account. We delete Premium for teams inquiries within
        one year after we have finished telling you about it. We keep the rest of the information
        until you delete your account. When you do, we delete all of the information above. Your
        videos are deleted at that time too, and any that could not be deleted then are removed
        within 91 days of their upload.
      </p>

      <h2>8. Access, correction and deletion</h2>
      <p>
        You can correct your marks and profile on your own screens, and delete your account yourself
        under Account in Settings. For any other request, contact us at the address above.
      </p>

      <h2>9. Minors</h2>
      <p>
        If you are a minor, get your parent&apos;s or guardian&apos;s consent before using Jumps
        Lab. If you are under 16, you can use the AI coach and join a team only after your parent or
        guardian agrees through the link we email them.
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
