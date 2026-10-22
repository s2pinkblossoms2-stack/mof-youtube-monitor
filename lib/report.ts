// 숫자 화면에 보여줄 줄 만들기: 영상별 값과 직전 보고 시각 대비 증가량.
import { calcDelta, type Delta, type Metric } from "./delta";
import type { ReportData } from "./db/report";
import type { Video, VideoSnapshot } from "./types";

export type ReportRow = {
  video: Video;
  failed: boolean; // 이 보고 시각 수집이 실패했는지
  viewCount: number | null;
  commentCount: number | null;
  viewDelta: Delta;
  commentDelta: Delta;
};

export type ReportSummary = {
  rows: ReportRow[];
  okCount: number;
  failedCount: number;
  collectedAt: string | null; // 이 보고 시각의 가장 늦은 수집 시각
};

function metric(snapshot: VideoSnapshot | undefined, pick: (s: VideoSnapshot) => number | null): Metric {
  if (!snapshot) return undefined;
  const value = pick(snapshot);
  return snapshot.status === "ok" && value !== null ? { status: "ok", value } : { status: "failed" };
}

export function buildReport(data: ReportData): ReportSummary {
  const prevById = new Map(data.previous.map((s) => [s.videoId, s]));
  const rows: ReportRow[] = [];
  for (const s of data.snapshots) {
    const video = data.videos.get(s.videoId);
    if (!video) continue;
    const prev = prevById.get(s.videoId);
    rows.push({
      video,
      failed: s.status === "failed",
      viewCount: s.viewCount,
      commentCount: s.commentCount,
      viewDelta: calcDelta(metric(s, (x) => x.viewCount), metric(prev, (x) => x.viewCount), data.previousCollected),
      commentDelta: calcDelta(
        metric(s, (x) => x.commentCount),
        metric(prev, (x) => x.commentCount),
        data.previousCollected,
      ),
    });
  }
  // 최근 업로드한 영상이 위로
  rows.sort((a, b) => b.video.uploadedAt.localeCompare(a.video.uploadedAt));
  const collected = data.snapshots.map((s) => s.collectedAt).sort();
  return {
    rows,
    okCount: rows.filter((r) => !r.failed).length,
    failedCount: rows.filter((r) => r.failed).length,
    collectedAt: collected.length ? collected[collected.length - 1] : null,
  };
}
