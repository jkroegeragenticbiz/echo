import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import {
  DOMAINS,
  PERSPECTIVES,
  PLANS,
  PLATFORMS,
  type KeyMetric,
  type Structured,
  type Tone,
} from "@echo/core";

export const EMBEDDING_DIMENSIONS = 1536;

export const planEnum = pgEnum("plan", PLANS);
export const platformEnum = pgEnum("platform", PLATFORMS);
export const domainEnum = pgEnum("domain", DOMAINS);
export const perspectiveEnum = pgEnum("perspective", PERSPECTIVES);
export const connectionStatusEnum = pgEnum("connection_status", ["active", "expired", "revoked", "error"]);
export const saveStatusEnum = pgEnum("save_status", ["processing", "ready", "failed"]);
export const jobStatusEnum = pgEnum("job_status", ["queued", "running", "done", "failed"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Users and Auth.js tables (column names follow @auth/drizzle-adapter).
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  name: text("name"),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  image: text("image"),
  plan: planEnum("plan").notNull().default("free"),
  /** When the current Plus entitlement lapses (from RevenueCat). Null for free or lifetime. */
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] }), index("accounts_user_idx").on(t.userId)],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Echo domain tables
// ---------------------------------------------------------------------------

export const voiceProfiles = pgTable(
  "voice_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    personas: text("personas").array().notNull().default(sql`'{}'::text[]`),
    description: text("description").notNull().default(""),
    perspective: perspectiveEnum("perspective").notNull().default("first_person"),
    tone: text("tone").array().$type<Tone[]>().notNull().default(sql`'{}'::text[]`),
    voiceSample: text("voice_sample"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("voice_profiles_user_idx").on(t.userId),
    // At most one active profile per user.
    uniqueIndex("voice_profiles_one_active_idx").on(t.userId).where(sql`${t.isActive}`),
  ],
);

export const socialConnections = pgTable(
  "social_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    status: connectionStatusEnum("status").notNull().default("active"),
    externalUserId: text("external_user_id"),
    externalUsername: text("external_username"),
    /** AES-256-GCM ciphertext (see apps/web/lib/crypto.ts); never stored in plaintext. */
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes").array(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("social_connections_user_platform_idx").on(t.userId, t.platform)],
);

export const saves = pgTable(
  "saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    sourceUrl: text("source_url"),
    canonicalUrl: text("canonical_url"),
    /** Platform-native id, e.g. the X post id, used to skip already-synced bookmarks. */
    externalId: text("external_id"),
    author: text("author"),
    verbatimText: text("verbatim_text").notNull().default(""),
    mediaUrls: text("media_urls").array().notNull().default(sql`'{}'::text[]`),
    transcript: text("transcript"),
    ocrText: text("ocr_text"),
    contentHash: text("content_hash"),
    domain: domainEnum("domain").notNull().default("other"),
    structured: jsonb("structured").$type<Structured>(),
    summary: text("summary"),
    keyMetric: jsonb("key_metric").$type<KeyMetric>(),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    status: saveStatusEnum("status").notNull().default("ready"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("saves_user_created_idx").on(t.userId, t.createdAt.desc()),
    uniqueIndex("saves_user_canonical_url_idx")
      .on(t.userId, t.canonicalUrl)
      .where(sql`${t.canonicalUrl} is not null`),
    uniqueIndex("saves_user_content_hash_idx")
      .on(t.userId, t.contentHash)
      .where(sql`${t.contentHash} is not null`),
    index("saves_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const rewrites = pgTable(
  "rewrites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saveId: uuid("save_id")
      .notNull()
      .references(() => saves.id, { onDelete: "cascade" }),
    voiceProfileId: uuid("voice_profile_id")
      .notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),
    headline: text("headline").notNull(),
    paraphrase: text("paraphrase").notNull(),
    actionSteps: text("action_steps").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("rewrites_save_voice_idx").on(t.saveId, t.voiceProfileId)],
);

export const adUnlocks = pgTable(
  "ad_unlocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    saveId: uuid("save_id")
      .notNull()
      .references(() => saves.id, { onDelete: "cascade" }),
    voiceProfileId: uuid("voice_profile_id").references(() => voiceProfiles.id, { onDelete: "set null" }),
    adNetwork: text("ad_network").notNull().default("admob"),
    /** AdMob SSV transaction_id; unique so replayed callbacks are ignored. */
    transactionId: text("transaction_id").unique(),
    rewardVerifiedAt: timestamp("reward_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("ad_unlocks_user_idx").on(t.userId), index("ad_unlocks_save_idx").on(t.saveId)],
);

/** Heavy media work (ffmpeg + Whisper) runs here instead of inside the request. */
export const mediaJobs = pgTable(
  "media_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saveId: uuid("save_id")
      .notNull()
      .references(() => saves.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_jobs_status_idx").on(t.status, t.createdAt)],
);

export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  persona: text("persona"),
  createdAt: createdAt(),
});

/** Processed RevenueCat webhook event ids, for idempotency. */
export const revenuecatEvents = pgTable("revenuecat_events", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type VoiceProfileRow = typeof voiceProfiles.$inferSelect;
export type SaveRow = typeof saves.$inferSelect;
export type NewSave = typeof saves.$inferInsert;
export type RewriteRow = typeof rewrites.$inferSelect;
export type AdUnlockRow = typeof adUnlocks.$inferSelect;
export type SocialConnectionRow = typeof socialConnections.$inferSelect;
export type MediaJobRow = typeof mediaJobs.$inferSelect;
