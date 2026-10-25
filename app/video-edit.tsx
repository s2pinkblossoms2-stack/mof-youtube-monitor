"use client";

import { useActionState, useState } from "react";
import { resetVideoCounts, saveVideoCounts, type EditState } from "./report-actions";

export type VideoEditSlot = {
  views: number | null; // 지금 화면에 보이는 값 (고친 값이 있으면 고친 값)
  comments: number | null;
  manualBy: string | null; // 고친 값이면 고친 사람
  autoViews: number | null; // 고친 값일 때 자동 수집한 원래 값
  autoComments: number | null;
};

export type VideoEditOption = {
  videoId: string;
  title: string;
  slots: Record<string, VideoEditSlot | undefined>; // "10:00" 등 → 그 보고 시각의 값 (기록이 없으면 undefined)
};

type Props = { date: string; slotNames: string[]; videos: VideoEditOption[] };

const INITIAL: EditState = { ok: false, message: "" };
const number = new Intl.NumberFormat("ko-KR");

// 조회수·댓글 수 고치기: 담당자가 유튜브 스튜디오 숫자와 대조해 보고 다르면 고친다.
// 고친 값은 화면과 PDF에 쓰이고, 자동 수집한 원래 값은 지워지지 않으며 언제든 되돌릴 수 있다.
export default function VideoEdit({ date, slotNames, videos }: Props) {
  const [slot, setSlot] = useState(slotNames[slotNames.length - 1] ?? "17:00");
  const [videoId, setVideoId] = useState(videos[0]?.videoId ?? "");
  const [saveState, saveAction, saving] = useActionState(saveVideoCounts, INITIAL);
  const [resetState, resetAction, resetting] = useActionState(resetVideoCounts, INITIAL);
  const message = saveState.message || resetState.message;
  const failed = (saveState.message && !saveState.ok) || (resetState.message && !resetState.ok);

  const video = videos.find((v) => v.videoId === videoId) ?? videos[0];
  const cell = video?.slots[slot];

  return (
    <details className="rounded-2xl border border-brand-line bg-white p-5 text-sm">
      <summary className="cursor-pointer text-base font-bold text-brand">조회수·댓글 수 고치기 (유튜브 스튜디오와 대조한 뒤)</summary>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1">
            <span className="block text-xs text-muted">보고 시각</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className="rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink">
              {slotNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[16rem] flex-1 space-y-1">
            <span className="block text-xs text-muted">영상</span>
            <select value={videoId} onChange={(e) => setVideoId(e.target.value)} className="w-full rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink">
              {videos.map((v) => (
                <option key={v.videoId} value={v.videoId}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!cell ? (
          <p className="text-muted">이 영상은 {slot}에 수집된 기록이 없어 고칠 수 없습니다.</p>
        ) : (
          <>
            {cell.manualBy && (
              <p className="text-amber-800">
                관리자가 고친 값입니다 ({cell.manualBy}) · 자동 수집값 조회수 {cell.autoViews === null ? "없음(수집 실패)" : number.format(cell.autoViews)} / 댓글 수{" "}
                {cell.autoComments === null ? "없음(수집 실패)" : number.format(cell.autoComments)}
              </p>
            )}
            <form action={saveAction} key={`${slot}-${videoId}-${cell.views}-${cell.comments}`} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="slot" value={slot} />
              <input type="hidden" name="videoId" value={videoId} />
              <label className="space-y-1">
                <span className="block text-xs text-muted">조회수 (스튜디오 숫자)</span>
                <input name="views" required inputMode="numeric" defaultValue={cell.views ?? ""} className="w-36 rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink" />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted">댓글 수 (스튜디오 숫자)</span>
                <input name="comments" required inputMode="numeric" defaultValue={cell.comments ?? ""} className="w-32 rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink" />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-muted">고치는 사람 이름</span>
                <input name="name" required maxLength={30} className="w-32 rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink" />
              </label>
              <button type="submit" disabled={saving} className="rounded-full bg-brand px-4 py-1.5 text-white disabled:opacity-50">
                {saving ? "저장하는 중…" : "고친 값 저장"}
              </button>
            </form>
            {cell.manualBy && (
              <form action={resetAction}>
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="slot" value={slot} />
                <input type="hidden" name="videoId" value={videoId} />
                <button type="submit" disabled={resetting} className="rounded-full border border-brand-line bg-white px-4 py-1.5 text-ink hover:bg-brand-soft disabled:opacity-50">
                  자동 수집한 값으로 되돌리기
                </button>
              </form>
            )}
          </>
        )}
        <p aria-live="polite" className={failed ? "text-red-600" : "text-green-700"}>
          {message}
        </p>
        <p className="text-xs text-muted">
          고친 값은 이 보고 시각의 화면·증가량·하루 증감·PDF에 쓰이며(숫자 옆에 *), 자동 수집한 원래 값은 지워지지 않습니다. 조회수와 댓글 수는 함께 고칩니다.
        </p>
      </div>
    </details>
  );
}
