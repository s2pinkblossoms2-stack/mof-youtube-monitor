// 매일 한국 시간 03:00: 수집한 지 14일이 지난 댓글과 삭제 기록의 원문을 지운다.
import { checkCronAuth, errorResponse } from "@/lib/cron";
import { purgeExpired } from "@/lib/db/cleanup";

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  try {
    const result = await purgeExpired(new Date());
    return Response.json({ ok: true, status: "done", ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
