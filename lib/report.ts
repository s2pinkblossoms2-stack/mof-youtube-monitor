// 숫자 화면에 보여줄 줄 만들기: 영상별 값과 직전 보고 시각 대비 증가량.
import { calcDelta, type Delta, type Metric } from "./delta";
import type { ReportData } from "./db/report";
import type { ChannelSnapshot, Video, VideoSnapshot } from "./types";

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

// 구독자 수 칸에 보여줄 값: 관리자가 고친 값이 있으면 그 값, 없으면 자동 수집한 값
export type ShownSubscribers =
  | { kind: "none" } // 이 보고 시각에 수집 기록이 없음
  | { kind: "failed" } // 수집 실패 (고친 값도 없음)
  | { kind: "auto"; value: number }
  | { kind: "manual"; value: number; by: string; at: string | null; autoValue: number | null };

export function shownSubscribers(channel: ChannelSnapshot | null): ShownSubscribers {
  if (channel === null) return { kind: "none" };
  if (channel.manualCount !== null) {
    return {
      kind: "manual",
      value: channel.manualCount,
      by: channel.manualBy ?? "",
      at: channel.manualAt,
      autoValue: channel.status === "ok" ? channel.subscriberCount : null,
    };
  }
  if (channel.status === "failed" || channel.subscriberCount === null) return { kind: "failed" };
  return { kind: "auto", value: channel.subscriberCount };
}

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
