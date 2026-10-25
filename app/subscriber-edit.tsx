"use client";

import { useActionState, useState } from "react";
import { resetSubscriberCount, saveSubscriberCount, type EditState } from "./report-actions";

export type SlotEditInfo = {
  slot: string; // "10:00" 등
  hasManual: boolean; // 이미 고친 값이 있는지 (있으면 되돌리기 버튼을 보여준다)
  initialCount: string; // 입력 칸에 미리 넣을 숫자 (지금 보이는 값)
};

type Props = {
  date: string;
  slots: SlotEditInfo[];
};

const INITIAL: EditState = { ok: false, message: "" };

// 구독자 수 고치기: 자동 수집한 값이 틀렸을 때 관리자가 보고 시각을 골라 고치는 칸
export default function SubscriberEdit({ date, slots }: Props) {
  const [slot, setSlot] = useState(slots[slots.length - 1]?.slot ?? "17:00");
  const [saveState, saveAction, saving] = useActionState(saveSubscriberCount, INITIAL);
  const [resetState, resetAction, resetting] = useActionState(resetSubscriberCount, INITIAL);
  const message = saveState.message || resetState.message;
  const failed = (saveState.message && !saveState.ok) || (resetState.message && !resetState.ok);
  const info = slots.find((s) => s.slot === slot) ?? slots[0];

  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted">구독자 수 고치기</summary>
      <div className="mt-2 space-y-2">
        <form action={saveAction} key={slot} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="slot" value={slot} />
          <label className="space-y-1">
            <span className="block text-xs text-muted">보고 시각</span>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink"
            >
              {slots.map((s) => (
                <option key={s.slot} value={s.slot}>
                  {s.slot}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">고치는 사람 이름</span>
            <input name="name" required maxLength={30} className="w-32 rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-muted">구독자 수 (스튜디오 숫자)</span>
            <input
              name="count"
              required
              inputMode="numeric"
              defaultValue={info?.initialCount ?? ""}
              className="w-36 rounded-lg border border-brand-line bg-white px-3 py-1.5 text-ink"
            />
          </label>
          <button type="submit" disabled={saving} className="rounded-full bg-brand px-4 py-1.5 text-white disabled:opacity-50">
            {saving ? "저장하는 중…" : "고친 값 저장"}
          </button>
        </form>
        {info?.hasManual && (
          <form action={resetAction}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="slot" value={slot} />
            <button
              type="submit"
              disabled={resetting}
              className="rounded-full border border-brand-line bg-white px-4 py-1.5 text-ink hover:bg-brand-soft disabled:opacity-50"
            >
              {slot} 값을 자동 수집한 값으로 되돌리기
            </button>
          </form>
        )}
        <p aria-live="polite" className={failed ? "text-red-600" : "text-green-700"}>
          {message}
        </p>
        <p className="text-xs text-muted">고친 값은 그 보고 시각의 화면과 엑셀에 쓰이고, 자동 수집한 원래 값은 지워지지 않습니다.</p>
      </div>
    </details>
  );
}
