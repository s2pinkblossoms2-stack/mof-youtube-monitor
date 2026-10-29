// 영상 목록 갱신과 조회수·댓글 수 수집 (서버 전용).
// 규칙(PRD 5장 must 1): 14일 이내 영상만, 유튜브 값 그대로 저장, 실패는 채우지 않고 "수집 실패"로 기록.
import { getChannelSnapshot, saveFailedChannelSnapshot, saveOkChannelSnapshot } from "./db/channel";
import { listActiveVideos, getKnownKinds, deactivateVideos, upsertVideos } from "./db/videos";
import { listSlotSnapshots, saveFailedSnapshots, saveOkSnapshots } from "./db/snapshots";
import { isWithinVideoWindow, reportSlotFor } from "./time";
import type { ReportSlot, Video, VideoSnapshot } from "./types";
import { fetchExactSubscriberCount } from "./youtube/subscribers";
import { collectRecentVideos, fetchVideoDetails, type VideoWithStats } from "./youtube/videos";

export type SyncResult = {
  items: VideoWithStats[]; // 유튜브에서 읽은 최근 14일 영상
  added: string[]; // 새로 저장한 영상 ID
  removed: string[]; // 14일이 지나 대상에서 뺀 영상 ID
};

type VideoCollectResult =
  | { status: "skipped"; reason: string } // 수집 시각 창 밖이라 저장하지 않음
  | { status: "done"; date: string; slot: ReportSlot; ok: number; failed: number; added: number; removed: number }
  | { status: "failed"; date: string; slot: ReportSlot; failed: number; message: string };

// 영상 수집 결과에 구독자 수 수집 결과(channel)를 함께 담는다
export type CollectResult = VideoCollectResult & { channel?: "ok" | "failed" };

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

// 구독자 수 수집: 정확값을 받아 저장하고, 받지 못하면 값을 채우지 않고 "수집 실패"로 남긴다.
async function collectChannel(now: Date, date: string, slot: ReportSlot): Promise<"ok" | "failed"> {
  try {
    const count = await fetchExactSubscriberCount(now);
    await saveOkChannelSnapshot(date, slot, count, now);
    return "ok";
  } catch (error) {
    console.error("구독자 수 수집 실패:", error instanceof Error ? error.message : error);
    try {
      await saveFailedChannelSnapshot(date, slot, now);
    } catch {
      // 실패 기록도 남기지 못하면 응답의 failed 표시로 알린다
    }
    return "failed";
  }
}

// 하루 한 번 수집(영상 + 구독자 수). 수집 시각 창(15:30~16:29) 밖이면 저장하지 않는다.
export async function runCollect(now: Date): Promise<CollectResult> {
  const result = await collectVideos(now);
  const where = reportSlotFor(now);
  if (result.status === "skipped" || !where) return result;
  return { ...result, channel: await collectChannel(now, where.date, where.slot) };
}

// 수집이 제한 시간(기본 50초, 함수 제한 60초보다 짧게) 안에 끝나지 않으면 기다리지 않고 "수집 실패"로 기록한다.
// 함수가 강제로 꺼지면 실패 기록도 남지 않아 그 보고 시각이 조용히 비게 되기 때문이다.
// 이미 성공한 값은 덮어쓰지 않고, 늦게 끝난 수집이 성공 값을 쓰면 그 값이 실패 기록을 대신한다.
export async function runCollectGuarded(
  now: Date,
  limitMs = 50_000,
  run: (now: Date) => Promise<CollectResult> = runCollect,
): Promise<CollectResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), limitMs);
  });
  const result = await Promise.race([run(now), timeout]);
  clearTimeout(timer);
  if (result !== "timeout") return result;

  const where = reportSlotFor(now);
  if (!where) return { status: "skipped", reason: "수집 시각 창 밖이라 저장하지 않았습니다." };
  const { date, slot } = where;
  const targets = await activeInWindow(now);
  await saveFailedSnapshots(targets.map((v) => snapshot(v, now, date, slot)));
  try {
    await saveFailedChannelSnapshot(date, slot, now);
  } catch {
    // 구독자 실패 기록을 남기지 못해도 영상 쪽 결과는 그대로 알린다
  }
  return { status: "failed", date, slot, failed: targets.length, message: "수집이 제한 시간을 넘겨 수집 실패로 기록했습니다.", channel: "failed" };
}

// 5분 뒤 재시도: 실패한 영상과, 아직 성공하지 못한 구독자 수만 다시 받는다.
export async function runRetry(now: Date): Promise<CollectResult> {
  const result = await retryVideos(now);
  const where = reportSlotFor(now);
  if (result.status === "skipped" || !where) return result;
  const current = await getChannelSnapshot(where.date, where.slot);
  if (current?.status === "ok") return { ...result, channel: "ok" };
  return { ...result, channel: await collectChannel(now, where.date, where.slot) };
}

async function collectVideos(now: Date): Promise<VideoCollectResult> {
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

async function retryVideos(now: Date): Promise<VideoCollectResult> {
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
