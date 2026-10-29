import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "../site-header";
import CommentsView from "./comments-view";

export const metadata: Metadata = { title: "댓글" };

// 댓글 화면: 질문 댓글의 답글 초안과 제외된 댓글
export default function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <SiteHeader current="comments" title="질문 댓글에 답글 초안을" subtitle={"새 댓글 가운데 질문이 있는 댓글의 존댓말 초안입니다.\n초안은 유튜브에 자동으로 올라가지 않습니다."} />
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <CommentsView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
