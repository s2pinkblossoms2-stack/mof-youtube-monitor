// 하루치 숫자 화면 만들기 (서버 전용): 한 날짜의 보고 시각 값(2026-10-30부터 16:00 하나, 그 전은 10:00 / 14:00 / 17:00)을 한 줄에 모으고,
// 전날 마지막 보고 시각 대비 오늘 마지막 보고 시각의 하루 증감(증감량과 증감률)을 계산한다.
// 저장된 값에서 계산만 하며, 실패하거나 없는 값은 추측하거나 채우지 않는다.
import { ALL_REPORT_SLOTS } from "./constants";
import { slotsForDate } from "./time";
import { calcDelta, type Delta } from "./delta";
import { getReportData } from "./db/report";
import { buildReport, effective, metric } from "./report";
import type { ChannelSnapshot, ReportSlot, Video, VideoSnapshot } from "./types";

// 한 보고 시각 칸: 아직 기록 없음 / 수집 실패 / 값과 직전 보고 시각 대비 증가량
// manual: 관리자가 고친 값이면 고친 사람과 자동 수집한 원래 값
export type SlotCell =
  | { state: "none" }
  | { state: "failed" }
  | { state: "ok"; value: number; delta: Delta; manual?: { by: string; autoValue: number | null } };

// 하루 증감: 전날 마지막 보고 시각 → 오늘 마지막 보고 시각. 오늘 마지막 수집 전이면 pending.
export type DayDelta =
  | { kind: "pending" }
  | { kind: "unavailable" }
  | { kind: "new" }
  | { kind: "change"; value: number; percent: number | null; before: number; after: number };

export type DayRow = {
  video: Video;
  views: Record<ReportSlot, SlotCell>;
  comments: Record<ReportSlot, SlotCell>;
  viewDay: DayDelta;
  commentDay: DayDelta;
};

export type SlotStatus = {
  slot: ReportSlot;
  collectedAt: string | null;
  videoCount: number;
  failedCount: number;
};

export type DayReport = {
  date: string;
  rows: DayRow[];
  slots: SlotStatus[];
  channels: Record<ReportSlot, ChannelSnapshot | null>;
  slotNames: ReportSlot[]; // 이 날짜에 쓰는 보고 시각 (2026-10-30부터 ["16:00"], 그 전 ["10:00","14:00","17:00"])
  finalHour: string; // 이 날의 마지막 보고 시각의 시 ("16시" 등). 하루 증감이 계산되기 시작하는 시각
  compareLabel: string; // 하루 증감의 비교 기준 글자 ("전날 17시 대비" 등)
  dayReady: boolean; // 오늘 마지막 보고 시각 수집이 끝나 하루 증감을 보여줄 수 있는지
};

function emptyCells(): Record<ReportSlot, SlotCell> {
  return Object.fromEntries(ALL_REPORT_SLOTS.map((s) => [s, { state: "none" }])) as Record<ReportSlot, SlotCell>;
}

function dayDelta(
  today: VideoSnapshot | undefined,
  yesterday: VideoSnapshot | undefined,
  yesterdayCollected: boolean,
  pick: (s: VideoSnapshot) => number | null,
): DayDelta {
  const delta = calcDelta(metric(today, pick), metric(yesterday, pick), yesterdayCollected);
  if (delta.kind === "unavailable") return { kind: "unavailable" };
  if (delta.kind === "new") return { kind: "new" };
  const before = yesterday ? pick(effective(yesterday)) : null;
  // 증감률은 전날 값이 0보다 클 때만 계산한다 (0으로 나누지 않음)
  const percent = before !== null && before > 0 ? (delta.value / before) * 100 : null;
  return { kind: "change", value: delta.value, percent, before: before ?? 0, after: (before ?? 0) + delta.value };
}

export async function buildDayReport(date: string): Promise<DayReport> {
  const slotNames = [...slotsForDate(date)];
  const datas = await Promise.all(slotNames.map((slot) => getReportData(date, slot)));
  const reports = datas.map(buildReport);

  const videos = new Map<string, Video>();
  for (const r of reports) for (const row of r.rows) videos.set(row.video.id, row.video);

  const first = datas[0]; // 하루의 첫 보고 시각 자료의 "직전"은 전날의 마지막 보고 시각
  const last = datas[datas.length - 1]; // 하루의 마지막 보고 시각 자료
  const yesterday = new Map(first.previous.map((s) => [s.videoId, s]));
  const today = new Map(last.snapshots.map((s) => [s.videoId, s]));
  const dayReady = last.snapshots.length > 0;

  const rows: DayRow[] = [...videos.values()].map((video) => {
    const views = emptyCells();
    const comments = emptyCells();
    slotNames.forEach((slot, i) => {
      const row = reports[i].rows.find((r) => r.video.id === video.id);
      if (!row) return;
      views[slot] =
        row.failed || row.viewCount === null
          ? { state: "failed" }
          : {
              state: "ok",
              value: row.viewCount,
              delta: row.viewDelta,
              manual: row.manual ? { by: row.manual.by, autoValue: row.manual.autoView } : undefined,
            };
      comments[slot] =
        row.failed || row.commentCount === null
          ? { state: "failed" }
          : {
              state: "ok",
              value: row.commentCount,
              delta: row.commentDelta,
              manual: row.manual ? { by: row.manual.by, autoValue: row.manual.autoComment } : undefined,
            };
    });
    const t = today.get(video.id);
    const y = yesterday.get(video.id);
    return {
      video,
      views,
      comments,
      viewDay: dayReady ? dayDelta(t, y, first.previousCollected, (s) => s.viewCount) : { kind: "pending" },
      commentDay: dayReady ? dayDelta(t, y, first.previousCollected, (s) => s.commentCount) : { kind: "pending" },
    };
  });
  rows.sort((a, b) => b.video.uploadedAt.localeCompare(a.video.uploadedAt));

  const channels = Object.fromEntries(ALL_REPORT_SLOTS.map((s) => [s, null])) as Record<ReportSlot, ChannelSnapshot | null>;
  slotNames.forEach((s, i) => (channels[s] = datas[i].channel));

  return {
    date,
    rows,
    slots: slotNames.map((slot, i) => ({
      slot,
      collectedAt: reports[i].collectedAt,
      videoCount: reports[i].rows.length,
      failedCount: reports[i].failedCount,
    })),
    channels,
    slotNames,
    finalHour: `${Number(last.slot.slice(0, 2))}시`,
    compareLabel: `전날 ${Number(first.previousSlot.slot.slice(0, 2))}시 대비`,
    dayReady,
  };
}
