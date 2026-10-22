"use client";

import { useState } from "react";
import { markDraftCopied } from "./actions";

type Props = {
  commentId: string;
  initialText: string; // 담당자가 전에 고친 글이 있으면 그 글, 없으면 AI 초안
  usedAt: string | null; // 이미 복사한 시각 (화면에 표시할 글자)
  youtubeUrl: string;
};

// 답글 초안 카드의 편집·복사 부분. 자동 게시 기능은 없고, 담당자가 복사해 유튜브에 직접 올린다.
export default function DraftCard({ commentId, initialText, usedAt, youtubeUrl }: Props) {
  const [text, setText] = useState(initialText);
  const [used, setUsed] = useState<string | null>(usedAt);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function copy() {
    setBusy(true);
    setMessage("");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 복사가 안 되면 사용한 것으로 기록하지 않는다
      setMessage("복사하지 못했습니다. 글을 직접 선택해 복사해 주세요.");
      setBusy(false);
      return;
    }
    const result = await markDraftCopied(commentId, text);
    if (result.ok) {
      setUsed("방금 복사함");
      setMessage("복사했습니다. 유튜브에서 직접 게시해 주세요.");
    } else {
      setMessage(`복사는 됐지만 기록하지 못했습니다. ${result.message ?? ""}`);
    }
    setBusy(false);
  }

  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={`draft-${commentId}`} className="text-sm text-zinc-600 dark:text-zinc-400">
        답글 초안 (고쳐 쓸 수 있습니다)
      </label>
      <textarea
        id={`draft-${commentId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full rounded border border-zinc-300 bg-white p-2 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={busy}
          className="rounded bg-foreground px-3 py-1 text-background disabled:opacity-50"
        >
          복사
        </button>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          유튜브에서 열기
        </a>
        {used && <span className="text-sm text-green-700 dark:text-green-400">{used}</span>}
      </div>
      <p className="text-xs text-zinc-500">※ 자동으로 유튜브에 올라가지 않습니다. 복사한 뒤 직접 게시해 주세요.</p>
      <p aria-live="polite" className="text-sm text-zinc-700 dark:text-zinc-300">
        {message}
      </p>
    </div>
  );
}
