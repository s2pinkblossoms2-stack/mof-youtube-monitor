import type { Metadata } from "next";
import { Suspense } from "react";
import SiteHeader from "../site-header";
import CommentsView from "./comments-view";

export const metadata: Metadata = { title: "댓글" };

// 댓글 화면: 질문 댓글의 답글 초안과 제외된 댓글
export default function CommentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <SiteHeader current="comments" />
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <CommentsView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
