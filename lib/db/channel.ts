// channel_snapshots 표 읽기·쓰기 (서버 전용).
import type { ChannelSnapshot, ReportSlot, SnapshotStatus } from "../types";
import { dbError, getDb } from "./client";

type Row = {
  collected_at: string;
  report_date: string;
  report_slot: ReportSlot;
  status: SnapshotStatus;
  subscriber_count: number | null;
  manual_count: number | null;
  manual_by: string | null;
  manual_at: string | null;
};

export function toChannelSnapshot(r: Row): ChannelSnapshot {
  const num = (v: number | null) => (v === null ? null : Number(v));
  return {
    collectedAt: r.collected_at,
    reportDate: r.report_date,
    reportSlot: r.report_slot,
    status: r.status,
    subscriberCount: num(r.subscriber_count),
    manualCount: num(r.manual_count),
    manualBy: r.manual_by,
    manualAt: r.manual_at,
  };
}

export async function getChannelSnapshot(date: string, slot: ReportSlot): Promise<ChannelSnapshot | null> {
  const { data, error } = await getDb()
    .from("channel_snapshots")
    .select("*")
    .eq("report_date", date)
    .eq("report_slot", slot)
    .maybeSingle();
  if (error) throw dbError("구독자 기록 읽기", error);
  return data ? toChannelSnapshot(data as Row) : null;
}

// 성공한 값 저장: 같은 보고 시각의 기존 기록(실패 포함)을 덮어쓴다. 관리자가 고친 값(manual_*)은 건드리지 않는다.
export async function saveOkChannelSnapshot(date: string, slot: ReportSlot, count: number, now: Date): Promise<void> {
  const { error } = await getDb()
    .from("channel_snapshots")
    .upsert(
      { report_date: date, report_slot: slot, collected_at: now.toISOString(), status: "ok", subscriber_count: count },
      { onConflict: "report_date,report_slot" },
    );
  if (error) throw dbError("구독자 수 저장", error);
}

// 실패 기록 저장: 이미 기록이 있으면 건드리지 않는다 (성공한 값을 실패로 덮어쓰지 않기 위해)
export async function saveFailedChannelSnapshot(date: string, slot: ReportSlot, now: Date): Promise<void> {
  const { error } = await getDb()
    .from("channel_snapshots")
    .upsert(
      { report_date: date, report_slot: slot, collected_at: now.toISOString(), status: "failed", subscriber_count: null },
      { onConflict: "report_date,report_slot", ignoreDuplicates: true },
    );
  if (error) throw dbError("구독자 수 실패 기록 저장", error);
}

// 관리자가 고친 값 저장. 그 보고 시각의 기록이 없으면 "수집 실패" 기록을 만들고 그 위에 고친 값을 남긴다.
export async function saveManualCount(
  date: string,
  slot: ReportSlot,
  count: number,
  by: string,
  now: Date,
): Promise<void> {
  const db = getDb();
  const manual = { manual_count: count, manual_by: by, manual_at: now.toISOString() };
  const updated = await db
    .from("channel_snapshots")
    .update(manual)
    .eq("report_date", date)
    .eq("report_slot", slot)
    .select("report_date");
  if (updated.error) throw dbError("구독자 수 수정 저장", updated.error);
  if ((updated.data ?? []).length > 0) return;

  const inserted = await db.from("channel_snapshots").upsert(
    {
      report_date: date,
      report_slot: slot,
      collected_at: now.toISOString(),
      status: "failed",
      subscriber_count: null,
      ...manual,
    },
    { onConflict: "report_date,report_slot" },
  );
  if (inserted.error) throw dbError("구독자 수 수정 저장", inserted.error);
}

// 관리자가 고친 값을 지워 자동 수집한 값으로 되돌린다
export async function clearManualCount(date: string, slot: ReportSlot): Promise<void> {
  const { error } = await getDb()
    .from("channel_snapshots")
    .update({ manual_count: null, manual_by: null, manual_at: null })
    .eq("report_date", date)
    .eq("report_slot", slot);
  if (error) throw dbError("구독자 수 수정 취소", error);
}

// 그래프용: 선택한 날짜까지 최근 며칠(기본 7일)의 구독자 기록 (오래된 순)
export async function listChannelSnapshotsUpTo(date: string, dayCount = 7): Promise<ChannelSnapshot[]> {
  const { data, error } = await getDb()
    .from("channel_snapshots")
    .select("*")
    .lte("report_date", date)
    .order("report_date", { ascending: false })
    .limit(dayCount * 3 + 3);
  if (error) throw dbError("구독자 기록 목록 읽기", error);
  const rows = (data ?? []) as Row[];
  const dates = [...new Set(rows.map((r) => r.report_date))].slice(0, dayCount);
  return rows
    .filter((r) => dates.includes(r.report_date))
    .map(toChannelSnapshot)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.reportSlot.localeCompare(b.reportSlot));
}
