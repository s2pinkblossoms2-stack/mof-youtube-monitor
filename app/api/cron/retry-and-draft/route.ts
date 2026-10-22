// 수집 5분 뒤 실행 (한국 시간 09:35 / 13:35 / 16:35): 실패한 영상만 다시 받는다.
// 새 댓글 분류와 답글 초안 생성은 댓글 작업 단계에서 여기에 이어 붙인다.
import { runRetry } from "@/lib/collect";
import { checkCronAuth, errorResponse, resultResponse } from "@/lib/cron";

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  try {
    return resultResponse(await runRetry(new Date()));
  } catch (error) {
    return errorResponse(error);
  }
}
