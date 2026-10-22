// 수집 5분 뒤 실행 (한국 시간 09:35 / 13:35 / 16:35):
// ① 실패한 영상만 다시 받고 ② 새 댓글을 모아 분류한다. 답글 초안 생성은 다음 단계에서 이어 붙인다.
import { classifyPending, collectNewComments } from "@/lib/comments/pipeline";
import { runRetry } from "@/lib/collect";
import { checkCronAuth, errorResponse } from "@/lib/cron";

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  const now = new Date();
  const deadline = Date.now() + 45_000; // 60초 제한 안에 끝나도록 시간을 정해 둔다

  try {
    const retry = await runRetry(now);
    // 댓글 단계가 실패해도 재시도 결과는 알려야 하므로 따로 잡는다
    let comments: Record<string, unknown>;
    try {
      const collected = await collectNewComments(now, deadline);
      const classified = await classifyPending(deadline);
      comments = { status: "done", collected, ...classified };
    } catch (error) {
      console.error("댓글 단계 오류:", error instanceof Error ? error.message : error);
      comments = { status: "failed" };
    }
    const ok = retry.status !== "failed" && comments.status !== "failed";
    return Response.json({ ok, retry, comments }, { status: ok ? 200 : 500 });
  } catch (error) {
    return errorResponse(error);
  }
}
