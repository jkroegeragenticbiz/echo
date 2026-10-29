import type { Metadata } from "next";
import { effectivePlan, getDb, getUser, listSaves, listVoiceProfiles, countSavesThisMonth } from "@echo/db";
import { LibraryView } from "@/components/library-view";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { toSaveDTO } from "@/lib/services/dto";
import { ensureActiveVoice, toVoiceDTO } from "@/lib/services/voices";

export const metadata: Metadata = { title: "Library" };
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  const userId = session!.user.id;
  const db = getDb();
  const [user, active] = await Promise.all([getUser(db, userId), ensureActiveVoice(db, userId)]);
  const [voices, rows, used] = await Promise.all([
    listVoiceProfiles(db, userId),
    listSaves(db, userId, { voiceProfileId: active.id, limit: 30 }),
    countSavesThisMonth(db, userId),
  ]);
  const plan = user ? effectivePlan(user) : "free";
  return (
    <LibraryView
      initialSaves={rows.map((r) => toSaveDTO(r.save, r.rewrite))}
      voices={voices.map(toVoiceDTO)}
      initialVoiceId={active.id}
      plan={plan}
      usage={{ used, limit: plan === "plus" ? null : env.freeSavesPerMonth }}
    />
  );
}
