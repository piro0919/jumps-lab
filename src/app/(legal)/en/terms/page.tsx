import type { Metadata } from 'next';
import Link from 'next/link';
import { Legal } from '../../legal';

export const metadata: Metadata = {
  title: 'Terms of Use',
  alternates: { canonical: './', languages: { ja: '/terms', en: '/en/terms' } },
};

/** 利用規約の英訳。条は日本語版（/terms）と1対1 */
export default function TermsEn() {
  return (
    <Legal title="Terms of Use" doc="terms" locale="en" updated="October 11, 2026">
      <h2>Article 1 (Scope)</h2>
      <p>
        These terms set out the conditions for using Jumps Lab (the &quot;Service&quot;) provided by
        kk-web (&quot;we&quot;). By using the Service, you agree to these terms.
      </p>

      <h2>Article 2 (Accounts)</h2>
      <ol>
        <li>You sign in with a Google account</li>
        <li>
          If you are a minor, get your parent&apos;s or guardian&apos;s consent before using the
          Service
        </li>
      </ol>

      <h2>Article 3 (Fees)</h2>
      <p>The Service is free.</p>

      <h2>Article 4 (Prohibited conduct)</h2>
      <ol>
        <li>Use that violates laws or public order and morals</li>
        <li>Putting excessive load on the Service&apos;s servers or network</li>
        <li>Using the Service while pretending to be someone else</li>
        <li>Interfering with the operation of the Service</li>
      </ol>

      <h2>Article 5 (Changes to and suspension of the Service)</h2>
      <p>We may change or stop providing the Service without prior notice.</p>

      <h2>Article 6 (Disclaimer)</h2>
      <ol>
        <li>
          We do not guarantee that the marks you save will never be lost. Keep your own copy of
          anything important
        </li>
        <li>
          Except in cases of our intent or gross negligence, we are not liable for any damage
          arising from your use of the Service
        </li>
      </ol>

      <h2>Article 7 (Changes to these terms)</h2>
      <p>We may change these terms. When we do, we will announce it on this page.</p>

      <h2>Article 8 (Governing law and jurisdiction)</h2>
      <p>
        These terms are governed by the laws of Japan. The Tokyo District Court has exclusive
        jurisdiction in the first instance over any dispute about the Service.
      </p>

      <p>
        How we handle your information is described in the{' '}
        <Link href="/en/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </Legal>
  );
}
