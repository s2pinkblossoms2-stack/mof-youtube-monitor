// 로그인 뒤 모든 화면 맨 위의 로고·메뉴와 화면 제목 (서버 컴포넌트).
// 모양은 로그인 전 메인 소개 화면과 같다: 흰 바탕, 진한 파랑, 알약 모양 버튼, 연한 파랑 배지.
import Link from "next/link";
import { logout } from "./login/actions";
import MofeLogo from "./mofe-logo";

const MENU = [
  { href: "/report", label: "숫자", key: "numbers" },
  { href: "/comments", label: "댓글", key: "comments" },
] as const;

const PILL = "rounded-full px-5 py-2 text-[15px] font-medium transition-colors";
const PILL_ACTIVE = `${PILL} bg-brand text-white`;
const PILL_IDLE = `${PILL} border border-brand-line bg-white text-ink hover:bg-brand-soft`;

type Props = {
  current: (typeof MENU)[number]["key"];
  title: string; // 화면 제목 (h1)
  subtitle: string; // 제목 아래 설명
};

export default function SiteHeader({ current, title, subtitle }: Props) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="메인 소개 화면으로" className="flex items-center gap-3 text-[17px] font-bold text-brand">
          <MofeLogo height={40} />
          <span aria-hidden="true" className="h-[22px] w-px bg-brand-line" />
          유튜브 모니터링
        </Link>
        <nav aria-label="화면 이동" className="flex flex-wrap items-center gap-2">
          {MENU.map((m) => (
            <Link key={m.key} href={m.href} aria-current={m.key === current ? "page" : undefined} className={m.key === current ? PILL_ACTIVE : PILL_IDLE}>
              {m.label}
            </Link>
          ))}
          <form action={logout}>
            <button type="submit" className={PILL_IDLE}>
              나가기
            </button>
          </form>
        </nav>
      </div>

      <div className="mt-10 text-center">
        <span className="inline-flex h-9 items-center rounded-full bg-brand-soft px-5 text-[15px] font-medium text-brand">
          재정경제부 공식 유튜브
        </span>
        <h1 className="mt-4 text-[32px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[44px]">{title}</h1>
        {/* 설명 글에 줄바꿈(
)이 있으면 그 자리에서 줄을 바꾼다 */}
        <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-[16px] leading-7 text-muted">{subtitle}</p>
      </div>
    </header>
  );
}
