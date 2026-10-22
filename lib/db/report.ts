// 숫자 화면에 필요한 저장 값 읽기 (서버 전용).
import { previousReportSlot } from "../time";
import type { ChannelSnapshot, ReportSlot, SnapshotStatus, Video, VideoKind, VideoSnapshot } from "../types";
import { dbError, getDb } from "./client";
import { listSlotSnapshots } from "./snapshots";

export type ReportData = {
  date: string;
  slot: ReportSlot;
  snapshots: VideoSnapshot[]; // 이 보고 시각의 영상별 기록
  previous: VideoSnapshot[]; // 직전 보고 시각의 영상별 기록
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
  const prevSlot = previousReportSlot(date, slot);
  const [snapshots, previous] = await Promise.all([
    listSlotSnapshots(date, slot),
    listSlotSnapshots(prevSlot.date, prevSlot.slot),
  ]);

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

  const ch = await getDb()
    .from("channel_snapshots")
    .select("*")
    .eq("report_date", date)
    .eq("report_slot", slot)
    .maybeSingle();
  if (ch.error) throw dbError("구독자 기록 읽기", ch.error);
  const channel: ChannelSnapshot | null = ch.data
    ? {
        collectedAt: ch.data.collected_at as string,
        reportDate: ch.data.report_date as string,
        reportSlot: ch.data.report_slot as ReportSlot,
        status: ch.data.status as SnapshotStatus,
        subscriberCount: ch.data.subscriber_count === null ? null : Number(ch.data.subscriber_count),
      }
    : null;

  return { date, slot, snapshots, previous, previousCollected: previous.length > 0, videos, channel };
}
