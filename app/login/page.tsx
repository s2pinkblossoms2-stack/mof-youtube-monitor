import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "로그인" };

type Params = Promise<Record<string, string | string[] | undefined>>;

// 주소의 "돌아갈 곳(next)"은 요청 때 읽는 값이라 Suspense 안에서 읽는다
async function LoginFormWithNext({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <LoginForm next={next ?? "/report"} />;
}

// 로그인 화면: 공유 비밀번호를 입력해야 숫자·댓글 화면을 볼 수 있다
export default function LoginPage({ searchParams }: { searchParams: Params }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">재정경제부 유튜브 모니터링 서비스</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">담당자 공유 비밀번호를 입력해 주세요.</p>
      <Suspense fallback={<p className="text-zinc-500">불러오는 중…</p>}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
