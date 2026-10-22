// 월요일 영상 목록 갱신 (한국 시간 월요일 08:50): 14일 지난 영상은 빼고 새 영상은 추가한다.
import { syncVideos } from "@/lib/collect";
import { checkCronAuth, errorResponse } from "@/lib/cron";

export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  try {
    const { items, added, removed } = await syncVideos(new Date());
    return Response.json({
      ok: true,
      status: "done",
      total: items.length,
      added: added.length,
      removed: removed.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
