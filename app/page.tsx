// 메인 화면: 재정경제부 최신 영상 썸네일이 둥글게 흐르는 소개 화면. 로그인 없이 누구나 볼 수 있고,
// 숫자·댓글·엑셀은 아래 버튼으로 로그인한 뒤 들어간다.
import type { Metadata } from "next";
import { Noto_Sans_KR, Nanum_Pen_Script } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { getLatestVideos, type LatestVideo } from "@/lib/youtube/latest";
import HeroStage from "./hero-stage";
import LatestCarousel from "./latest-carousel";

const sans = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700", "800"], display: "swap" });
const hand = Nanum_Pen_Script({ subsets: ["latin"], weight: "400", display: "swap" });

// 메인(/)만 검색에 나오게 연다. 나머지 화면은 layout.tsx의 noindex를 그대로 따른다.
export const metadata: Metadata = {
  title: { absolute: "재정경제부 유튜브 모니터링 | 영상 조회수·댓글 수 매일 16시 기록과 질문 댓글 답글 초안" },
  description:
    "재정경제부 공식 유튜브 영상의 조회수·댓글 수를 매일 오후 4시(16시)에 기록하고, 시청자 질문 댓글에는 존댓말 답글 초안을 제안합니다. 홍보 담당자용 서비스입니다. 지금 로그인해서 영상별 증가량과 PDF 보고 자료를 바로 확인해 보세요. 자동 게시는 하지 않습니다.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};

const CHANNEL_URL = "https://www.youtube.com/channel/UCnrPF6de3KuHZy3c2ZkqcMA";
const BLUE = "#083891"; // 재정경제부 누리집의 진한 파랑(primary-70)

// 재정경제부 로고 (재정경제부 누리집의 로고 파일을 public/mofe-logo.svg에 두고 쓴다, 가로 167 : 세로 48)
function MofeLogo({ height }: { height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/mofe-logo.svg" alt="재정경제부" height={height} width={Math.round((height * 167) / 48)} style={{ height, width: "auto" }} />
  );
}

// 최신 영상을 불러와 캐러셀에 넘긴다. 불러오지 못하면 빈 카드로 두어 화면이 깨지지 않는다.
async function Carousel({ mode }: { mode: "desktop" | "phone" }) {
  let videos: LatestVideo[] = [];
  try {
    videos = await getLatestVideos(10);
  } catch (error) {
    console.error("최신 영상 불러오기 실패:", error instanceof Error ? error.message : error);
  }
  return <LatestCarousel videos={videos} mode={mode} />;
}

export default function Home() {
  return (
    <div className={`${sans.className} min-h-screen w-full bg-white text-[#1E2124]`} style={{ colorScheme: "light" }}>
      {/* ───────── 컴퓨터 화면: 1440×1080 판을 화면에 맞춰 보여 준다 ───────── */}
      <div className="hidden min-h-screen items-center justify-center overflow-hidden min-[821px]:flex">
        <HeroStage>
          {/* 윗줄 */}
          <div className="hero-nav absolute left-[37px] top-[24px] flex items-center gap-3 text-[17px] font-bold" style={{ color: BLUE }}>
            <MofeLogo height={48} />
            <span className="h-[22px] w-px bg-[#B1CEFB]" aria-hidden="true" />
            유튜브 모니터링
          </div>
          <nav aria-label="바로가기" className="hero-nav absolute top-[38px] flex gap-[31px] text-[16.4px] font-medium text-[#1E2124]" style={{ left: 565 }}>
            <Link href="/report" className="hover:underline">숫자 보고</Link>
            <Link href="/comments" className="hover:underline">댓글 응대</Link>
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">공식 채널</a>
          </nav>
          <Link href="/login" className="hero-nav absolute left-[1211px] top-[29px] flex h-[40px] w-[92px] items-center justify-center rounded-full border border-[#B1CEFB] bg-white text-[15px] font-medium text-[#1E2124]">
            로그인
          </Link>
          <Link href="/report" className="hero-nav absolute left-[1304px] top-[29px] flex h-[40px] w-[97px] items-center justify-center rounded-full text-[15px] font-medium text-white" style={{ background: BLUE }}>
            시작하기
          </Link>

          {/* 배지 */}
          <div className="hero-badge absolute left-[540px] top-[115px] flex h-[37px] w-[360px] items-center justify-center rounded-full bg-[#D8E5FD] text-[16.6px] font-medium" style={{ color: BLUE }}>
            재정경제부 공식 유튜브 최신 영상
          </div>

          {/* 큰 제목 */}
          <h1 className="absolute left-0 top-[176px] w-[1440px] text-center text-[88px] font-bold leading-[92px]">
            <span className="hero-line1 block" style={{ letterSpacing: "-0.035em" }}>재정경제부 유튜브를</span>
            <span className="hero-line2 block" style={{ letterSpacing: "-0.022em" }}>한눈에, 숫자로</span>
          </h1>

          {/* 설명 */}
          <p className="hero-sub absolute left-0 top-[394px] w-[1440px] text-center text-[20.8px] leading-[32px] text-[#464C53]">
            조회수와 댓글 수를 매일 오후 4시에 기록하고,
            <br />
            시청자 질문에는 답글 초안까지 제안해
            <br />
            담당자의 보고 업무를 가볍게 해 드립니다.
          </p>

          {/* 손글씨 메모와 낙서 */}
          <svg className="absolute left-[263px] top-[377px]" width="50" height="40" viewBox="0 0 50 40" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path className="hero-draw" d="M14 4 L4 34" />
            <path className="hero-draw" d="M30 4 L20 34" style={{ animationDelay: "1.5s" }} />
          </svg>
          <div className={`${hand.className} hero-note absolute left-[1212px] top-[310px] text-[36px] leading-[34px]`} style={{ color: BLUE, transform: "rotate(16deg)" }}>
            새 영상이
            <br />
            올라왔어요
          </div>
          <svg className="absolute left-[1190px] top-[385px]" width="170" height="170" viewBox="0 0 170 170" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path className="hero-draw" d="M120 8 C150 40 150 95 70 140" />
            <path className="hero-draw" d="M70 140 L92 138 M70 140 L78 118" style={{ animationDelay: "2.2s" }} />
          </svg>
          <div className={`${hand.className} hero-note absolute left-[500px] top-[937px] text-[34px] leading-[30px]`} style={{ color: BLUE, transform: "rotate(-14deg)" }}>
            로그인하면
            <br />
            바로 확인
          </div>
          <svg className="absolute left-[590px] top-[925px]" width="46" height="40" viewBox="0 0 46 40" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path className="hero-draw" d="M4 30 C14 36 30 28 38 12" />
            <path className="hero-draw" d="M38 12 L30 14 M38 12 L40 21" style={{ animationDelay: "2.1s" }} />
          </svg>

          {/* 최신 영상 캐러셀 (위에서 480 떨어진 띠) */}
          <div className="hero-cards absolute left-0 top-[480px]">
            <Suspense fallback={<div style={{ width: 1440, height: 420 }} />}>
              <Carousel mode="desktop" />
            </Suspense>
          </div>

          {/* 버튼 */}
          <div className="hero-button absolute left-[626px] top-[901px] flex h-[74px] w-[190px] items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: BLUE }}>
            <Link href="/report" className="flex h-[58px] w-[172px] items-center justify-center rounded-full text-[18px] font-bold text-white" style={{ background: BLUE }}>
              숫자 보러 가기
            </Link>
          </div>

          <p className="absolute left-0 top-[1030px] w-[1440px] text-center text-[13px] text-[#464C53]">
            재정경제부 공식 유튜브의 공개 영상을 불러옵니다. 재정경제부 홍보 담당자용 업무 도구이며, 재정경제부 공식 누리집이 아닙니다.
          </p>
        </HeroStage>
      </div>

      {/* ───────── 휴대폰 화면 (820px 이하) ───────── */}
      <div className="flex min-h-screen flex-col items-center px-5 pb-8 pt-5 min-[821px]:hidden">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-bold" style={{ color: BLUE }}>
            <MofeLogo height={34} />
            <span className="h-[16px] w-px bg-[#B1CEFB]" aria-hidden="true" />
            유튜브 모니터링
          </div>
          <Link href="/report" className="rounded-full px-4 py-2 text-[14px] font-medium text-white" style={{ background: BLUE }}>
            시작하기
          </Link>
        </div>

        <div className="mt-8 rounded-full bg-[#D8E5FD] px-4 py-2 text-[14px] font-medium" style={{ color: BLUE }}>
          재정경제부 공식 유튜브 최신 영상
        </div>
        {/* 제목(h1)은 컴퓨터 화면 쪽에 하나만 두고, 휴대폰 쪽은 같은 모양의 문단으로 둔다 (페이지당 h1 하나) */}
        <p className="mt-5 text-center font-bold leading-[1.1]" style={{ fontSize: "clamp(34px, 10vw, 56px)", letterSpacing: "-0.03em" }}>
          재정경제부 유튜브를
          <br />
          한눈에, 숫자로
        </p>
        <p className="mt-4 text-center text-[16px] leading-[26px] text-[#464C53]">
          조회수와 댓글 수를 매일 오후 4시에 기록하고,
          <br />
          시청자 질문에는 답글 초안까지 제안해
          <br />
          담당자의 보고 업무를 가볍게 해 드립니다.
        </p>

        <div className="-mx-5 mt-6 w-[calc(100%+2.5rem)]">
          <Suspense fallback={<div className="h-[250px]" />}>
            <Carousel mode="phone" />
          </Suspense>
        </div>

        <Link href="/report" className="mt-6 flex h-[54px] w-[200px] items-center justify-center rounded-full text-[17px] font-bold text-white" style={{ background: BLUE }}>
          숫자 보러 가기
        </Link>
        <p className={`${hand.className} mt-3 text-[26px]`} style={{ color: BLUE }}>
          로그인하면 바로 확인
        </p>
        <Link href="/login" className="mt-2 text-[14px] underline" style={{ color: BLUE }}>
          로그인
        </Link>
        <p className="mt-6 text-center text-[12px] text-[#464C53]">재정경제부 공식 유튜브의 공개 영상을 불러옵니다. 재정경제부 홍보 담당자용 업무 도구이며, 재정경제부 공식 누리집이 아닙니다.</p>
      </div>

      {/* ───────── 서비스 소개 (두 화면 공통, 스크롤하면 보임) ───────── */}
      <section aria-label="서비스 소개" className="mx-auto max-w-[960px] px-5 pb-16 pt-8 min-[821px]:pt-16">
        <div className="grid gap-8 min-[821px]:grid-cols-3">
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: BLUE }}>매일 오후 4시, 숫자를 기록합니다</h2>
            <p className="mt-2 text-[15px] leading-[26px] text-[#464C53]">
              재정경제부 공식 유튜브의 최근 14일 영상에 대해 조회수와 댓글 수를 매일 오후 4시(15시 30분에 수집)에 기록하고, 전날보다 얼마나 늘었는지 보여 드립니다.
            </p>
          </div>
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: BLUE }}>질문 댓글에는 답글 초안을</h2>
            <p className="mt-2 text-[15px] leading-[26px] text-[#464C53]">
              새 댓글 가운데 질문이 있는 댓글에 존댓말 답글 초안을 제안합니다. 초안만 만들며 유튜브에 자동으로 게시하지 않습니다.
            </p>
          </div>
          <div>
            <h2 className="text-[20px] font-bold" style={{ color: BLUE }}>엑셀로 바로 보고</h2>
            <p className="mt-2 text-[15px] leading-[26px] text-[#464C53]">
              기록한 유튜브 조회수·댓글 수·구독자 수를 엑셀 파일로 내려받아 보고 자료에 그대로 쓸 수 있습니다. 로그인이 필요합니다.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
