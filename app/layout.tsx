import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
