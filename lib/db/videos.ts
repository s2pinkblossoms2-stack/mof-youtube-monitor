// videos 표 읽기·쓰기 (서버 전용).
import type { Video, VideoKind } from "../types";
import { dbError, getDb } from "./client";

type VideoRow = {
  id: string;
  title: string;
  description: string;
  kind: VideoKind;
  uploaded_at: string;
  active: boolean;
};

function toVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    uploadedAt: row.uploaded_at,
    active: row.active,
  };
}

// 저장된 모든 영상의 구분(롱폼/쇼츠). 새 영상만 쇼츠 여부를 확인하는 데 쓴다.
export async function getKnownKinds(): Promise<Map<string, VideoKind>> {
  const { data, error } = await getDb().from("videos").select("id, kind");
  if (error) throw dbError("영상 구분 읽기", error);
  return new Map((data ?? []).map((r) => [r.id as string, r.kind as VideoKind]));
}

// 집계 대상(active) 영상 목록
export async function listActiveVideos(): Promise<Video[]> {
  const { data, error } = await getDb().from("videos").select("*").eq("active", true);
  if (error) throw dbError("대상 영상 읽기", error);
  return (data as VideoRow[] ?? []).map(toVideo);
}

// 같은 영상은 한 번만 저장한다 (이미 있으면 제목·설명 등을 갱신)
export async function upsertVideos(videos: Video[]): Promise<void> {
  if (videos.length === 0) return;
  const rows: VideoRow[] = videos.map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    kind: v.kind,
    uploaded_at: v.uploadedAt,
    active: v.active,
  }));
  const { error } = await getDb().from("videos").upsert(rows, { onConflict: "id" });
  if (error) throw dbError("영상 저장", error);
}

// 14일이 지난 영상을 집계 대상에서 뺀다 (삭제하지 않고 active만 끈다)
export async function deactivateVideos(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getDb().from("videos").update({ active: false }).in("id", ids);
  if (error) throw dbError("영상 제외", error);
}
