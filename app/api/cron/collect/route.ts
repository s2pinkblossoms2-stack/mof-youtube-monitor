// 하루 한 번 수집 (한국 시간 15:30, 16:00 기록). 일정은 supabase/cron.sql에 있다.
import { runCollectGuarded } from "@/lib/collect";
import { checkCronAuth, errorResponse, resultResponse } from "@/lib/cron";

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  try {
    return resultResponse(await runCollectGuarded(new Date()));
  } catch (error) {
    return errorResponse(error);
  }
}
