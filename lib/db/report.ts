// 숫자 화면에 필요한 저장 값 읽기 (서버 전용).
import { previousReportSlot } from "../time";
import type { ChannelSnapshot, ReportSlot, Video, VideoKind, VideoSnapshot } from "../types";
import { getChannelSnapshot } from "./channel";
import { dbError, getDb } from "./client";
import { listSlotSnapshots } from "./snapshots";

export type ReportData = {
  date: string;
  slot: ReportSlot;
  snapshots: VideoSnapshot[]; // 이 보고 시각의 영상별 기록
  previous: VideoSnapshot[]; // 직전 보고 시각의 영상별 기록
  previousSlot: { date: string; slot: ReportSlot }; // 실제로 비교에 쓴 직전 보고 시각
  previousCollected: boolean; // 직전 보고 시각에 수집이 실제로 있었는지
  videos: Map<string, Video>;
  channel: ChannelSnapshot | null; // 이 보고 시각의 구독자 기록 (없으면 null)
};

// 기록이 있는 보고 날짜 (최신순)
export async function listReportDates(limit = 30): Promise<string[]> {
  const { data, error } = await getDb()
    .from("video_snapshots")
    .select("report_date")
    .order("report_date", { ascending: false })
    .limit(1000);
  if (error) throw dbError("보고 날짜 읽기", error);
  return [...new Set((data ?? []).map((r) => r.report_date as string))].slice(0, limit);
}

// 가장 최근 보고 시각 (기록이 없으면 null)
export async function getLatestReportSlot(): Promise<{ date: string; slot: ReportSlot } | null> {
  const { data, error } = await getDb()
    .from("video_snapshots")
    .select("report_date, report_slot")
    .order("report_date", { ascending: false })
    .order("report_slot", { ascending: false })
    .limit(1);
  if (error) throw dbError("최근 보고 시각 읽기", error);
  const row = data?.[0];
  return row ? { date: row.report_date as string, slot: row.report_slot as ReportSlot } : null;
}

export async function getReportData(date: string, slot: ReportSlot): Promise<ReportData> {
  let prevSlot = previousReportSlot(date, slot);
  const [snapshots, firstTry] = await Promise.all([
    listSlotSnapshots(date, slot),
    listSlotSnapshots(prevSlot.date, prevSlot.slot),
  ]);
  let previous = firstTry;
  // 하루 3회에서 하루 1회로 바뀌는 날에는 전날의 마지막 기록이 17:00이라, 하루의 첫 보고 시각은 전날의 다른 마지막 시각도 살펴본다
  if (previous.length === 0 && (slot === "10:00" || slot === "16:00")) {
    const other: ReportSlot = prevSlot.slot === "16:00" ? "17:00" : "16:00";
    const second = await listSlotSnapshots(prevSlot.date, other);
    if (second.length > 0) {
      prevSlot = { date: prevSlot.date, slot: other };
      previous = second;
    }
  }

  const ids = [...new Set(snapshots.map((s) => s.videoId))];
  const videos = new Map<string, Video>();
  if (ids.length > 0) {
    const { data, error } = await getDb().from("videos").select("*").in("id", ids);
    if (error) throw dbError("영상 읽기", error);
    for (const r of data ?? []) {
      videos.set(r.id as string, {
        id: r.id as string,
        title: r.title as string,
        description: r.description as string,
        kind: r.kind as VideoKind,
        uploadedAt: r.uploaded_at as string,
        active: r.active as boolean,
      });
    }
  }

  const channel = await getChannelSnapshot(date, slot);

  return { date, slot, snapshots, previous, previousSlot: prevSlot, previousCollected: previous.length > 0, videos, channel };
}
