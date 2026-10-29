import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PRIVACY_EMAIL } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Echo exists to help you use what you save. This policy explains what we collect to do that, who processes it for us, and how you stay in control. We don't sell your data and we don't use it for advertising profiles."
    >
      <h2>What we collect</h2>
      <h3>Account information</h3>
      <ul>
        <li>Your email address, if you sign in with email or share it through Sign in with Apple (Apple may give us a private relay address instead).</li>
        <li>An identifier from Apple when you use Sign in with Apple.</li>
        <li>Your plan (Free or Echo Plus) and how many saves you've made this month.</li>
      </ul>
      <h3>Content you save</h3>
      <ul>
        <li>Links, text, screenshots and videos you share to Echo, and the public page text, captions or metadata we fetch from those links.</li>
        <li>Text recognised in images (done on your iPhone where possible), transcripts of video audio, and text recognised in video frames.</li>
        <li>What Echo produces from it: the topic, structured details, rewrites in your voice, and an embedding (a list of numbers used to find related saves).</li>
      </ul>
      <h3>Your voice profile</h3>
      <ul>
        <li>The personas, description, tone and perspective you choose, and any writing sample you paste to help Echo match your voice.</li>
      </ul>
      <h3>Connected accounts</h3>
      <ul>
        <li>If you connect X, we store access tokens (encrypted) and your X user id and username, and we read your bookmarks to import them. See <Link href="/data">how Echo uses social data</Link>.</li>
        <li>We do not connect to, log in to, or read your Instagram, LinkedIn or TikTok accounts. We only see what you choose to share.</li>
      </ul>
      <h3>Purchases and ads</h3>
      <ul>
        <li>Subscriptions are processed by Apple. RevenueCat tells us whether your Echo Plus subscription is active; we never see your payment details.</li>
        <li>On the free plan, Google AdMob shows a rewarded video before each rewrite. We request non-personalized ads only and don't ask to track you across apps. AdMob confirms to our server that an ad was watched, using an id for that unlock and your Echo user id.</li>
      </ul>
      <h3>Technical data</h3>
      <ul>
        <li>Standard server logs (IP address, device and browser type, timestamps and errors), kept for security and debugging.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To save, read, classify and rewrite your posts, find related saves, and show your library on iPhone and the web.</li>
        <li>To run your account, enforce plan limits, verify rewarded ads and keep your subscription status in sync.</li>
        <li>To secure Echo, prevent abuse and fix problems.</li>
        <li>To email you about your account or, if you joined the waitlist, about Echo's launch. You can unsubscribe any time.</li>
      </ul>
      <p>We do not sell or rent your personal information, and we do not use your saves to build advertising profiles.</p>

      <h2>Who processes data for us</h2>
      <p>We use a small set of service providers, each only for the job below and under contracts that limit how they can use your data:</p>
      <ul>
        <li><strong>Vercel</strong>: hosting the website and API, and storing uploaded screenshots and videos (Vercel Blob).</li>
        <li><strong>Our Postgres database provider</strong> (Neon or Vercel Postgres): storing your account and library.</li>
        <li><strong>Anthropic</strong>: the AI model that classifies posts, recognises text in images when needed, and writes rewrites.</li>
        <li><strong>OpenAI</strong>: transcribing video audio (Whisper) and creating embeddings for related saves.</li>
        <li><strong>X</strong>: reading your bookmarks if you connect your account.</li>
        <li><strong>Google AdMob</strong>: rewarded video ads on the free plan.</li>
        <li><strong>RevenueCat</strong> and <strong>Apple</strong>: subscriptions.</li>
        <li><strong>Our email provider</strong>: sending sign-in links.</li>
      </ul>
      <p>Content is sent to our AI providers only to produce your results, under API terms that do not allow them to train their models on it.</p>

      <h2>How long we keep it</h2>
      <p>We keep your library until you delete a save or your account. When you delete your account, we delete your data from our live systems right away, including uploaded media, and it ages out of encrypted backups within 30 days. Server logs are kept for up to 30 days. Waitlist emails are kept until launch or until you ask us to remove them.</p>

      <h2>Your choices and rights</h2>
      <ul>
        <li><strong>Delete</strong> any save from its detail view, or your whole account in the app (Settings, Delete account) or on the web (<Link href="/account">Account</Link>).</li>
        <li><strong>Disconnect X</strong> any time in the app or on the web, and revoke Echo's access in your X settings.</li>
        <li><strong>Access or correct</strong> your data: everything we hold about your saves is visible in your library. For a copy of your data, email us.</li>
        <li>Depending on where you live (for example under the GDPR or CCPA), you may have further rights such as objecting to processing or data portability. Email us and we'll respond within 30 days.</li>
      </ul>

      <h2>Security</h2>
      <p>Data is encrypted in transit. OAuth tokens are additionally encrypted at rest with AES-256-GCM. Access to production systems is limited to people who need it to run Echo. Uploaded media is stored at unguessable URLs.</p>

      <h2>Children</h2>
      <p>Echo is not directed at children under 13 (or under 16 where local law requires), and we don't knowingly collect their data. If you believe a child has an account, contact us and we'll delete it.</p>

      <h2>International transfers</h2>
      <p>Our providers may process data in the United States and other countries. Where required, we rely on appropriate safeguards such as standard contractual clauses.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we'll tell you in the app or by email before the change takes effect.</p>

      <h2>Contact</h2>
      <p>Questions or requests: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.</p>
    </LegalPage>
  );
}
