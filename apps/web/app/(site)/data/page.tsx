import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PRIVACY_EMAIL } from "@/components/legal-page";

export const metadata: Metadata = { title: "Your data and account deletion" };

export default function DataPage() {
  return (
    <LegalPage
      title="How Echo uses your social data"
      intro="Plain answers to what Echo can see from each platform, what it does with it, and how to delete everything."
    >
      <h2>X (formerly Twitter)</h2>
      <p>X is the only platform with an official API for your bookmarks, so it's the only one Echo connects to directly. When you tap Connect X, you sign in on X's own page and approve these read-only permissions:</p>
      <ul>
        <li><strong>bookmark.read</strong>: read the posts you've bookmarked so Echo can import them.</li>
        <li><strong>tweet.read</strong> and <strong>users.read</strong>: read a bookmarked post's full thread and its author's handle.</li>
        <li><strong>offline.access</strong>: keep the connection working without signing in again.</li>
      </ul>
      <p>Echo never posts, likes, follows, sends messages or changes anything on your X account. Tokens are encrypted at rest. Echo Plus checks for new bookmarks about once an hour; free accounts import when you tap Sync.</p>

      <h2>Instagram, LinkedIn, TikTok and YouTube</h2>
      <p>These platforms don't offer an API for your personal saved posts, and Echo will never ask for your password or log in as you. Echo only sees what you choose to share to it with the iOS Share sheet or paste in:</p>
      <ul>
        <li>For a link, Echo fetches the post's public page the way a link preview does, plus official oEmbed data where available.</li>
        <li>For a screenshot, text is recognised on your iPhone with Apple's Vision framework. If that fails, the image is read by our AI provider.</li>
        <li>For a video or screen recording, Echo transcribes the audio and reads on-screen captions from a few frames.</li>
      </ul>

      <h2>What Echo does with it</h2>
      <ul>
        <li>Keeps the original post word for word so you can always check the source.</li>
        <li>Files it by topic, pulls out details like tickers, sets and reps, or scripts, and rewrites the takeaway in the voice you chose.</li>
        <li>Creates an embedding so related saves show up together.</li>
      </ul>
      <p>Your saves are private to you. Echo doesn't share them, sell them, or use them for ad targeting. Content goes to our AI providers only to produce your results, under API terms that don't allow them to train on it. The full list of processors is in the <Link href="/privacy">Privacy Policy</Link>.</p>

      <h2 id="delete">Deleting your account</h2>
      <p>You can delete your account and all of its data at any time:</p>
      <ul>
        <li><strong>In the iOS app</strong>: open the Plus tab, tap Settings, then Delete account.</li>
        <li><strong>On the web</strong>: sign in, go to <Link href="/account">Account</Link>, and use Delete account.</li>
        <li><strong>By email</strong>: write to <a href={`mailto:${PRIVACY_EMAIL}?subject=Delete%20my%20Echo%20account`}>{PRIVACY_EMAIL}</a> from the address on your account.</li>
      </ul>
      <p>Deletion is immediate and permanent. It removes your account, saves, rewrites, voices, X connection and tokens, ad unlock records and every screenshot or video you uploaded. Encrypted database backups age out within 30 days.</p>
      <p>Deleting your account does not cancel an Echo Plus subscription, because Apple manages billing. Cancel it in Settings on your iPhone: tap your name, then Subscriptions, then Echo.</p>

      <h2>Disconnecting X only</h2>
      <p>To stop importing bookmarks without deleting your account, tap Disconnect next to X in the app or on the <Link href="/account">Account</Link> page. You can also revoke Echo's access in X under Settings, Security and account access, Apps and sessions.</p>
    </LegalPage>
  );
}
