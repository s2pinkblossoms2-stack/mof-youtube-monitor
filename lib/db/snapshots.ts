// video_snapshots 표 읽기·쓰기 (서버 전용).
import type { ReportSlot, SnapshotStatus, VideoSnapshot } from "../types";
import { dbError, getDb } from "./client";

type SnapshotRow = {
  video_id: string;
  collected_at: string;
  report_date: string;
  report_slot: ReportSlot;
  status: SnapshotStatus;
  view_count: number | null;
  comment_count: number | null;
};

function toRow(s: VideoSnapshot): SnapshotRow {
  return {
    video_id: s.videoId,
    collected_at: s.collectedAt,
    report_date: s.reportDate,
    report_slot: s.reportSlot,
    status: s.status,
    view_count: s.viewCount,
    comment_count: s.commentCount,
  };
}

function toSnapshot(r: SnapshotRow): VideoSnapshot {
  return {
    videoId: r.video_id,
    collectedAt: r.collected_at,
    reportDate: r.report_date,
    reportSlot: r.report_slot,
    status: r.status,
    viewCount: r.view_count === null ? null : Number(r.view_count),
    commentCount: r.comment_count === null ? null : Number(r.comment_count),
  };
}

const CONFLICT = "video_id,report_date,report_slot";

// 성공한 값 저장: 같은 보고 시각의 기존 기록(실패 포함)을 덮어쓴다
export async function saveOkSnapshots(snapshots: VideoSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;
  const { error } = await getDb()
    .from("video_snapshots")
    .upsert(snapshots.map(toRow), { onConflict: CONFLICT });
  if (error) throw dbError("수집 값 저장", error);
}

// 실패 기록 저장: 이미 기록이 있으면 건드리지 않는다 (성공한 값을 실패로 덮어쓰지 않기 위해)
export async function saveFailedSnapshots(snapshots: VideoSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;
  const { error } = await getDb()
    .from("video_snapshots")
    .upsert(snapshots.map(toRow), { onConflict: CONFLICT, ignoreDuplicates: true });
  if (error) throw dbError("수집 실패 기록 저장", error);
}

// 한 보고 시각의 기록 전체
export async function listSlotSnapshots(
  reportDate: string,
  reportSlot: ReportSlot,
): Promise<VideoSnapshot[]> {
  const { data, error } = await getDb()
    .from("video_snapshots")
    .select("*")
    .eq("report_date", reportDate)
    .eq("report_slot", reportSlot);
  if (error) throw dbError("수집 기록 읽기", error);
  return ((data ?? []) as SnapshotRow[]).map(toSnapshot);
}
