// 영상 목록 갱신과 조회수·댓글 수 수집 (서버 전용).
// 규칙(PRD 5장 must 1): 14일 이내 영상만, 유튜브 값 그대로 저장, 실패는 채우지 않고 "수집 실패"로 기록.
import { listActiveVideos, getKnownKinds, deactivateVideos, upsertVideos } from "./db/videos";
import { listSlotSnapshots, saveFailedSnapshots, saveOkSnapshots } from "./db/snapshots";
import { isWithinVideoWindow, reportSlotFor } from "./time";
import type { ReportSlot, Video, VideoSnapshot } from "./types";
import { collectRecentVideos, fetchVideoDetails, type VideoWithStats } from "./youtube/videos";

export type SyncResult = {
  items: VideoWithStats[]; // 유튜브에서 읽은 최근 14일 영상
  added: string[]; // 새로 저장한 영상 ID
  removed: string[]; // 14일이 지나 대상에서 뺀 영상 ID
};

export type CollectResult =
  | { status: "skipped"; reason: string } // 수집 시각 창 밖이라 저장하지 않음
  | { status: "done"; date: string; slot: ReportSlot; ok: number; failed: number; added: number; removed: number }
  | { status: "failed"; date: string; slot: ReportSlot; failed: number; message: string };

// 14일 이내인 영상으로 목록을 맞춘다: 새 영상은 추가하고, 14일이 지난 영상은 뺀다.
// 월요일 갱신과 매 수집에서 같이 쓴다 (같은 영상은 한 번만 저장됨).
export async function syncVideos(now: Date): Promise<SyncResult> {
  const known = await getKnownKinds();
  const items = await collectRecentVideos(now, known);
  await upsertVideos(items.map((i) => i.video));

  const active = await listActiveVideos();
  const removed = active
    .filter((v) => !isWithinVideoWindow(new Date(v.uploadedAt), now))
    .map((v) => v.id);
  await deactivateVideos(removed);

  const added = items.filter((i) => !known.has(i.video.id)).map((i) => i.video.id);
  return { items, added, removed };
}

function snapshot(
  video: Video,
  now: Date,
  date: string,
  slot: ReportSlot,
  stats?: { viewCount: number | null; commentCount: number | null },
): VideoSnapshot {
  const hasValues = stats && stats.viewCount !== null && stats.commentCount !== null;
  return {
    videoId: video.id,
    collectedAt: now.toISOString(),
    reportDate: date,
    reportSlot: slot,
    status: hasValues ? "ok" : "failed",
    // 실패한 값은 채우지 않는다
    viewCount: hasValues ? stats.viewCount : null,
    commentCount: hasValues ? stats.commentCount : null,
  };
}

// 14일 이내인 집계 대상 영상 (저장소 기준)
async function activeInWindow(now: Date): Promise<Video[]> {
  return (await listActiveVideos()).filter((v) => isWithinVideoWindow(new Date(v.uploadedAt), now));
}

// 하루 3회 수집. 수집 시각 창(09:30~09:59 등) 밖이면 저장하지 않는다.
export async function runCollect(now: Date): Promise<CollectResult> {
  const where = reportSlotFor(now);
  if (!where) return { status: "skipped", reason: "수집 시각 창 밖이라 저장하지 않았습니다." };
  const { date, slot } = where;

  let sync: SyncResult;
  try {
    sync = await syncVideos(now);
  } catch (error) {
    // 유튜브나 저장소를 읽지 못함: 대상 영상 모두 "수집 실패"로 남기고 (이미 성공한 기록은 보존)
    const targets = await activeInWindow(now);
    await saveFailedSnapshots(targets.map((v) => snapshot(v, now, date, slot)));
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { status: "failed", date, slot, failed: targets.length, message };
  }

  const seen = new Set(sync.items.map((i) => i.video.id));
  const okRows: VideoSnapshot[] = [];
  const failedRows: VideoSnapshot[] = [];
  for (const item of sync.items) {
    const row = snapshot(item.video, now, date, slot, item);
    (row.status === "ok" ? okRows : failedRows).push(row);
  }
  // 대상인데 유튜브 응답에 없는 영상(비공개·삭제 등)도 실패로 남긴다
  for (const v of await activeInWindow(now)) {
    if (!seen.has(v.id)) failedRows.push(snapshot(v, now, date, slot));
  }

  await saveOkSnapshots(okRows);
  await saveFailedSnapshots(failedRows);
  return {
    status: "done",
    date,
    slot,
    ok: okRows.length,
    failed: failedRows.length,
    added: sync.added.length,
    removed: sync.removed.length,
  };
}

// 실패한 영상만 다시 받는다 (수집 5분 뒤 자동 실행)
export async function runRetry(now: Date): Promise<CollectResult> {
  const where = reportSlotFor(now);
  if (!where) return { status: "skipped", reason: "수집 시각 창 밖이라 다시 시도하지 않았습니다." };
  const { date, slot } = where;

  const done = new Set(
    (await listSlotSnapshots(date, slot)).filter((s) => s.status === "ok").map((s) => s.videoId),
  );
  const targets = (await activeInWindow(now)).filter((v) => !done.has(v.id));
  if (targets.length === 0) return { status: "done", date, slot, ok: 0, failed: 0, added: 0, removed: 0 };

  try {
    const known = new Map(targets.map((v) => [v.id, v.kind]));
    const items = await fetchVideoDetails(targets.map((v) => v.id), known);
    const byId = new Map(items.map((i) => [i.video.id, i]));
    const okRows: VideoSnapshot[] = [];
    const failedRows: VideoSnapshot[] = [];
    for (const v of targets) {
      const row = snapshot(v, now, date, slot, byId.get(v.id));
      (row.status === "ok" ? okRows : failedRows).push(row);
    }
    await saveOkSnapshots(okRows);
    await saveFailedSnapshots(failedRows);
    return { status: "done", date, slot, ok: okRows.length, failed: failedRows.length, added: 0, removed: 0 };
  } catch (error) {
    await saveFailedSnapshots(targets.map((v) => snapshot(v, now, date, slot)));
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return { status: "failed", date, slot, failed: targets.length, message };
  }
}
