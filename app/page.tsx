import { Suspense } from "react";
import ReportView from "./report-view";

// 숫자 화면: 보고 시각별 영상 조회수·댓글 수와 직전 대비 증가량
export default function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">재정경제부 유튜브 모니터링 서비스</h1>
      {/* 저장소에서 읽는 부분은 요청 때마다 가져오므로 Suspense로 감싼다 */}
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <ReportView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
