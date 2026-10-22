import type { Metadata } from "next";
import { Suspense } from "react";
import ReportView from "./report-view";
import SiteHeader from "./site-header";

// 같은 위치의 layout 제목 틀(template)은 이 페이지에 적용되지 않아 전체 제목을 직접 적는다
export const metadata: Metadata = { title: "숫자 | 재정경제부 유튜브 모니터링" };

// 숫자 화면: 보고 시각별 영상 조회수·댓글 수와 직전 대비 증가량
export default function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <SiteHeader current="numbers" />
      {/* 저장소에서 읽는 부분은 요청 때마다 가져오므로 Suspense로 감싼다 */}
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <ReportView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
