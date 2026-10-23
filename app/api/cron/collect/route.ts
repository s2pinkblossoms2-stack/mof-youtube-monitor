// 하루 3회 수집 (한국 시간 09:30 / 13:30 / 16:30). 일정은 vercel.json에 있다.
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
