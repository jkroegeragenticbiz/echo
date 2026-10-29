import { json, route } from "@/lib/http";
import { requireCron } from "@/lib/cron";
import { runMediaJobs } from "@/lib/services/media";
import { serviceContext } from "@/lib/services/runtime";

export const maxDuration = 300;

/** Vercel Cron: retries media jobs that failed or whose function was cut short. */
export const GET = route(async (req: Request) => {
  requireCron(req);
  return json({ results: await runMediaJobs(serviceContext(), { limit: 3 }) });
});
