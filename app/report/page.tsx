import type { Metadata } from "next";
import { Suspense } from "react";
import ReportView from "../report-view";
import SiteHeader from "../site-header";

// layout의 제목 틀(template)이 뒤에 서비스 이름을 붙이므로 화면 이름만 적는다
export const metadata: Metadata = { title: "숫자" };

// 숫자 화면: 보고 시각별 영상 조회수·댓글 수와 직전 대비 증가량
export default function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <SiteHeader current="numbers" title="영상별 숫자를 한눈에" subtitle="하루의 조회수·댓글 수를 한 화면에서 보고, 전날 17시 대비 하루 증감과 구독자 수 변화를 확인하세요." />
      {/* 저장소에서 읽는 부분은 요청 때마다 가져오므로 Suspense로 감싼다 */}
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <ReportView searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
