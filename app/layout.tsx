import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

// 메인 소개 화면과 같은 글꼴을 모든 화면에 쓴다
const sans = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "재정경제부 유튜브 모니터링",
    template: "%s | 재정경제부 유튜브 모니터링",
  },
  description: "재정경제부 공식 유튜브 영상의 조회수·댓글 수를 하루 3회 기록하고, 질문 댓글의 답글 초안을 제안하는 담당자용 서비스",
  // 담당자만 쓰는 서비스라 검색 결과에 나오지 않게 한다
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className={`${sans.className} min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
