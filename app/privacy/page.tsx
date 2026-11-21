import type { Metadata } from "next";
import Link from "next/link";
import MofeLogo from "../mofe-logo";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  robots: { index: true, follow: true }, // 구글 앱 확인용으로 로그인 없이 공개한다
};

// 개인정보처리방침: 서비스가 실제로 하는 일만 적는다 (로그인 없이 볼 수 있는 공개 화면).
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-3 text-[17px] font-bold text-brand">
        <MofeLogo height={40} />
        <span aria-hidden="true" className="h-[22px] w-px bg-brand-line" />
        유튜브 모니터링
      </Link>
      <h1 className="mb-2 text-2xl font-bold tracking-[-0.02em]">개인정보처리방침</h1>
      <p className="mb-8 text-sm text-muted">재정경제부 유튜브 모니터링 서비스 (시행일 2026-11-21)</p>

      <div className="space-y-6 text-[15px] leading-7">
        <section>
          <h2 className="mb-1 text-lg font-bold text-brand">1. 서비스 목적</h2>
          <p>
            이 서비스는 재정경제부 공식 유튜브 채널의 영상별 조회수·댓글 수와 구독자 수를 하루 한 번 기록해 보고에 쓰고, 새 댓글 중
            질문에 대한 답글 초안을 담당자에게 제안하기 위한 내부 업무용 도구입니다. 일반 이용자를 대상으로 하지 않으며,
            담당자 공유 비밀번호로 로그인한 사람만 숫자와 댓글 화면을 볼 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-brand">2. 구글 계정 데이터의 이용</h2>
          <p>
            채널 관리자가 허용한 &quot;YouTube 분석 보고서 조회(읽기 전용)&quot; 권한으로 채널의 구독자 증감 통계를 읽어 구독자 수를
            계산합니다. 이 권한으로 영상·댓글을 수정하거나 삭제하지 않으며, 읽은 통계는 구독자 수 기록 외의 목적으로 쓰지 않습니다.
            구글 계정 데이터는 제3자에게 제공하거나 판매하지 않고, 광고에도 쓰지 않습니다. 인증에 쓰는 열쇠(토큰)는 서버의 비밀
            설정에만 보관합니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-brand">3. 수집·보관하는 정보</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>업로드 후 14일 안 영상의 제목·업로드일, 조회수·댓글 수, 채널 구독자 수 (유튜브가 제공한 값 그대로)</li>
            <li>영상에 달린 댓글의 작성자 닉네임, 본문, 작성 시각 (작성 후 14일이 지나면 삭제합니다)</li>
          </ul>
          <p className="mt-2">
            전화번호·이메일 등 개인정보가 들어 있는 댓글은 &quot;개인정보 포함&quot;으로 표시하며, 답글 초안을 만드는 외부 AI 서비스에는
            그런 댓글의 내용을 보내지 않습니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-brand">4. 제3자 제공과 처리 위탁</h2>
          <p>
            정보를 판매하거나 제3자에게 제공하지 않습니다. 서비스 운영을 위해 저장소(Supabase), 호스팅(Vercel), 답글 초안 작성(OpenAI)
            서비스를 이용하며, 답글 초안 작성에는 개인정보가 없는 질문형 댓글 본문만 보냅니다. 답글은 유튜브에 자동으로 게시되지
            않고, 담당자가 확인한 뒤 직접 씁니다.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-brand">5. 권한 철회와 삭제 요청</h2>
          <p>
            채널 관리자는 언제든 구글 계정의 &quot;서드 파티 앱 및 서비스 연결&quot; 화면에서 이 서비스의 접근 권한을 해제할 수 있습니다.
            저장된 정보의 삭제를 원하시면 재정경제부 홍보 담당자에게 요청해 주세요.
          </p>
        </section>
      </div>
    </main>
  );
}
