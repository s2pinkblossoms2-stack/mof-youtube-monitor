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
  manual_view_count?: number | null;
  manual_comment_count?: number | null;
  manual_by?: string | null;
  manual_at?: string | null;
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
    manual:
      r.manual_view_count != null && r.manual_comment_count != null && r.manual_by && r.manual_at
        ? { viewCount: Number(r.manual_view_count), commentCount: Number(r.manual_comment_count), by: r.manual_by, at: r.manual_at }
        : undefined,
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

// 관리자가 조회수·댓글 수를 고친다. 자동 수집한 원래 값(view_count 등)은 건드리지 않고 고친 값과 고친 사람·시각만 따로 저장한다.
// 고칠 기록이 없으면(그 보고 시각에 수집 기록이 없으면) false를 돌려준다.
export async function saveManualVideoCounts(
  videoId: string,
  reportDate: string,
  reportSlot: ReportSlot,
  viewCount: number,
  commentCount: number,
  by: string,
  now: Date,
): Promise<boolean> {
  const { data, error } = await getDb()
    .from("video_snapshots")
    .update({ manual_view_count: viewCount, manual_comment_count: commentCount, manual_by: by, manual_at: now.toISOString() })
    .eq("video_id", videoId)
    .eq("report_date", reportDate)
    .eq("report_slot", reportSlot)
    .select("id");
  if (error) throw dbError("조회수·댓글 수 고치기", error);
  return (data ?? []).length > 0;
}

// 고친 값을 지워 자동 수집한 값으로 되돌린다
export async function clearManualVideoCounts(videoId: string, reportDate: string, reportSlot: ReportSlot): Promise<void> {
  const { error } = await getDb()
    .from("video_snapshots")
    .update({ manual_view_count: null, manual_comment_count: null, manual_by: null, manual_at: null })
    .eq("video_id", videoId)
    .eq("report_date", reportDate)
    .eq("report_slot", reportSlot);
  if (error) throw dbError("조회수·댓글 수 되돌리기", error);
}
