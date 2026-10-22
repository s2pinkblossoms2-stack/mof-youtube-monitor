"use client";

import { useActionState } from "react";
import { resetSubscriberCount, saveSubscriberCount, type EditState } from "./report-actions";

type Props = {
  date: string;
  slot: string;
  hasManual: boolean; // 이미 고친 값이 있는지 (있으면 되돌리기 버튼을 보여준다)
  initialCount: string; // 입력 칸에 미리 넣을 숫자 (지금 보이는 값)
};

const INITIAL: EditState = { ok: false, message: "" };

// 구독자 수 고치기: 자동 수집한 값이 틀렸을 때 관리자가 고치는 칸
export default function SubscriberEdit({ date, slot, hasManual, initialCount }: Props) {
  const [saveState, saveAction, saving] = useActionState(saveSubscriberCount, INITIAL);
  const [resetState, resetAction, resetting] = useActionState(resetSubscriberCount, INITIAL);
  const message = saveState.message || resetState.message;
  const failed = (saveState.message && !saveState.ok) || (resetState.message && !resetState.ok);

  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">구독자 수 고치기</summary>
      <div className="mt-2 space-y-2">
        <form action={saveAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="slot" value={slot} />
          <label className="space-y-1">
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">고치는 사람 이름</span>
            <input
              name="name"
              required
              maxLength={30}
              className="w-32 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-zinc-600 dark:text-zinc-400">구독자 수 (스튜디오 숫자)</span>
            <input
              name="count"
              required
              inputMode="numeric"
              defaultValue={initialCount}
              className="w-36 rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button type="submit" disabled={saving} className="rounded bg-foreground px-3 py-1 text-background disabled:opacity-50">
            {saving ? "저장하는 중…" : "고친 값 저장"}
          </button>
        </form>
        {hasManual && (
          <form action={resetAction}>
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="slot" value={slot} />
            <button
              type="submit"
              disabled={resetting}
              className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              자동 수집한 값으로 되돌리기
            </button>
          </form>
        )}
        <p aria-live="polite" className={failed ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
          {message}
        </p>
        <p className="text-xs text-zinc-500">고친 값은 이 보고 시각의 화면과 엑셀에 쓰이고, 자동 수집한 원래 값은 지워지지 않습니다.</p>
      </div>
    </details>
  );
}
