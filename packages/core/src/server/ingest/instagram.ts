import type { CreateSaveInput } from "../../schemas";

/**
 * Placeholder for a future Instagram integration. Instagram has no API for a
 * person's saved posts, so today Instagram content arrives only through the
 * Share Extension or a pasted link. A plausible future path is the Instagram
 * Messaging API: the user DMs a post to an Echo business account, and the
 * webhook turns each shared post into a save. Nothing here scrapes Instagram.
 */
export interface InstagramMessagingIngest {
  /** Verifies the X-Hub-Signature-256 header Meta sends with each webhook. */
  verifySignature(rawBody: string, signatureHeader: string | null): boolean;
  /** Maps a messaging webhook payload to save requests plus the Instagram user they came from. */
  parseWebhook(payload: unknown): { instagramUserId: string; save: CreateSaveInput }[];
}

export class InstagramMessagingNotConfigured implements InstagramMessagingIngest {
  verifySignature(): boolean {
    return false;
  }

  parseWebhook(): { instagramUserId: string; save: CreateSaveInput }[] {
    throw new Error("Instagram messaging ingest is not implemented yet");
  }
}
